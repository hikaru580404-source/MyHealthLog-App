document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').then(() => console.log('SW Registered'));
    }

    const user = await checkAuth();
    if (!user) return;
    
    window.dict = {
        adv_weight: "Q. 体重の変動は結果に過ぎません。この数値の変化は、あなたの自己統治のどの部分が影響したと考えますか？",
        adv_sleep: "Q. 本日の睡眠時間と、今日のあなたの『意思決定の質』にはどのような相関がありましたか？",
        adv_mental: "Q. このコンディションは、あなたの『圧倒的利他主義（顧客を救済する余白）』にどう影響しましたか？",
        adv_streak: "Q. 継続は『私ならできる』というエフィカシーの源泉です。このストリークを途切れさせないために、どんな工夫をしていますか？"
    };

    // --- High Goal ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        if (savedGoal) goalText.innerText = savedGoal;
        goalCard.onclick = () => {
            const current = localStorage.getItem('highGoal_' + user.id) || "";
            const newGoal = prompt("あなたの『究極のゴール（北極星）』を入力してください：", current);
            if (newGoal !== null) {
                const textToSave = newGoal.trim() === "" ? "（タップして究極のゴールを設定してください）" : newGoal.trim();
                localStorage.setItem('highGoal_' + user.id, textToSave);
                goalText.innerText = textToSave;
            }
        };
    }

    // --- 主観戦闘力スライダーの連動 ---
    const powerSlider = document.getElementById('powerSlider');
    const powerCircle = document.getElementById('powerCircle');
    const powerValue = document.getElementById('powerValue');
    
    // 初期値の読み込み
    const savedPower = localStorage.getItem('govPower_' + user.id) || 80;
    if(powerSlider) {
        powerSlider.value = savedPower;
        powerValue.innerText = savedPower;
        powerCircle.style.background = `conic-gradient(var(--clr-accent) ${savedPower}%, rgba(255,255,255,0.05) ${savedPower}%)`;
        
        powerSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            powerValue.innerText = val;
            powerCircle.style.background = `conic-gradient(var(--clr-accent) ${val}%, rgba(255,255,255,0.05) ${val}%)`;
        });
        powerSlider.addEventListener('change', (e) => {
            localStorage.setItem('govPower_' + user.id, e.target.value);
        });
    }

    // --- 起床・就寝ボタンのアクション ---
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        const logicalDate = new Date(now.getTime());
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        const dateStr = logicalDate.toLocaleDateString('sv-SE');

        const payload = { user_id: user.id, measured_date: dateStr };
        payload[field] = now.toISOString();

        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', dateStr).maybeSingle();
        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        
        if (doAnimation) {
            // おやすみ完了の劇的アニメーション
            const overlay = document.getElementById('nightOverlay');
            overlay.classList.add('active');
            setTimeout(() => {
                overlay.classList.remove('active');
                loadDashboard(); // アニメーション後に更新
            }, 3000);
        } else {
            alert('記録しました。今日も統治を始めましょう。');
            loadDashboard();
        }
    }
    
    document.getElementById('btnWaketime').onclick = () => quickLog('waketime', false);
    document.getElementById('btnBedtime').onclick = () => quickLog('bedtime', true);

    // --- KPIモーダル制御 ---
    document.querySelectorAll('.kpi-card').forEach(card => {
        card.addEventListener('click', () => {
            const kpi = card.getAttribute('data-kpi');
            document.getElementById('mdKpiTitle').innerText = card.querySelector('.kpi-label').innerText;
            document.getElementById('mdKpiMainValue').innerText = card.querySelector('.kpi-value').innerText;
            document.getElementById('mdAdvice').innerText = dict['adv_' + kpi] || "";
            document.getElementById('kpiDetailModal').style.display = 'flex';
        });
    });

    // --- ダッシュボードデータ読み込み ---
    window.loadDashboard = async function() {
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        let streak = 0;
        if (kpiData?.[0]) {
            streak = kpiData[0].streak_days || 0;
            document.getElementById('streakDays').innerText = streak;
        }

        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
        let sleepH = 6; // デフォルト
        if (recent?.[0]) {
            const current = recent[0];
            document.getElementById('latestWeight').innerText = current.weight || "--";
            document.getElementById('latestSleep').innerText = current.sleep_hours || "--";
            sleepH = current.sleep_hours || 6;
            
            const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mentalMap[current.mental_condition] || "--";
        }
        
        // 【AI客観活力スコアの算出】 睡眠時間とストリークから算出 (Max 100)
        const vitalityCircle = document.getElementById('vitalityCircle');
        const vitalityValue = document.getElementById('vitalityValue');
        if (vitalityCircle) {
            let vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40 + (streak > 0 ? 10 : 0)));
            vitalityValue.innerText = vScore;
            // アニメーションでメーターを上げる
            setTimeout(() => {
                vitalityCircle.style.background = `conic-gradient(#10b981 ${vScore}%, rgba(255,255,255,0.05) ${vScore}%)`;
            }, 500);
        }
        
        // Activity Grid
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
    };
    
    loadDashboard();
});