document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    
    let currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    const dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "KPI", weight: "Weight", fat_p: "Fat", sleep_h: "Sleep", mental: "Mental Condition",
            streak: "Streak", days: "Days", consecutive: "Consecutive", completion: "Completion", last30days: "Last 30 Days",
            month_count: "Month Count", logging: "Logging", calories: "Calories", today_total: "Today's Total",
            nav_meals: "Meals", nav_history: "History", analysis: "Analysis", trend: "7-Day Trend", recorded: "Logged",
            msg_wake: "Good morning! ☀️", msg_sleep: "Good night! 🌙",
            adv_weight: "Weight fluctuates daily. Focus on the 7-day trend.",
            adv_fat: "Body fat is affected by hydration. Measure consistently.",
            adv_calories: "Today's estimated calories analyzed by AI.",
            adv_sleep: "Aiming for ~7 hours stabilizes mental and physical health.",
            adv_mental: "Mental condition correlates with sleep and diet.",
            adv_streak: "Shows habit consistency. Restart immediately if broken.",
            adv_completion: "Maintaining 80%+ enables highly accurate analysis.",
            adv_month: "Total days logged this month."
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "指標", weight: "体重", fat_p: "体脂肪", sleep_h: "睡眠", mental: "メンタル",
            streak: "継続日数", days: "日", consecutive: "連続記録中", completion: "記録率", last30days: "過去30日",
            month_count: "月間記録数", logging: "記録済み", calories: "カロリー", today_total: "本日の合計",
            nav_meals: "食事録", nav_history: "履歴", analysis: "分析", trend: "推移", recorded: "済",
            msg_wake: "おはようございます！☀️", msg_sleep: "お疲れ様でした！🌙",
            adv_weight: "体重は日々変動します。7日間のトレンドに注目しましょう。",
            adv_fat: "体脂肪率は水分量に影響されます。一定の条件で測定しましょう。",
            adv_calories: "AIによって解析された本日の推定摂取カロリーです。",
            adv_sleep: "約7時間の睡眠は心身の健康を安定させます。",
            adv_mental: "メンタル状態は睡眠や食事と密接に関係しています。",
            adv_streak: "習慣の継続性を示します。途切れたら即座に再開しましょう。",
            adv_completion: "80%以上の記録率を維持すると、分析の精度が向上します。",
            adv_month: "今月の合計記録日数です。"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerText = dict[currentLang][key];
        });
    }
    updateLanguage();

    // 言語切り替えボタン
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLang = (currentLang === 'en' ? 'ja' : 'en');
            localStorage.setItem('appLang_' + user.id, currentLang);
            updateLanguage();
            loadDashboard();
        };
    }

    // ログアウトボタン
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabaseClient.auth.signOut();
            location.href = 'login.html';
        };
    }

    // --- クイックアクション (即時DB更新) ---
    async function quickLog(field, message) {
        const today = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const payload = { user_id: user.id, measured_date: today };
        payload[field] = new Date().toISOString();
        
        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', today).maybeSingle();
        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        
        alert(message);
        loadDashboard();
    }

    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    if (btnWake) btnWake.onclick = () => quickLog('waketime', dict[currentLang].msg_wake);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', dict[currentLang].msg_sleep);

    // --- KPI詳細・アドバイス・グラフ表示 ---
    let detailChart = null;
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', async () => {
            const kpi = card.getAttribute('data-kpi');
            const title = card.querySelector('.kpi-label').innerText;
            const val = card.querySelector('.kpi-value').innerText;
            
            // 継続日数、記録率、月間記録数はグラフ表示対象外とする（必要に応じて追加可能）
            if (kpi === 'streak' || kpi === 'completion' || kpi === 'month_count' || kpi === 'calories') {
                document.getElementById('mdKpiTitle').innerText = title;
                document.getElementById('mdKpiMainValue').innerText = val;
                document.getElementById('mdAdvice').innerText = dict[currentLang]['adv_' + kpi] || "";
                document.getElementById('kpiDetailModal').style.display = 'flex';
                const ctx = document.getElementById('detailModalChart').getContext('2d');
                if (detailChart) detailChart.destroy();
                return;
            }

            document.getElementById('mdKpiTitle').innerText = title;
            document.getElementById('mdKpiMainValue').innerText = val;
            document.getElementById('mdAdvice').innerText = dict[currentLang]['adv_' + kpi] || "";
            document.getElementById('kpiDetailModal').style.display = 'flex';

            const { data } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(30);
            const logs = data.reverse();
            
            if (detailChart) detailChart.destroy();
            const ctx = document.getElementById('detailModalChart').getContext('2d');
            
            // 睡眠時間の場合は sleep_hours カラム、それ以外は kpi 名と一致するカラムを使用
            const dbColumn = (kpi === 'sleep' ? 'sleep_hours' : (kpi === 'fat' ? 'body_fat' : kpi));

            detailChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [{
                        label: title,
                        data: logs.map(l => l[dbColumn]),
                        borderColor: '#fbbf24', tension: 0.4, fill: true, backgroundColor: 'rgba(251, 191, 36, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
            });
        });
    });

    // --- ダッシュボード更新・Activity Grid描画・メイングラフ描画 ---
    window.loadDashboard = async function() {
        // 1. KPI取得 (RPC)
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) {
            document.getElementById('streakDays').innerText = kpiData[0].streak_days || 0;
            document.getElementById('completionRate').innerText = Math.round(kpiData[0].log_completion_rate || 0);
            // MONTH COUNTのバグ修正：複数の可能性のあるカラム名に対応
            document.getElementById('monthLogs').innerText = kpiData[0].logs_this_month ?? kpiData[0].logs_count ?? 0;
        }

        // 2. 最新の健康データ反映
        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
        if (recent?.[0]) {
            document.getElementById('latestWeight').innerText = recent[0].weight || "--";
            document.getElementById('latestFat').innerText = recent[0].body_fat || "--";
            document.getElementById('latestSleep').innerText = recent[0].sleep_hours || "--";
            const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mentalMap[recent[0].mental_condition] || "--";
        }
        
        // 3. 今日のカロリー集計
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const { data: meals } = await supabaseClient.from('meal_logs').select('calories').eq('user_id', user.id).eq('meal_date', todayStr);
        const totalCal = meals?.reduce((sum, m) => sum + (Number(m.calories) || 0), 0) || 0;
        document.getElementById('todayCalories').innerText = totalCal;

        // 4. Activity Grid描画 (過去90日)
        const grid = document.getElementById('activityGrid');
        if (grid) {
            grid.innerHTML = '';
            const { data: history } = await supabaseClient.from('health_logs').select('measured_date').eq('user_id', user.id);
            const loggedDates = new Set(history?.map(h => h.measured_date));
            
            for (let i = 89; i >= 0; i--) {
                const d = new Date(); d.setDate(d.getDate() - i);
                const dStr = d.toLocaleDateString('sv-SE');
                const cell = document.createElement('div');
                cell.className = 'streak-cell' + (loggedDates.has(dStr) ? ' lv-2' : '');
                grid.appendChild(cell);
            }
        }

        // 5. メインの7-Day Trendグラフ描画
        const { data: trendData } = await supabaseClient.from('health_logs')
            .select('measured_date, weight, sleep_hours')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false })
            .limit(7);

        const chartCanvas = document.getElementById('healthCorrelationChart');
        if (chartCanvas && trendData && trendData.length > 0) {
            const logs = trendData.reverse();
            const ctx = chartCanvas.getContext('2d');
            
            if (window.mainChart) window.mainChart.destroy();
            
            window.mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [
                        {
                            label: 'Sleep (h)',
                            data: logs.map(l => l.sleep_hours),
                            backgroundColor: '#fbbf24',
                            borderRadius: 4,
                            yAxisID: 'ySleep'
                        },
                        {
                            label: 'Weight (kg)',
                            data: logs.map(l => l.weight),
                            type: 'line',
                            borderColor: '#f8fafc',
                            borderWidth: 2,
                            pointBackgroundColor: '#f8fafc',
                            tension: 0.4,
                            yAxisID: 'yWeight'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        ySleep: { type: 'linear', position: 'left', min: 0, max: 12, grid: { display: false }, ticks: { color: '#8b9bb4' } },
                        yWeight: { type: 'linear', position: 'right', grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b9bb4' } }
                    }
                }
            });
        }
    };
    
    loadDashboard();
});