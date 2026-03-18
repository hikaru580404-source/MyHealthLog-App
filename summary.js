document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    let currentDate = new Date();
    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    async function loadSummaryData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        document.getElementById('summaryMonthLabel').innerText = `${year}年 ${month + 1}月`;
        const start = new Date(year, month, 1).toISOString();
        const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
        const { data: hLogs } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).gte('measured_date', start).lte('measured_date', end).order('measured_date', { ascending: true });
        const { data: mLogs } = await supabaseClient.from('meal_logs').select('*').eq('user_id', user.id).gte('meal_date', start).lte('meal_date', end);
        if (hLogs) { renderStats(hLogs); renderChart(hLogs); renderDailyList(hLogs, mLogs || []); }
    }

    function renderStats(logs) {
        if (logs.length === 0) return;
        const avgW = logs.reduce((s, l) => s + l.weight, 0) / logs.length;
        const avgS = logs.reduce((s, l) => s + (l.sleep_hours || 0), 0) / logs.length;
        document.getElementById('avgWeight').innerText = `${avgW.toFixed(1)} kg`;
        document.getElementById('avgSleep').innerText = `${avgS.toFixed(1)} h`;
        document.getElementById('monthCount').innerText = `${logs.length} 日`;
    }

    function renderChart(logs) {
        const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
        if (window.myChart) window.myChart.destroy();
        window.myChart = new Chart(ctx, {
            type: 'line',
            data: { labels: logs.map(l => l.measured_date.split('-')[2]), datasets: [{ label: 'メンタル', data: logs.map(l => l.mental_condition), borderColor: '#6366f1', fill: false, tension: 0.4 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 1, max: 5 } } }
        });
    }

    function renderDailyList(hLogs, mLogs) {
        const container = document.getElementById('dailyLogList');
        container.innerHTML = '';
        [...hLogs].reverse().forEach(log => {
            const meals = mLogs.filter(m => m.meal_date === log.measured_date);
            const card = document.createElement('div');
            card.className = 'daily-card';
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; font-weight:800;"><span>${log.measured_date}</span><span>${mentalLabels[log.mental_condition - 1]}</span></div>
                <div>体重: ${log.weight.toFixed(1)}kg / 睡眠: ${log.sleep_hours.toFixed(1)}h</div>
                ${meals.map(m => `<div><span class="meal-badge">${m.meal_type}</span>${m.content}</div>`).join('')}
            `;
            container.appendChild(card);
        });
    }
    document.getElementById('prevMonthBtn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() - 1); loadSummaryData(); });
    document.getElementById('nextMonthBtn').addEventListener('click', () => { currentDate.setMonth(currentDate.getMonth() + 1); loadSummaryData(); });
    loadSummaryData();
});