document.addEventListener('DOMContentLoaded', async () => {
    // 「**認証チェック**」
    const user = await checkAuth();
    
    const logList = document.getElementById('log-list');
    const loadingMsg = document.getElementById('loading-msg');

    // 「**データの取得実行**」
    async function fetchLogs() {
        const { data, error } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false });

        if (error) {
            console.error('Error:', error);
            loadingMsg.innerText = "「**データの取得に失敗しました。**」";
            return;
        }

        renderLogs(data);
    }

    // 「**テーブルへのレンダリング**」
    function renderLogs(logs) {
        loadingMsg.style.display = "none";
        logList.innerHTML = '';

        if (logs.length === 0) {
            logList.innerHTML = '<tr><td colspan="5" class="text-center">「**データがありません。**」</td></tr>';
            return;
        }

        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${log.measured_date}</td>
                <td>${log.weight.toFixed(1)}</td>
                <td>${log.body_fat ? log.body_fat.toFixed(1) : '-'}</td>
                <td class="cell-notes">${log.notes || ''}</td>
                <td>
                    <button class="btn-delete" onclick="deleteLog('${log.id}')">「**削除**」</button>
                </td>
            `;
            logList.appendChild(tr);
        });
    }

    // 「**削除機能の実装**」
    window.deleteLog = async (id) => {
        if (!confirm("「**この記録を削除してもよろしいですか？**」")) return;

        const { error } = await supabaseClient
            .from('health_logs')
            .delete()
            .eq('id', id);

        if (error) {
            alert("「**削除に失敗しました。**」");
        } else {
            fetchLogs(); // 「**再読み込み**」
        }
    };

    fetchLogs();
});
