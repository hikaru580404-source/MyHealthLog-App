document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    let currentDate = new Date();

    /**
     * 「**月別データの取得と表示**」
     */
    async function loadSummaryData() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        document.getElementById('summaryMonthLabel').innerText = `「**${year}年 ${month + 1}月**」`;

        const startOfMonth = new Date(year, month, 1).toISOString();
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

        const { data, error } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .gte('measured_date', startOfMonth)
            .lte('measured_date', endOfMonth)
            .order('measured_date', { ascending: false });

        if (!error) {
            renderStats(data);
            renderList(data);
        }
    }

    /**
     * 「**統計カード（KPI）の更新**」
     */
    function renderStats(logs) {
        if (logs.length === 0) {
            document.getElementById('avgWeight').innerText = "-- kg";
            document.getElementById('avgFat').innerText = "-- %";
            document.getElementById('monthCount').innerText = "0 回";
            return;
        }

        const sumW = logs.reduce((s, l) => s + l.weight, 0);
        const logsWithFat = logs.filter(l => l.body_fat !== null);
        const sumF = logsWithFat.reduce((s, l) => s + l.body_fat, 0);

        document.getElementById('avgWeight').innerText = `「**${(sumW / logs.length).toFixed(1)} kg**」`;
        document.getElementById('avgFat').innerText = logsWithFat.length > 0 ? `「**${(sumF / logsWithFat.length).toFixed(1)} %**」` : "-- %";
        document.getElementById('monthCount').innerText = `「**${logs.length} 回**」`;
    }

    /**
     * 「**明細リストの表示（家計簿のカテゴリ明細形式を継承）**」
     */
    function renderList(logs) {
        const listContainer = document.getElementById('logDetailList');
        listContainer.innerHTML = '';

        if (logs.length === 0) {
            listContainer.innerHTML = '<div class="empty-msg">「**この月の記録はありません**」</div>';
            return;
        }

        logs.forEach(log => {
            const row = document.createElement('div');
            row.className = 'cat-detail-row';
            row.innerHTML = `
                <div class="cat-detail-name">「**${log.measured_date}**」</div>
                <div class="cat-detail-actual">「**${log.weight.toFixed(1)} kg**」</div>
                <div class="cat-detail-budget">「**${log.body_fat ? log.body_fat.toFixed(1) + '%' : '-'}**」</div>
            `;
            listContainer.appendChild(row);
        });
    }

    // 「**月移動ボタンのイベント**」
    document.getElementById('prevMonthBtn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        loadSummaryData();
    });
    document.getElementById('nextMonthBtn').addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        loadSummaryData();
    });

    loadSummaryData();
});