document.addEventListener('DOMContentLoaded', async () => {
    // 1. Service Worker & Auth Check
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(() => console.log('SW Registered')); }
    const user = await checkAuth();
    if (!user) return;
    
    // グローバルデータ（モーダル描画用）
    window.globalAllLogs = [];

    // --- ログアウト ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            if(confirm("ログアウトしますか？")) {
                await supabaseClient.auth.signOut();
                location.href = 'login.html';
            }
        };
    }

    // --- 多言語辞書 (i18n) ---
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
            adv_fat: "[Point] Body fat % is heavily affected by body water. Measure under the same conditions daily (e.g., after waking) for accuracy.",
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
                el.innerHTML = window.dict[window.currentLang][key];
            }
        });
        // High Goalのプレースホルダー処理
        const goalText = document.getElementById('highGoalText');
        if (goalText) {
            const savedGoal = localStorage.getItem('highGoal_' + user.id);
            const jaP = window.dict.ja.high_goal_placeholder;
            const enP = window.dict.en.high_goal_placeholder;
            if (savedGoal && savedGoal !== jaP && savedGoal !== enP) goalText.innerText = savedGoal;
            else goalText.innerText = window.dict[window.currentLang].high_goal_placeholder;
        }
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

    // --- High Goal 設定 ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        goalCard.onclick = () => {
            const currentGoal = localStorage.getItem('highGoal_' + user.id) || "";
            const isFirst = !currentGoal || currentGoal === window.dict.ja.high_goal_placeholder || currentGoal === window.dict.en.high_goal_placeholder;
            const newGoal = prompt("あなたの『北極星（究極のゴール）』を入力：", isFirst ? "" : currentGoal);
            if (newGoal !== null) {
                const final = newGoal.trim() || window.dict[window.currentLang].high_goal_placeholder;
                localStorage.setItem('highGoal_' + user.id, final);
                goalText.innerText = final;
            }
        };
    }

    // --- 主観戦闘力（ダイヤル）の制御 ---
    const powerSlider = document.getElementById('powerSlider');
    const powerValue = document.getElementById('powerValue');
    const powerCircle = document.getElementById('powerCircle');
    if (powerSlider && powerValue && powerCircle) {
        const savedPower = localStorage.getItem('govPower_' + user.id) || 80;
        powerSlider.value = savedPower;
        powerValue.innerText = savedPower;
        powerCircle.style.background = `conic-gradient(#eecb70 ${savedPower}%, #1e293b ${savedPower}%)`;

        powerSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            powerValue.innerText = val;
            powerCircle.style.background = `conic-gradient(#eecb70 ${val}%, #1e293b ${val}%)`;
            localStorage.setItem('govPower_' + user.id, val);
        });
    }

    // --- チュートリアルガイドの非表示制御 ---
    const powerGuide = document.getElementById('powerGuide');
    const btnHideGuide = document.getElementById('btnHideGuide');
    if (powerGuide && btnHideGuide) {
        if (!localStorage.getItem('hidePowerGuide_' + user.id)) {
            powerGuide.style.display = 'block';
        }
        btnHideGuide.onclick = () => {
            powerGuide.style.display = 'none';
            localStorage.setItem('hidePowerGuide_' + user.id, 'true');
        };
    }

    // --- クイックログ機能 (起床・就寝) ---
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        let lDate = new Date(now);
        if (now.getHours() < 4) lDate.setDate(lDate.getDate() - 1); // 深夜4時ルール
        const dateStr = lDate.toLocaleDateString('sv-SE');
        const timeISO = now.toISOString();

        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();
            
        let pToSave = existing && existing.payload ? existing.payload : { measured_date: dateStr };
        pToSave[field] = timeISO;

        // 睡眠時間の自動計算
        if (pToSave.waketime && pToSave.bedtime) {
            let wD = new Date(pToSave.waketime);
            let bD = new Date(pToSave.bedtime);
            let diffM = (wD - bD) / 60000;
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
            location.href = 'form.html?date=' + dateStr;
        }
    }

    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', true);

    // --- ナビゲーションポップアップ (Nav Confirm) ---
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
    if (document.getElementById('btnEditHistory')) document.getElementById('btnEditHistory').onclick = () => { location.href = 'form.html'; };

    // --- ★ 復元：KPIカードのクリック詳細表示 (Detail Modal) ---
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            const kpiType = card.getAttribute('data-kpi');
            if (!kpiType || kpiType === 'streak' || kpiType === 'log_count') return;
            openKpiDetailModal(kpiType);
        });
    });

    function openKpiDetailModal(kpiType) {
        const modal = document.getElementById('kpiDetailModal');
        if(!modal) return;

        const titleEl = document.getElementById('mdKpiTitle');
        const mainValEl = document.getElementById('mdKpiMainValue');
        const adviceEl = document.getElementById('mdAdvice');

        let title = "";
        let val = "--";
        let logs = window.globalAllLogs.slice(0, 30).reverse(); // 直近30日のデータを抽出
        let chartData = [];
        let chartLabel = "";
        let chartColor = "";

        const latestLog = window.globalAllLogs[0] || {};
        const dict = window.dict[window.currentLang];

        if (kpiType === 'weight') {
            title = dict.weight;
            val = (latestLog.weight ? latestLog.weight.toFixed(1) : "--") + " kg";
            adviceEl.innerText = dict.adv_weight;
            chartData = logs.map(l => l.weight || null);
            chartLabel = "Weight (kg)";
            chartColor = "#f8fafc";
        } else if (kpiType === 'fat') {
            title = dict.fat;
            val = (latestLog.body_fat ? latestLog.body_fat.toFixed(1) : "--") + " %";
            adviceEl.innerText = dict.adv_fat;
            chartData = logs.map(l => l.body_fat || null);
            chartLabel = "Body Fat (%)";
            chartColor = "#38bdf8";
        } else if (kpiType === 'sleep') {
            title = dict.sleep_lbl;
            val = (latestLog.sleep_hours ? latestLog.sleep_hours.toFixed(1) : "--") + " h";
            adviceEl.innerText = dict.adv_sleep;
            chartData = logs.map(l => l.sleep_hours || null);
            chartLabel = "Sleep (h)";
            chartColor = "#eecb70";
        } else if (kpiType === 'mental') {
            title = dict.mental;
            const mFaces = ["", "😫", "😟", "😐", "🙂", "🤩"];
            val = latestLog.mental_condition ? mFaces[latestLog.mental_condition] : "--";
            adviceEl.innerText = dict.adv_mental;
            chartData = logs.map(l => l.mental_condition || null);
            chartLabel = "Mental Level";
            chartColor = "#10b981";
        }

        titleEl.innerText = title;
        mainValEl.innerText = val;

        renderDetailChart(logs.map(l => l.measured_date.split('-')[2] + "日"), chartData, chartLabel, chartColor);
        modal.style.display = 'flex';
    }

    function renderDetailChart(labels, data, labelName, color) {
        const ctx = document.getElementById('detailModalChart').getContext('2d');
        if (window.detailChart) window.detailChart.destroy();

        window.detailChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: data,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    pointBackgroundColor: color,
                    pointRadius: 4,
                    tension: 0.3,
                    spanGaps: true // nullデータをスキップして線を繋ぐ
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { display: false } },
                    y: { ticks: { color: color, font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // --- ダッシュボードデータ読込 ---
    window.loadDashboard = async function() {
        const { data } = await supabaseClient
            .from('universal_logs')
            .select('payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric');
            
        let allLogs = data ? data.map(d => d.payload) : [];
        allLogs.sort((a, b) => (b.measured_date || "").localeCompare(a.measured_date || ""));
        window.globalAllLogs = allLogs; // グローバルに保存して詳細グラフで再利用

        // 簡易ストリーク＆カウント計算（RPCエラー時のフェイルセーフ含む）
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        let streak = kpiData?.[0]?.streak_days || 0;
        let logsCount = kpiData?.[0]?.logs_count || allLogs.filter(l => l.measured_date?.startsWith(new Date().toISOString().slice(0, 7))).length;

        document.getElementById('streakDays').innerText = streak;
        document.getElementById('monthLogs').innerText = logsCount;

        const todayD = new Date();
        if (todayD.getHours() < 4) todayD.setDate(todayD.getDate() - 1);
        const lToday = todayD.toLocaleDateString('sv-SE');
        
        // ボタン状態の切り替え
        const todayLog = allLogs.find(l => l.measured_date === lToday);
        if (todayLog && todayLog.waketime && !todayLog.bedtime) {
            if(btnWake) btnWake.classList.add('disabled'); 
            if(btnBed) btnBed.classList.remove('disabled');
        } else {
            if(btnWake) btnWake.classList.remove('disabled'); 
            if(btnBed) btnBed.classList.add('disabled');
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
            document.getElementById('latestMental').innerText = current.mental_condition ? mFaces[current.mental_condition] : "--";
            
            // 体重の増減差分表示
            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                const el = document.getElementById('deltaWeight');
                el.innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                el.className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
            }
        }

        // Activity Grid の描画
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

        // Vitality Score (客観活力) の計算
        const vValue = document.getElementById('vitalityValue');
        const vCircle = document.getElementById('vitalityCircle');
        if (vValue && vCircle) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40 + (streak > 0 ? 10 : 0)));
            vValue.innerText = vScore;
            vCircle.style.background = `conic-gradient(#10b981 ${vScore}%, #1e293b ${vScore}%)`;
        }

        // トップ画面の7日間相関チャート描画
        if (allLogs.length > 0) {
            const logs = allLogs.slice(0, 7).reverse();
            const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
            if (window.mainChart) window.mainChart.destroy();
            const grad = ctx.createLinearGradient(0, 0, 0, 250);
            grad.addColorStop(0, 'rgba(238, 203, 112, 0.9)'); 
            grad.addColorStop(1, 'rgba(138, 106, 28, 0.4)');
            
            window.mainChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: logs.map(l => l.measured_date?.split('-')[2] + "日"),
                    datasets: [
                        { label: 'Sleep', data: logs.map(l => l.sleep_hours), backgroundColor: grad, borderRadius: 4, yAxisID: 'ySleep' },
                        { label: 'Weight', data: logs.map(l => l.weight), type: 'line', borderColor: '#ffffff', borderWidth: 2, pointBackgroundColor: '#eecb70', tension: 0.4, spanGaps: true, yAxisID: 'yWeight' }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { 
                        ySleep: { position: 'left', min: 0, max: 12, ticks: { color: '#8b9bb4' }, grid: { color: 'rgba(255,255,255,0.05)' } }, 
                        yWeight: { position: 'right', ticks: { color: '#eecb70' }, grid: { display: false } } 
                    }
                }
            });
        }
    };
    
    // 初期化実行
    loadDashboard();
});