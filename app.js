document.addEventListener('DOMContentLoaded', async () => {
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker Registered'));
    }

    const user = await checkAuth();
    if (!user) return;
    
    // --- 多言語辞書（i18n）の保全と拡張 ---
    window.currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    window.dict = {
        en: {
            quick_action: "Quick Action", wake: "Wake Up", meal: "Meal", sleep: "Sleep",
            kpi_title: "Key Performance Indicators", weight: "Weight", fat_p: "Body Fat", sleep_h: "Sleep", mental: "Mental",
            streak: "Streak", days: "Days", consecutive: "Consecutive", completion: "Completion", last30days: "Last 30 Days",
            month_count: "Month Count", logging: "Logging", calories: "Calories", today_total: "Today's Total",
            nav_meals: "Meals", nav_history: "History", analysis: "Analysis", trend: "Trend", recorded: "Logged",
            ai_analysis_title: "AI Analysis Engine", ai_analysis_wait: "Premium features standby...",
            msg_wake: "Good morning! ☀️", msg_sleep: "Good night! 🌙",
            adv_weight: "Weight fluctuates daily. Focus on the 7-day trend.",
            adv_fat: "Body fat is affected by hydration. Measure consistently.",
            adv_calories: "Premium feature release is near. Wait for the AI precision analysis with excitement!",
            adv_sleep: "Aiming for ~7 hours stabilizes health.",
            adv_mental: "Mental condition correlates with sleep and diet.",
            adv_streak: "Shows habit consistency. Every green dot is a win.",
            adv_completion: "Maintaining 80%+ enables high accuracy analysis.",
            adv_month: "Total unique days logged this calendar month."
        },
        ja: {
            quick_action: "クイックアクション", wake: "起床", meal: "食事", sleep: "就寝",
            kpi_title: "主要指標 (KPI)", weight: "体重", fat_p: "体脂肪", sleep_h: "睡眠時間", mental: "メンタル",
            streak: "継続日数", days: "日", consecutive: "連続記録中", completion: "記録率", last30days: "過去30日",
            month_count: "月間記録数", logging: "記録済み", calories: "カロリー", today_total: "本日の合計",
            nav_meals: "食事録", nav_history: "履歴", analysis: "分析", trend: "推移", recorded: "済",
            ai_analysis_title: "AI自動解析エンジン", ai_analysis_wait: "プレミアム機能解放までお待ちください...",
            msg_wake: "おはようございます！☀️", msg_sleep: "お疲れ様でした！🌙",
            adv_weight: "体重は日々変動します。7日間のトレンドに注目しましょう。",
            adv_fat: "体脂肪率は水分量に影響されます。一定の条件で測定しましょう。",
            adv_calories: "プレミアム機能の解放は間近です。AIによる精密解析をお楽しみに！",
            adv_sleep: "約7時間の睡眠は心身の健康を安定させます。",
            adv_mental: "メンタル状態は睡眠や食事と密接に関係しています。",
            adv_streak: "習慣の継続性を示します。緑の点が増えるほど健康が加速します。",
            adv_completion: "80%以上の記録率を維持すると、分析の精度が飛躍的に向上します。",
            adv_month: "今月の合計記録日数です。毎日を積み重ねましょう。"
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
            document.getElementById('mdAdvice').innerText = dict[currentLang]['adv_' + kpi] || "";
            document.getElementById('kpiDetailModal').style.display = 'flex';

            // 数値データ以外のKPIはチャートをスキップ
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