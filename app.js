document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック (supabase-client.js側の関数)
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
    
    let TARGET_WEIGHT = parseFloat(localStorage.getItem('targetWeight_' + user.id)) || 65.0;
    let TARGET_FAT = parseFloat(localStorage.getItem('targetFat_' + user.id)) || 13.0;

    // ログアウト処理 (supabaseClientを使用)
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    const settingsModal = document.getElementById('settingsModal');
    document.getElementById('settingsBtn').addEventListener('click', () => {
        document.getElementById('settingTargetWeight').value = TARGET_WEIGHT;
        document.getElementById('settingTargetFat').value = TARGET_FAT;
        settingsModal.style.display = 'flex';
    });
    document.getElementById('btnSettingsCancel').addEventListener('click', () => {
        settingsModal.style.display = 'none';
    });
    document.getElementById('btnSettingsSave').addEventListener('click', () => {
        const tWeight = parseFloat(document.getElementById('settingTargetWeight').value);
        const tFat = parseFloat(document.getElementById('settingTargetFat').value);
        if (isNaN(tWeight) || isNaN(tFat)) { alert("数値を正しく入力してください。"); return; }
        localStorage.setItem('targetWeight_' + user.id, tWeight);
        localStorage.setItem('targetFat_' + user.id, tFat);
        TARGET_WEIGHT = tWeight; TARGET_FAT = tFat;
        settingsModal.style.display = 'none';
        renderDynamicChart();
    });

    function getLocalLogicalDateStr(dateObj) {
        const d = new Date(dateObj.getTime());
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function createSafeDate(dateStr, timeStr) {
        if (!timeStr) return null;
        const [y, m, d] = dateStr.split('-').map(Number);
        const [h, min] = timeStr.split(':').map(Number);
        return new Date(y, m - 1, d, h, min);
    }

    async function checkInitialSetup() {
        const localFlag = localStorage.getItem('initSetup_' + user.id);
        if (localFlag === 'true') { loadDashboard(); return; }
        const { data } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).limit(1);
        if (!data || data.length === 0) { document.getElementById('initialSetupModal').style.display = 'flex'; } 
        else { localStorage.setItem('initSetup_' + user.id, 'true'); loadDashboard(); }
    }

    let initMVal = 3;
    document.querySelectorAll('#initMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#initMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active'); initMVal = b.dataset.v;
        });
    });

    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true; btn.innerText = "Processing...";
        const tWeight = document.getElementById('initTargetWeight').value;
        const tFat = document.getElementById('initTargetFat').value;
        localStorage.setItem('targetWeight_' + user.id, tWeight);
        localStorage.setItem('targetFat_' + user.id, tFat);
        TARGET_WEIGHT = parseFloat(tWeight); TARGET_FAT = parseFloat(tFat);

        try {
            const now = new Date();
            const todayStr = getLocalLogicalDateStr(now);
            const yesterday = new Date(now.getTime()); yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const btVal = document.getElementById('initBedtime').value;
            const wtVal = document.getElementById('initWaketime').value;
            const wVal = document.getElementById('initWeight').value;
            const fVal = document.getElementById('initFat').value;

            let bDate = createSafeDate(yesterdayStr, btVal);
            let wDate = createSafeDate(todayStr, wtVal);
            if (wDate <= bDate) wDate.setDate(wDate.getDate() + 1);
            let sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));

            const yestPayload = { user_id: user.id, measured_date: yesterdayStr, bedtime: bDate.toISOString() };
            const { data: yData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
            if (yData) await supabaseClient.from('health_logs').update(yestPayload).eq('id', yData.id);
            else await supabaseClient.from('health_logs').insert(yestPayload);

            const todayPayload = { user_id: user.id, measured_date: todayStr, waketime: wDate.toISOString(), sleep_hours: sleepHours, mental_condition: parseInt(initMVal) };
            if (wVal) todayPayload.weight = parseFloat(wVal);
            if (fVal) todayPayload.body_fat = parseFloat(fVal);

            const { data: tData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            if (tData) await supabaseClient.from('health_logs').update(todayPayload).eq('id', tData.id);
            else await supabaseClient.from('health_logs').insert(todayPayload);

            localStorage.setItem('initSetup_' + user.id, 'true');
            document.getElementById('initialSetupModal').style.display = 'none';
            loadDashboard();
        } catch (err) { alert("Error: " + err.message); btn.disabled = false; }
    });

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

    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => { document.getElementById('quickMealDate').value = getLocalLogicalDateStr(new Date()); mealModal.style.display = 'flex'; });
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');

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

    // KPI取得と描画のサブ関数
    async function fetchAndRenderKPI() {
        try {
            const { data: stats, error } = await supabaseClient
                .from('user_kpi_stats')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (stats) {
                document.getElementById('currentStreak').innerText = stats.current_streak || 0;
                document.getElementById('maxStreak').innerText = `Max: ${stats.max_streak || 0} Days`;
                
                // 登録日からの経過日数と累計記録数から達成率を算出
                const joinedDate = user.created_at ? new Date(user.created_at) : new Date();
                const today = new Date();
                const diffDays = Math.max(1, Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24)) + 1);
                const rate = Math.min(100, Math.round(((stats.total_log_days || 0) / diffDays) * 100));
                
                document.getElementById('completionRate').innerText = rate;
            } else {
                // データがまだない場合
                document.getElementById('currentStreak').innerText = "0";
                document.getElementById('maxStreak').innerText = `Max: 0 Days`;
                document.getElementById('completionRate').innerText = "0";
            }
        } catch (err) {
            console.error('[KPI_FETCH_ERROR]:', err.message);
        }
    }

    async function loadDashboard() {
        const now = new Date();
        const firstDayStr = getLocalLogicalDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
        
        // 直近の健康ログの取得
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

        // 新規追加した行動KPIの取得処理を呼び出す
        await fetchAndRenderKPI();

        // チャートデータの取得と描画
        const { data: chartData } = await supabaseClient.from('health_logs').select('measured_date, weight, body_fat, sleep_hours, mental_condition').eq('user_id', user.id).order('measured_date', { ascending: true }).limit(7);
        if (chartData) { globalChartLogs = chartData; renderDynamicChart(); }
    }

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

    checkInitialSetup();
});