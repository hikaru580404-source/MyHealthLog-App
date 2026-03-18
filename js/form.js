document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェック**」
    const user = await checkAuth();
    
    const healthForm = document.getElementById('health-form');
    const message = document.getElementById('message');

    // 「**今日の日付を初期値として設定**」
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('measured_date').value = today;

    healthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 「**フォームデータの取得**」
        const formData = {
            user_id: user.id, // 「**ログイン中のユーザーID**」
            measured_date: document.getElementById('measured_date').value,
            weight: parseFloat(document.getElementById('weight').value),
            body_fat: document.getElementById('body_fat').value ? parseFloat(document.getElementById('body_fat').value) : null,
            notes: document.getElementById('notes').value
        };

        // 「**ボタンの二重押し防止**」
        const submitBtn = healthForm.querySelector('.btn-submit');
        submitBtn.disabled = true;
        message.innerText = "「**保存中...**」";

        // 「**Supabaseへのデータ挿入**」
        const { error } = await supabaseClient
            .from('health_logs') // 「**テーブル名と一致させる必要があります**」
            .insert([formData]);

        if (error) {
            console.error('Error:', error);
            message.innerText = "「**保存に失敗しました：**」" + error.message;
            submitBtn.disabled = false;
        } else {
            message.style.color = "green";
            message.innerText = "「**正常に記録されました。**」";
            
            // 「**一定時間後にダッシュボードへ戻る**」
            setTimeout(() => {
                window.location.href = "index.html";
            }, 1500);
        }
    });
});
