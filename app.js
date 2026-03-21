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
            analysis: "Analysis", nav_meals: "Meals (Photo)", nav_history: "History",
            msg_wake: "Good morning! Let's start governing today.",
            adv_weight: "[Point] Weight fluctuates daily with water and meals. Focus on the long-term trend (1 week to 1 month) rather than daily changes.",
            adv_fat: "[Point] Body fat % is heavily affected by body water. Measure under the same conditions daily (e.g., after waking/restroom) for accuracy.",
            adv_sleep: "[Point] 7 hours of sleep is not just 'rest', but 'strategic maintenance' to maximize the quality of daytime decisions.",
            adv_mental: "[Point] Condition reflects your margin for altruism. If low, prioritize your own recovery (sleep/rest) without pushing too hard.",
            adv_streak: "[Point] Your streak is proof of your self-efficacy ('I can do it'). Keeping it unbroken as long as possible is crucial.",
            adv_log_count: "[Point] Monthly logged days act as a barometer of your self-governance. A higher log rate enables more accurate reflection."
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
            adv_log_count: "【ポイント】月間の記録日数は、自己を統治できているかの客観的なバロメーターです。記録率が高いほど正確な振り返りが可能になります。"
        }
    };

    function updateLanguage() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (window.dict[window.currentLang] && window.dict[window.currentLang][key]) {
                el.innerHTML = window.dict[window.currentLang][key];
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

    // --- 【新機能】High Goal（粋なコメント付き） ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        const placeholder = window.dict[window.currentLang].high_goal_placeholder;
        if (savedGoal && savedGoal !== placeholder) goalText.innerText = savedGoal;
        
        goalCard.onclick = () => {
            const currentGoal = localStorage.getItem('highGoal_' + user.id) || "";
            const isFirstTime = !currentGoal || currentGoal === placeholder;
            const newGoal = prompt("あなたの『究極のゴール（北極星）』を入力してください：", currentGoal === placeholder ? "" : currentGoal);
            
            if (newGoal !== null) { 
                const finalGoal = newGoal.trim() || placeholder;
                localStorage.setItem('highGoal_' + user.id, finalGoal); 
                goalText.innerText = finalGoal; 
                
                // コメントの出し分け
                if (finalGoal !== placeholder) {
                    if (isFirstTime) {
                        alert("素晴らしい北極星です。統治を始めましょう。");
                    } else {
                        alert("目標の再定義、承知しました。さらなる高みへ。");
                    }
                }
            }
        };
    }

    // --- 操作ガイド（チュートリアル）の表示制御 ---
    const guide = document.getElementById('powerGuide');
    const btnHideGuide = document.getElementById('btnHideGuide');
    if (guide && btnHideGuide) {
        if (localStorage.getItem('hidePowerGuide_' + user.id) !== 'true') {
            guide.style.display = 'block';
        }
        btnHideGuide.onclick = () => {
            localStorage.setItem('hidePowerGuide_' + user.id, 'true');
            guide.style.display = 'none';
        };
    }

    // --- 主観戦闘力：縦ダイヤルと円形メーターの完全連動 ---
    const powerSlider = document.getElementById('powerSlider');
    const powerCircle = document.getElementById('powerCircle');
    const powerValue = document.getElementById('powerValue');
    
    function updatePowerMeter(val) {
        powerValue.innerText = val;
        powerCircle.style.background = `conic-gradient(var(--clr-accent) ${val}%, #1e293b ${val}%)`;
    }

    if(powerSlider) {
        const initialVal = localStorage.getItem('govPower_' + user.id) || 80;
        powerSlider.value = initialVal;
        updatePowerMeter(initialVal); 
        
        powerSlider.addEventListener('input', (e) => {
            updatePowerMeter(e.target.value);
            if (guide && guide.style.display === 'block') { guide.style.display = 'none'; }
        });
        powerSlider.addEventListener('change', (e) => {
            localStorage.setItem('govPower_' + user.id, e.target.value);
        });
    }

    // --- 起床・就寝ボタンのアクション ---
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('sv-SE');
        const payload = { user_id: user.id, measured_date: dateStr };
        payload[field] = now.toISOString();

        if (now.getHours() < 4) {
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            payload.measured_date = yesterday.toLocaleDateString('sv-SE');
            if (field === 'bedtime') payload.bedtime = now.toISOString();
        } else {
            if (field === 'bedtime') payload.bedtime = now.toISOString();
        }
        
        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', payload.measured_date).maybeSingle();
        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        
        if (doAnimation) {
            const overlay = document.getElementById('nightOverlay');
            overlay.classList.add('active');
            setTimeout(() => { overlay.classList.remove('active'); loadDashboard(); }, 3000);
        } else {
            alert(window.dict[window.currentLang].msg_wake);
            location.href = 'form.html?date=' + payload.measured_date + '&mode=edit';
        }
    }

    // 【修正】存在チェック(if)を入れて、summary.htmlでのエラーを防止
    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    const btnEdit = document.getElementById('btnEditHistory');

    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', true);
    if (btnEdit) btnEdit.onclick = () => { location.href = 'form.html'; };

    // --- KPIカードのタップイベントと詳細グラフ ---
    let detailChart = null;
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', async () => {
            const kpi = card.getAttribute('data-kpi');
            document.getElementById('mdKpiTitle').innerText = card.querySelector('.kpi-label').innerText;
            document.getElementById('mdKpiMainValue').innerText = card.querySelector('.kpi-value').innerText;
            document.getElementById('mdAdvice').innerText = window.dict[window.currentLang]['adv_' + kpi] || "";
            document.getElementById('kpiDetailModal').style.display = 'flex';

            if (['streak', 'log_count', 'mental'].includes(kpi)) {
                if (detailChart) detailChart.destroy();
                return;
            }

            const { data } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(30);
            if (!data) return;
            const logs = data.reverse();
            
            if (detailChart) detailChart.destroy();
            const ctx = document.getElementById('detailModalChart').getContext('2d');
            const dbColumn = (kpi === 'sleep' ? 'sleep_hours' : (kpi === 'fat' ? 'body_fat' : kpi));

            detailChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: logs.map(l => l.measured_date.split('-')[2]),
                    datasets: [{
                        label: card.querySelector('.kpi-label').innerText, 
                        data: logs.map(l => l[dbColumn]),
                        borderColor: '#fbbf24', tension: 0.4, fill: true, backgroundColor: 'rgba(251, 191, 36, 0.1)'
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                    scales: { y: { ticks: { color: '#8b9bb4' }, grid: { color: 'rgba(255,255,255,0.05)' } }, x: { ticks: { color: '#8b9bb4' } } }
                }
            });
        });
    });

    // --- ダッシュボードデータ読み込み ---
    window.loadDashboard = async function() {
        // パフォーマンス集計
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        let streak = 0;
        if (kpiData?.[0]) {
            streak = kpiData[0].streak_days || 0;
            document.getElementById('streakDays').innerText = streak;
            document.getElementById('monthLogs').innerText = kpiData[0].logs_count || 0;
        }

        // --- 【新機能】儀式ボタン（Wake/Sleep）の厳格な制限ロジック ---
        if (btnWake && btnBed) {
            const todayD = new Date();
            if (todayD.getHours() < 4) todayD.setDate(todayD.getDate() - 1);
            const logicalTodayStr = todayD.toLocaleDateString('sv-SE');

            const { data: todayLog } = await supabaseClient
                .from('health_logs')
                .select('waketime, bedtime')
                .eq('user_id', user.id)
                .eq('measured_date', logicalTodayStr)
                .maybeSingle();

            if (todayLog && todayLog.waketime) {
                // 今日すでにWakeしている -> Wake不可、Sleep可
                btnWake.classList.add('disabled');
                btnBed.classList.remove('disabled');
            } else {
                // 今日まだWakeしていない -> Wake可、Sleep不可
                btnWake.classList.remove('disabled');
                btnBed.classList.add('disabled');
            }
        }

        // 最新の2件取得（デルタ計算と表示用）
        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
        let sleepH = 6;
        if (recent?.[0]) {
            const current = recent[0];
            const previous = recent[1] || null;
            document.getElementById('latestWeight').innerText = current.weight || "--";
            document.getElementById('latestFat').innerText = current.body_fat || "--";
            document.getElementById('latestSleep').innerText = current.sleep_hours || "--";
            sleepH = current.sleep_hours || 6;
            const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mentalMap[current.mental_condition] || "--";
            
            if (previous && current.weight && previous.weight) {
                const diff = (current.weight - previous.weight).toFixed(1);
                document.getElementById('deltaWeight').innerText = `Δ ${diff > 0 ? '+' : ''}${diff} kg`;
                document.getElementById('deltaWeight').className = `kpi-delta ${diff > 0 ? 'delta-bad' : 'delta-good'}`;
            }
        }
        
        // Activity Grid
        const grid = document.getElementById('activityGrid');
        if (grid) {
            grid.innerHTML = '';
            const { data: history } = await supabaseClient.from('health_logs').select('measured_date').eq('user_id', user.id);
            const loggedDates = new Set(history?.map(h => h.measured_date));
            const now = new Date();
            for (let i = 89; i >= 0; i--) {
                const d = new Date(); d.setDate(now.getDate() - i);
                const dStr = d.toLocaleDateString('sv-SE');
                const cell = document.createElement('div');
                cell.className = 'streak-cell' + (loggedDates.has(dStr) ? ' lv-2' : '');
                grid.appendChild(cell);
            }
        }

        // AI活力スコア (AI算出)
        const vitalityCircle = document.getElementById('vitalityCircle');
        const vitalityValue = document.getElementById('vitalityValue');
        if (vitalityCircle) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40 + (streak > 0 ? 10 : 0)));
            vitalityValue.innerText = vScore;
            setTimeout(() => {
                vitalityCircle.style.background = `conic-gradient(#10b981 ${vScore}%, #1e293b ${vScore}%)`;
            }, 500);
        }

        // Analytics (7-Day Trend Chart)
        const { data: trendData } = await supabaseClient.from('health_logs').select('measured_date, weight, sleep_hours').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(7);
        if (trendData && trendData.length > 0) {
            const logs = trendData.reverse();
            const ctx = document.getElementById('healthCorrelationChart');
            if (ctx) {
                if (window.mainChart) window.mainChart.destroy();
                window.mainChart = new Chart(ctx.getContext('2d'), {
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
        }
    };
    loadDashboard();
});