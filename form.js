document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    let mVal = 3;

    // 論理日付の取得（午前4時境界）
    function getLogicalDate(dateObj) {
        const d = new Date(dateObj);
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        return d.toISOString().split('T')[0];
    }
    const today = getLogicalDate(new Date());
    document.getElementById('date').value = today;

    // コンディションボタンの制御
    document.querySelectorAll('#mGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            mVal = b.dataset.v;
        });
    });

    // 「**段階的保存データ（打刻データ）の自動読み込み**」
    async function loadExistingData() {
        const { data } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('measured_date', today)
            .single();

        if (data) {
            if (data.weight) document.getElementById('w').value = data.weight;
            if (data.body_fat) document.getElementById('f').value = data.body_fat;
            if (data.bedtime) {
                const btDate = new Date(data.bedtime);
                document.getElementById('bt').value = btDate.toTimeString().slice(0, 5);
            }
            if (data.waketime) {
                const wtDate = new Date(data.waketime);
                document.getElementById('wt').value = wtDate.toTimeString().slice(0, 5);
            }
            if (data.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const targetBtn = document.querySelector(`#mGrp .cond-btn[data-v="${data.mental_condition}"]`);
                if(targetBtn) targetBtn.classList.add('active');
                mVal = data.mental_condition;
            }
            if (data.daily_notes) document.getElementById('note').value = data.daily_notes;
        }
    }
    
    await loadExistingData();

    // 確認画面への遷移処理
    document.getElementById('hForm').addEventListener('submit', e => {
        e.preventDefault();
        const date = document.getElementById('date').value;
        const bt = document.getElementById('bt').value;
        const wt = document.getElementById('wt').value;
        const wValue = document.getElementById('w').value;
        
        let diff = "未入力";
        if (bt && wt) {
            let d_bt = new Date(date + "T" + bt);
            let d_wt = new Date(date + "T" + wt);
            if (d_wt <= d_bt) d_wt.setDate(d_wt.getDate() + 1);
            diff = ((d_wt - d_bt) / 3600000).toFixed(1) + " h";
        }

        document.getElementById('cList').innerHTML = `
            <div><span>日付:</span><span>${date}</span></div>
            <div><span>体重:</span><span>${wValue ? wValue + " kg" : "未入力"}</span></div>
            <div><span>睡眠:</span><span>${diff}</span></div>
        `;
        document.getElementById('p1').classList.remove('active');
        document.getElementById('p2').classList.add('active');
        document.getElementById('s1').classList.add('done');
        document.getElementById('s2').classList.add('active');
    });

    // データベースへの確定保存処理（UPSERTマージ）
    document.getElementById('saveBtn').addEventListener('click', async () => {
        const btn = document.getElementById('saveBtn');
        btn.disabled = true;
        btn.innerText = "保存中...";

        const date = document.getElementById('date').value;
        const bt = document.getElementById('bt').value;
        const wt = document.getElementById('wt').value;
        const wValue = document.getElementById('w').value;
        const fValue = document.getElementById('f').value;
        
        let sleepHours = null;
        let bedTS = null;
        let wakeTS = null;

        if (bt && wt) {
            let d_bt = new Date(date + "T" + bt);
            let d_wt = new Date(date + "T" + wt);
            if (d_wt <= d_bt) d_wt.setDate(d_wt.getDate() + 1);
            sleepHours = parseFloat(((d_wt - d_bt) / 3600000).toFixed(1));
            bedTS = d_bt.toISOString();
            wakeTS = d_wt.toISOString();
        }

        const payload = {
            user_id: user.id, 
            measured_date: date,
            mental_condition: parseInt(mVal),
            daily_notes: document.getElementById('note').value
        };

        if (wValue) payload.weight = parseFloat(wValue);
        if (fValue) payload.body_fat = parseFloat(fValue);
        if (bedTS) payload.bedtime = bedTS;
        if (wakeTS) payload.waketime = wakeTS;
        if (sleepHours !== null) payload.sleep_hours = sleepHours;

        const { error } = await supabaseClient.from('health_logs').upsert(payload);

        if (!error) {
            document.getElementById('p2').classList.remove('active');
            document.getElementById('p3').classList.add('active');
            document.getElementById('s2').classList.add('done');
            document.getElementById('s3').classList.add('active');
        } else {
            alert("保存に失敗しました: " + error.message);
            btn.disabled = false;
            btn.innerText = "確定する";
        }
    });
});