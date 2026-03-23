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
                window.location.replace('login.html');
            }
        };
    }

    // --- 多言語辞書と翻訳ロジック ---
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
            adv_weight: "[Point] Weight fluctuates daily with water and meals. Focus on the long-term trend (1 week to 1 month) rather than daily changes.",
            adv_fat: "[Point] Body fat % is heavily affected by body water. Measure under the same conditions daily (e.g., after waking/restroom) for accuracy.",
            adv_sleep: "[Point] 7 hours of sleep is not just 'rest', but 'strategic maintenance' to maximize the quality of daytime decisions.",
            adv_mental: "[Point] Condition reflects your margin for altruism. If low, prioritize your own recovery (sleep/rest) without pushing too hard.",
            adv_streak: "[Point] Your streak is proof of your self-efficacy ('I can do it'). Keeping it unbroken as long as possible is crucial.",
            adv_log_count: "[Point] Monthly logged days act as a barometer of your self-governance. A higher log rate enables more accurate reflection.",
            desc_analysis: "View detailed analytics and trend charts of your governance.",
            desc_meals: "Log and review your daily meals with photos.",
            desc_history: "Review past logs, edit or audit your governance history.",
            understood: "Proceed",
            cancel: "Cancel"
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
            adv_weight: "【ポイント】体重は水分量や食事のタイミングで日々変動します。一喜一憂せず、1週間〜1ヶ月の長期的なトレンド（推移）を重視してください。",
            adv_fat: "【ポイント】体脂肪率は計測時の体内水分量に大きく影響されます。毎日同じ条件（例：起床後のトイレ後）で計測することで、精度の高いデータが得られます。",
            adv_sleep: "【ポイント】7時間の睡眠は「休息」ではなく、日中の意思決定の質を最大化するための「戦略的メンテナンス」です。脳のパフォーマンスに直結します。",
            adv_mental: "【ポイント】コンディションは利他（他者への価値提供）の余裕を表す指標です。数値が低い日は無理をせず、自己の回復（睡眠や休養）を最優先してください。",
            adv_streak: "【ポイント】連続記録（ストリーク）は、あなた自身の自己効力感（私ならできるという自信）の証明です。1日でも長く繋ぐことが重要です。",
            adv_log_count: "【ポイント】月間の記録日数は、自己を統治できているかの客観的なバロメーターです。記録率が高いほど正確な振り返りが可能になります。",
            desc_analysis: "これまでの統治記録の推移と、詳細な分析データを確認します。",
            desc_meals: "日々の食事を画像で記録し、食生活の振り返りを行います。",
            desc_history: "過去の統治記録を一覧で振り返り、記録の修正や監査を行います。",
            understood: "了解 / 遷移する",
            cancel: "キャンセル"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.dict[window.currentLang] && window.dict[window.currentLang][key]) {
                if (el.id === 'highGoalText') {
                    const savedGoal = localStorage.getItem('highGoal_' + user.id);
                    const jaPlaceholder = window.dict.ja.high_goal_placeholder;
                    const enPlaceholder = window.dict.en.high_goal_placeholder;
                    if (savedGoal && savedGoal !== jaPlaceholder && savedGoal !== enPlaceholder) {
                        el.innerText = savedGoal;
                    } else {
                        el.innerText = window.dict[window.currentLang].high_goal_placeholder;
                    }
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

    // --- High Goal（北極星） ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        const jaPlaceholder = window.dict.ja.high_goal_placeholder;
        const enPlaceholder = window.dict.en.high_goal_placeholder;
        if (savedGoal && savedGoal !== jaPlaceholder && savedGoal !== enPlaceholder) {
            goalText.innerText = savedGoal;
        } else {
            goalText.innerText = window.dict[window.currentLang].high_goal_placeholder;
        }
        goalCard.onclick = () => {
            const currentGoal = localStorage.getItem('highGoal_' + user.id) || "";
            const isFirstTime = !currentGoal || currentGoal === jaPlaceholder || currentGoal === enPlaceholder;
            const newGoal = prompt("あなたの『究極のゴール（北極星）』を入力してください：", isFirstTime ? "" : currentGoal);
            if (newGoal !== null) {
                const finalGoal = newGoal.trim() || window.dict[window.currentLang].high_goal_placeholder;
                localStorage.setItem('highGoal_' + user.id, finalGoal);
                goalText.innerText = finalGoal;
                if (finalGoal !== jaPlaceholder && finalGoal !== enPlaceholder) {
                    alert(isFirstTime ? "素晴らしい北極星です。統治を始めましょう。" : "目標の再定義、承知しました。さらなる高みへ。");
                }
            }
        };
    }

    // --- 操作ガイド ---
    const guide = document.getElementById('powerGuide');
    const btnHideGuide = document.getElementById('btnHideGuide');
    if (guide && btnHideGuide) {
        if (localStorage.getItem('hidePowerGuide_' + user.id) !== 'true') { guide.style.display = 'block'; }
        btnHideGuide.onclick = () => { localStorage.setItem('hidePowerGuide_' + user.id, 'true'); guide.style.display = 'none'; };
    }

    // --- 主観戦闘力ダイヤル ---
    const powerSlider = document.getElementById('powerSlider');
    const powerCircle = document.getElementById('powerCircle');
    const powerValue  = document.getElementById('powerValue');

    function updatePowerMeter(val) {
        if (!powerValue || !powerCircle) return;
        powerValue.innerText = val;
        powerCircle.style.background = `conic-gradient(#eecb70 ${val}%, #1e293b ${val}%)`;
    }

    if (powerSlider) {
        const initialVal = localStorage.getItem('govPower_' + user.id) || 80;
        powerSlider.value = initialVal;
        updatePowerMeter(initialVal);
        powerSlider.addEventListener('input', (e) => {
            updatePowerMeter(e.target.value);
            if (guide && guide.style.display === 'block') { guide.style.display = 'none'; }
        });
        powerSlider.addEventListener('change', (e) => { localStorage.setItem('govPower_' + user.id, e.target.value); });
    }

    // ============================================================
    // クイックログ（起床・就寝ボタン）
    // MIGRATED: health_logs → universal_logs (payload JSONB)
    // JST固定: toISOString()はUTCのためJST変換して保存
    // ============================================================

    /**
     * 現在時刻をJSTタイムスタンプ文字列として返す
     * 形式: "YYYY-MM-DDTHH:MM:SS+09:00"
     */
    function getNowJSTTimestamp() {
        const now = new Date();
        const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        const y   = jst.getUTCFullYear();
        const mo  = String(jst.getUTCMonth() + 1).padStart(2, '0');
        const d   = String(jst.getUTCDate()).padStart(2, '0');
        const h   = String(jst.getUTCHours()).padStart(2, '0');
        const mi  = String(jst.getUTCMinutes()).padStart(2, '0');
        const s   = String(jst.getUTCSeconds()).padStart(2, '0');
        return `${y}-${mo}-${d}T${h}:${mi}:${s}+09:00`;
    }

    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        // JSTのHH時を取得
        const jstHour = (now.getUTCHours() + 9) % 24;
        const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
        if (jstHour < 4) jstDate.setDate(jstDate.getDate() - 1);
        const dateStr = jstDate.toISOString().slice(0, 10); // YYYY-MM-DD (JST)

        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();

        let pToSave = (existing && existing.payload) ? { ...existing.payload } : { measured_date: dateStr };
        // JST タイムスタンプで保存 (UTC ではなく +09:00 明示)
        pToSave[field] = getNowJSTTimestamp();

        // 睡眠時間の自動算出
        const wTime = field === 'waketime' ? pToSave.waketime : (pToSave.waketime || null);
        const bTime = field === 'bedtime'  ? pToSave.bedtime  : (pToSave.bedtime  || null);
        if (wTime && bTime) {
            let diffM = (new Date(wTime) - new Date(bTime)) / 60000;
            if (diffM < 0) diffM += 1440;
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
    const btnBed  = document.getElementById('btnBedtime');
    const btnEdit = document.getElementById('btnEditHistory');

    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed)  btnBed.onclick  = () => quickLog('bedtime', true);
    if (btnEdit) btnEdit.onclick = () => { location.href = 'form.html'; };

    // --- ナビゲーション・ポップアップ ---
    const navModal  = document.getElementById('navConfirmModal');
    const navTitle  = document.getElementById('navModalTitle');
    const navDesc   = document.getElementById('navModalDesc');
    const navProceed = document.getElementById('navModalProceed');

    function openNavModal(titleKey, descKey, targetUrl) {
        if (!navModal || !navTitle || !navDesc || !navProceed) return;
        navTitle.innerText = window.dict[window.currentLang][titleKey] || titleKey;
        navDesc.innerText  = window.dict[window.currentLang][descKey]  || descKey;
        navModal.style.display = 'flex';
        navProceed.onclick = () => {
            if (targetUrl) { location.href = targetUrl; }
            else { navModal.style.display = 'none'; window.scrollTo({ top: 0, behavior: 'smooth' }); }
        };
    }

    window.onclick = (e) => { if (e.target === navModal) navModal.style.display = 'none'; };

    const btnNavAnalysis = document.getElementById('navAnalysis');
    const btnNavMeals    = document.getElementById('navMeals');
    const btnNavHistory  = document.getElementById('navHistory');

    if (btnNavAnalysis) btnNavAnalysis.onclick = () => openNavModal('analysis',   'desc_analysis', '');
    if (btnNavMeals)    btnNavMeals.onclick    = () => openNavModal('nav_meals',  'desc_meals',    'meals.html');
    if (btnNavHistory)  btnNavHistory.onclick  = () => openNavModal('nav_history','desc_history',  'summary.html');

    // --- KPI詳細グラフ（モーダル）---
    let detailChart = null;
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', async () => {
            const kpi = card.getAttribute('data-kpi');
            const titleEl     = document.getElementById('mdKpiTitle');
            const mainValueEl = document.getElementById('mdKpiMainValue');
            const adviceEl    = document.getElementById('mdAdvice');
            const modalEl     = document.getElementById('kpiDetailModal');

            if (titleEl)     titleEl.innerText     = card.querySelector('.kpi-label')?.innerText || '';
            if (mainValueEl) mainValueEl.innerText  = card.querySelector('.kpi-value')?.innerText || '';
            if (adviceEl)    adviceEl.innerText     = window.dict[window.currentLang]['adv_' + kpi] || "";
            if (modalEl)     modalEl.style.display  = 'flex';

            if (['streak', 'log_count', 'mental'].includes(kpi)) {
                if (detailChart) { detailChart.destroy(); detailChart = null; }
                return;
            }

            // MIGRATED: universal_logs
            const { data: rawLogs } = await supabaseClient
                .from('universal_logs')
                .select('payload')
                .eq('user_id', user.id)
                .eq('project_id', 'jwa')
                .eq('log_type', 'daily_metric');

            if (!rawLogs) return;
            const logs = rawLogs.map(r => r.payload)
                                .sort((a,b) => (a.measured_date||'').localeCompare(b.measured_date||''))
                                .slice(-30);

            if (detailChart) { detailChart.destroy(); detailChart = null; }
            const chartCanvas = document.getElementById('detailModalChart');
            if (!chartCanvas) return;
            const ctx = chartCanvas.getContext('2d');
            const dbColumn = (kpi === 'sleep' ? 'sleep_hours' : (kpi === 'fat' ? 'body_fat' : kpi));

            const gradientLine = ctx.createLinearGradient(0, 0, 0, 180);
            gradientLine.addColorStop(0, 'rgba(238, 203, 112, 0.4)');
            gradientLine.addColorStop(1, 'rgba(238, 203, 112, 0)');

            detailChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: logs.map(l => (l.measured_date||'').split('-')[2]),
                    datasets: [{
                        label: card.querySelector('.kpi-label')?.innerText || '',
                        data: logs.map(l => l[dbColumn]),
                        borderColor: '#eecb70', borderWidth: 2,
                        pointBackgroundColor: '#fff', pointBorderColor: '#eecb70', pointBorderWidth: 1.5,
                        tension: 0.4, fill: true, backgroundColor: gradientLine
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: '#8b9bb4' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                        x: { ticks: { color: '#8b9bb4' } }
                    }
                }
            });
        });
    });

    // ============================================================
    // ダッシュボードデータ描画
    // MIGRATED: health_logs → universal_logs (payload JSONB)
    // ============================================================
    window.loadDashboard = async function() {

        // universal_logs から全データ取得
        const { data: rawLogs } = await supabaseClient
            .from('universal_logs')
            .select('payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric');

        const allLogs = rawLogs
            ? rawLogs.map(r => r.payload).sort((a,b) => (b.measured_date||'').localeCompare(a.measured_date||''))
            : [];

        // --- Streak 計算 (JST基準) ---
        let streak = 0;
        const loggedDates = new Set(allLogs.map(l => l.measured_date));
        const nowForStreak = new Date();
        const jstHourStreak = (nowForStreak.getUTCHours() + 9) % 24;
        const todayD = new Date(nowForStreak.getTime() + 9 * 60 * 60 * 1000);
        if (jstHourStreak < 4) todayD.setDate(todayD.getDate() - 1);
        for (let i = 0; i < 365; i++) {
            const d = new Date(todayD); d.setDate(d.getDate() - i);
            if (loggedDates.has(d.toISOString().slice(0, 10))) streak++;
            else break;
        }
        // --- 今月ログ数 (JST基準) ---
        const nowForMonth = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
        const thisMonth = nowForMonth.toISOString().slice(0, 7);
        const monthLogs = allLogs.filter(l => (l.measured_date||'').startsWith(thisMonth)).length;

        const elStreakDays = document.getElementById('streakDays');
        if (elStreakDays) elStreakDays.innerText = streak;
        const elMonthLogs = document.getElementById('monthLogs');
        if (elMonthLogs)  elMonthLogs.innerText  = monthLogs;

        // --- 起床/就寝ボタン状態 (JST基準) ---
        if (btnWake && btnBed) {
            const logicalTodayStr = todayD.toISOString().slice(0, 10);
            const todayLog = allLogs.find(l => l.measured_date === logicalTodayStr);
            if (todayLog && todayLog.waketime) {
                btnWake.classList.add('disabled'); btnBed.classList.remove('disabled');
            } else {
                btnWake.classList.remove('disabled'); btnBed.classList.add('disabled');
            }
        }

        // --- KPI カード ---
        let sleepH = 6;
        if (allLogs.length > 0) {
            const current  = allLogs[0];
            const previous = allLogs[1] || null;

            const elLatestWeight = document.getElementById('latestWeight');
            if (elLatestWeight) elLatestWeight.innerText = current.weight    || "--";
            const elLatestFat    = document.getElementById('latestFat');
            if (elLatestFat)    elLatestFat.innerText    = current.body_fat  || "--";
            const elLatestSleep  = document.getElementById('latestSleep');
            if (elLatestSleep)  elLatestSleep.innerText  = current.sleep_hours || "--";
            sleepH = current.sleep_hours || 6;

            const elLatestMental = document.getElementById('latestMental');
            if (elLatestMental) {
                const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
                elLatestMental.innerText = mentalMap[current.mental_condition] || "--";
            }

            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                const elDeltaWeight = document.getElementById('deltaWeight');
                if (elDeltaWeight) {
                    elDeltaWeight.innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                    elDeltaWeight.className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
                }
            }
        }

        // --- Activity Grid (過去90日, JST基準) ---
        const grid = document.getElementById('activityGrid');
        if (grid) {
            grid.innerHTML = '';
            const nowJST = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
            for (let i = 89; i >= 0; i--) {
                const d = new Date(nowJST); d.setDate(nowJST.getDate() - i);
                const dStr = d.toISOString().slice(0, 10);
                const cell = document.createElement('div');
                cell.className = 'streak-cell' + (loggedDates.has(dStr) ? ' lv-2' : '');
                grid.appendChild(cell);
            }
        }

        // --- Vitality サークル ---
        const vitalityCircle = document.getElementById('vitalityCircle');
        const vitalityValue  = document.getElementById('vitalityValue');
        if (vitalityCircle && vitalityValue) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40 + (streak > 0 ? 10 : 0)));
            vitalityValue.innerText = vScore;
            setTimeout(() => {
                vitalityCircle.style.background = `conic-gradient(#10b981 ${vScore}%, #1e293b ${vScore}%)`;
            }, 500);
        }

        // --- トレンドチャート（直近7日） ---
        const trendLogs = allLogs.slice(0, 7).reverse();
        if (trendLogs.length > 0) {
            const chartCanvas = document.getElementById('healthCorrelationChart');
            if (chartCanvas) {
                const ctx = chartCanvas.getContext('2d');
                if (window.mainChart) window.mainChart.destroy();

                const gradientSleep = ctx.createLinearGradient(0, 0, 0, 250);
                gradientSleep.addColorStop(0, 'rgba(238, 203, 112, 0.9)');
                gradientSleep.addColorStop(1, 'rgba(138, 106, 28, 0.4)');

                window.mainChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: trendLogs.map(l => (l.measured_date||'').split('-')[2]),
                        datasets: [
                            {
                                label: 'Sleep (h)',
                                data: trendLogs.map(l => l.sleep_hours),
                                backgroundColor: gradientSleep,
                                borderRadius: 4,
                                yAxisID: 'ySleep'
                            },
                            {
                                label: 'Weight (kg)',
                                data: trendLogs.map(l => l.weight),
                                type: 'line',
                                borderColor: '#ffffff', borderWidth: 2,
                                pointBackgroundColor: '#eecb70', pointBorderColor: '#ffffff', pointBorderWidth: 1.5,
                                pointRadius: 4, tension: 0.4,
                                yAxisID: 'yWeight'
                            }
                        ]
                    },
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            ySleep:  { type: 'linear', position: 'left',  min: 0, max: 12, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#8b9bb4' } },
                            yWeight: { type: 'linear', position: 'right', grid: { display: false }, ticks: { color: '#8b9bb4' } }
                        }
                    }
                });
            }
        }
    };

    loadDashboard();
});
