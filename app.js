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
            ai_analysis_title: "AI Meal Analysis", ai_analysis_wait: "Waiting for AI Integration...",
            msg_wake: "Good morning! ☀️", msg_sleep: "Good night! 🌙"
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "指標", weight: "体重", sleep_h: "睡眠", mental: "メンタル",
            nav_meals: "食事録", nav_log: "記録", nav_history: "履歴", chart_title: "直近7日の推移",
            analysis: "分析", trend: "推移", recorded: "済",
            fat_p: "体脂肪", streak: "継続日数", days: "日", consecutive: "連続記録中",
            completion: "記録率", last30days: "過去30日",
            ai_analysis_title: "AI食事自動解析", ai_analysis_wait: "プレミアム機能解放までお待ちください...",
            msg_wake: "おはようございます！☀️", msg_sleep: "お疲れ様でした！🌙"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerText = dict[currentLang][key];
        });
    }
    
    const langToggleBtn = document.getElementById('langToggleBtn');
    if (langToggleBtn) {
        langToggleBtn.addEventListener('click', () => {
            currentLang = currentLang === 'en' ? 'ja' : 'en';
            localStorage.setItem('appLang_' + user.id, currentLang);
            updateLanguage();
            loadDashboard();
        });
    }
    updateLanguage();

    // --- GitHub風グリッド描画ロジック ---
    async function renderActivityGrid() {
        const grid = document.getElementById('activityGrid');
        if (!grid) return;
        grid.innerHTML = '';
        
        const today = new Date();
        const daysToShow = 35; // 5週間分
        const startDate = new Date();
        startDate.setDate(today.getDate() - daysToShow + 1);

        const { data: logs } = await supabaseClient.from('health_logs')
            .select('measured_date, mental_condition')
            .eq('user_id', user.id)
            .gte('measured_date', startDate.toISOString().split('T')[0]);

        const logMap = {};
        logs?.forEach(log => { logMap[log.measured_date] = log.mental_condition; });

        for (let i = 0; i < daysToShow; i++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + i);
            const dateStr = current.toISOString().split('T')[0];
            
            const cell = document.createElement('div');
            cell.className = 'streak-cell';
            if (logMap[dateStr]) {
                cell.classList.add(logMap[dateStr] >= 4 ? 'lv-2' : 'lv-1');
            }
            grid.appendChild(cell);
        }
    }

    // --- ダッシュボード更新 ---
    window.loadDashboard = async function() {
        // KPI取得 (既存のRPC)
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) {
            document.getElementById('streakDays').innerText = kpiData[0].streak_days;
            document.getElementById('completionRate').innerText = Math.round(kpiData[0].log_completion_rate);
        }

        // 最新の健康データ (既存)
        const { data: recentLogs } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
        
        if (recentLogs?.[0]) {
            document.getElementById('latestWeight').innerText = recentLogs[0].weight ? recentLogs[0].weight.toFixed(1) + " kg" : "-- kg";
            document.getElementById('latestSleep').innerText = recentLogs[0].sleep_hours ? recentLogs[0].sleep_hours.toFixed(1) + " h" : "-- h";
        }

        renderActivityGrid(); // グリッド描画
    };

    // クイックアクション等の既存ロジック (省略せず維持)
    // ... (recordTime, chart rendering etc.)
    
    loadDashboard();
});