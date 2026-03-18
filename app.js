document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    // タイムゾーンのズレを防ぐ厳密な日付生成
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

    async function checkInitialSetup() {
        const { count, error } = await supabaseClient.from('health_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id);

        if (count === 0 && !sessionStorage.getItem('setupDone')) {
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
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

        let bDate = new Date(`${yesterdayStr}T${btVal}:00`);
        let wDate = new Date(`${todayStr}T${wtVal}:00`);
        if (wDate <= bDate) wDate.setDate(wDate.getDate() + 1);
        let sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));

        await supabaseClient.from('health_logs').upsert({
            user_id: user.id, measured_date: yesterdayStr, bedtime: bDate.toISOString()
        });

        const todayPayload = {
            user_id: user.id, measured_date: todayStr,
            waketime: wDate.toISOString(),
            sleep_hours: sleepHours,
            mental_condition: parseInt(initMVal)
        };
        if (wVal) todayPayload.weight = parseFloat(wVal);
        if (fVal) todayPayload.body_fat = parseFloat(fVal);
        if (noteVal) todayPayload.daily_notes = noteVal;

        await supabaseClient.from('health_logs').upsert(todayPayload);

        sessionStorage.setItem('setupDone', 'true');
        document.getElementById('initialSetupModal').style.display = 'none';
        loadDashboard();
    });

    async function recordTime(type) {
        const now = new Date();
        const logicalDateStr = getLocalLogicalDateStr(now);
        const timeISO = now.toISOString();

        const { data: existing } = await supabaseClient
            .from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', logicalDateStr).single();

        const payload = existing || { user_id: user.id, measured_date: logicalDateStr };

        if (type === 'wake') {
            payload.waketime = timeISO;
            const yesterday = new Date(now.getTime());
            yesterday.setDate(yesterday.getDate() - 1);
            const logicalYesterdayStr = getLocalLogicalDateStr(yesterday);
            
            const { data: prevDay } = await supabaseClient
                .from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', logicalYesterdayStr).single();

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

        const { error } = await supabaseClient.from('health_logs').upsert(payload);
        if (!error) {
            alert(type === 'bed' ? "就寝時刻を記録しました。" : "起床時刻と睡眠時間を記録しました。");
            loadDashboard();
        } else {
            alert("打刻エラー: " + error.message);
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

    async function loadDashboard() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayStr = getLocalLogicalDateStr(firstDay);
        
        const { data: latestData } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
            
        if (latestData && latestData.length > 0) {
            const log = latestData[0];
            document.getElementById('latestWeight').innerText = log.weight ? log.weight.toFixed(1) + " kg" : "-- kg";
            document.getElementById('latestSleep').innerText = log.sleep_hours ? log.sleep_hours.toFixed(1) + " h" : "-- h";
            document.getElementById('latestMental').innerText = log.mental_condition ? mentalLabels[log.mental_condition - 1] : "--";
        }

        const { count } = await supabaseClient.from('health_logs')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('measured_date', firstDayStr);
        document.getElementById('monthCount').innerText = (count || 0) + " 日";

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