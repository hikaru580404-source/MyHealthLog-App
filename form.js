document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    // --- 1. UIの初期設定 ---
    
    // コンディションボタンの選択制御
    document.querySelectorAll('#mGrp .cond-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // 日付の初期値（深夜4時までは前日扱い）
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const now = new Date();
        const logicalDate = new Date(now.getTime());
        if (now.getHours() < 4) logicalDate.setDate(now.getDate() - 1);
        dateInput.value = logicalDate.toLocaleDateString('sv-SE');
    }

    // --- 2. データの収集と確認画面への遷移 ---
    
    const form = document.getElementById('hForm');
    let payloadToSave = {}; // DBに送るデータを格納する箱

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            // 現在「朝」と「夜」どちらの画面が開いているかを判定
            const isMorning = document.getElementById('morningSection').style.display === 'block';
            const isNight = document.getElementById('nightSection').style.display === 'block';

            // ベースとなるデータ（誰の、いつの記録か）
            payloadToSave = {
                user_id: user.id,
                measured_date: dateInput.value,
            };

            // 確認画面（cList）のHTMLをリセット
            const cList = document.getElementById('cList');
            cList.innerHTML = `<div><span>日付</span><span>${dateInput.value}</span></div>`;

            // 【重要】朝の画面が開いている時だけ、体重などのデータを取得する
            if (isMorning) {
                const wt = document.getElementById('wt').value;
                const bt = document.getElementById('bt').value;
                const w = document.getElementById('w').value;
                const f = document.getElementById('f').value;
                const cond = document.querySelector('#mGrp .cond-btn.active').getAttribute('data-v');

                if(wt) { payloadToSave.waketime = `${dateInput.value}T${wt}:00`; cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`; }
                if(bt) { payloadToSave.bedtime = `${dateInput.value}T${bt}:00`; cList.innerHTML += `<div><span>就寝(昨夜)</span><span>${bt}</span></div>`; }
                if(w)  { payloadToSave.weight = parseFloat(w); cList.innerHTML += `<div><span>体重</span><span>${w} kg</span></div>`; }
                if(f)  { payloadToSave.body_fat = parseFloat(f); cList.innerHTML += `<div><span>体脂肪</span><span>${f} %</span></div>`; }
                
                payloadToSave.mental_condition = parseInt(cond);
                cList.innerHTML += `<div><span>コンディション</span><span>Level ${cond}</span></div>`;
            }

            // 【重要】夜の画面が開いている時だけ、ジャーナルのデータを取得する
            if (isNight) {
                const note = document.getElementById('note').value;
                if(note) {
                    payloadToSave.daily_notes = note;
                    cList.innerHTML += `<div><span>ジャーナル</span><span>入力あり</span></div>`;
                }
            }

            // P1(入力)を隠して、P2(確認)を表示
            document.getElementById('p1').classList.remove('active');
            document.getElementById('p2').classList.add('active');
            document.getElementById('s1').classList.remove('active');
            document.getElementById('s1').classList.add('done');
            document.getElementById('s2').classList.add('active');
        });
    }

    // --- 3. データベースへの保存（Upsert処理） ---
    
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            btn.innerText = "保存中...";

            try {
                // すでに今日のデータが存在するか確認
                const { data: existing } = await supabaseClient
                    .from('health_logs')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('measured_date', payloadToSave.measured_date)
                    .maybeSingle();

                if (existing) {
                    // データがあれば「上書き（更新）」※今回送信した項目のみ更新される
                    const { error } = await supabaseClient.from('health_logs').update(payloadToSave).eq('id', existing.id);
                    if (error) throw error;
                } else {
                    // データがなければ「新規作成」
                    const { error } = await supabaseClient.from('health_logs').insert(payloadToSave);
                    if (error) throw error;
                }

                // 保存成功：P2(確認)を隠して、P3(完了)を表示
                document.getElementById('p2').classList.remove('active');
                document.getElementById('p3').classList.add('active');
                document.getElementById('s2').classList.remove('active');
                document.getElementById('s2').classList.add('done');
                document.getElementById('s3').classList.add('active');

            } catch(err) {
                alert("システムエラー: " + err.message);
                btn.disabled = false;
                btn.innerText = "確定する";
            }
        });
    }
});