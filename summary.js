document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">Loading...</td></tr>';

    // Supabaseからユーザーの全ログを取得
    const { data: logs, error } = await supabaseClient
        .from('health_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('measured_date', { ascending: false });

    if (error) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">Error loading data</td></tr>';
        return;
    }

    // 日付をキーにしたマップを作成（検索しやすくするため）
    const logMap = {};
    if (logs) {
        logs.forEach(log => { logMap[log.measured_date] = log; });
    }

    tbody.innerHTML = '';
    
    // 深夜4時ルールを適用した「今日」の論理日付を取得
    const today = new Date();
    if (today.getHours() < 4) today.setDate(today.getDate() - 1);

    // 過去30日間をループして一覧を生成
    for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('sv-SE'); // YYYY-MM-DD
        
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        // 行をタップで、対象日のEDIT MODEへ遷移
        tr.onclick = () => { location.href = `form.html?date=${dateStr}`; };

        const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
        const dateDisplay = `${dateStr.slice(5)} <span class="dow">${dayOfWeek}</span>`; // MM-DD Sun

        if (logMap[dateStr]) {
            // 記録がある場合（データ展開）
            const log = logMap[dateStr];
            const weight = log.weight ? `${log.weight} <span style="font-size:0.7rem;color:var(--clr-text-secondary)">kg</span>` : '--';
            const sleep = log.sleep_hours ? `${log.sleep_hours} <span style="font-size:0.7rem;color:var(--clr-text-secondary)">h</span>` : '--';
            
            let mentalBadge = '--';
            if (log.mental_condition) {
                const mFaces = ["", "😫", "😟", "😐", "🙂", "🤩"];
                mentalBadge = `<span class="badge-mental m-${log.mental_condition}">${mFaces[log.mental_condition]}</span>`;
            }
            
            // ジャーナルは15文字で省略
            const note = log.daily_notes ? (log.daily_notes.length > 15 ? log.daily_notes.substring(0, 15) + '...' : log.daily_notes) : '--';

            tr.innerHTML = `
                <td class="col-date">${dateDisplay}</td>
                <td class="col-val">${weight}</td>
                <td class="col-val">${sleep}</td>
                <td class="col-mental">${mentalBadge}</td>
                <td class="col-note">${note}</td>
            `;
        } else {
            // 記録がない場合（Null表示）
            tr.innerHTML = `
                <td class="col-date">${dateDisplay}</td>
                <td colspan="4" style="text-align: center; color: rgba(255,255,255,0.2); font-size: 0.85rem; letter-spacing: 0.1em;">
                    [ Null ] 未記録 - タップして修正
                </td>
            `;
        }
        tbody.appendChild(tr);
    }
});