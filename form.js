document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    // ============================================================
    // Helper関数群 - 日本時間(JST)を確実に扱うユーティリティ
    // ============================================================

    /**
     * 論理日付を返す (深夜4時前は前日扱い)
     * @returns {string} YYYY-MM-DD
     */
    function getLogicalToday() {
        const now = new Date();
        // JSTのHH時を取得 (UTC+9)
        const jstHour = (now.getUTCHours() + 9) % 24;
        const d = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC→JST
        if (jstHour < 4) d.setDate(d.getDate() - 1);
        return d.toISOString().slice(0, 10); // YYYY-MM-DD
    }

    /**
     * JST タイムスタンプを生成して保存
     * 形式: "YYYY-MM-DDTHH:MM:00+09:00" (ISO 8601, JST明示)
     * @param {string} logicalDateStr - YYYY-MM-DD (論理日付)
     * @param {string} timeStr - HH:MM
     * @param {boolean} isBedtime - 就寝時刻フラグ (true: 深夜扱い調整あり)
     * @returns {string|null}
     */
    function getJSTTimestamp(logicalDateStr, timeStr, isBedtime) {
        if (!timeStr || !logicalDateStr) return null;
        const [h, m] = timeStr.split(':').map(Number);

        // 日付計算
        const dateParts = logicalDateStr.split('-');
        let year  = parseInt(dateParts[0]);
        let month = parseInt(dateParts[1]) - 1; // 0-indexed
        let day   = parseInt(dateParts[2]);

        // 就寝時刻が12:00以降 = 前夜の就寝 → 物理日付を -1日
        if (isBedtime && h >= 12) {
            const tmp = new Date(year, month, day - 1);
            year  = tmp.getFullYear();
            month = tmp.getMonth();
            day   = tmp.getDate();
        }

        const hh  = String(h).padStart(2, '0');
        const mm  = String(m).padStart(2, '0');
        const dd  = String(day).padStart(2, '0');
        const mo  = String(month + 1).padStart(2, '0');

        // ISO 8601 形式でJSTを明示 (+09:00)
        return `${year}-${mo}-${dd}T${hh}:${mm}:00+09:00`;
    }

    /**
     * Supabase から返ってきたタイムスタンプ文字列から JST の HH:MM を抽出
     * 形式対応: "2026-03-21T06:30:00+09:00", "2026-03-20T21:30:00+00:00", "2026-03-21 06:30:00+09"
     * @param {string} timestampStr
     * @returns {string} HH:MM (JST)
     */
    function extractJSTTime(timestampStr) {
        if (!timestampStr) return "";
        try {
            // Date オブジェクトに変換 (ブラウザが UTC に正規化)
            const utcMs = new Date(timestampStr).getTime();
            if (isNaN(utcMs)) return "";
            // JST = UTC + 9h
            const jstDate = new Date(utcMs + 9 * 60 * 60 * 1000);
            const hh = String(jstDate.getUTCHours()).padStart(2, '0');
            const mm = String(jstDate.getUTCMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
        } catch {
            return "";
        }
    }

    // ============================================================
    // UI要素の取得
    // ============================================================
    const dateInput = document.getElementById('date');
    const title     = document.getElementById('formTitle');
    const mSec      = document.getElementById('morningSection');
    const nSec      = document.getElementById('nightSection');
    const dMsg      = document.getElementById('dayTimeMessage');
    const btn       = document.getElementById('submitBtn');

    let currentRecordId = null;
    let existingPayload = {};
    let payloadToSave   = {};

    // --- コンディションボタンの選択制御 ---
    document.querySelectorAll('#mGrp .cond-btn').forEach(b => {
        b.addEventListener('click', (e) => {
            document.querySelectorAll('#mGrp .cond-btn').forEach(x => x.classList.remove('active'));
            e.currentTarget.classList.add('active');
        });
    });

    // ============================================================
    // UI表示切り替え (時間帯・選択日付に連動)
    // ============================================================
    function updateUIByTimeAndDate(selectedDateStr) {
        const now = new Date();
        // JSTの時間を計算
        const jstHour = (now.getUTCHours() + 9) % 24;
        const logicalTodayStr = getLogicalToday();

        mSec.style.display = 'none';
        nSec.style.display = 'none';
        dMsg.style.display = 'none';
        btn.style.display  = 'block';

        if (selectedDateStr === logicalTodayStr) {
            if (jstHour >= 4 && jstHour < 12) {
                title.innerText   = "MORNING LOG";
                mSec.style.display = 'block';
            } else if (jstHour >= 20 || jstHour < 4) {
                title.innerText   = "NIGHT LOG";
                nSec.style.display = 'block';
            } else {
                title.innerText   = "DAY TIME";
                dMsg.style.display = 'block';
                btn.style.display  = 'none';
            }
        } else {
            // 過去ログ編集モード
            title.innerText    = "EDIT / " + selectedDateStr;
            mSec.style.display = 'block';
            nSec.style.display = 'block';
        }

        loadDataByDate(selectedDateStr);
    }

    // ============================================================
    // URLパラメータ & Flatpickr 初期化
    // ============================================================
    const urlParams  = new URLSearchParams(window.location.search);
    const initialDate = urlParams.get('date') || getLogicalToday();
    dateInput.value  = initialDate;

    flatpickr("#date", {
        locale: "ja",
        dateFormat: "Y-m-d",
        defaultDate: initialDate,
        disableMobile: "true",
        onChange: function(selectedDates, dateStr) {
            updateUIByTimeAndDate(dateStr);
        }
    });

    // ============================================================
    // universal_logs からデータ読み込み
    // ============================================================
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

        // フォームをリセット
        document.getElementById('wt').value   = "";
        document.getElementById('bt').value   = "";
        document.getElementById('w').value    = "";
        document.getElementById('f').value    = "";
        document.getElementById('note').value = "";
        document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
        const defaultCond = document.querySelector('#mGrp .cond-btn[data-v="3"]');
        if (defaultCond) defaultCond.classList.add('active');

        if (error) {
            console.error('loadDataByDate error:', error.message);
            return;
        }

        // データがあれば反映
        if (data && data.payload) {
            currentRecordId = data.id;
            existingPayload = data.payload;
            const p = data.payload;

            // JSTに変換してHH:MM形式で表示
            if (p.waketime) document.getElementById('wt').value = extractJSTTime(p.waketime);
            if (p.bedtime)  document.getElementById('bt').value = extractJSTTime(p.bedtime);
            if (p.weight)     document.getElementById('w').value    = p.weight;
            if (p.body_fat)   document.getElementById('f').value    = p.body_fat;
            if (p.daily_notes) document.getElementById('note').value = p.daily_notes;

            if (p.mental_condition) {
                document.querySelectorAll('#mGrp .cond-btn').forEach(b => b.classList.remove('active'));
                const condBtn = document.querySelector(`#mGrp .cond-btn[data-v="${p.mental_condition}"]`);
                if (condBtn) condBtn.classList.add('active');
            }
        }
    }

    // 初回ロード
    updateUIByTimeAndDate(initialDate);

    // ============================================================
    // 修正ボタン (確認画面P2 → 入力画面P1 へ戻る)
    // ============================================================
    const btnBack = document.getElementById('btnBackToEdit');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            document.getElementById('p2').classList.remove('active');
            document.getElementById('p1').classList.add('active');
            document.getElementById('s2').classList.remove('active');
        });
    }

    // ============================================================
    // フォーム送信 → 確認画面へ (P1 → P2)
    // ============================================================
    const hForm = document.getElementById('hForm');
    if (hForm) {
        hForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const dateStr         = dateInput.value;
            const isMorningVisible = mSec.style.display === 'block';
            const isNightVisible   = nSec.style.display === 'block';
            const cList           = document.getElementById('cList');

            payloadToSave = { measured_date: dateStr };
            cList.innerHTML = `<div><span>日付</span><span>${dateStr}</span></div>`;

            if (isMorningVisible) {
                const wt    = document.getElementById('wt').value;
                const bt    = document.getElementById('bt').value;
                const w     = document.getElementById('w').value;
                const f     = document.getElementById('f').value;
                const condEl = document.querySelector('#mGrp .cond-btn.active');
                const cond  = condEl ? condEl.getAttribute('data-v') : "3";

                if (wt) {
                    payloadToSave.waketime = getJSTTimestamp(dateStr, wt, false);
                    cList.innerHTML += `<div><span>起床</span><span>${wt}</span></div>`;
                }
                if (bt) {
                    payloadToSave.bedtime = getJSTTimestamp(dateStr, bt, true);
                    cList.innerHTML += `<div><span>就寝</span><span>${bt}</span></div>`;
                }

                // 睡眠時間の自動算出
                if (wt && bt) {
                    const wMs = new Date(payloadToSave.waketime).getTime();
                    const bMs = new Date(payloadToSave.bedtime).getTime();
                    let diffM = (wMs - bMs) / 60000;
                    if (diffM < 0) diffM += 24 * 60;
                    const sleepH = Math.round((diffM / 60) * 10) / 10;
                    payloadToSave.sleep_hours = sleepH;
                    cList.innerHTML += `<div><span>睡眠時間</span><span style="color:#10b981; font-weight:700;">${sleepH} h (自動算出)</span></div>`;
                }

                if (w) { payloadToSave.weight    = parseFloat(w); cList.innerHTML += `<div><span>体重</span><span>${w} kg</span></div>`; }
                if (f) { payloadToSave.body_fat  = parseFloat(f); cList.innerHTML += `<div><span>体脂肪</span><span>${f} %</span></div>`; }
                payloadToSave.mental_condition = parseInt(cond);
                cList.innerHTML += `<div><span>コンディション</span><span>Level ${cond}</span></div>`;
            }

            if (isNightVisible) {
                const note = document.getElementById('note').value;
                payloadToSave.daily_notes = note || null;
                if (note) cList.innerHTML += `<div><span>ジャーナル</span><span>入力あり</span></div>`;
            }

            document.getElementById('p1').classList.remove('active');
            document.getElementById('p2').classList.add('active');
            document.getElementById('s2').classList.add('active');
        });
    }

    // ============================================================
    // 保存処理 (確認画面P2の「確定」ボタン)
    // ============================================================
    const saveBtn = document.getElementById('saveBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled  = true;
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
                            user_id:    user.id,
                            project_id: 'jwa',
                            log_type:   'daily_metric',
                            payload:    finalPayload
                        });
                    err = error;
                }

                if (err) throw err;

                document.getElementById('p2').classList.remove('active');
                document.getElementById('p3').classList.add('active');
                document.getElementById('s3').classList.add('active');

            } catch (error) {
                console.error('Save error:', error);
                alert("保存エラー: " + error.message);
                btn.disabled  = false;
                btn.innerText = "確定";
            }
        });
    }
});
