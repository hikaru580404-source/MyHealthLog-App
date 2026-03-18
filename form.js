document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const healthForm = document.getElementById('healthForm');
    const mentalBtns = document.querySelectorAll('#mentalGroup .cond-btn');
    const inputMental = document.getElementById('inputMental');

    // 本日の日付をデフォルト設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;

    /**
     * 「**コンディション選択ロジック**」
     */
    mentalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mentalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            inputMental.value = btn.dataset.level;
        });
    });
    // 初期選択（普通：3）
    document.querySelector('#mentalGroup .cond-btn[data-level="3"]').classList.add('active');

    /**
     * 「**睡眠時間の算出ロジック**」
     * 就寝時刻と起床時刻から、日付跨ぎを考慮して時間を計算します。
     */
    function calculateSleepHours(dateStr, bedStr, wakeStr) {
        const bed = new Date(`${dateStr}T${bedStr}`);
        const wake = new Date(`${dateStr}T${wakeStr}`);
        
        // 起床時刻が就寝時刻より前（例: 23:00寝て07:00起きる）なら起床を翌日と判定
        if (wake <= bed) {
            wake.setDate(wake.getDate() + 1);
        }
        
        const diffMs = wake - bed;
        return (diffMs / (1000 * 60 * 60)).toFixed(1);
    }

    /**
     * ステップ1 → 2: 確認画面
     */
    healthForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const date = document.getElementById('inputDate').value;
        const weight = document.getElementById('inputWeight').value;
        const sleepH = calculateSleepHours(date, document.getElementById('inputBedtime').value, document.getElementById('inputWaketime').value);
        
        const confirmTable = document.getElementById('confirmDataList');
        confirmTable.innerHTML = `
            <div class="confirm-row"><span class="confirm-key">日付</span><span class="confirm-val">${date}</span></div>
            <div class="confirm-row"><span class="confirm-key">体重</span><span class="confirm-val">${weight} kg</span></div>
            <div class="confirm-row"><span class="confirm-key">睡眠時間</span><span class="confirm-val">${sleepH} 時間</span></div>
            <div class="confirm-row"><span class="confirm-key">メンタル</span><span class="confirm-val">${inputMental.value} / 5</span></div>
            <div class="confirm-row"><span class="confirm-key">食事</span><span class="confirm-val">${document.getElementById('inputMealType').value}: ${document.getElementById('inputMealMemo').value || '未入力'}</span></div>
        `;
        document.getElementById('confirmSummary').innerText = `${weight} kg / ${sleepH} h`;

        document.getElementById('panelInput').classList.remove('active');
        document.getElementById('panelConfirm').classList.add('active');
        document.getElementById('step1Dot').classList.add('done');
        document.getElementById('step2Dot').classList.add('active');
    });

    /**
     * ステップ2 → 3: Supabase保存
     */
    document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
        const date = document.getElementById('inputDate').value;
        const bedTimeStr = document.getElementById('inputBedtime').value;
        const wakeTimeStr = document.getElementById('inputWaketime').value;
        const sleepH = calculateSleepHours(date, bedTimeStr, wakeTimeStr);

        // 就寝・起床のフルタイムスタンプ作成
        const bedTS = new Date(`${date}T${bedTimeStr}`).toISOString();
        let wakeDate = new Date(`${date}T${wakeTimeStr}`);
        if (new Date(`${date}T${wakeTimeStr}`) <= new Date(`${date}T${bedTimeStr}`)) {
            wakeDate.setDate(wakeDate.getDate() + 1);
        }
        const wakeTS = wakeDate.toISOString();

        // 1. 健康ログ（基本）の保存
        const healthData = {
            user_id: user.id,
            measured_date: date,
            weight: parseFloat(document.getElementById('inputWeight').value),
            body_fat: document.getElementById('inputFat').value ? parseFloat(document.getElementById('inputFat').value) : null,
            bedtime: bedTS,
            waketime: wakeTS,
            sleep_hours: parseFloat(sleepH),
            mental_condition: parseInt(inputMental.value),
            daily_notes: document.getElementById('inputNotes').value
        };

        const btn = document.getElementById('confirmSaveBtn');
        btn.disabled = true;
        btn.innerText = "保存中...";

        // upsertを使用して1日1件を担保
        const { error: hErr } = await supabaseClient.from('health_logs').upsert(healthData);

        if (hErr) {
            alert("基本ログの保存に失敗: " + hErr.message);
            btn.disabled = false;
            return;
        }

        // 2. 食事ログの保存（任意入力時のみ）
        const mealMemo = document.getElementById('inputMealMemo').value;
        if (mealMemo) {
            const mealData = {
                user_id: user.id,
                meal_date: date,
                meal_type: document.getElementById('inputMealType').value,
                content: mealMemo
            };
            await supabaseClient.from('meal_logs').insert(mealData);
        }

        document.getElementById('panelConfirm').classList.remove('active');
        document.getElementById('panelDone').classList.add('active');
        document.getElementById('step2Dot').classList.add('done');
        document.getElementById('step3Dot').classList.add('active');
    });

    document.getElementById('backToInputBtn').addEventListener('click', () => {
        document.getElementById('panelConfirm').classList.remove('active');
        document.getElementById('panelInput').classList.add('active');
        document.getElementById('step2Dot').classList.remove('active');
    });
});