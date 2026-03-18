document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェックを実行**」
    const user = await checkAuth();
    
    // 「**UI要素の取得**」
    const weightDisplay = document.getElementById('latest-weight');
    const countDisplay = document.getElementById('log-count');
    const logoutBtn = document.getElementById('logout-btn');

    // 「**ログアウト処理**」
    logoutBtn.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
        window.location.href = "login.html";
    });

    /**
     * 「**サマリーデータの取得と表示**」
     */
    async function updateDashboard() {
        // 1. 「**最新の体重を取得**」
        const { data: latestData, error: weightError } = await supabaseClient
            .from('health_logs')
            .select('weight')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false })
            .limit(1);

        if (!weightError && latestData && latestData.length > 0) {
            weightDisplay.innerText = `${latestData[0].weight.toFixed(1)} kg`;
        } else {
            weightDisplay.innerText = "「**データなし**」";
        }

        // 2. 「**今月の計測日数をカウント**」
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        const { count, error: countError } = await supabaseClient
            .from('health_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('measured_date', firstDayOfMonth);

        if (!countError) {
            countDisplay.innerText = `${count} 日`;
        }
    }

    // 「**初期表示の実行**」
    updateDashboard();
});