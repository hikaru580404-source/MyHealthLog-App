document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(() => console.log('SW Registered')); }
    const user = await checkAuth();
    if (!user) return;
    
    // --- High Goal ---
    const goalCard = document.getElementById('highGoalCard');
    const goalText = document.getElementById('highGoalText');
    if (goalCard && goalText) {
        const savedGoal = localStorage.getItem('highGoal_' + user.id);
        if (savedGoal) goalText.innerText = savedGoal;
        goalCard.onclick = () => {
            const newGoal = prompt("あなたの『究極のゴール（北極星）』を入力してください：", localStorage.getItem('highGoal_' + user.id) || "");
            if (newGoal !== null) { localStorage.setItem('highGoal_' + user.id, newGoal.trim() || "（タップして設定）"); goalText.innerText = newGoal.trim() || "（タップして設定）"; }
        };
    }

    // --- 主観戦闘力スライダーの連動 ---
    const powerSlider = document.getElementById('powerSlider');
    const powerValue = document.getElementById('powerValue');
    if(powerSlider) {
        powerValue.innerText = powerSlider.value = localStorage.getItem('govPower_' + user.id) || 80;
        powerSlider.addEventListener('input', (e) => powerValue.innerText = e.target.value );
        powerSlider.addEventListener('change', (e) => localStorage.setItem('govPower_' + user.id, e.target.value));
    }

    // --- 起床・就寝ボタンのアクション ---
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        const dateStr = now.toLocaleDateString('sv-SE');
        const payload = { user_id: user.id, measured_date: dateStr };
        payload[field] = now.toISOString();

        // 深夜4時ルール（前日扱い）
        if (now.getHours() < 4) {
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            payload.measured_date = yesterday.toLocaleDateString('sv-SE');
            // bedtime の場合、measured_dateとbtを前日、measured_dateとbtのタイムスタンプを前日の bt に
            if (field === 'bedtime') { /* bedtime 登録時に measures_date を昨日に。Btをそのタイムスタンプに。 BTのタイムスタンプは BTカラムへ。 btのタイムスタンプはそのまま。 */
                payload.bedtime = now.toISOString();
            }
        } else {
            // daytime（Wakeの場合） measured_date は今日。 bt も今日。 BT のタイムスタンプは BTカラムへ。 btのタイムスタンプはそのまま。
            if (field === 'bedtime') {
               payload.bedtime = now.toISOString(); // 今日 BT。 BTのタイムスタンプは BTカラムへ。btのタイムスタンプはそのまま。
            }
        }
        
        // Supabase Upsert
        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', payload.measured_date).maybeSingle();
        if (existing) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
        else await supabaseClient.from('health_logs').insert(payload);
        
        // 保存成功時の処理
        if (doAnimation) {
            // アニメーション (Gridのドット点灯)
            document.getElementById('bedtimeLogIndicator')?.classList.add('recorded');
            loadDashboard(); // アニメーション後に更新
        } else {
            alert('おはようございます！今日も統治を始めましょう。');
            location.href = 'form.html?date=' + payload.measured_date + '&mode=edit'; // 朝ログ入力画面へ
        }
    }
    document.getElementById('btnWaketime').onclick = () => quickLog('waketime', false);
    document.getElementById('btnBedtime').onclick = () => { quickLog('bedtime', true); document.getElementById('bedtimeLogIndicator')?.classList.add('recorded'); };

    // --- 監査・修正用ボタン（日次記録） ---
    document.getElementById('btnEditHistory').onclick = () => {
        location.href = 'form.html'; // 日時修正モード（form.js側でカレンダーが今日になる）
    };

    // --- ダッシュボードデータ読み込み ---
    window.loadDashboard = async function() {
        // パフォーマンス統計 (RPCS)
        const { data: kpiData } = await supabaseClient.rpc('get_user_performance', { target_user_id: user.id });
        if (kpiData?.[0]) document.getElementById('streakDays').innerText = kpiData[0].streak_days || 0;

        // 最新レコード
        const { data: recent } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
        if (recent?.[0]) {
            const current = recent[0];
            const previous = recent[1] || null;
            document.getElementById('latestWeight').innerText = current.weight || "--";
            document.getElementById('latestSleep').innerText = current.sleep_hours || "--";
            const mentalMap = ["", "😫", "😟", "😐", "🙂", "🤩"];
            document.getElementById('latestMental').innerText = mentalMap[current.mental_condition] || "--";
            // デルタ計算
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

        // AI活力スコア (ダミーロジック)
        document.getElementById('vitalityCircle').style.background = `conic-gradient(#10b981 90%, rgba(255,255,255,0.05) 90%)`;
        document.getElementById('vitalityValue').innerText = 90;
    };
    loadDashboard();
});