document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    
    // メンタルアイコンをFontAwesomeのタグに変更
    const mentalIcons = [
        '<i class="far fa-sad-tear"></i>',
        '<i class="far fa-frown"></i>',
        '<i class="far fa-meh"></i>',
        '<i class="far fa-smile"></i>',
        '<i class="far fa-laugh-beam"></i>'
    ];

    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
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
        if (localFlag === 'true') {
            loadDashboard();
            return;
        }
        const { data } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).limit(1);
        if (!data || data.length === 0) {
            document.getElementById('initialSetupModal').style.display = 'flex';
        } else {
            localStorage.setItem('initSetup_' + user.id, 'true');
            loadDashboard();
        }
    }

    let initMVal = 3;
    document.querySelectorAll('#initMGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#initMGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            initMVal = b.dataset.v;
        });
    });

    document.getElementById('initialSetupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('initSaveBtn');
        btn.disabled = true;
        btn.innerText = "処理中...";
        try {
            const now = new Date();
            const todayStr = getLocalLogicalDateStr(now);
            const yesterday = new Date(now.getTime());
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = getLocalLogicalDateStr(yesterday);

            const btVal = document.getElementById('initBedtime').value;
            const wtVal = document.getElementById('initWaketime').value;
            const wVal = document.getElementById('initWeight').value;
            const fVal = document.getElementById('initFat').value;
            const noteVal = document.getElementById('initNote').value;

            let bDate = createSafeDate(yesterdayStr, btVal);
            let wDate = createSafeDate(todayStr, wtVal);
            if (wDate <= bDate) wDate.setDate(wDate.getDate() + 1);
            let sleepHours = parseFloat(((wDate - bDate) / 3600000).toFixed(1));

            const yestPayload = { user_id: user.id, measured_date: yesterdayStr, bedtime: bDate.toISOString() };
            const { data: yData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', yesterdayStr).maybeSingle();
            if (yData) await supabaseClient.from('health_logs').update(yestPayload).eq('id', yData.id);
            else await supabaseClient.from('health_logs').insert(yestPayload);

            const todayPayload = {
                user_id: user.id, measured_date: todayStr, waketime: wDate.toISOString(), sleep_hours: sleepHours, mental_condition: parseInt(initMVal)
            };
            if (wVal) todayPayload.weight = parseFloat(wVal);
            if (fVal) todayPayload.body_fat = parseFloat(fVal);
            if (noteVal) todayPayload.daily_notes = noteVal;

            const { data: tData } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', todayStr).maybeSingle();
            if (tData) await supabaseClient.from('health_logs').update(todayPayload).eq('id', tData.id);
            else await supabaseClient.from('health_logs').insert(todayPayload);

            localStorage.setItem('initSetup_' + user.id, 'true');
            document.getElementById('initialSetupModal').style.display = 'none';
            loadDashboard();
        } catch (err) {
            alert("エラー: " + err.message);
            btn.disabled = false;
        }
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
                const yesterday = new Date(now.getTime());
                yesterday.setDate(yesterday.getDate() - 1);
                const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', getLocalLogicalDateStr(yesterday)).maybeSingle();
                if (prevDay && prevDay.bedtime) {
                    let diff = (new Date(timeISO) - new Date(prevDay.bedtime)) / 3600000;
                    if (diff < 0) diff += 24;
                    payload.sleep_hours = parseFloat(diff.toFixed(1));
                }
            } else if (type === 'bed') {
                payload.bedtime = timeISO;
            }

            if (existing && existing.id) await supabaseClient.from('health_logs').update(payload).eq('id', existing.id);
            else await supabaseClient.from('health_logs').insert(payload);

            alert(type === 'bed' ? "就寝時刻を記録しました。" : "起床時刻を記録しました。");
            loadDashboard();
        } catch (e) { alert("システムエラー: " + e.message); }
    }

    document.getElementById('btnBedtime').addEventListener('click', () => recordTime('bed'));
    document.getElementById('btnWaketime').addEventListener('click', () => recordTime('wake'));

    // 食事モーダルと画像アップロード機能
    const mealModal = document.getElementById('mealModal');
    document.getElementById('btnMealOpen').addEventListener('click', () => mealModal.style.display = 'flex');
    document.getElementById('btnMealCancel').addEventListener('click', () => mealModal.style.display = 'none');

    // 画像圧縮関数（長辺800pxに自動リサイズ）
    async function compressImage(file, maxWidth = 800) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = event => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    if (width > height && width > maxWidth) {
                        height *= maxWidth / width; width = maxWidth;
                    } else if (height > maxWidth) {
                        width *= maxWidth / height; height = maxWidth;
                    }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    canvas.toBlob(blob => resolve(blob), 'image/jpeg', 0.8);
                };
            };
            reader.onerror = error => reject(error);
        });
    }

    document.getElementById('btnMealSave').addEventListener('click', async () => {
        const btn = document.getElementById('btnMealSave');
        const type = document.getElementById('quickMealType').value;
        const memo = document.getElementById('quickMealMemo').value;
        const fileInput = document.getElementById('quickMealImage');
        
        btn.disabled = true;
        btn.innerText = "保存中...";

        try {
            let imageUrl = null;
            // 1. 画像が選択されている場合、圧縮してStorageにアップロード
            if (fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const compressedBlob = await compressImage(file);
                const fileName = `${user.id}/${Date.now()}.jpg`;

                const { error: uploadError } = await supabaseClient.storage
                    .from('meal_images').upload(fileName, compressedBlob, { contentType: 'image/jpeg' });
                
                if (uploadError) throw uploadError;

                // 2. 公開URLを取得
                const { data: publicUrlData } = supabaseClient.storage.from('meal_images').getPublicUrl(fileName);
                imageUrl = publicUrlData.publicUrl;
            }

            // 3. DBに記録
            const logicalDateStr = getLocalLogicalDateStr(new Date());
            const { error } = await supabaseClient.from('meal_logs').insert({
                user_id: user.id, meal_date: logicalDateStr, meal_type: type, content: memo, image_url: imageUrl
            });

            if (error) throw error;

            mealModal.style.display = 'none';
            document.getElementById('quickMealMemo').value = '';
            document.getElementById('quickMealImage').value = '';
            alert("食事を記録しました。");
        } catch (err) {
            alert("エラーが発生しました: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = "保存";
        }
    });

    async function loadDashboard() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const firstDayStr = getLocalLogicalDateStr(firstDay);
        
        const { data: latestData } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
            
        if (latestData && latestData.length > 0) {
            const log = latestData[0];
            document.getElementById('latestWeight').innerText = log.weight ? log.weight.toFixed(1) + " kg" : "-- kg";
            document.getElementById('latestSleep').innerText = log.sleep_hours ? log.sleep_hours.toFixed(1) + " h" : "-- h";
            // メンタルを顔文字アイコン化
            document.getElementById('latestMental').innerHTML = log.mental_condition ? mentalIcons[log.mental_condition - 1] : "--";
        }

        const { count } = await supabaseClient.from('health_logs')
            .select('*', { count: 'exact', head: true }).eq('user_id', user.id).gte('measured_date', firstDayStr);
        document.getElementById('monthCount').innerText = (count || 0) + " 日";

        const { data: chartData } = await supabaseClient.from('health_logs')
            .select('measured_date, weight, sleep_hours').eq('user_id', user.id).order('measured_date', { ascending: true }).limit(7);
        if (chartData) renderChart(chartData);
    }

    function renderChart(logs) {
        const ctx = document.getElementById('healthCorrelationChart').getContext('2d');
        if (window.dashChart) window.dashChart.destroy();
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(245, 158, 11, 0.6)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.0)');

        window.dashChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: logs.map(l => l.measured_date.split('-')[2]),
                datasets: [
                    { label: '睡眠', data: logs.map(l => l.sleep_hours), backgroundColor: gradient, borderColor: '#f59e0b', borderWidth: 1, yAxisID: 'ySleep', barPercentage: 0.6 },
                    { label: '体重', data: logs.map(l => l.weight), type: 'line', borderColor: '#f8fafc', borderWidth: 2, pointBackgroundColor: '#f59e0b', tension: 0.3, yAxisID: 'yWeight' }
                ]
            },
            options: { plugins: { legend: { labels: { color: '#94a3b8', font: { size: 11, family: 'Inter' } } } }, scales: { x: { ticks: { color: '#94a3b8', font: { family: 'Inter' } }, grid: { display: false } }, ySleep: { position: 'left', min: 0, max: 12, ticks: { color: '#94a3b8', font: { family: 'Inter' } }, grid: { color: '#334155' } }, yWeight: { position: 'right', ticks: { color: '#94a3b8', font: { family: 'Inter' } }, grid: { display: false } } } }
        });
    }

    checkInitialSetup();
});