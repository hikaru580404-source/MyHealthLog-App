document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェック**」
    const user = await checkAuth();
    
    // UI要素の取得
    const healthForm = document.getElementById('healthForm');
    const panelInput = document.getElementById('panelInput');
    const panelConfirm = document.getElementById('panelConfirm');
    const panelDone = document.getElementById('panelDone');
    
    // 今日をデフォルトに設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('inputDate').value = today;

    /**
     * 「**クイック情報の更新（ダッシュボードと同様のロジック）**」
     */
    async function updateQuickStats() {
        const { data } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).order('measured_date', { ascending: false }).limit(1);
        if (data && data.length > 0) {
            document.getElementById('qbWeight').innerText = `${data[0].weight.toFixed(1)} kg`;
            document.getElementById('qbFat').innerText = data[0].body_fat ? `${data[0].body_fat.toFixed(1)} %` : "-- %";
        }
    }
    updateQuickStats();

    /**
     * ステップ1 → 2: 「**確認画面への遷移**」
     */
    healthForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // 入力値の取得
        const weight = parseFloat(document.getElementById('inputWeight').value);
        const fat = document.getElementById('inputFat').value;
        const date = document.getElementById('inputDate').value;
        const memo = document.getElementById('inputMemo').value;

        // 確認画面への反映
        document.getElementById('confirmDate').innerText = date;
        document.getElementById('confirmWeight').innerText = `${weight.toFixed(1)} kg`;
        document.getElementById('confirmFat').innerText = fat ? `${parseFloat(fat).toFixed(1)} %` : "---";
        document.getElementById('confirmMemo').innerText = memo || "「**なし**」";
        document.getElementById('confirmSummary').innerText = `「**${weight.toFixed(1)} kg**」`;

        // パネル切り替え
        panelInput.classList.remove('active');
        panelConfirm.classList.add('active');
        document.getElementById('step1Dot').classList.add('done');
        document.getElementById('step2Dot').classList.add('active');
    });

    /**
     * 修正ボタン
     */
    document.getElementById('backToInputBtn').addEventListener('click', () => {
        panelConfirm.classList.remove('active');
        panelInput.classList.add('active');
        document.getElementById('step2Dot').classList.remove('active');
    });

    /**
     * ステップ2 → 3: 「**Supabaseへの確定保存**」
     */
    document.getElementById('confirmSaveBtn').addEventListener('click', async () => {
        const weight = parseFloat(document.getElementById('inputWeight').value);
        const fat = document.getElementById('inputFat').value;
        
        const saveData = {
            user_id: user.id,
            measured_date: document.getElementById('inputDate').value,
            weight: weight,
            body_fat: fat ? parseFloat(fat) : null,
            notes: document.getElementById('inputMemo').value
        };

        const btn = document.getElementById('confirmSaveBtn');
        btn.disabled = true;
        btn.innerText = "「**保存中...**」";

        const { error } = await supabaseClient.from('health_logs').insert([saveData]);

        if (error) {
            alert("「**保存に失敗しました：**」" + error.message);
            btn.disabled = false;
            btn.innerText = "「**確定する**」";
        } else {
            panelConfirm.classList.remove('active');
            panelDone.classList.add('active');
            document.getElementById('step2Dot').classList.add('done');
            document.getElementById('step3Dot').classList.add('active');
        }
    });
});