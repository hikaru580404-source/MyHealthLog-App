document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    let mVal = 3;

    // タイムゾーンバグを修正した日付生成関数
    function getLocalLogicalDateStr(dateObj) {
        const d = new Date(dateObj.getTime());
        if (d.getHours() < 4) {
            d.setDate(d.getDate() - 1);
        }
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatTimeForInput(isoString) {
        if (!isoString) return "";
        const d = new Date(isoString);
        const h = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${min}`;
    }

    const todayStr = getLocalLogicalDateStr(new Date());
    document.getElementById('date').value = todayStr;

    document.querySelectorAll('#mGrp .cond-btn').forEach(b => {
        b.addEventListener('click', () => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(x => x.classList.remove('active'));
            b.classList.add('active');
            mVal = b.dataset.v;
        });
    });

    async function loadExistingData() {
        const { data } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .eq('measured_date', todayStr)
            .single();

        if (data) {
            if (data.weight) document.getElementById('w').value = data.weight;
            if (data.body_fat) document.getElementById('f').value = data.body_fat;
            if (data.waketime) document.getElementById('wt').value = formatTimeForInput(data.waketime);
            if (data.bedtime) document.getElementById('bt').value = formatTimeForInput(data.bedtime);
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
            const prevDateStr = getLocalLogicalDateStr(dDate);
            
            const { data: prevDay } = await supabaseClient
                .from('health_logs')
                .select('bedtime')
                .eq('user_id', user.id)
                .eq('measured_date', prevDateStr)
                .single();

            if (prevDay && prevDay.bedtime) {
                const btDate = new Date(prevDay.bedtime);
                const wtDate = new Date(`${date}T${wt}:00`);
                let hours = (wtDate - btDate) / 3600000;
                if (hours < 0) hours += 24;
                diff = hours.toFixed(1) + " h";
            } else {
                diff = "前日の記録なし";
            }
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

        const date = document.getElementById('date').value;
        const wt = document.getElementById('wt').value;
        const bt = document.getElementById('bt').value;
        const wValue = document.getElementById('w').value;
        const fValue = document.getElementById('f').value;
        
        let sleepHours = null;
        let wakeTS = null;
        let bedTS = null;

        if (wt) {
            wakeTS = new Date(`${date}T${wt}:00`).toISOString();
            const dDate = new Date(date);
            dDate.setDate(dDate.getDate() - 1);
            const prevDateStr = getLocalLogicalDateStr(dDate);
            
            const { data: prevDay } = await supabaseClient
                .from('health_logs')
                .select('bedtime')
                .eq('user_id', user.id)
                .eq('measured_date', prevDateStr)
                .single();

            if (prevDay && prevDay.bedtime) {
                const btDate = new Date(prevDay.bedtime);
                const wtDate = new Date(wakeTS);
                let hours = (wtDate - btDate) / 3600000;
                if (hours < 0) hours += 24;
                sleepHours = parseFloat(hours.toFixed(1));
            }
        }

        if (bt) {
            let bDate = new Date(`${date}T${bt}:00`);
            if (bDate.getHours() < 4) bDate.setDate(bDate.getDate() + 1);
            bedTS = bDate.toISOString();
        }

        const payload = {
            user_id: user.id, 
            measured_date: date,
            mental_condition: parseInt(mVal),
            daily_notes: document.getElementById('note').value
        };

        if (wValue) payload.weight = parseFloat(wValue);
        if (fValue) payload.body_fat = parseFloat(fValue);
        if (wakeTS) payload.waketime = wakeTS;
        if (bedTS) payload.bedtime = bedTS;
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