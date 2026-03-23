document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    let mVal = 3;

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

    function formatTimeForInput(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    const todayStr = getLocalLogicalDateStr(new Date());
    const dateInput = document.getElementById('date');
    dateInput.value = todayStr;

    document.querySelectorAll('#mGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            mVal = b.dataset.v;
        });
    });

    // 特定の日付のデータを読み込む関数
    async function loadDataForDate(targetDate) {
        const { data } = await supabaseClient.from('health_logs')
            .select('*').eq('user_id', user.id).eq('measured_date', targetDate).maybeSingle();

        const submitBtn = document.querySelector('#hForm button[type="submit"]');

        if (data) {
            // 過去データがある場合は入力欄に反映
            document.getElementById('w').value = data.weight || "";
            document.getElementById('f').value = data.body_fat || "";
            document.getElementById('wt').value = formatTimeForInput(data.waketime);
            document.getElementById('bt').value = formatTimeForInput(data.bedtime);
            document.getElementById('note').value = data.daily_notes || "";
            
            if (data.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const targetBtn = document.querySelector(`#mGrp .cond-btn[data-v="${data.mental_condition}"]`);
                if(targetBtn) targetBtn.classList.add('active');
                mVal = data.mental_condition;
            }
            // ボタンの文字を修正モードに変更
            submitBtn.innerText = "修正確認する";
        } else {
            // データがない場合は空欄にする
            document.getElementById('w').value = "";
            document.getElementById('f').value = "";
            document.getElementById('wt').value = "";
            document.getElementById('bt').value = "";
            document.getElementById('note').value = "";
            document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
            const targetBtn = document.querySelector(`#mGrp .cond-btn[data-v="3"]`);
            if(targetBtn) targetBtn.classList.add('active');
            mVal = 3;
            // ボタンの文字を新規モードに変更
            submitBtn.innerText = "確認へ進む";
        }
    }
    
    // カレンダーの日付が変更されたら発火
    dateInput.addEventListener('change', (e) => loadDataForDate(e.target.value));
    
    // 最初の読み込み
    await loadDataForDate(todayStr);

    document.getElementById('hForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const date = document.getElementById('date').value;
        const wt = document.getElementById('wt').value;
        const bt = document.getElementById('bt').value;
        const wValue = document.getElementById('w').value;
        let diff = "未計算";

        if (wt) {
            const dDate = new Date(date);
            dDate.setDate(dDate.getDate() - 1);
            const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', getLocalLogicalDateStr(dDate)).maybeSingle();

            if (prevDay && prevDay.bedtime) {
                const btDate = new Date(prevDay.bedtime);
                const wtDate = createSafeDate(date, wt);
                let hours = (wtDate - btDate) / 3600000;
                if (hours < 0) hours += 24;
                diff = hours.toFixed(1) + " h";
            } else diff = "前日の記録なし";
        }

        document.getElementById('cList').innerHTML = `
            <div><span>日付:</span><span>${date}</span></div>
            <div><span>起床:</span><span>${wt ? wt : "未入力"}</span></div>
            <div><span>就寝:</span><span>${bt ? bt : "未入力"}</span></div>
            <div><span>睡眠:</span><span>${diff}</span></div>
            <div><span>体重:</span><span>${wValue ? wValue + " kg" : "未入力"}</span></div>
        `;
        document.getElementById('p1').classList.remove('active');
        document.getElementById('p2').classList.add('active');
        document.getElementById('s1').classList.add('done');
        document.getElementById('s2').classList.add('active');
    });

    document.getElementById('saveBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveBtn');
        btn.disabled = true;
        btn.innerText = "保存中...";

        try {
            const date = document.getElementById('date').value;
            const wt = document.getElementById('wt').value;
            const bt = document.getElementById('bt').value;
            const payload = { user_id: user.id, measured_date: date, mental_condition: parseInt(mVal), daily_notes: document.getElementById('note').value };

            if (document.getElementById('w').value) payload.weight = parseFloat(document.getElementById('w').value);
            if (document.getElementById('f').value) payload.body_fat = parseFloat(document.getElementById('f').value);

            let sleepHours = null;
            if (wt) {
                payload.waketime = createSafeDate(date, wt).toISOString();
                const dDate = new Date(date); dDate.setDate(dDate.getDate() - 1);
                const { data: prevDay } = await supabaseClient.from('health_logs').select('bedtime').eq('user_id', user.id).eq('measured_date', getLocalLogicalDateStr(dDate)).maybeSingle();
                if (prevDay && prevDay.bedtime) {
                    let hours = (new Date(payload.waketime) - new Date(prevDay.bedtime)) / 3600000;
                    if (hours < 0) hours += 24;
                    payload.sleep_hours = parseFloat(hours.toFixed(1));
                }
            }
            if (bt) {
                let bDate = createSafeDate(date, bt);
                if (bDate.getHours() < 4) bDate.setDate(bDate.getDate() + 1);
                payload.bedtime = bDate.toISOString();
            }

            const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', date).maybeSingle();
            
            let dbErr;
            if (existing && existing.id) dbErr = (await supabaseClient.from('health_logs').update(payload).eq('id', existing.id)).error;
            else dbErr = (await supabaseClient.from('health_logs').insert(payload)).error;

            if (!dbErr) {
                document.getElementById('p2').classList.remove('active'); document.getElementById('p3').classList.add('active');
                document.getElementById('s2').classList.add('done'); document.getElementById('s3').classList.add('active');
            } else throw dbErr;
        } catch (e) {
            alert("システムエラー: " + e.message);
            btn.disabled = false; btn.innerText = "確定する";
        }
    });
});