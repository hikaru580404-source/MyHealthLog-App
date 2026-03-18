document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    // 論理日付の取得（午前4時までは前日として扱う）
    function getLogicalDate(dateObj) {
        const d = new Date(dateObj);
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        return d.toISOString().split('T')[0];
    }

    // 打刻処理（就寝・起床）
    async function recordTime(type) {
        const now = new Date();
        const logicalDate = getLogicalDate(now);
        const timeISO = now.toISOString();

        // 既存の今日のデータを取得（上書きによるデータ消失を防ぐため）
        const { data: existing } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('measured_date', logicalDate)
            .single();

        const payload = existing || { user_id: user.id, measured_date: logicalDate };

        if (type === 'bed') {
            payload.bedtime = timeISO;
        } else if (type === 'wake') {
            payload.waketime = timeISO;
        }

        // 両方揃っていれば睡眠時間を自動再計算
        if (payload.bedtime && payload.waketime) {
            const bt = new Date(payload.bedtime);
            const wt = new Date(payload.waketime);
            let diff = (wt - bt) / 3600000;
            if (diff < 0) diff += 24; // 万が一の逆転補正
            payload.sleep_hours = parseFloat(diff.toFixed(1));
        }

        const { error } = await supabaseClient.from('health_logs').upsert(payload);
        
        if (error) {
            alert("エラーが発生しました: " + error.message);
        } else {
            alert(type === 'bed' ? "就寝時刻を記録しました。" : "起床時刻を記録しました。");
            loadDashboard(); // 画面を更新
        }
    }

    document.getElementById('btnBedtime').addEventListener('click', () => recordTime('bed'));
    document.getElementById('btnWaketime').addEventListener('click', () => recordTime('wake'));

    // 食事モーダルの制御
    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => mealModal.style.display = 'flex');
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');

    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const type = document.getElementById('quickMealType').value;
        const memo = document.getElementById('quickMealMemo').value;
        if (!memo) return;

        const logicalDate = getLogicalDate(new Date());

        const { error } = await supabaseClient.from('meal_logs').insert({
            user_id: user.id,
            meal_date: logicalDate,
            meal_type: type,
            content: memo
        });

        if (!error) {
            mealModal.style.display = 'none';
            document.getElementById('quickMealMemo').value = '';
            alert("食事を記録しました。");
        }
    });

    // ダッシュボードの描画処理
    async function loadDashboard() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        const { data: latestData } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
            
        if (latestData && latestData.length > 0) {
            const log = latestData[0];
            document.getElementById('latestWeight').innerText = log.weight ? log.weight.toFixed(1) + " kg" : "-- kg";
            document.getElementById('latestSleep').innerText = log.sleep_hours ? log.sleep_hours.toFixed(1) + " h" : "-- h";
            document.getElementById('latestMental').innerText = log.mental_condition ? mentalLabels[log.mental_condition - 1] : "--";
        }

        const { count } = await supabaseClient.from('health_logs')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('measured_date', firstDay);
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

    loadDashboard();
});