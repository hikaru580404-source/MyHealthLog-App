document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(() => console.log('SW Registered')); }
    const user = await checkAuth();
    if (!user) return;
    
    // --- ログアウト機能 ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if(confirm("ログアウトしますか？")) {
                await supabaseClient.auth.signOut();
                location.href = 'login.html';
            }
        };
    }

    // --- 多言語辞書 ---
    window.currentLang = localStorage.getItem('appLang_' + user.id) || 'ja';
    window.dict = {
        en: {
            night_msg: "Governance completed. Good night.",
            high_goal_placeholder: "(Tap to set your High Goal)",
            vitality_ai: "Vitality Score",
            gov_power: "Governance Power",
            guide_slider: "Slide up/down to set your current power.",
            guide_hide: "Hide this next time",
            wake: "Wake", meal: "Meal", sleep: "Sleep",
            edit_history: "Daily Log (Edit/Audit Past Logs)",
            ai_analysis_title: "AI Personal Coach Standby",
            ai_analysis_wait: "Analysis & Diet Support (Preparing)",
            weight: "Weight", fat: "Body Fat", sleep_lbl: "Sleep", mental: "Mental",
            streak: "Streak", days: "Days", consecutive: "Consecutive",
            logs: "Logs", this_month: "This Month",
            activity_grid: "Activity Grid (Last 90 Days)",
            analysis: "Analysis", nav_meals: "Meals", nav_history: "History",
            msg_wake: "Good morning! Let's start governing today.",
            understood: "Proceed", cancel: "Cancel",
            desc_analysis: "View detailed analytics and trend charts of your governance.",
            desc_meals: "Log and review your daily meals with photos.",
            desc_history: "Review past logs, edit or audit your governance history.",
            adv_weight: "[Point] Weight fluctuates daily with water and meals. Focus on the long-term trend (1 week to 1 month) rather than daily changes.",
            adv_fat: "[Point] Body fat % is heavily affected by body water. Measure under the same conditions daily (e.g., after waking/restroom) for accuracy.",
            adv_sleep: "[Point] 7 hours of sleep is not just 'rest', but 'strategic maintenance' to maximize the quality of daytime decisions.",
            adv_mental: "[Point] Condition reflects your margin for altruism. If low, prioritize your own recovery (sleep/rest) without pushing too hard."
        },
        ja: {
            night_msg: "今日も1日、統治完了。おやすみなさい。",
            high_goal_placeholder: "（タップして究極のゴールを設定）",
            vitality_ai: "客観活力",
            gov_power: "主観戦闘力",
            guide_slider: "ダイヤルを上下に動かして、今の戦闘力をセットします。",
            guide_hide: "次回から非表示",
            wake: "Wake", meal: "Meal", sleep: "Sleep",
            edit_history: "日次記録（過去ログ修正・監査）",
            ai_analysis_title: "AI Personal Coach Standby",
            ai_analysis_wait: "解析・ダイエット支援（準備中）",
            weight: "Weight", fat: "Body Fat", sleep_lbl: "Sleep", mental: "Mental",
            streak: "Streak", days: "Days", consecutive: "Consecutive",
            logs: "Logs", this_month: "This Month",
            activity_grid: "Activity Grid (Last 90 Days)",
            analysis: "Analysis", nav_meals: "Meals(画像)", nav_history: "History",
            msg_wake: "おはようございます！今日も統治を始めましょう。",
            understood: "了解 / 遷移する", cancel: "キャンセル",
            desc_analysis: "これまでの統治記録の推移と、詳細な分析データを確認します。",
            desc_meals: "日々の食事を画像で記録し、食生活の振り返りを行います。",
            desc_history: "過去の統治記録を一覧で振り返り、記録の修正や監査を行います。",
            adv_weight: "【ポイント】体重は水分量や食事のタイミングで日々変動します。一喜一憂せず、1週間〜1ヶ月の長期的なトレンド（推移）を重視してください。",
            adv_fat: "【ポイント】体脂肪率は計測時の体内水分量に大きく影響されます。毎日同じ条件（例：起床後のトイレ後）で計測することで、精度の高いデータが得られます。",
            adv_sleep: "【ポイント】7時間の睡眠は「休息」ではなく、日中の意思決定の質を最大化するための「戦略的メンテナンス」です。脳のパフォーマンスに直結します。",
            adv_mental: "【ポイント】コンディションは利他（他者への価値提供）の余裕を表す指標です。数値が低い日は無理をせず、自己の回復（睡眠や休養）を最優先してください。"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.dict[window.currentLang] && window.dict[window.currentLang][key]) {
                if (el.id === 'highGoalText') {
                    const savedGoal = localStorage.getItem('highGoal_' + user.id);
                    const jaP = window.dict.ja.high_goal_placeholder;
                    const enP = window.dict.en.high_goal_placeholder;
                    if (savedGoal && savedGoal !== jaP && savedGoal !== enP) el.innerText = savedGoal;
                    else el.innerText = window.dict[window.currentLang].high_goal_placeholder;
                } else {
                    el.innerHTML = window.dict[window.currentLang][key];
                }
            }
        });
    }
    updateLanguage();

    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = () => {
            window.currentLang = (window.currentLang === 'en' ? 'ja' : 'en');
            localStorage.setItem('appLang_' + user.id, window.currentLang);
            updateLanguage();
        };
    }

    // --- High Goal ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        const jaP = window.dict.ja.high_goal_placeholder;
        const enP = window.dict.en.high_goal_placeholder;
        if (savedGoal && savedGoal !== jaP && savedGoal !== enP) goalText.innerText = savedGoal;
        
        goalCard.onclick = () => {
            const currentGoal = localStorage.getItem('highGoal_' + user.id) || "";
            const isFirst = !currentGoal || currentGoal === jaP || currentGoal === enP;
            const newGoal = prompt("あなたの『北極星』を入力：", isFirst ? "" : currentGoal);
            if (newGoal !== null) {
                const final = newGoal.trim() || window.dict[window.currentLang].high_goal_placeholder;
                localStorage.setItem('highGoal_' + user.id, final);
                goalText.innerText = final;
            }
        };
    }

    // --- 起床・就寝ボタン (universal_logs 統合版) ---
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        let lDate = new Date(now);
        if (now.getHours() < 4) lDate.setDate(lDate.getDate() - 1);
        const dateStr = lDate.toLocaleDateString('sv-SE');

        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();
            
        let pToSave = existing && existing.payload ? existing.payload : { measured_date: dateStr };
        pToSave[field] = now.toISOString();

        if (pToSave.waketime && pToSave.bedtime) {
            let wD = new Date(pToSave.waketime);
            let bD = new Date(pToSave.bedtime);
            let diffM = (wD - bD) / (1000 * 60);
            if (diffM < 0) diffM += 24 * 60;
            pToSave.sleep_hours = Math.round((diffM / 60) * 10) / 10;
        }

        if (existing) {
            await supabaseClient.from('universal_logs').update({ payload: pToSave }).eq('id', existing.id);
        } else {
            await supabaseClient.from('universal_logs').insert({
                user_id: user.id, project_id: 'jwa', log_type: 'daily_metric', payload: pToSave
            });
        }
        
        if (doAnimation) {
            const overlay = document.getElementById('nightOverlay');
            if (overlay) {
                overlay.classList.add('active');
                setTimeout(() => { overlay.classList.remove('active'); loadDashboard(); }, 3000);
            }
        } else {
            alert(window.dict[window.currentLang].msg_wake);
            location.href = 'form.html?date=' + dateStr + '&mode=edit';
        }
    }

    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', true);
    if (document.getElementById('btnEditHistory')) {
        document.getElementById('btnEditHistory').onclick = () => { location.href = 'form.html'; };
    }

    // --- ナビゲーションポップアップ ---
    const navModal = document.getElementById('navConfirmModal');
    function openNavModal(titleKey, descKey, targetUrl) {
        if (!navModal) return;
        document.getElementById('navModalTitle').innerText = window.dict[window.currentLang][titleKey];
        document.getElementById('navModalDesc').innerText = window.dict[window.currentLang][descKey];
        navModal.style.display = 'flex';
        document.getElementById('navModalProceed').onclick = () => {
            if (targetUrl) location.href = targetUrl;
            else { navModal.style.display = 'none'; window.scrollTo({ top: 0, behavior: 'smooth' }); }
        };
    }
    if (document.getElementById('navAnalysis')) document.getElementById('navAnalysis').onclick = () => openNavModal('analysis', 'desc_analysis', '');
    if (document.getElementById('navMeals')) document.getElementById('navMeals').onclick = () => openNavModal('nav_meals', 'desc_meals', 'meals.html');
    if (document.getElementById('navHistory')) document.getElementById('navHistory').onclick = () => openNavModal('nav_history', 'desc_history', 'summary.html');

    // --- ダッシュボードデータ読込 (universal_logs 読込ヘルパー) ---
    async function getSortedLogs() {
        const { data } = await supabaseClient
            .from('universal_logs')
            .select('payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric');
        let logs = data ? data.map(d => d.payload) : [];
        logs.sort((a, b) => (b.measured_date || "").localeCompare(a.measured_date || ""));
        return logs;
    }

    window.loadDashboard = async function() {
        const allLogs = await getSortedLogs();
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        
        let streak = kpiData?.[0]?.streak_days || 0;
        let logsCount = kpiData?.[0]?.logs_count || allLogs.filter(l => l.measured_date?.startsWith(new Date().toISOString().slice(0, 7))).length;

        document.getElementById('streakDays').innerText = streak;
        document.getElementById('monthLogs').innerText = logsCount;

        const todayD = new Date();
        if (todayD.getHours() < 4) todayD.setDate(todayD.getDate() - 1);
        const lToday = todayD.toLocaleDateString('sv-SE');
        const todayLog = allLogs.find(l => l.measured_date === lToday);
        if (todayLog && todayLog.waketime) {
            btnWake.classList.add('disabled'); btnBed.classList.remove('disabled');
        } else {
            btnWake.classList.remove('disabled'); btnBed.classList.add('disabled');
        }

        let sleepH = 6;
        if (allLogs.length > 0) {
            const current = allLogs[0];
            const previous = allLogs[1] || null;
            document.getElementById('latestWeight').innerText = current.weight || "--";
            document.getElementById('latestFat').innerText = current.body_fat || "--";
            document.getElementById('latestSleep').innerText = current.sleep_hours || "--";
            sleepH = current.sleep_hours || 6;
            const mFaces = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mFaces[current.mental_condition] || "--";
            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                const el = document.getElementById('deltaWeight');
                el.innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                el.className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
            }
        }

        const grid = document.getElementById('activityGrid');
        if (grid) {
            grid.innerHTML = '';
            const loggedDates = new Set(allLogs.map(l => l.measured_date));
            const now = new Date();
            for (let i = 89; i >= 0; i--) {
                const d = new Date(); d.setDate(now.getDate() - i);
                const dStr = d.toLocaleDateString('sv-SE');
                const cell = document.createElement('div');
                cell.className = 'streak-cell' + (loggedDates.has(dStr) ? ' lv-2' : '');
                grid.appendChild(cell);
            }
        }

        const vValue = document.getElementById('vitalityValue');
        if (vValue) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40 + (streak > 0 ? 10 : 0)));
            vValue.innerText = vScore;
            document.getElementById('vitalityCircle').style.background = `conic-gradient(#10b981 ${vScore}%, #1e293b ${vScore}%)`;
        }

        if (allLogs.length > 0) {
            const logs = allLogs.slice(0, 7).reverse();
            const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
            if (window.mainChart) window.mainChart.destroy();
            const grad = ctx.createLinearGradient(0, 0, 0, 250);
            grad.addColorStop(0, 'rgba(238, 203, 112, 0.9)'); grad.addColorStop(1, 'rgba(138, 106, 28, 0.4)');
            window.mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: logs.map(l => l.measured_date?.split('-')[2]),
                    datasets: [
                        { label: 'Sleep', data: logs.map(l => l.sleep_hours), backgroundColor: grad, borderRadius: 4, yAxisID: 'ySleep' },
                        { label: 'Weight', data: logs.map(l => l.weight), type: 'line', borderColor: '#ffffff', borderWidth: 2, pointBackgroundColor: '#eecb70', tension: 0.4, yAxisID: 'yWeight' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { ySleep: { min: 0, max: 12, ticks: { color: '#8b9bb4' } }, yWeight: { position: 'right', ticks: { color: '#8b9bb4' } } }
                }
            });
        }
    };
    loadDashboard();
});