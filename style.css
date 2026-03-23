document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    const listContainer = document.getElementById('historyBody');
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="text-align:center; padding: 3rem; color: #64748b; font-weight: 600; letter-spacing: 0.1em;">Loading...</div>';

    // Supabaseからユーザーの全ログを取得
    const { data: logs, error } = await supabaseClient
        .from('health_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_date', { ascending: false });

    if (error) {
        listContainer.innerHTML = '<div style="text-align:center; color:#ef4444; padding: 2rem;">Error loading data</div>';
        return;
    }

    // 日付をキーにしたマップを作成
    const logMap = {};
    if (logs) {
        logs.forEach(log => { logMap[log.measured_date] = log; });
    }

    listContainer.innerHTML = '';
    
    // 深夜4時ルールを適用した「今日」の論理日付を取得
    const today = new Date();
    if (today.getHours() < 4) today.setDate(today.getDate() - 1);

    // 過去30日間をループして一覧を生成
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        
        // 1行分のコンテナ (div) を生成
        const row = document.createElement('div');
        row.className = 'archive-row';
        row.onclick = () => { location.href = `form.html?date=${dateStr}`; };

        const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        // 例: 03/22 Sun
        const dateDisplay = `${dateStr.slice(5).replace('-', '/')} <span class="dow">${dayOfWeek}</span>`; 

        if (logMap[dateStr]) {
            // 記録がある場合
            const log = logMap[dateStr];
            const weight = log.weight ? `${log.weight} <small>kg</small>` : '--';
            const sleep = log.sleep_hours ? `${log.sleep_hours} <small>h</small>` : '--';
            
            let mentalBadge = '--';
            if (log.mental_condition) {
                const mFaces = ["", "😫", "😟", "😐", "🙂", "🤩"];
                mentalBadge = mFaces[log.mental_condition];
            }
            
            // CSSで自動省略されるため、そのまま全テキストを投入
            const note = log.daily_notes || '';

            row.innerHTML = `
                <div class="col-date">${dateDisplay}</div>
                <div class="col-metrics">
                    <div class="metric-val">${weight}</div>
                    <div class="metric-val">${sleep}</div>
                </div>
                <div class="col-mental">${mentalBadge}</div>
                <div class="col-journal">${note}</div>
            `;
        } else {
            // 記録がない場合（Nullスタイルを適用）
            row.classList.add('is-null');
            row.innerHTML = `
                <div class="col-date">${dateDisplay}</div>
                <div class="col-null-msg">
                    <span class="null-badge">[ NULL ]</span>
                </div>
            `;
        }
        listContainer.appendChild(row);
    }
});