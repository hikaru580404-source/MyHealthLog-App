document.addEventListener('DOMContentLoaded', async () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker Registered'));
    }

    const user = await checkAuth();
    if (!user) return;
    
    // --- 多言語辞書（i18n）をコーチングの『問い』へ完全刷新 ---
    window.currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    window.dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "KPI (Governance Metrics)", weight: "Weight", fat_p: "Body Fat", sleep_h: "Sleep", mental: "Mental",
            streak: "Streak", days: "Days", consecutive: "Consecutive", completion: "Completion", last30days: "Last 30 Days",
            month_count: "Month Count", logging: "Logging", calories: "Calories", today_total: "Today's Total",
            nav_meals: "Meals (Photo Log)", nav_history: "History", analysis: "Analysis", trend: "Trend", recorded: "Logged",
            ai_analysis_title: "AI / Personal Coach Standby", ai_analysis_wait: "Premium features standby...",
            msg_wake: "Good morning! ☀️", msg_sleep: "Perfect Governance. Good night! 🌙",
            adv_weight: "Q. Weight is just a result. Which of your 'Self-Governance' habits caused this change?",
            adv_fat: "Q. Body fat reflects your lifestyle. What will you change tomorrow to close the gap to your goal?",
            adv_calories: "Premium feature (AI Meal/Diet Coaching) is preparing. Your daily meal photos will be the strongest data for future analysis.",
            adv_sleep: "Q. How did today's sleep hours affect the 'Quality of your Decision Making'?",
            adv_mental: "Q. How did this mental condition impact your 'Margin for Altruism (Serving others)'?",
            adv_streak: "Q. Streak is the source of your efficacy. What is your strategy to keep this unbroken?",
            adv_completion: "Q. High logging rate means high meta-cognition. What system do you need to fill the remaining gap?",
            adv_month: "Q. Days logged equal days invested in your business. How will you increase this investment next month?"
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "統治指標 (KPI)", weight: "体重", fat_p: "体脂肪", sleep_h: "睡眠", mental: "メンタル",
            streak: "継続日数", days: "日", consecutive: "連続記録中", completion: "記録率", last30days: "過去30日",
            month_count: "月間記録数", logging: "記録済み", calories: "カロリー", today_total: "本日の合計",
            nav_meals: "食事録(画像)", nav_history: "履歴", analysis: "分析", trend: "推移", recorded: "済",
            ai_analysis_title: "AI / Personal Coach Standby", ai_analysis_wait: "食事画像・データを蓄積し、解析をお待ちください...",
            msg_wake: "おはようございます！☀️", msg_sleep: "完璧な統治です。お疲れ様でした！🌙",
            adv_weight: "Q. 体重の変動は結果に過ぎません。この数値の変化は、あなたの自己統治のどの部分が影響したと考えますか？",
            adv_fat: "Q. 体脂肪は生活習慣の鏡です。目標値とのギャップを埋めるために、明日から何を変えますか？",
            adv_calories: "※プレミアム機能（食事解析・ダイエット支援）は準備中です。毎日の食事画像データの蓄積が、将来のAIコーチングの最高の資産となります。記録を続けましょう。",
            adv_sleep: "Q. 本日の睡眠時間と、今日のあなたの『意思決定の質』にはどのような相関がありましたか？",
            adv_mental: "Q. このコンディションは、あなたの『圧倒的利他主義（顧客を救済する余白）』にどう影響しましたか？",
            adv_streak: "Q. 継続は『私ならできる』というエフィカシーの源泉です。このストリークを途切れさせないために、どんな工夫をしていますか？",
            adv_completion: "Q. 記録率の高さは、メタ認知の高さです。残りの空白を埋めるために必要なシステム（仕組み）は何ですか？",
            adv_month: "Q. 今月の記録日数は、あなたの事業への投資日数そのものです。来月、さらにこの投資を増やすための戦略は？"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerText = dict[currentLang][key];
        });
    }
    updateLanguage();

    // 言語切り替えロジック
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = () => {
            currentLang = (currentLang === 'en' ? 'ja' : 'en');
            localStorage.setItem('appLang_' + user.id, currentLang);
            updateLanguage();
            loadDashboard();
        };
    }

    // ログアウトロジック
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await supabaseClient.auth.signOut();
            location.href = 'login.html';
        };
    }

    // --- High Goal (北極星) の処理 ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        // localStorageから読み込み
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        if (savedGoal) goalText.innerText = savedGoal;
        
        goalCard.onclick = () => {
            const current = localStorage.getItem('highGoal_' + user.id) || "";
            const newGoal = prompt("あなたの『究極のゴール（北極星）』を入力してください：\n（例：年商1億円達成し、業界の常識を覆す）", current);
            if (newGoal !== null) {
                const textToSave = newGoal.trim() === "" ? "（タップして究極のゴールを設定してください）" : newGoal.trim();
                localStorage.setItem('highGoal_' + user.id, textToSave);
                goalText.innerText = textToSave;
            }
        };
    }

    // クイックログ機能（深夜4時ルール適用）
    async function quickLog(field, message) {
        const now = new Date();
        const logicalDate = new Date(now.getTime());
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        const dateStr = logicalDate.toLocaleDateString('sv-SE');

        const payload = { user_id: user.id, measured_date: dateStr };
        payload[field] = now.toISOString();

        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', dateStr).maybeSingle();
        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        
        alert(message);
        loadDashboard();
    }
    document.getElementById('btnWaketime').onclick = () => quickLog('waketime', dict[currentLang].msg_wake);
    document.getElementById('btnBedtime').onclick = () => quickLog('bedtime', dict[currentLang].msg_sleep);

    // --- KPI詳細モーダル & チャートロジック ---
    let detailChart = null;
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', async () => {
            const kpi = card.getAttribute('data-kpi');
            const title = card.querySelector('.kpi-label').innerText;
            const val = card.querySelector('.kpi-value').innerText;
            document.getElementById('mdKpiTitle').innerText = title;
            document.getElementById('mdKpiMainValue').innerText = val;
            
            // 変更：解説（コンサル）ではなく「問い（コーチング）」を表示
            document.getElementById('mdAdvice').innerText = dict[currentLang]['adv_' + kpi] || "";
            document.getElementById('kpiDetailModal').style.display = 'flex';

            if (['streak', 'completion', 'month_count', 'calories', 'mental'].includes(kpi)) {
                if (detailChart) detailChart.destroy();
                return;
            }

            const { data } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(30);
            const logs = data.reverse();
            if (detailChart) detailChart.destroy();
            const ctx = document.getElementById('detailModalChart').getContext('2d');
            const dbColumn = (kpi === 'sleep' ? 'sleep_hours' : (kpi === 'fat' ? 'body_fat' : kpi));

            detailChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [{
                        label: title, data: logs.map(l => l[dbColumn]),
                        borderColor: '#fbbf24', tension: 0.4, fill: true, backgroundColor: 'rgba(251, 191, 36, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { y: { ticks: { color: '#8b9bb4' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#8b9bb4' } } }
                }
            });
        });
    });

    // --- ダッシュボードの主力エンジン ---
    window.loadDashboard = async function() {
        // 1. パフォーマンス統計 (SQL関数)
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) {
            document.getElementById('streakDays').innerText = kpiData[0].streak_days || 0;
            document.getElementById('completionRate').innerText = Math.round(kpiData[0].log_completion_rate || 0);
            document.getElementById('monthLogs').innerText = kpiData[0].logs_count || 0;
        }

        // 2. 最新レコード (Weight, Fat, Sleep, Mental)
        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
        if (recent?.[0]) {
            const current = recent[0];
            const previous = recent[1] || null;

            document.getElementById('latestWeight').innerText = current.weight || "--";
            document.getElementById('latestFat').innerText = current.body_fat || "--";
            document.getElementById('latestSleep').innerText = current.sleep_hours || "--";
            
            const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mentalMap[current.mental_condition] || "--";

            // Δ（デルタ）計算
            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                const el = document.getElementById('deltaWeight');
                el.innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                el.className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
            }
        }
        
        // 3. 本日のカロリー集計
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const { data: meals } = await supabaseClient.from('meal_logs').select('calories').eq('user_id', user.id).eq('meal_date', todayStr);
        const totalCal = meals?.reduce((sum, m) => sum + (Number(m.calories) || 0), 0) || 0;
        document.getElementById('todayCalories').innerText = totalCal;

        // 4. Activity Grid (GitHub風90日間)
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

        // 5. 7-Day Trend Chart
        const { data: trendData } = await supabaseClient.from('health_logs').select('measured_date, weight, sleep_hours').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(7);
        if (trendData && trendData.length > 0) {
            const logs = trendData.reverse();
            const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
            if (window.mainChart) window.mainChart.destroy();
            window.mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [
                        { label: 'Sleep (h)', data: logs.map(l => l.sleep_hours), backgroundColor: '#fbbf24', borderRadius: 4, yAxisID: 'ySleep' },
                        { label: 'Weight (kg)', data: logs.map(l => l.weight), type: 'line', borderColor: '#f8fafc', borderWidth: 2, pointBackgroundColor: '#f8fafc', tension: 0.4, yAxisID: 'yWeight' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
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