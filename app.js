document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェックを実行**」
    const user = await checkAuth();
    if (!user) return;

    // UI要素の取得
    const latestWeight = document.getElementById('latestWeight');
    const latestSleep = document.getElementById('latestSleep');
    const latestMental = document.getElementById('latestMental');
    const monthCount = document.getElementById('monthCount');
    const latestNote = document.getElementById('latestNote');
    const dateLabel = document.getElementById('currentDateLabel');
    const logoutBtn = document.getElementById('logoutBtn');

    // コンディションのラベル定義
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    /**
     * 「**ログアウト処理**」
     */
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    /**
     * 「**ダッシュボードデータの読み込み**」
     */
    async function loadDashboard() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        
        dateLabel.innerText = `（**${now.getFullYear()}年 ${now.getMonth() + 1}月**）`;

        // 1. 最新の記録（1件）を取得
        const { data: latestData, error: err1 } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false })
            .limit(1);

        if (latestData && latestData.length > 0) {
            const log = latestData[0];
            latestWeight.innerText = log.weight ? `${log.weight.toFixed(1)} kg` : "-- kg";
            latestSleep.innerText = log.sleep_hours ? `${log.sleep_hours.toFixed(1)} h` : "-- h";
            latestMental.innerText = log.mental_condition ? mentalLabels[log.mental_condition - 1] : "--";
            latestNote.innerText = log.daily_notes || "メモはありません。";
        }

        // 2. 今月の計測日数をカウント
        const { count, error: err2 } = await supabaseClient
            .from('health_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('measured_date', firstDay);

        if (count !== null) {
            monthCount.innerText = `${count} 日`;
        }

        // 3. 直近7日間のデータをグラフ用に取得
        const { data: chartData, error: err3 } = await supabaseClient
            .from('health_logs')
            .select('measured_date, weight, sleep_hours')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: true })
            .limit(7);

        if (chartData && chartData.length > 0) {
            renderCorrelationChart(chartData);
        }
    }

    /**
     * 「**相関グラフのレンダリング**」
     * 体重（折れ線）と睡眠時間（棒グラフ）を二軸で描画します。
     */
    function renderCorrelationChart(logs) {
        const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
        
        const labels = logs.map(l => {
            const d = new Date(l.measured_date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        });

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '睡眠時間 (h)',
                        data: logs.map(l => l.sleep_hours),
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        borderColor: '#6366f1',
                        borderWidth: 2,
                        borderRadius: 5,
                        yAxisID: 'ySleep',
                        type: 'bar'
                    },
                    {
                        label: '体重 (kg)',
                        data: logs.map(l => l.weight),
                        borderColor: '#10b981',
                        backgroundColor: '#10b981',
                        borderWidth: 3,
                        pointRadius: 4,
                        tension: 0.3,
                        yAxisID: 'yWeight',
                        type: 'line'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11, weight: 'bold' } } }
                },
                scales: {
                    x: { grid: { display: false } },
                    ySleep: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: '睡眠時間', font: { size: 10 } },
                        min: 0,
                        max: 12
                    },
                    yWeight: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: '体重', font: { size: 10 } },
                        grid: { display: false },
                        // 体重の軸範囲をデータの最小最大に合わせて論理調整
                        suggestedMin: Math.min(...logs.filter(l => l.weight).map(l => l.weight)) - 2,
                        suggestedMax: Math.max(...logs.filter(l => l.weight).map(l => l.weight)) + 2
                    }
                }
            }
        });
    }

    loadDashboard();
});