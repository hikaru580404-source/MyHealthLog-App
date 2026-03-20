document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    
    let currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    const dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "KPI", weight: "Weight", sleep_h: "Sleep", mental: "Mental Condition",
            nav_meals: "Meals", nav_log: "Daily Log", nav_history: "History", chart_title: "Recent 7-Day Trend",
            analysis: "Analysis", trend: "7-Day Trend", recorded: "Logged",
            fat_p: "Fat", streak: "Streak", days: "Days", consecutive: "Consecutive",
            completion: "Completion", last30days: "Last 30 Days",
            msg_wake: "Good morning! ☀️", msg_sleep: "Good night! 🌙"
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "指標", weight: "体重", sleep_h: "睡眠", mental: "メンタル",
            nav_meals: "食事録", nav_log: "記録", nav_history: "履歴", chart_title: "直近7日の推移",
            analysis: "分析", trend: "推移", recorded: "済",
            fat_p: "体脂肪", streak: "継続日数", days: "日", consecutive: "連続記録中",
            completion: "記録率", last30days: "過去30日",
            msg_wake: "おはようございます！☀️", msg_sleep: "お疲れ様でした！🌙"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerText = dict[currentLang][key];
        });
    }
    updateLanguage();

    // --- KPIカードタップ詳細表示 ---
    let detailChart = null;
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', async () => {
            const key = card.getAttribute('data-kpi');
            const title = card.querySelector('.kpi-label').innerText;
            if (key === 'streak' || key === 'completion') return;

            document.getElementById('mdKpiTitle').innerText = title + " (Last 30 Days)";
            document.getElementById('kpiDetailModal').style.display = 'flex';

            const { data } = await supabaseClient.from('health_logs')
                .select('measured_date, ' + (key === 'weight' ? 'weight' : 'sleep_hours'))
                .eq('user_id', user.id).order('measured_date', { ascending: false }).limit(30);

            if (detailChart) detailChart.destroy();
            const ctx = document.getElementById('detailModalChart').getContext('2d');
            const logs = data.reverse();
            detailChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [{
                        label: title,
                        data: logs.map(l => key === 'weight' ? l.weight : l.sleep_hours),
                        borderColor: '#fbbf24', tension: 0.4, fill: true,
                        backgroundColor: 'rgba(251, 191, 36, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        });
    });

    // --- ダッシュボード更新 ---
    window.loadDashboard = async function() {
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) {
            document.getElementById('streakDays').innerText = kpiData[0].streak_days;
            document.getElementById('completionRate').innerText = Math.round(kpiData[0].log_completion_rate);
        }

        const { data: recentLogs } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
        
        if (recentLogs?.[0]) {
            document.getElementById('latestWeight').innerText = recentLogs[0].weight ? recentLogs[0].weight.toFixed(1) + " kg" : "-- kg";
            document.getElementById('latestSleep').innerText = recentLogs[0].sleep_hours ? recentLogs[0].sleep_hours.toFixed(1) + " h" : "-- h";
        }
    };
    
    loadDashboard();
});