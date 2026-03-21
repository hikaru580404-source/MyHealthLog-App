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

    // --- 【新機能】特定の日のデータをSupabaseから読み込む (Read) ---
    window.loadDataByDate = async function(dateStr) {
        if (!supabaseClient) return;

        const { data, error } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('measured_date', dateStr)
            .maybeSingle();

        // フォームのリセット (Wakeログで遷移したときなどに残らないよう)
        document.getElementById('wt').value = "";
        document.getElementById('bt').value = "";
        document.getElementById('w').value = "";
        document.getElementById('f').value = "";
        document.getElementById('note').value = "";
        // コンディションボタンリセット
        document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('#mGrp .cond-btn[data-v="3"]').classList.add('active'); // デフォルトLevel 3

        if (data) {
            // 既存データがあればセット
            if (data.waketime) document.getElementById('wt').value = new Date(data.waketime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'});
            if (data.bedtime) document.getElementById('bt').value = new Date(data.bedtime).toLocaleTimeString('sv-SE', {hour: '2-digit', minute:'2-digit'});
            if (data.weight) document.getElementById('w').value = data.weight;
            if (data.body_fat) document.getElementById('f').value = data.body_fat;
            if (data.daily_notes) document.getElementById('note').value = data.daily_notes;
            
            // コンディションボタン
            if (data.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const condBtn = document.querySelector(`#mGrp .cond-btn[data-v="${data.mental_condition}"]`);
                if (condBtn) condBtn.classList.add('active');
            }
            document.getElementById('saveBtn').innerText = "更新する"; // ボタンテキスト変更
        } else {
            document.getElementById('saveBtn').innerText = "確定する"; // 新規登録
        }
    }

    // --- 確認画面への遷移 (P1 -> P2) ---
    const form = document.getElementById('hForm');
    let payloadToSave = {};

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // 現在「朝」と「夜」どちらの画面が開いているかを判定 (EDIT MODEなら両方 true)
            const mSec = document.getElementById('morningSection');
            const nSec = document.getElementById('nightSection');
            const isMorningVisible = mSec.style.display === 'block';
            const isNightVisible = nSec.style.display === 'block';

            payloadToSave = {
                user_id: user.id,
                measured_date: dateInput.value,
            };

            const cList = document.getElementById('cList');
            cList.innerHTML = `<div><span>日付</span><span>${dateInput.value}</span></div>`;

            // 朝セクションのデータ収集
            if (isMorningVisible) {
                const wt = document.getElementById('wt').value;
                const bt = document.getElementById('bt').value;
                const w = document.getElementById('w').value;
                const f = document.getElementById('f').value;
                const cond = document.querySelector('#mGrp .cond-btn.active').getAttribute('data-v');

                // Wake/Bed Timeをタイムスタンプに
                if(wt) { payloadToSave.waketime = `${dateInput.value}T${wt}:00`; cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`; }
                if(bt) { payloadToSave.bedtime = `${dateInput.value}T${bt}:00`; cList.innerHTML += `<div><span>就寝</span><span>${bt}</span></div>`; }
                
                if(w)  { payloadToSave.weight = parseFloat(w); cList.innerHTML += `<div><span>体重</span><span>${w} kg</span></div>`; }
                if(f)  { payloadToSave.body_fat = parseFloat(f); cList.innerHTML += `<div><span>体脂肪</span><span>${f} %</span></div>`; }
                payloadToSave.mental_condition = parseInt(cond);
                cList.innerHTML += `<div><span>コンディション</span><span>Level ${cond}</span></div>`;
            }

            // 夜セクションのデータ収集
            if (isNightVisible) {
                const note = document.getElementById('note').value;
                if(note) {
                    payloadToSave.daily_notes = note;
                    cList.innerHTML += `<div><span>ジャーナル</span><span>入力あり</span></div>`;
                } else {
                    payloadToSave.daily_notes = null; // 上書きで消せるように
                }
            }

            // P1 -> P2
            document.getElementById('p1').classList.remove('active');
            document.getElementById('p2').classList.add('active');
        });
    }

    // --- データベースへの保存 (Upsertロジックはそのまま維持) ---
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.innerText = "保存中...";

            try {
                // Upsert：既存データがあれば更新、なければ挿入
                const { error } = await supabaseClient
                    .from('health_logs')
                    .upsert(payloadToSave, { onConflict: 'user_id, measured_date' });

                if (error) throw error;

                // 保存成功：P2 -> P3
                document.getElementById('p2').classList.remove('active');
                document.getElementById('p3').classList.add('active');

            } catch(err) {
                alert("システムエラー: " + err.message);
                btn.disabled = false;
                btn.innerText = payloadToSave.id ? "更新する" : "確定する";
            }
        });
    }
});