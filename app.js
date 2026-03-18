document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    function getLocalLogicalDateStr(dateObj) {
        const d = new Date(dateObj.getTime());
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function createSafeDate(dateStr, timeStr) {
        if (!timeStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        const [h, min] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, h, min);
    }

    async function checkInitialSetup() {
        const localFlag = localStorage.getItem('initSetup_' + user.id);
        if (localFlag === 'true') {
            loadDashboard();
            return;
        }

        const { data } = await supabaseClient.from('health_logs')
            .select('id').eq('user_id', user.id).limit(1);

        if (!data || data.length === 0) {
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
            localStorage.setItem('initSetup_' + user.id, 'true');
            loadDashboard();
        }
    }

    let initMVal = 3;
    document.querySelectorAll('#initMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#initMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            initMVal = b.dataset.v;
        });
    });

    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true;
        btn.innerText = "処理中...";

        try {
            const now = new Date();
            const todayStr = getLocalLogicalDateStr(now);
            const yesterday = new Date(now.getTime());
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const btVal = document.getElementById('initBedtime').value;
            const wtVal = document.getElementById('initWaketime').value;
            const wVal = document.getElementById('initWeight').value;
            const fVal = document.getElementById('initFat').value;
            const noteVal = document.getElementById('initNote').value;

            let bDate = createSafeDate(yesterdayStr, btVal);
            let wDate = createSafeDate(todayStr, wtVal);
            if (wDate <= bDate) wDate.setDate(wDate.getDate() + 1);
            let sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));

            const yestPayload = { user_id: user.id, measured_date: yesterdayStr, bedtime: bDate.toISOString() };
            const { data: yData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
            if (yData) await supabaseClient.from('health_logs').update(yestPayload).eq('id', yData.id);
            else await supabaseClient.from('health_logs').insert(yestPayload);

            const todayPayload = {
                user_id: user.id, measured_date: todayStr,
                waketime: wDate.toISOString(),
                sleep_hours: sleepHours,
                mental_condition: parseInt(initMVal)
            };
            if (wVal) todayPayload.weight = parseFloat(wVal);
            if (fVal) todayPayload.body_fat = parseFloat(fVal);
            if (noteVal) todayPayload.daily_notes = noteVal;

            const { data: tData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            if (tData) await supabaseClient.from('health_logs').update(todayPayload).eq('id', tData.id);
            else await supabaseClient.from('health_logs').insert(todayPayload);

            localStorage.setItem('initSetup_' + user.id, 'true');
            document.getElementById('initialSetupModal').style.display = 'none';
            loadDashboard();
        } catch (err) {
            alert("初期設定エラー: " + err.message);
            btn.disabled = false;
            btn.innerText = "記録して始める";
        }
    });

    async function recordTime(type) {
        try {
            const now = new Date();
            const logicalDateStr = getLocalLogicalDateStr(now);
            const timeISO = now.toISOString();

            const { data: existing } = await supabaseClient
                .from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', logicalDateStr).maybeSingle();

            const payload = existing ? { ...existing } : { user_id: user.id, measured_date: logicalDateStr };

            if (type === 'wake') {
                payload.waketime = timeISO;
                const yesterday = new Date(now.getTime());
                yesterday.setDate(yesterday.getDate() - 1);
                const logicalYesterdayStr = getLocalLogicalDateStr(yesterday);
                
                const { data: prevDay } = await supabaseClient
                    .from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', logicalYesterdayStr).maybeSingle();

                if (prevDay && prevDay.bedtime) {
                    const bt = new Date(prevDay.bedtime);
                    const wt = new Date(timeISO);
                    let diff = (wt - bt) / 3600000;
                    if (diff < 0) diff += 24;
                    payload.sleep_hours = parseFloat(diff.toFixed(1));
                }
            } else if (type === 'bed') {
                payload.bedtime = timeISO;
            }

            let dbErr;
            if (existing && existing.id) {
                const { error } = await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
                dbErr = error;
            } else {
                const { error } = await supabaseClient.from('health_logs').insert(payload);
                dbErr = error;
            }

            if (!dbErr) {
                alert(type === 'bed' ? "就寝時刻を記録しました。" : "起床時刻を記録しました。");
                loadDashboard();
            } else {
                alert("打刻エラー: " + dbErr.message);
            }
        } catch (e) {
            alert("システムエラー: " + e.message);
        }
    }

    document.getElementById('btnBedtime').addEventListener('click', () => recordTime('bed'));
    document.getElementById('btnWaketime').addEventListener('click', () => recordTime('wake'));

    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => mealModal.style.display = 'flex');
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');

    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const type = document.getElementById('quickMealType').value;
        const memo = document.getElementById('quickMealMemo').value;
        if (!memo) return;

        const logicalDateStr = getLocalLogicalDateStr(new Date());
        const { error } = await supabaseClient.from('meal_logs').insert({
            user_id: user.id, meal_date: logicalDateStr, meal_type: type, content: memo
        });

        if (!error) {
            mealModal.style.display = 'none';
            document.getElementById('quickMealMemo').value = '';
            alert("食事を記録しました。");
        }
    });

    // 「**値が入っている最新のレコードを探すように修正**」
    async function loadDashboard() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayStr = getLocalLogicalDateStr(firstDay);
        
        // 体重の最新値を取得
        const { data: wData } = await supabaseClient.from('health_logs')
            .select('weight').eq('user_id', user.id).not('weight', 'is', null).order('measured_date', { ascending: false }).limit(1);
        if (wData && wData.length > 0) document.getElementById('latestWeight').innerText = wData[0].weight.toFixed(1) + " kg";

        // 睡眠の最新値を取得
        const { data: sData } = await supabaseClient.from('health_logs')
            .select('sleep_hours').eq('user_id', user.id).not('sleep_hours', 'is', null).order('measured_date', { ascending: false }).limit(1);
        if (sData && sData.length > 0) document.getElementById('latestSleep').innerText = sData[0].sleep_hours.toFixed(1) + " h";

        // メンタルの最新値を取得
        const { data: mData } = await supabaseClient.from('health_logs')
            .select('mental_condition').eq('user_id', user.id).not('mental_condition', 'is', null).order('measured_date', { ascending: false }).limit(1);
        if (mData && mData.length > 0) document.getElementById('latestMental').innerText = mentalLabels[mData[0].mental_condition - 1];

        // 今月の計測日数
        const { count } = await supabaseClient.from('health_logs')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('measured_date', firstDayStr);
        document.getElementById('monthCount').innerText = (count || 0) + " 日";

        // グラフデータの取得
        const { data: chartData } = await supabaseClient.from('health_logs')
            .select('measured_date, weight, sleep_hours').eq('user_id', user.id).order('measured_date', { ascending: true }).limit(7);
        if (chartData) renderChart(chartData);
    }

    function renderChart(logs) {
        const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
        if (window.dashChart) window.dashChart.destroy();
        window.dashChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: logs.map(l => l.measured_date.split('-')[2]),
                datasets: [
                    { label: '睡眠', data: logs.map(l => l.sleep_hours), backgroundColor: 'rgba(99, 102, 241, 0.3)', yAxisID: 'ySleep' },
                    { label: '体重', data: logs.map(l => l.weight), type: 'line', borderColor: '#111827', tension: 0.3, yAxisID: 'yWeight' }
                ]
            },
            options: { scales: { ySleep: { position: 'left', min: 0, max: 12 }, yWeight: { position: 'right', grid: { display: false } } } }
        });
    }

    checkInitialSetup();
});