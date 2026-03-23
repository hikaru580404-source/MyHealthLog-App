document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    // --- Helper: 論理日付の取得 (深夜4時ルール) ---
    function getLogicalToday() {
        let d = new Date();
        if (d.getHours() < 4) d.setDate(d.getDate() - 1);
        return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
    }

    // --- Helper: ローカルタイムスタンプ生成 (UTCズレ防止と深夜対応) ---
    function getLocalTimestamp(logicalDateStr, timeStr, isBedtime) {
        if (!timeStr) return null;
        let d = new Date(logicalDateStr + "T00:00:00");
        const [h, m] = timeStr.split(':').map(Number);
        
        // 就寝時刻が12:00以降（例: 23:00）なら前日の夜とみなし、物理日付を-1日する
        // 深夜（例: 01:00）ならそのままの論理日付＝物理日付となる
        if (isBedtime && h >= 12) {
            d.setDate(d.getDate() - 1);
        }
        
        const yy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(h).padStart(2, '0');
        const min = String(m).padStart(2, '0');
        
        return `${yy}-${mm}-${dd}T${hh}:${min}:00`;
    }

    // --- Helper: タイムスタンプから HH:MM を抽出 ---
    function extractTime(timestampStr) {
        if (!timestampStr) return "";
        if (timestampStr.includes('T')) {
            return timestampStr.split('T')[1].substring(0, 5);
        }
        return "";
    }

    // --- UI要素の取得 ---
    const dateInput = document.getElementById('date');
    const title = document.getElementById('formTitle');
    const mSec = document.getElementById('morningSection');
    const nSec = document.getElementById('nightSection');
    const dMsg = document.getElementById('dayTimeMessage');
    const btn = document.getElementById('submitBtn');
    const cList = document.getElementById('cList');

    let currentRecordId = null;
    let existingPayload = {};
    let payloadToSave = {};

    // --- コンディションボタンの選択制御 ---
    document.querySelectorAll('#mGrp .cond-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // --- UI表示切り替え (時間帯・日付連動) ---
    function updateUIByTimeAndDate(selectedDateStr) {
        const now = new Date();
        const hour = now.getHours();
        const logicalTodayStr = getLogicalToday();

        mSec.style.display = 'none'; 
        nSec.style.display = 'none'; 
        dMsg.style.display = 'none'; 
        btn.style.display = 'block';

        if (selectedDateStr === logicalTodayStr) {
            if (hour >= 4 && hour < 12) { 
                title.innerText = "MORNING LOG"; 
                mSec.style.display = 'block'; 
            }
            else if (hour >= 20 || hour < 4) { 
                title.innerText = "NIGHT LOG"; 
                nSec.style.display = 'block'; 
            }
            else { 
                title.innerText = "DAY TIME"; 
                dMsg.style.display = 'block'; 
                btn.style.display = 'none'; 
            }
        } else {
            // 過去ログの編集モード
            title.innerText = "EDIT / " + selectedDateStr;
            mSec.style.display = 'block'; 
            nSec.style.display = 'block';
        }
        
        // UIが切り替わったらデータを取得
        loadDataByDate(selectedDateStr);
    }

    // --- URLパラメータの取得と Flatpickr 初期化 ---
    const urlParams = new URLSearchParams(window.location.search);
    const initialDate = urlParams.get('date') || getLogicalToday();
    dateInput.value = initialDate;

    flatpickr("#date", {
        locale: "ja",
        dateFormat: "Y-m-d",
        defaultDate: initialDate,
        disableMobile: "true", 
        onChange: function(selectedDates, dateStr, instance) {
            updateUIByTimeAndDate(dateStr);
        }
    });

    // --- universal_logs からのデータ読み込み (Read) ---
    async function loadDataByDate(dateStr) {
        if (!supabaseClient) return;

        currentRecordId = null;
        existingPayload = {};

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
        const defaultCond = document.querySelector('#mGrp .cond-btn[data-v="3"]');
        if(defaultCond) defaultCond.classList.add('active'); 

        // データが存在すれば反映
        if (data && data.payload) {
            currentRecordId = data.id;
            existingPayload = data.payload;
            const p = data.payload;

            if (p.waketime) document.getElementById('wt').value = extractTime(p.waketime);
            if (p.bedtime) document.getElementById('bt').value = extractTime(p.bedtime);
            if (p.weight) document.getElementById('w').value = p.weight;
            if (p.body_fat) document.getElementById('f').value = p.body_fat;
            if (p.daily_notes) document.getElementById('note').value = p.daily_notes;
            
            if (p.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const condBtn = document.querySelector(`#mGrp .cond-btn[data-v="${p.mental_condition}"]`);
                if (condBtn) condBtn.classList.add('active');
            }
        }
    }

    // 初回ロードの実行
    updateUIByTimeAndDate(initialDate);

    // --- 修正ボタン (P2 -> P1 への戻り) ---
    document.getElementById('btnBackToEdit').addEventListener('click', () => {
        document.getElementById('p2').classList.remove('active');
        document.getElementById('p1').classList.add('active');
        document.getElementById('s2').classList.remove('active');
    });

    // --- 確認画面への遷移 (P1 -> P2) ---
    document.getElementById('hForm').addEventListener('submit', (e) => {
        e.preventDefault();

        const dateStr = dateInput.value;
        const isMorningVisible = mSec.style.display === 'block';
        const isNightVisible = nSec.style.display === 'block';

        payloadToSave = {
            measured_date: dateStr,
        };

        cList.innerHTML = `<div><span>日付</span><span>${dateStr}</span></div>`;

        if (isMorningVisible) {
            const wt = document.getElementById('wt').value;
            const bt = document.getElementById('bt').value;
            const w = document.getElementById('w').value;
            const f = document.getElementById('f').value;
            const condEl = document.querySelector('#mGrp .cond-btn.active');
            const cond = condEl ? condEl.getAttribute('data-v') : "3";

            if(wt) { 
                payloadToSave.waketime = getLocalTimestamp(dateStr, wt, false); 
                cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`; 
            }
            if(bt) { 
                payloadToSave.bedtime = getLocalTimestamp(dateStr, bt, true); 
                cList.innerHTML += `<div><span>就寝</span><span>${bt}</span></div>`; 
            }
            
            // 睡眠時間の自動算出（正確な物理日付から計算）
            if(wt && bt) {
                let wDate = new Date(payloadToSave.waketime);
                let bDate = new Date(payloadToSave.bedtime);
                let diffM = (wDate - bDate) / 60000;
                if (diffM < 0) diffM += 24 * 60; // 異常値へのフェイルセーフ
                let sleepH = Math.round((diffM / 60) * 10) / 10;
                
                payloadToSave.sleep_hours = sleepH;
                cList.innerHTML += `<div><span>睡眠時間</span><span style="color:#10b981; font-weight:700;">${sleepH} h (自動算出)</span></div>`;
            }
            
            if(w)  { payloadToSave.weight = parseFloat(w); cList.innerHTML += `<div><span>体重</span><span>${w} kg</span></div>`; }
            if(f)  { payloadToSave.body_fat = parseFloat(f); cList.innerHTML += `<div><span>体脂肪</span><span>${f} %</span></div>`; }
            payloadToSave.mental_condition = parseInt(cond);
            cList.innerHTML += `<div><span>コンディション</span><span>Level ${cond}</span></div>`;
        }

        if (isNightVisible) {
            const note = document.getElementById('note').value;
            if(note) {
                payloadToSave.daily_notes = note;
                cList.innerHTML += `<div><span>ジャーナル</span><span>入力あり</span></div>`;
            } else {
                payloadToSave.daily_notes = null;
            }
        }

        document.getElementById('p1').classList.remove('active');
        document.getElementById('p2').classList.add('active');
        document.getElementById('s2').classList.add('active');
    });

    // --- 保存処理 (universal_logs へ INSERT または UPDATE) ---
    const saveBtn = document.getElementById('saveBtn');
    saveBtn.addEventListener('click', async (e) => {
        const btn = e.target;
        btn.disabled = true;
        btn.innerText = "保存中...";

        try {
            // 既存のpayloadと今回の入力内容をマージ（既存のデータを消さない）
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
            document.getElementById('s3').classList.add('active');

        } catch(error) {
            alert("システムエラー: " + error.message);
            btn.disabled = false;
            btn.innerText = "確定";
        }
    });
});