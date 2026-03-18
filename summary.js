document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    let currentDate = new Date();
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    /**
     * 「**月別データの取得と統合表示ロジック**」
     */
    async function loadSummaryData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        document.getElementById('summaryMonthLabel').innerText = `（**${year}年 ${month + 1}月**）`;

        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        // 1. 健康ログの取得
        const { data: healthLogs, error: hErr } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .gte('measured_date', startOfMonth)
            .lte('measured_date', endOfMonth)
            .order('measured_date', { ascending: true });

        // 2. 食事ログの取得
        const { data: mealLogs, error: mErr } = await supabaseClient
            .from('meal_logs')
            .select('*')
            .eq('user_id', user.id)
            .gte('meal_date', startOfMonth)
            .lte('meal_date', endOfMonth)
            .order('logged_at', { ascending: true });

        if (!hErr) {
            renderStats(healthLogs);
            renderChart(healthLogs);
            renderDailyList(healthLogs, mealLogs || []);
        }
    }

    /**
     * 「**統計カードの更新**」
     */
    function renderStats(logs) {
        if (logs.length === 0) {
            document.getElementById('avgWeight').innerText = "-- kg";
            document.getElementById('avgSleep').innerText = "-- h";
            document.getElementById('monthCount').innerText = "0 日";
            return;
        }
        const avgW = logs.reduce((s, l) => s + l.weight, 0) / logs.length;
        const avgS = logs.reduce((s, l) => s + (l.sleep_hours || 0), 0) / logs.length;

        document.getElementById('avgWeight').innerText = `${avgW.toFixed(1)} kg`;
        document.getElementById('avgSleep').innerText = `${avgS.toFixed(1)} h`;
        document.getElementById('monthCount').innerText = `${logs.length} 日`;
    }

    /**
     * 「**月間推移グラフの描画**」
     */
    function renderChart(logs) {
        const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
        // 既存のチャートがある場合は破棄（メモリリーク防止）
        if (window.myChart) window.myChart.destroy();

        window.myChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: logs.map(l => l.measured_date.split('-')[2]), // 日にちのみ
                datasets: [{
                    label: 'メンタル',
                    data: logs.map(l => l.mental_condition),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { min: 1, max: 5, ticks: { stepSize: 1 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    /**
     * 「**日次詳細リストの描画**」
     */
    function renderDailyList(hLogs, mLogs) {
        const container = document.getElementById('dailyLogList');
        container.innerHTML = '';

        // 降順（新しい順）で表示
        [...hLogs].reverse().forEach(log => {
            const dayMeals = mLogs.filter(m => m.meal_date === log.measured_date);
            
            const card = document.createElement('div');
            card.style.cssText = 'padding: 12px 0; border-bottom: 1px solid var(--clr-border);';
            
            // 食事バッジの生成
            const mealHtml = dayMeals.map(m => `
                <div style="margin-top:4px; font-size:.75rem;">
                    <span class="meal-badge ${getMealClass(m.meal_type)}">${m.meal_type}</span>
                    <span style="color:var(--clr-text-secondary);">${m.content}</span>
                </div>
            `).join('');

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                    <span style="font-weight:800; font-size:.85rem;">${log.measured_date}</span>
                    <span style="font-size:.75rem; color:var(--clr-cond-${log.mental_condition}); font-weight:700;">
                        ${mentalLabels[log.mental_condition - 1]}
                    </span>
                </div>
                <div style="font-size:.8rem; display:flex; gap:15px; color:var(--clr-text-primary);">
                    <span>体重: <strong>${log.weight.toFixed(1)}kg</strong></span>
                    <span>睡眠: <strong>${log.sleep_hours.toFixed(1)}h</strong></span>
                </div>
                ${mealHtml}
                ${log.daily_notes ? `<div style="margin-top:6px; font-size:.7rem; color:var(--clr-text-muted); font-style:italic;">"${log.daily_notes}"</div>` : ''}
            `;
            container.appendChild(card);
        });
    }

    function getMealClass(type) {
        const map = { '朝食': 'meal-bfast', '昼食': 'meal-lunch', '夕食': 'meal-dinner', '間食': 'meal-snack' };
        return map[type] || '';
    }

    // 月移動イベント
    document.getElementById('prevMonthBtn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); loadSummaryData(); });
    document.getElementById('nextMonthBtn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); loadSummaryData(); });

    loadSummaryData();
});