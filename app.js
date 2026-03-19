document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;
    
    const mentalIcons = [
        '<i class="far fa-sad-tear"></i>',
        '<i class="far fa-frown"></i>',
        '<i class="far fa-meh"></i>',
        '<i class="far fa-smile"></i>',
        '<i class="far fa-laugh-beam"></i>'
    ];

    let currentChartMode = 'weight';
    let globalChartLogs = [];
    
    // DBから取得する目標値・現在の状態（モーダル表示用グローバル変数）
    let TARGET_WEIGHT = 65.0;
    let TARGET_FAT = 13.0;
    let TARGET_SLEEP = 7.0;
    let TARGET_DATE = null;
    let CURRENT_WEIGHT = 65.0; 
    let CURRENT_FAT = 0;
    let CURRENT_SLEEP = 0;
    let CURRENT_MENTAL = 3;
    let KPI_STATS = null;
    let USER_PROFILE = null;

    // ユーティリティ関数
    function getLocalLogicalDateStr(dateObj) {
        const d = new Date(dateObj.getTime());
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function calculateAge(birthDateStr) {
        const today = new Date();
        const birthDate = new Date(birthDateStr);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age;
    }

    // 推奨摂取カロリー自動計算ロジック
    function calcRecommendedCalories(weight, height, age, gender, activityLevel, targetWeight, targetDateStr) {
        if(!weight || !height || !age || !gender || !targetWeight || !targetDateStr) return "";
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr = gender === 'male' ? bmr + 5 : bmr - 161;
        const activityMultipliers = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725 };
        const tdee = bmr * (activityMultipliers[activityLevel] || 1.375);
        const days = Math.max(1, Math.floor((new Date(targetDateStr) - new Date()) / (1000 * 60 * 60 * 24)));
        const weightDiff = weight - targetWeight; 
        const dailyDeficit = (weightDiff > 0) ? ((weightDiff * 7200) / days) : 0;
        let targetCal = Math.round(tdee - dailyDeficit);
        const minCal = gender === 'male' ? 1500 : 1200;
        if(targetCal < minCal) targetCal = minCal;
        return targetCal;
    }

    // リアルタイムカロリー計算イベント
    const initInputs = ['initBirth', 'initGender', 'initHeight', 'initActivity', 'initWeight', 'initTargetWeight', 'initTargetDate'];
    initInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const w = parseFloat(document.getElementById('initWeight').value);
            const h = parseFloat(document.getElementById('initHeight').value);
            const b = document.getElementById('initBirth').value;
            const g = document.getElementById('initGender').value;
            const a = parseInt(document.getElementById('initActivity').value);
            const tw = parseFloat(document.getElementById('initTargetWeight').value);
            const td = document.getElementById('initTargetDate').value;
            if(b && w && h && tw && td) {
                document.getElementById('initTargetCal').value = calcRecommendedCalories(w, h, calculateAge(b), g, a, tw, td);
            }
        });
    });

    const setInputs = ['setBirth', 'setGender', 'setHeight', 'setActivity', 'setTargetWeight', 'setTargetDate'];
    setInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const w = CURRENT_WEIGHT;
            const h = parseFloat(document.getElementById('setHeight').value);
            const b = document.getElementById('setBirth').value;
            const g = document.getElementById('setGender').value;
            const a = parseInt(document.getElementById('setActivity').value);
            const tw = parseFloat(document.getElementById('setTargetWeight').value);
            const td = document.getElementById('setTargetDate').value;
            if(b && w && h && tw && td) {
                document.getElementById('setTargetCal').value = calcRecommendedCalories(w, h, calculateAge(b), g, a, tw, td);
            }
        });
    });

    // 初期化チェック
    async function checkInitialSetup() {
        const { data: profile } = await supabaseClient.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        
        if (!profile) {
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
            USER_PROFILE = profile;
            TARGET_WEIGHT = profile.target_weight;
            TARGET_FAT = profile.target_fat;
            TARGET_SLEEP = profile.target_sleep_hours || 7.0;
            TARGET_DATE = profile.target_date;
            
            const { data: latestLog } = await supabaseClient.from('health_logs').select('weight').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1).maybeSingle();
            CURRENT_WEIGHT = (latestLog && latestLog.weight) ? latestLog.weight : profile.baseline_weight;

            document.getElementById('setBirth').value = profile.birth_date || "";
            document.getElementById('setGender').value = profile.gender || "male";
            document.getElementById('setHeight').value = profile.height || "";
            document.getElementById('setActivity').value = profile.activity_level || 2;
            document.getElementById('setTargetWeight').value = profile.target_weight || "";
            document.getElementById('setTargetFat').value = profile.target_fat || "";
            document.getElementById('setTargetSleep').value = profile.target_sleep_hours || 7.0;
            document.getElementById('setTargetDate').value = profile.target_date || "";
            document.getElementById('setTargetCal').value = profile.target_calories || "";

            loadDashboard();
        }
    }

    // 保存処理系（初期設定、設定モーダル）
    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true; btn.innerText = "Saving...";
        const payload = {
            user_id: user.id,
            birth_date: document.getElementById('initBirth').value, gender: document.getElementById('initGender').value,
            height: parseFloat(document.getElementById('initHeight').value), activity_level: parseInt(document.getElementById('initActivity').value),
            baseline_weight: parseFloat(document.getElementById('initWeight').value), baseline_fat: parseFloat(document.getElementById('initFat').value),
            target_weight: parseFloat(document.getElementById('initTargetWeight').value), target_fat: parseFloat(document.getElementById('initTargetFat').value),
            target_sleep_hours: parseFloat(document.getElementById('initTargetSleep').value), target_date: document.getElementById('initTargetDate').value,
            target_calories: parseInt(document.getElementById('initTargetCal').value)
        };
        try {
            await supabaseClient.from('user_profiles').upsert(payload);
            const todayStr = getLocalLogicalDateStr(new Date());
            await supabaseClient.from('health_logs').upsert({ user_id: user.id, measured_date: todayStr, weight: payload.baseline_weight, body_fat: payload.baseline_fat, mental_condition: 3 }, { onConflict: 'user_id, measured_date' });
            document.getElementById('initialSetupModal').style.display = 'none';
            await checkInitialSetup();
        } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
    });

    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('settingsBtn').addEventListener('click', () => { settingsModal.style.display = 'flex'; });
    document.getElementById('btnSettingsCancel').addEventListener('click', () => { settingsModal.style.display = 'none'; });
    
    document.getElementById('btnSettingsSave').addEventListener('click', async () => {
        const payload = {
            user_id: user.id,
            birth_date: document.getElementById('setBirth').value, gender: document.getElementById('setGender').value,
            height: parseFloat(document.getElementById('setHeight').value), activity_level: parseInt(document.getElementById('setActivity').value),
            target_weight: parseFloat(document.getElementById('setTargetWeight').value), target_fat: parseFloat(document.getElementById('setTargetFat').value),
            target_sleep_hours: parseFloat(document.getElementById('setTargetSleep').value), target_date: document.getElementById('setTargetDate').value,
            target_calories: parseInt(document.getElementById('setTargetCal').value)
        };
        try {
            await supabaseClient.from('user_profiles').upsert(payload);
            USER_PROFILE = { ...USER_PROFILE, ...payload };
            TARGET_WEIGHT = payload.target_weight; TARGET_FAT = payload.target_fat; TARGET_SLEEP = payload.target_sleep_hours; TARGET_DATE = payload.target_date;
            settingsModal.style.display = 'none';
            renderDynamicChart();
        } catch (err) { alert("Error: " + err.message); }
    });

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    // Quick Actions
    async function recordTime(type) {
        try {
            const now = new Date();
            const logicalDateStr = getLocalLogicalDateStr(now);
            const timeISO = now.toISOString();
            const { data: existing } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', logicalDateStr).maybeSingle();
            const payload = existing ? { ...existing } : { user_id: user.id, measured_date: logicalDateStr };
            if (type === 'wake') {
                payload.waketime = timeISO;
                const yesterday = new Date(now.getTime()); yesterday.setDate(yesterday.getDate() - 1);
                const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', getLocalLogicalDateStr(yesterday)).maybeSingle();
                if (prevDay && prevDay.bedtime) {
                    let diff = (new Date(timeISO) - new Date(prevDay.bedtime)) / 3600000;
                    if (diff < 0) diff += 24; payload.sleep_hours = parseFloat(diff.toFixed(1));
                }
            } else if (type === 'bed') { payload.bedtime = timeISO; }
            if (existing && existing.id) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
            else await supabaseClient.from('health_logs').insert(payload);
            loadDashboard();
        } catch (e) { alert("Error: " + e.message); }
    }
    document.getElementById('btnBedtime').addEventListener('click', () => recordTime('bed'));
    document.getElementById('btnWaketime').addEventListener('click', () => recordTime('wake'));

    // Meal Modal
    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => { document.getElementById('quickMealDate').value = getLocalLogicalDateStr(new Date()); mealModal.style.display = 'flex'; });
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');
    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const btn = document.getElementById('btnMealSave');
        const mealDate = document.getElementById('quickMealDate').value;
        const type = document.getElementById('quickMealType').value;
        const memo = document.getElementById('quickMealMemo').value;
        if (!mealDate) return;
        btn.disabled = true; btn.innerText = "Saving...";
        try {
            await supabaseClient.from('meal_logs').insert({ user_id: user.id, meal_date: mealDate, meal_type: type, content: memo, created_at: new Date().toISOString() });
            mealModal.style.display = 'none'; document.getElementById('quickMealMemo').value = '';
        } catch (err) { alert("Error: " + err.message); } finally { btn.disabled = false; btn.innerText = "Save"; }
    });

    // KPI取得と描画
    async function fetchAndRenderKPI() {
        try {
            const { data: stats, error } = await supabaseClient.from('user_kpi_stats').select('*').eq('user_id', user.id).maybeSingle();
            if (error) throw error;
            KPI_STATS = stats || { current_streak: 0, max_streak: 0, total_log_days: 0 };

            document.getElementById('currentStreak').innerText = KPI_STATS.current_streak;
            document.getElementById('maxStreak').innerText = `Max: ${KPI_STATS.max_streak} Days`;
            
            const joinedDate = user.created_at ? new Date(user.created_at) : new Date();
            const diffDays = Math.max(1, Math.floor((new Date() - joinedDate) / (1000 * 60 * 60 * 24)) + 1);
            const rate = Math.min(100, Math.round(((KPI_STATS.total_log_days) / diffDays) * 100));
            document.getElementById('completionRate').innerText = rate;
            KPI_STATS.rate = rate;
        } catch (err) { console.error('[KPI_FETCH_ERROR]:', err.message); }
    }

    async function loadDashboard() {
        const { data: recentLogs } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
            
        if (recentLogs && recentLogs.length > 0) {
            const current = recentLogs[0];
            const previous = recentLogs.length > 1 ? recentLogs[1] : null;

            // Global変数に保持（モーダル用）
            CURRENT_WEIGHT = current.weight || 0;
            CURRENT_FAT = current.body_fat || 0;
            CURRENT_SLEEP = current.sleep_hours || 0;
            CURRENT_MENTAL = current.mental_condition || 3;

            // 1. Weight
            document.getElementById('latestWeight').innerText = current.weight ? current.weight.toFixed(1) + " kg" : "-- kg";
            if (current.weight && previous && previous.weight) {
                const diff = current.weight - previous.weight;
                const deltaEl = document.getElementById('deltaWeight');
                if (diff > 0) { deltaEl.innerHTML = `Δ +${diff.toFixed(1)} kg`; deltaEl.className = "kpi-delta delta-bad"; }
                else if (diff < 0) { deltaEl.innerHTML = `Δ ${diff.toFixed(1)} kg`; deltaEl.className = "kpi-delta delta-good"; }
                else { deltaEl.innerText = "Δ 0.0 kg"; deltaEl.className = "kpi-delta delta-neutral"; }
            }

            // 2. Body Fat (新規追加)
            document.getElementById('latestFat').innerText = current.body_fat ? current.body_fat.toFixed(1) + " %" : "-- %";
            if (current.body_fat && previous && previous.body_fat) {
                const diff = current.body_fat - previous.body_fat;
                const deltaEl = document.getElementById('deltaFat');
                if (diff > 0) { deltaEl.innerHTML = `Δ +${diff.toFixed(1)} %`; deltaEl.className = "kpi-delta delta-bad"; }
                else if (diff < 0) { deltaEl.innerHTML = `Δ ${diff.toFixed(1)} %`; deltaEl.className = "kpi-delta delta-good"; }
                else { deltaEl.innerText = "Δ 0.0 %"; deltaEl.className = "kpi-delta delta-neutral"; }
            }

            // 3. Sleep
            document.getElementById('latestSleep').innerText = current.sleep_hours ? current.sleep_hours.toFixed(1) + " h" : "-- h";
            if (current.sleep_hours && previous && previous.sleep_hours) {
                const diff = current.sleep_hours - previous.sleep_hours;
                const deltaEl = document.getElementById('deltaSleep');
                if (diff > 0) { deltaEl.innerHTML = `Δ +${diff.toFixed(1)} h`; deltaEl.className = "kpi-delta delta-good"; }
                else if (diff < 0) { deltaEl.innerHTML = `Δ ${diff.toFixed(1)} h`; deltaEl.className = "kpi-delta delta-bad"; }
                else { deltaEl.innerText = "Δ 0.0 h"; deltaEl.className = "kpi-delta delta-neutral"; }
            }

            // 4. Mental
            document.getElementById('latestMental').innerHTML = current.mental_condition ? mentalIcons[current.mental_condition - 1] : "--";
        }

        await fetchAndRenderKPI();

        const { data: chartData } = await supabaseClient.from('health_logs').select('measured_date, weight, body_fat, sleep_hours, mental_condition').eq('user_id', user.id).order('measured_date', { ascending: true }).limit(7);
        if (chartData) { globalChartLogs = chartData; renderDynamicChart(); }
    }

    // ★ KPI モーダル制御ロジック
    const kpiModal = document.getElementById('kpiDetailModal');
    const kpiTitle = document.getElementById('kpiDetailTitle');
    const kpiBody = document.getElementById('kpiDetailBody');

    document.getElementById('btnKpiDetailClose').addEventListener('click', () => { kpiModal.style.display = 'none'; });

    function showKpiModal(type) {
        let title = "";
        let content = "";

        switch(type) {
            case 'weight':
                title = "Weight Detail";
                const diffW = (CURRENT_WEIGHT - TARGET_WEIGHT).toFixed(1);
                content = `
                    <div class="kpi-detail-info">
                        現在: <span class="highlight">${CURRENT_WEIGHT}</span> kg<br>
                        目標: <span class="highlight" style="color:#10b981;">${TARGET_WEIGHT}</span> kg<br>
                        <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.2); margin:8px 0;">
                        目標まであと <span class="highlight">${diffW > 0 ? diffW : 0}</span> kg
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">目標期日 (${TARGET_DATE || '未設定'}) まで計画的に進めましょう。</div>
                `;
                break;
            case 'fat':
                title = "Body Fat Detail";
                const diffF = (CURRENT_FAT - TARGET_FAT).toFixed(1);
                content = `
                    <div class="kpi-detail-info">
                        現在: <span class="highlight">${CURRENT_FAT}</span> %<br>
                        目標: <span class="highlight" style="color:#10b981;">${TARGET_FAT}</span> %<br>
                        <hr style="border:0; border-top:1px dashed rgba(255,255,255,0.2); margin:8px 0;">
                        目標まであと <span class="highlight">${diffF > 0 ? diffF : 0}</span> %
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">カロリー設定（現在: ${USER_PROFILE?.target_calories || '--'} kcal/日）を遵守することで体脂肪率の低下が期待できます。</div>
                `;
                break;
            case 'sleep':
                title = "Sleep Detail";
                content = `
                    <div class="kpi-detail-info">
                        直近の睡眠: <span class="highlight">${CURRENT_SLEEP}</span> 時間<br>
                        目標睡眠: <span class="highlight" style="color:#10b981;">${TARGET_SLEEP}</span> 時間
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">睡眠は疲労回復と代謝アップ（脂肪燃焼）に直結する重要な要素です。</div>
                `;
                break;
            case 'mental':
                title = "Mental Status";
                content = `
                    <div class="kpi-detail-info" style="text-align:center;">
                        現在の状態<br>
                        <span style="font-size: 2.5rem; color: var(--clr-accent);">${mentalIcons[CURRENT_MENTAL - 1]}</span>
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">メンタルスコアが低い日は、無理なトレーニングを避け、睡眠と休養を優先してください。</div>
                `;
                break;
            case 'streak':
                title = "Streak Motivation";
                content = `
                    <div class="kpi-detail-info">
                        現在の連続記録: <span class="highlight">${KPI_STATS?.current_streak || 0}</span> 日<br>
                        過去最高記録: <span class="highlight" style="color:#10b981;">${KPI_STATS?.max_streak || 0}</span> 日
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">毎日記録をつけることが成功への第一歩です。途切れても何度でも再開しましょう！</div>
                `;
                break;
            case 'completion':
                title = "Data Completion";
                content = `
                    <div class="kpi-detail-info">
                        システム登録からの経過: <span class="highlight">${Math.max(1, Math.floor((new Date() - new Date(USER_PROFILE?.created_at || new Date())) / (1000 * 60 * 60 * 24)) + 1)}</span> 日<br>
                        累計記録日数: <span class="highlight">${KPI_STATS?.total_log_days || 0}</span> 日
                    </div>
                    <div style="font-size:0.8rem; color:var(--clr-text-secondary);">アシリラボのメソッドでは、記録率 <strong>80%以上</strong> の維持を推奨しています。（現在: ${KPI_STATS?.rate || 0}%）</div>
                `;
                break;
        }

        kpiTitle.innerText = title;
        kpiBody.innerHTML = content;
        kpiModal.style.display = 'flex';
    }

    // 各カードへのクリックイベント割り当て
    document.getElementById('cardWeight').addEventListener('click', () => showKpiModal('weight'));
    document.getElementById('cardFat').addEventListener('click', () => showKpiModal('fat'));
    document.getElementById('cardSleep').addEventListener('click', () => showKpiModal('sleep'));
    document.getElementById('cardMental').addEventListener('click', () => showKpiModal('mental'));
    document.getElementById('cardStreak').addEventListener('click', () => showKpiModal('streak'));
    document.getElementById('cardCompletion').addEventListener('click', () => showKpiModal('completion'));


    // チャートトグル
    document.getElementById('modeWeight').addEventListener('click', (e) => {
        currentChartMode = 'weight';
        document.getElementById('modeWeight').classList.add('active'); document.getElementById('modeSleep').classList.remove('active');
        renderDynamicChart();
    });
    document.getElementById('modeSleep').addEventListener('click', (e) => {
        currentChartMode = 'sleep';
        document.getElementById('modeSleep').classList.add('active'); document.getElementById('modeWeight').classList.remove('active');
        renderDynamicChart();
    });

    // チャート描画ロジック
    function renderDynamicChart() {
        if (globalChartLogs.length === 0) return;
        const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
        if (window.dashChart) window.dashChart.destroy();

        const labels = globalChartLogs.map(l => l.measured_date.split('-')[2]);
        let datasets = [];
        let scales = { x: { ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } } };

        if (currentChartMode === 'weight') {
            datasets = [
                { label: 'Weight (kg)', data: globalChartLogs.map(l => l.weight), type: 'line', borderColor: '#f8fafc', borderWidth: 2, pointBackgroundColor: '#f8fafc', pointBorderColor: '#fbbf24', pointBorderWidth: 2, pointRadius: 4, tension: 0.3, yAxisID: 'y1' },
                { label: `TARGET ${TARGET_WEIGHT.toFixed(1)}kg`, data: globalChartLogs.map(() => TARGET_WEIGHT), type: 'line', borderColor: 'rgba(251, 191, 36, 0.5)', borderDash: [4, 4], pointRadius: 0, borderWidth: 1, yAxisID: 'y1' },
                { label: 'Fat (%)', data: globalChartLogs.map(l => l.body_fat), type: 'line', borderColor: '#38bdf8', borderWidth: 2, pointBackgroundColor: '#38bdf8', tension: 0.3, yAxisID: 'y2' }
            ];
            scales.y1 = { position: 'right', ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } };
            scales.y2 = { position: 'left', ticks: { color: '#38bdf8', font: { family: 'Inter' } }, grid: { display: false } };
        } else {
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
            gradient.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
            datasets = [
                { label: 'Sleep (h)', data: globalChartLogs.map(l => l.sleep_hours), type: 'bar', backgroundColor: gradient, borderColor: 'rgba(251, 191, 36, 0.5)', borderWidth: 1, barPercentage: 0.5, yAxisID: 'y1' },
                { label: 'Mental', data: globalChartLogs.map(l => l.mental_condition), type: 'line', borderColor: '#10b981', pointBackgroundColor: '#10b981', borderWidth: 2, tension: 0.3, yAxisID: 'y2' }
            ];
            scales.y1 = { position: 'left', min: 0, max: 12, ticks: { color: '#8b9bb4', font: { family: 'Inter' } }, grid: { color: 'rgba(255,255,255,0.05)' } };
            scales.y2 = { position: 'right', min: 1, max: 5, ticks: { color: '#10b981', font: { family: 'Inter' } }, grid: { display: false } };
        }

        window.dashChart = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: { plugins: { legend: { display: false } }, layout: { padding: { top: 20 } }, scales }
        });
    }

    checkInitialSetup(); // 初期化をキック
});