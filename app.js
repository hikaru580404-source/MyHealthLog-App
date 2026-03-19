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
    
    // DBから取得する目標値（グローバル保持）
    let TARGET_WEIGHT = 65.0;
    let TARGET_FAT = 13.0;
    let CURRENT_WEIGHT = 65.0; // カロリー計算用

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

    // ★推奨摂取カロリー自動計算ロジック (Mifflin-St Jeorの式)
    function calcRecommendedCalories(weight, height, age, gender, activityLevel, targetWeight, targetDateStr) {
        if(!weight || !height || !age || !gender || !targetWeight || !targetDateStr) return "";
        
        // 基礎代謝(BMR)計算
        let bmr = (10 * weight) + (6.25 * height) - (5 * age);
        bmr = gender === 'male' ? bmr + 5 : bmr - 161;

        // 総消費カロリー(TDEE)計算
        const activityMultipliers = { 1: 1.2, 2: 1.375, 3: 1.55, 4: 1.725 };
        const tdee = bmr * (activityMultipliers[activityLevel] || 1.375);

        // 期日までの必要減量カロリーを日割り計算
        const days = Math.max(1, Math.floor((new Date(targetDateStr) - new Date()) / (1000 * 60 * 60 * 24)));
        const weightDiff = weight - targetWeight; 
        const dailyDeficit = (weightDiff > 0) ? ((weightDiff * 7200) / days) : 0; // 1kg=7200kcalで計算

        let targetCal = Math.round(tdee - dailyDeficit);

        // セーフティガード (極端なカロリー制限を防ぐ)
        const minCal = gender === 'male' ? 1500 : 1200;
        if(targetCal < minCal) targetCal = minCal;

        return targetCal;
    }

    // 初期セットアップ入力時のリアルタイムカロリー計算イベント
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
                const age = calculateAge(b);
                const cal = calcRecommendedCalories(w, h, age, g, a, tw, td);
                document.getElementById('initTargetCal').value = cal;
            }
        });
    });

    // 設定画面入力時のリアルタイムカロリー計算イベント
    const setInputs = ['setBirth', 'setGender', 'setHeight', 'setActivity', 'setTargetWeight', 'setTargetDate'];
    setInputs.forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            const w = CURRENT_WEIGHT; // 計算時は最新の記録体重を使用
            const h = parseFloat(document.getElementById('setHeight').value);
            const b = document.getElementById('setBirth').value;
            const g = document.getElementById('setGender').value;
            const a = parseInt(document.getElementById('setActivity').value);
            const tw = parseFloat(document.getElementById('setTargetWeight').value);
            const td = document.getElementById('setTargetDate').value;
            
            if(b && w && h && tw && td) {
                const age = calculateAge(b);
                const cal = calcRecommendedCalories(w, h, age, g, a, tw, td);
                document.getElementById('setTargetCal').value = cal;
            }
        });
    });

    // 初期化チェック (DBベースに完全移行)
    async function checkInitialSetup() {
        const { data: profile } = await supabaseClient.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle();
        
        if (!profile) {
            // プロフィールがなければ初期設定モーダルを表示
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
            TARGET_WEIGHT = profile.target_weight;
            TARGET_FAT = profile.target_fat;
            
            // 最新体重の取得（カロリー再計算用）
            const { data: latestLog } = await supabaseClient.from('health_logs').select('weight').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1).maybeSingle();
            CURRENT_WEIGHT = (latestLog && latestLog.weight) ? latestLog.weight : profile.baseline_weight;

            // 設定モーダルに値を事前セット
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

    // 初期設定フォーム保存
    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true; btn.innerText = "Saving...";

        const payload = {
            user_id: user.id,
            birth_date: document.getElementById('initBirth').value,
            gender: document.getElementById('initGender').value,
            height: parseFloat(document.getElementById('initHeight').value),
            activity_level: parseInt(document.getElementById('initActivity').value),
            baseline_weight: parseFloat(document.getElementById('initWeight').value),
            baseline_fat: parseFloat(document.getElementById('initFat').value),
            target_weight: parseFloat(document.getElementById('initTargetWeight').value),
            target_fat: parseFloat(document.getElementById('initTargetFat').value),
            target_sleep_hours: parseFloat(document.getElementById('initTargetSleep').value),
            target_date: document.getElementById('initTargetDate').value,
            target_calories: parseInt(document.getElementById('initTargetCal').value)
        };

        try {
            await supabaseClient.from('user_profiles').upsert(payload);
            
            // 最初のログとして health_logs にもベースラインを挿入
            const todayStr = getLocalLogicalDateStr(new Date());
            await supabaseClient.from('health_logs').upsert({
                user_id: user.id, measured_date: todayStr, 
                weight: payload.baseline_weight, body_fat: payload.baseline_fat, mental_condition: 3
            }, { onConflict: 'user_id, measured_date' });

            document.getElementById('initialSetupModal').style.display = 'none';
            await checkInitialSetup(); // 再読み込み
        } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
    });

    // ログアウト処理
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    // 設定モーダル操作
    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('settingsBtn').addEventListener('click', () => { settingsModal.style.display = 'flex'; });
    document.getElementById('btnSettingsCancel').addEventListener('click', () => { settingsModal.style.display = 'none'; });
    
    // 設定保存
    document.getElementById('btnSettingsSave').addEventListener('click', async () => {
        const payload = {
            user_id: user.id,
            birth_date: document.getElementById('setBirth').value,
            gender: document.getElementById('setGender').value,
            height: parseFloat(document.getElementById('setHeight').value),
            activity_level: parseInt(document.getElementById('setActivity').value),
            target_weight: parseFloat(document.getElementById('setTargetWeight').value),
            target_fat: parseFloat(document.getElementById('setTargetFat').value),
            target_sleep_hours: parseFloat(document.getElementById('setTargetSleep').value),
            target_date: document.getElementById('setTargetDate').value,
            target_calories: parseInt(document.getElementById('setTargetCal').value)
        };
        
        try {
            await supabaseClient.from('user_profiles').upsert(payload);
            TARGET_WEIGHT = payload.target_weight;
            TARGET_FAT = payload.target_fat;
            settingsModal.style.display = 'none';
            renderDynamicChart();
        } catch (err) { alert("Error: " + err.message); }
    });

    // Quick Actions (Wake / Bed)
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

    // 食事モーダル
    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => { document.getElementById('quickMealDate').value = getLocalLogicalDateStr(new Date()); mealModal.style.display = 'flex'; });
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');

    // 画像圧縮と食事保存
    async function compressImage(file, maxWidth = 800) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader(); reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image(); img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width; let height = img.height;
                    if (width > height && width > maxWidth) { height *= maxWidth / width; width = maxWidth; } 
                    else if (height > maxWidth) { width *= maxWidth / height; height = maxWidth; }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
                };
            };
            reader.onerror = error => reject(error);
        });
    }

    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const btn = document.getElementById('btnMealSave');
        const mealDate = document.getElementById('quickMealDate').value;
        const type = document.getElementById('quickMealType').value;
        const memo = document.getElementById('quickMealMemo').value;
        const fileInput = document.getElementById('quickMealImage');
        
        if (!mealDate) return;
        btn.disabled = true; btn.innerText = "Saving...";

        try {
            let imageUrl = null;
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const compressedBlob = await compressImage(file);
                const fileName = `${user.id}/${Date.now()}.jpg`;
                await supabaseClient.storage.from('meal_images').upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
                const { data: publicUrlData } = supabaseClient.storage.from('meal_images').getPublicUrl(fileName);
                imageUrl = publicUrlData.publicUrl;
            }
            await supabaseClient.from('meal_logs').insert({ user_id: user.id, meal_date: mealDate, meal_type: type, content: memo, image_url: imageUrl, created_at: new Date().toISOString() });
            mealModal.style.display = 'none';
            document.getElementById('quickMealMemo').value = ''; document.getElementById('quickMealImage').value = '';
        } catch (err) { alert("Error: " + err.message); } finally { btn.disabled = false; btn.innerText = "Save"; }
    });

    // KPI取得サブ関数
    async function fetchAndRenderKPI() {
        try {
            const { data: stats, error } = await supabaseClient.from('user_kpi_stats').select('*').eq('user_id', user.id).maybeSingle();
            if (error) throw error;

            if (stats) {
                document.getElementById('currentStreak').innerText = stats.current_streak || 0;
                document.getElementById('maxStreak').innerText = `Max: ${stats.max_streak || 0} Days`;
                
                const joinedDate = user.created_at ? new Date(user.created_at) : new Date();
                const today = new Date();
                const diffDays = Math.max(1, Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24)) + 1);
                const rate = Math.min(100, Math.round(((stats.total_log_days || 0) / diffDays) * 100));
                
                document.getElementById('completionRate').innerText = rate;
            } else {
                document.getElementById('currentStreak').innerText = "0";
                document.getElementById('maxStreak').innerText = `Max: 0 Days`;
                document.getElementById('completionRate').innerText = "0";
            }
        } catch (err) { console.error('[KPI_FETCH_ERROR]:', err.message); }
    }

    // ダッシュボード描画
    async function loadDashboard() {
        const { data: recentLogs } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(2);
            
        if (recentLogs && recentLogs.length > 0) {
            const current = recentLogs[0];
            const previous = recentLogs.length > 1 ? recentLogs[1] : null;

            document.getElementById('latestWeight').innerText = current.weight ? current.weight.toFixed(1) + " kg" : "-- kg";
            if (current.weight && previous && previous.weight) {
                const diff = current.weight - previous.weight;
                const deltaEl = document.getElementById('deltaWeight');
                if (diff > 0) { deltaEl.innerHTML = `Δ +${diff.toFixed(1)} kg`; deltaEl.className = "kpi-delta delta-bad"; }
                else if (diff < 0) { deltaEl.innerHTML = `Δ ${diff.toFixed(1)} kg`; deltaEl.className = "kpi-delta delta-good"; }
                else { deltaEl.innerText = "Δ 0.0 kg"; deltaEl.className = "kpi-delta delta-neutral"; }
            }

            document.getElementById('latestSleep').innerText = current.sleep_hours ? current.sleep_hours.toFixed(1) + " h" : "-- h";
            if (current.sleep_hours && previous && previous.sleep_hours) {
                const diff = current.sleep_hours - previous.sleep_hours;
                const deltaEl = document.getElementById('deltaSleep');
                if (diff > 0) { deltaEl.innerHTML = `Δ +${diff.toFixed(1)} h`; deltaEl.className = "kpi-delta delta-good"; }
                else if (diff < 0) { deltaEl.innerHTML = `Δ ${diff.toFixed(1)} h`; deltaEl.className = "kpi-delta delta-bad"; }
                else { deltaEl.innerText = "Δ 0.0 h"; deltaEl.className = "kpi-delta delta-neutral"; }
            }
            document.getElementById('latestMental').innerHTML = current.mental_condition ? mentalIcons[current.mental_condition - 1] : "--";
        }

        await fetchAndRenderKPI();

        // チャート生成
        const { data: chartData } = await supabaseClient.from('health_logs').select('measured_date, weight, body_fat, sleep_hours, mental_condition').eq('user_id', user.id).order('measured_date', { ascending: true }).limit(7);
        if (chartData) { globalChartLogs = chartData; renderDynamicChart(); }
    }

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