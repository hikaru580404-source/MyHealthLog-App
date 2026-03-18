document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;
    const healthForm = document.getElementById('healthForm');
    const mentalBtns = document.querySelectorAll('#mentalGroup .cond-btn');
    const inputMental = document.getElementById('inputMental');
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;

    mentalBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            mentalBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            inputMental.value = btn.dataset.level;
        });
    });
    document.querySelector('#mentalGroup .cond-btn[data-level="3"]').classList.add('active');

    function calculateSleepHours(dateStr, bedStr, wakeStr) {
        const bed = new Date(`${dateStr}T${bedStr}`);
        const wake = new Date(`${dateStr}T${wakeStr}`);
        if (wake <= bed) wake.setDate(wake.getDate() + 1);
        const diffMs = wake - bed;
        return (diffMs / (1000 * 60 * 60)).toFixed(1);
    }

    healthForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const date = document.getElementById('inputDate').value;
        const weight = document.getElementById('inputWeight').value;
        const sleepH = calculateSleepHours(date, document.getElementById('inputBedtime').value, document.getElementById('inputWaketime').value);
        document.getElementById('confirmDataList').innerHTML = `
            <div class="confirm-row"><span class="confirm-key">日付</span><span class="confirm-val">${date}</span></div>
            <div class="confirm-row"><span class="confirm-key">体重</span><span class="confirm-val">${weight} kg</span></div>
            <div class="confirm-row"><span class="confirm-key">睡眠時間</span><span class="confirm-val">${sleepH} 時間</span></div>
            <div class="confirm-row"><span class="confirm-key">メンタル</span><span class="confirm-val">${inputMental.value} / 5</span></div>
        `;
        document.getElementById('confirmSummary').innerText = `${weight} kg / ${sleepH} h`;
        document.getElementById('panelInput').classList.remove('active');
        document.getElementById('panelConfirm').classList.add('active');
    });

    document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
        const date = document.getElementById('inputDate').value;
        const sleepH = calculateSleepHours(date, document.getElementById('inputBedtime').value, document.getElementById('inputWaketime').value);
        const healthData = {
            user_id: user.id,
            measured_date: date,
            weight: parseFloat(document.getElementById('inputWeight').value),
            body_fat: document.getElementById('inputFat').value ? parseFloat(document.getElementById('inputFat').value) : null,
            sleep_hours: parseFloat(sleepH),
            mental_condition: parseInt(inputMental.value),
            daily_notes: document.getElementById('inputNotes').value
        };
        const { error: hErr } = await supabaseClient.from('health_logs').upsert(healthData);
        if (hErr) { alert("保存失敗: " + hErr.message); return; }
        const mealMemo = document.getElementById('inputMealMemo').value;
        if (mealMemo) {
            await supabaseClient.from('meal_logs').insert({ user_id: user.id, meal_date: date, meal_type: document.getElementById('inputMealType').value, content: mealMemo });
        }
        document.getElementById('panelConfirm').classList.remove('active');
        document.getElementById('panelDone').classList.add('active');
    });
});