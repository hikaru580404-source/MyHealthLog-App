document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(() => console.log('SW Registered'));
    }

    const user = await checkAuth();
    if (!user) return;
    
    window.currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    window.dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "KPI", weight: "Weight", sleep_h: "Sleep", streak: "Streak", days: "Days",
            consecutive: "Consecutive", completion: "Completion", last30days: "Last 30 Days",
            nav_meals: "Meals", nav_history: "History", analysis: "Analysis",
            ai_analysis_title: "AI Analysis Engine", ai_analysis_wait: "Waiting for AI...",
            adv_calories: "AI estimation is near! Wait for the update with excitement.",
            msg_wake: "Good morning! ☀️", msg_sleep: "Good night! 🌙"
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "指標", weight: "体重", sleep_h: "睡眠", streak: "継続日数", days: "日",
            consecutive: "連続記録中", completion: "記録率", last30days: "過去30日",
            nav_meals: "食事録", nav_history: "履歴", analysis: "分析",
            ai_analysis_title: "AI自動解析エンジン", ai_analysis_wait: "プレミアム機能解放までお待ちください...",
            adv_calories: "プレミアム機能の解放は間近です。AIによる解析をお楽しみに！",
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

    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLang = (currentLang === 'en' ? 'ja' : 'en');
            localStorage.setItem('appLang_' + user.id, currentLang);
            updateLanguage();
            loadDashboard();
        };
    }

    // 就寝・起床クイックログ修正
    async function quickLog(field, message) {
        const now = new Date();
        const logicalDate = new Date(now.getTime());
        // 深夜4時までは「前日」の記録として扱う
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        const dStr = logicalDate.toLocaleDateString('sv-SE');

        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', dStr).maybeSingle();
        const payload = { user_id: user.id, measured_date: dStr };
        payload[field] = now.toISOString();

        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        alert(message);
        loadDashboard();
    }
    document.getElementById('btnWaketime').onclick = () => quickLog('waketime', dict[currentLang].msg_wake);
    document.getElementById('btnBedtime').onclick = () => quickLog('bedtime', dict[currentLang].msg_sleep);

    window.loadDashboard = async function() {
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) {
            document.getElementById('streakDays').innerText = kpiData[0].streak_days;
            document.getElementById('completionRate').innerText = Math.round(kpiData[0].log_completion_rate);
        }

        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
        if (recent?.[0]) {
            document.getElementById('latestWeight').innerText = recent[0].weight || "--";
            document.getElementById('latestSleep').innerText = recent[0].sleep_hours || "--";
        }

        const grid = document.getElementById('activityGrid');
        if (grid) {
            grid.innerHTML = '';
            const { data: history } = await supabaseClient.from('health_logs').select('measured_date').eq('user_id', user.id);
            const loggedDates = new Set(history?.map(h => h.measured_date));
            // 90日間表示
            for (let i = 89; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('sv-SE');
                const cell = document.createElement('div');
                cell.className = 'streak-cell' + (loggedDates.has(dStr) ? ' lv-2' : '');
                grid.appendChild(cell);
            }
        }
    };
    loadDashboard();
});