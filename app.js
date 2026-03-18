document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェック**」
    const user = await checkAuth();
    
    // 「**UI要素の取得**」
    const weightDisplay = document.getElementById('kpiWeight');
    const fatDisplay = document.getElementById('kpiFat');
    const logCountDisplay = document.getElementById('kpiLogCount');
    const monthLabel = document.getElementById('currentMonthLabel');

    // 「**今日の日付情報を取得**」
    const now = new Date();
    monthLabel.innerText = `「**${now.getFullYear()}年 ${now.getMonth() + 1}月**」`;

    /**
     * 「**ダッシュボードデータの更新ロジック**」
     */
    async function updateDashboard() {
        // 1. 「**最新の記録を1件取得**」
        const { data: latestData, error: err1 } = await supabaseClient
            .from('health_logs')
            .select('weight, body_fat')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false })
            .limit(1);

        if (!err1 && latestData.length > 0) {
            weightDisplay.innerText = `「**${latestData[0].weight.toFixed(1)} kg**」`;
            fatDisplay.innerText = latestData[0].body_fat ? `「**${latestData[0].body_fat.toFixed(1)} %**」` : "「**-- %**」";
        }

        // 2. 「**今月のログ件数をカウント**」
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count, error: err2 } = await supabaseClient
            .from('health_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('measured_date', firstDay);

        if (!err2) {
            logCountDisplay.innerText = `「**${count} 日**」`;
        }
    }

    updateDashboard();
});