document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    // --- コンディションボタンの選択制御 ---
    document.querySelectorAll('#mGrp .cond-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        const now = new Date();
        const logicalDate = new Date();
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        dateInput.value = logicalDate.toLocaleDateString('sv-SE');
    }

    let currentRecordId = null;
    let existingPayload = {};

    // --- データの読み込み (リセット処理を最優先に修正) ---
    window.loadDataByDate = async function(dateStr) {
        if (!supabaseClient) return;

        // 1. 通信前に即座にリセット（前の日付のデータの残存を防ぐ）
        currentRecordId = null;
        existingPayload = {};
        document.getElementById('wt').value = "";
        document.getElementById('bt').value = "";
        document.getElementById('w').value = "";
        document.getElementById('f').value = "";
        document.getElementById('note').value = "";
        document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#mGrp .cond-btn[data-v="3"]').classList.add('active'); 
        document.getElementById('saveBtn').innerText = "確定する";

        // 2. データ取得
        const { data, error } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();

        if (data && data.payload) {
            currentRecordId = data.id;
            existingPayload = data.payload;
            const p = data.payload;

            // 時刻の復元 (タイムゾーンのズレを吸収)
            if (p.waketime) {
                const d = new Date(p.waketime);
                document.getElementById('wt').value = !isNaN(d) ? d.toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'}) : "";
            }
            if (p.bedtime) {
                const d = new Date(p.bedtime);
                document.getElementById('bt').value = !isNaN(d) ? d.toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'}) : "";
            }
            
            if (p.weight) document.getElementById('w').value = p.weight;
            if (p.body_fat) document.getElementById('f').value = p.body_fat;
            if (p.daily_notes) document.getElementById('note').value = p.daily_notes;
            
            if (p.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const condBtn = document.querySelector(`#mGrp .cond-btn[data-v="${p.mental_condition}"]`);
                if (condBtn) condBtn.classList.add('active');
            }
            document.getElementById('saveBtn').innerText = "更新する";
        }
    }

    // --- 確認画面・保存用データの構築 ---
    const form = document.getElementById('hForm');
    let payloadToSave = {};

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            payloadToSave = { measured_date: dateInput.value };

            const wt = document.getElementById('wt').value;
            const bt = document.getElementById('bt').value;
            const w = document.getElementById('w').value;
            const f = document.getElementById('f').value;
            const cond = document.querySelector('#mGrp .cond-btn.active').getAttribute('data-v');

            // 保存形式を ISO 形式に統一（ブラウザの現在時刻のオフセットを付与して保存）
            if(wt) payloadToSave.waketime = new Date(`${dateInput.value}T${wt}:00`).toISOString();
            if(bt) {
                // 就寝時刻が深夜（0-4時）の場合、論理日付の翌日の日付として保存する
                let bDate = new Date(`${dateInput.value}T${bt}:00`);
                if (parseInt(bt.split(':')[0]) < 12) bDate.setDate(bDate.getDate() + 1);
                payloadToSave.bedtime = bDate.toISOString();
            }
            
            if(w) payloadToSave.weight = parseFloat(w);
            if(f) payloadToSave.body_fat = parseFloat(f);
            payloadToSave.mental_condition = parseInt(cond);

            const note = document.getElementById('note').value;
            payloadToSave.daily_notes = note || null;

            // 睡眠時間の再計算
            if(payloadToSave.waketime && payloadToSave.bedtime) {
                let diffM = (new Date(payloadToSave.waketime) - new Date(payloadToSave.bedtime)) / (1000 * 60);
                if (diffM < 0) diffM += 24 * 60;
                payloadToSave.sleep_hours = Math.round((diffM / 60) * 10) / 10;
            }

            document.getElementById('p1').classList.remove('active');
            document.getElementById('p2').classList.add('active');
            
            // 確認リストの更新
            const cList = document.getElementById('cList');
            cList.innerHTML = `<div><span>日付</span><span>${dateInput.value}</span></div>`;
            if(wt) cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`;
            if(bt) cList.innerHTML += `<div><span>就寝</span><span>${bt}</span></div>`;
            if(payloadToSave.sleep_hours) cList.innerHTML += `<div><span>睡眠時間</span><span style="color:#10b981;">${payloadToSave.sleep_hours} h</span></div>`;
        });
    }

    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            saveBtn.innerText = "保存中...";
            try {
                const finalPayload = { ...existingPayload, ...payloadToSave };
                const { error } = currentRecordId 
                    ? await supabaseClient.from('universal_logs').update({ payload: finalPayload }).eq('id', currentRecordId)
                    : await supabaseClient.from('universal_logs').insert({ user_id: user.id, project_id: 'jwa', log_type: 'daily_metric', payload: finalPayload });

                if (error) throw error;
                document.getElementById('p2').classList.remove('active');
                document.getElementById('p3').classList.add('active');
            } catch(error) {
                alert("エラー: " + error.message);
                saveBtn.disabled = false;
                saveBtn.innerText = "確定する";
            }
        });
    }
});