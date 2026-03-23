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

    // 日付の初期値設定（深夜4時ルール）
    const dateInput = document.getElementById('date');
    if (dateInput && !dateInput.value) {
        const now = new Date();
        const logicalDate = new Date();
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        dateInput.value = logicalDate.toLocaleDateString('sv-SE');
    }

    let currentRecordId = null;
    let existingPayload = {};

    // --- universal_logs からのデータ読み込み (Read) ---
    window.loadDataByDate = async function(dateStr) {
        if (!supabaseClient) return;

        currentRecordId = null;
        existingPayload = {};

        // project_id='jwa' かつ payload内のmeasured_dateで特定
        const { data, error } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();

        // フォームのリセット
        document.getElementById('wt').value = "";
        document.getElementById('bt').value = "";
        document.getElementById('w').value = "";
        document.getElementById('f').value = "";
        document.getElementById('note').value = "";
        document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#mGrp .cond-btn[data-v="3"]').classList.add('active'); 

        if (data && data.payload) {
            currentRecordId = data.id;
            existingPayload = data.payload;
            const p = data.payload;

            if (p.waketime) document.getElementById('wt').value = new Date(p.waketime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'});
            if (p.bedtime) document.getElementById('bt').value = new Date(p.bedtime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'});
            if (p.weight) document.getElementById('w').value = p.weight;
            if (p.body_fat) document.getElementById('f').value = p.body_fat;
            if (p.daily_notes) document.getElementById('note').value = p.daily_notes;
            
            if (p.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const condBtn = document.querySelector(`#mGrp .cond-btn[data-v="${p.mental_condition}"]`);
                if (condBtn) condBtn.classList.add('active');
            }
            document.getElementById('saveBtn').innerText = "更新する";
        } else {
            document.getElementById('saveBtn').innerText = "確定する";
        }
    }

    // --- 確認画面への遷移 (P1 -> P2) ---
    const form = document.getElementById('hForm');
    let payloadToSave = {};

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const mSec = document.getElementById('morningSection');
            const isMorningVisible = mSec.style.display === 'block';

            payloadToSave = {
                measured_date: dateInput.value,
            };

            const cList = document.getElementById('cList');
            cList.innerHTML = `<div><span>日付</span><span>${dateInput.value}</span></div>`;

            if (isMorningVisible) {
                const wt = document.getElementById('wt').value;
                const bt = document.getElementById('bt').value;
                const w = document.getElementById('w').value;
                const f = document.getElementById('f').value;
                const cond = document.querySelector('#mGrp .cond-btn.active').getAttribute('data-v');

                if(wt) { payloadToSave.waketime = `${dateInput.value}T${wt}:00`; cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`; }
                if(bt) { payloadToSave.bedtime = `${dateInput.value}T${bt}:00`; cList.innerHTML += `<div><span>就寝</span><span>${bt}</span></div>`; }
                
                if(wt && bt) {
                    let [wH, wM] = wt.split(':').map(Number);
                    let [bH, bM] = bt.split(':').map(Number);
                    let diffM = (wH * 60 + wM) - (bH * 60 + bM);
                    if (diffM < 0) diffM += 24 * 60;
                    let sleepH = Math.round((diffM / 60) * 10) / 10;
                    payloadToSave.sleep_hours = sleepH;
                    cList.innerHTML += `<div><span>睡眠時間</span><span style="color:#10b981; font-weight:700;">${sleepH} h (自動算出)</span></div>`;
                }
                
                if(w)  { payloadToSave.weight = parseFloat(w); cList.innerHTML += `<div><span>体重</span><span>${w} kg</span></div>`; }
                if(f)  { payloadToSave.body_fat = parseFloat(f); cList.innerHTML += `<div><span>体脂肪</span><span>${f} %</span></div>`; }
                payloadToSave.mental_condition = parseInt(cond);
                cList.innerHTML += `<div><span>コンディション</span><span>Level ${cond}</span></div>`;
            }

            const note = document.getElementById('note').value;
            if(note) {
                payloadToSave.daily_notes = note;
                cList.innerHTML += `<div><span>ジャーナル</span><span>入力あり</span></div>`;
            } else {
                payloadToSave.daily_notes = null;
            }

            document.getElementById('p1').classList.remove('active');
            document.getElementById('p2').classList.add('active');
        });
    }

    // --- 保存処理 (universal_logs へ INSERT/UPDATE) ---
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.innerText = "保存中...";

            try {
                const finalPayload = { ...existingPayload, ...payloadToSave };
                let err = null;

                if (currentRecordId) {
                    const { error } = await supabaseClient
                        .from('universal_logs')
                        .update({ payload: finalPayload })
                        .eq('id', currentRecordId);
                    err = error;
                } else {
                    const { error } = await supabaseClient
                        .from('universal_logs')
                        .insert({
                            user_id: user.id,
                            project_id: 'jwa',
                            log_type: 'daily_metric',
                            payload: finalPayload
                        });
                    err = error;
                }

                if (err) throw err;

                document.getElementById('p2').classList.remove('active');
                document.getElementById('p3').classList.add('active');

            } catch(error) {
                alert("システムエラー: " + error.message);
                btn.disabled = false;
                btn.innerText = currentRecordId ? "更新する" : "確定する";
            }
        });
    }
});