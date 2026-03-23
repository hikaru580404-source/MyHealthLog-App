document.addEventListener('DOMContentLoaded', async () => {
    // 1. Auth Check (Assuming auth.js provides checkAuth and supabaseClient)
    if (typeof checkAuth === 'function') {
        const user = await checkAuth();
        if (!user) return;
        window.currentUser = user;
    }
    
    // グローバルデータ（モーダル描画用）
    window.globalAllLogs = [];

    // --- 多言語辞書 (i18n) 2.0対応版 ---
    window.currentLang = localStorage.getItem('appLang_2.0') || 'en'; // デフォルトは英語
    window.dict = {
        en: {
            app_title: "GOVERNANCE LOG",
            north_star: "NORTH STAR",
            vitality_ai: "VITALITY SCORE",
            gov_power: "GOVERNANCE POWER",
            daily_kpi: "DAILY LOG (KPIs)",
            weight: "WEIGHT",
            fat: "BODY FAT",
            sleep_lbl: "SLEEP",
            mental: "MENTAL",
            hint_click_kpi: "* Tap cards for detailed charts & AI advice.",
            wake: "Wake",
            sleep: "Sleep",
            edit_history: "Edit Daily Log",
            close: "Close",
            night_msg: "Governance completed. Good night.",
            high_goal_placeholder: "(Tap to set your North Star / Ultimate Goal)",
            adv_weight: "[Analysis] Focus on the long-term trend (1-4 weeks) rather than daily water fluctuations.",
            adv_fat: "[Analysis] Measure under identical conditions daily (e.g., after waking up) for precise tracking.",
            adv_sleep: "[Analysis] Sleep is strategic maintenance. Aim for quality to maximize daytime decision making.",
            adv_mental: "[Analysis] Represents your margin for altruism. Prioritize recovery if the level drops."
        },
        ja: {
            app_title: "統治ログ",
            north_star: "北極星（究極のゴール）",
            vitality_ai: "客観活力",
            gov_power: "主観戦闘力",
            daily_kpi: "日次記録 (KPIs)",
            weight: "体重",
            fat: "体脂肪率",
            sleep_lbl: "睡眠時間",
            mental: "コンディション",
            hint_click_kpi: "※カードをタップで詳細トレンドとAI分析を表示",
            wake: "起床",
            sleep: "就寝",
            edit_history: "過去の記録を編集する",
            close: "閉じる",
            night_msg: "今日も統治完了。おやすみなさい。",
            high_goal_placeholder: "（タップして究極のゴールを設定）",
            adv_weight: "【分析】日々の水分量で変動します。一喜一憂せず、1週間〜1ヶ月の長期トレンドを重視してください。",
            adv_fat: "【分析】毎日同じ条件（起床後など）で計測することで、ノイズのない正確な推移が把握できます。",
            adv_sleep: "【分析】睡眠は「戦略的メンテナンス」です。日中の意思決定の質を最大化するために確保しましょう。",
            adv_mental: "【分析】利他のための「余裕」の指標です。低下している場合は自己回復を最優先にしてください。"
        }
    };

    // --- 言語アップデート処理 ---
    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.dict[window.currentLang] && window.dict[window.currentLang][key]) {
                el.innerHTML = window.dict[window.currentLang][key];
            }
        });
        
        // 言語トグルボタンの表示更新
        const langBtn = document.getElementById('langToggleBtn');
        if (langBtn) {
            langBtn.innerText = window.currentLang === 'en' ? 'EN | ja' : 'en | JA';
        }

        // High Goalのプレースホルダー処理
        const goalText = document.getElementById('highGoalText');
        if (goalText) {
            const savedGoal = localStorage.getItem('highGoal_v2');
            const jaP = window.dict.ja.high_goal_placeholder;
            const enP = window.dict.en.high_goal_placeholder;
            if (savedGoal && savedGoal !== jaP && savedGoal !== enP) goalText.innerText = savedGoal;
            else goalText.innerText = window.dict[window.currentLang].high_goal_placeholder;
        }
    }
    updateLanguage();

    // 言語切り替えイベント
    const langBtn = document.getElementById('langToggleBtn');
    if (langBtn) {
        langBtn.onclick = () => {
            window.currentLang = (window.currentLang === 'en' ? 'ja' : 'en');
            localStorage.setItem('appLang_2.0', window.currentLang);
            updateLanguage();
        };
    }

    // --- High Goal 設定 ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        goalCard.onclick = () => {
            const currentGoal = localStorage.getItem('highGoal_v2') || "";
            const isFirst = !currentGoal || currentGoal === window.dict.ja.high_goal_placeholder || currentGoal === window.dict.en.high_goal_placeholder;
            const newGoal = prompt(window.currentLang === 'ja' ? "あなたの『北極星』を入力：" : "Enter your North Star:", isFirst ? "" : currentGoal);
            if (newGoal !== null) {
                const final = newGoal.trim() || window.dict[window.currentLang].high_goal_placeholder;
                localStorage.setItem('highGoal_v2', final);
                goalText.innerText = final;
            }
        };
    }

    // --- 主観戦闘力（ダイヤル）の制御 ---
    const powerSlider = document.getElementById('powerSlider');
    const powerValue = document.getElementById('powerValue');
    const powerCircle = document.getElementById('powerCircle');
    if (powerSlider && powerValue && powerCircle) {
        const savedPower = localStorage.getItem('govPower_v2') || 80;
        powerSlider.value = savedPower;
        powerValue.innerText = savedPower;
        powerCircle.style.background = `conic-gradient(var(--clr-primary) ${savedPower}%, var(--clr-bg) ${savedPower}%)`;

        powerSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            powerValue.innerText = val;
            powerCircle.style.background = `conic-gradient(var(--clr-primary) ${val}%, var(--clr-bg) ${val}%)`;
            localStorage.setItem('govPower_v2', val);
        });
    }

    // --- KPIカードのクリック詳細表示 (Detail Modal) ---
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            const kpiType = card.getAttribute('data-kpi');
            if (kpiType) openKpiDetailModal(kpiType);
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
        let logs = window.globalAllLogs.slice(0, 30).reverse(); // 直近30日のデータ
        let chartData = [];
        let chartLabel = "";

        const latestLog = window.globalAllLogs[0] || {};
        const dict = window.dict[window.currentLang];

        if (kpiType === 'weight') {
            title = dict.weight;
            val = (latestLog.weight ? latestLog.weight.toFixed(1) : "--") + " kg";
            adviceEl.innerText = dict.adv_weight;
            chartData = logs.map(l => l.weight || null);
            chartLabel = "Weight (kg)";
        } else if (kpiType === 'fat') {
            title = dict.fat;
            val = (latestLog.body_fat ? latestLog.body_fat.toFixed(1) : "--") + " %";
            adviceEl.innerText = dict.adv_fat;
            chartData = logs.map(l => l.body_fat || null);
            chartLabel = "Body Fat (%)";
        } else if (kpiType === 'sleep') {
            title = dict.sleep_lbl;
            val = (latestLog.sleep_hours ? latestLog.sleep_hours.toFixed(1) : "--") + " h";
            adviceEl.innerText = dict.adv_sleep;
            chartData = logs.map(l => l.sleep_hours || null);
            chartLabel = "Sleep (h)";
        } else if (kpiType === 'mental') {
            title = dict.mental;
            const mFaces = ["", "😫", "😟", "😐", "🙂", "🤩"];
            val = latestLog.mental_condition ? mFaces[latestLog.mental_condition] : "--";
            adviceEl.innerText = dict.adv_mental;
            chartData = logs.map(l => l.mental_condition || null);
            chartLabel = "Mental Level";
        }

        titleEl.innerText = title;
        mainValEl.innerText = val;

        // チャートの描画
        const labels = logs.map(l => {
            const parts = l.measured_date.split('-');
            return `${parts[1]}/${parts[2]}`; // MM/DD 形式
        });
        renderDetailChart(labels, chartData, chartLabel);
        modal.style.display = 'flex';
    }

    function renderDetailChart(labels, data, labelName) {
        const ctx = document.getElementById('detailModalChart').getContext('2d');
        if (window.detailChart) window.detailChart.destroy();

        window.detailChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: labelName,
                    data: data,
                    borderColor: '#eecb70', // ゴールド
                    backgroundColor: 'rgba(238, 203, 112, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#eecb70',
                    pointRadius: 3,
                    tension: 0.3,
                    fill: true,
                    spanGaps: true
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { family: 'Inter' }, maxTicksLimit: 7 }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }

    // --- クイックログ機能 (起床・就寝 / 深夜4時バグ対策済み) ---
    async function quickLog(field, doAnimation = false) {
        if (!window.currentUser) return;
        const now = new Date();
        
        // 日本時間のタイムスタンプ文字列を手動生成 (YYYY-MM-DD HH:mm:ss+09)
        const offset = now.getTimezoneOffset() * 60000;
        const localISO = new Date(now - offset).toISOString().slice(0, 19).replace('T', ' ') + "+09";

        let lDate = new Date(now);
        if (now.getHours() < 4) lDate.setDate(lDate.getDate() - 1); // 深夜4時ルール
        const dateStr = lDate.toLocaleDateString('sv-SE');

        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', window.currentUser.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();
            
        let pToSave = existing && existing.payload ? existing.payload : { measured_date: dateStr };
        pToSave[field] = localISO;

        // 睡眠時間の自動計算
        if (pToSave.waketime && pToSave.bedtime) {
            let wD = new Date(pToSave.waketime.replace(' ', 'T'));
            let bD = new Date(pToSave.bedtime.replace(' ', 'T'));
            let diffM = (wD - bD) / 60000;
            if (diffM < 0) diffM += 24 * 60;
            pToSave.sleep_hours = Math.round((diffM / 60) * 10) / 10;
        }

        if (existing) {
            await supabaseClient.from('universal_logs').update({ payload: pToSave }).eq('id', existing.id);
        } else {
            await supabaseClient.from('universal_logs').insert({
                user_id: window.currentUser.id, project_id: 'jwa', log_type: 'daily_metric', payload: pToSave
            });
        }
        
        if (doAnimation) {
            const overlay = document.getElementById('nightOverlay');
            if (overlay) {
                overlay.classList.add('active');
                setTimeout(() => { overlay.classList.remove('active'); loadDashboard(); }, 3000);
            }
        } else {
            alert(window.currentLang === 'ja' ? "おはようございます！記録しました。" : "Good morning! Logged successfully.");
            loadDashboard(); // リロードせずに画面更新
        }
    }

    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', true);
    
    // フォームへの遷移
    const btnEdit = document.getElementById('btnEditHistory');
    if (btnEdit) btnEdit.onclick = () => { location.href = 'form.html'; };

    // --- ダッシュボードデータ読込 ---
    window.loadDashboard = async function() {
        if (!window.currentUser || typeof supabaseClient === 'undefined') return;

        const { data } = await supabaseClient
            .from('universal_logs')
            .select('payload')
            .eq('user_id', window.currentUser.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric');
            
        let allLogs = data ? data.map(d => d.payload) : [];
        allLogs.sort((a, b) => (b.measured_date || "").localeCompare(a.measured_date || ""));
        window.globalAllLogs = allLogs;

        const todayD = new Date();
        if (todayD.getHours() < 4) todayD.setDate(todayD.getDate() - 1);
        const lToday = todayD.toLocaleDateString('sv-SE');
        
        const todayLog = allLogs.find(l => l.measured_date === lToday);
        if (todayLog && todayLog.waketime && !todayLog.bedtime) {
            if(btnWake) { btnWake.style.opacity = '0.5'; btnWake.style.pointerEvents = 'none'; }
            if(btnBed) { btnBed.style.opacity = '1'; btnBed.style.pointerEvents = 'auto'; }
        } else {
            if(btnWake) { btnWake.style.opacity = '1'; btnWake.style.pointerEvents = 'auto'; }
            if(btnBed) { btnBed.style.opacity = '0.5'; btnBed.style.pointerEvents = 'none'; }
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
            
            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                const el = document.getElementById('deltaWeight');
                el.innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                el.className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
            }
        }

        // Vitality Score (客観活力)
        const vValue = document.getElementById('vitalityValue');
        const vCircle = document.getElementById('vitalityCircle');
        if (vValue && vCircle) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40));
            vValue.innerText = vScore;
            vCircle.style.background = `conic-gradient(var(--clr-good) ${vScore}%, var(--clr-bg) ${vScore}%)`;
        }
    };
    
    // 初期化実行
    loadDashboard();
});