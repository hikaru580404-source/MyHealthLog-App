document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];

    async function loadHistory() {
        const { data, error } = await supabaseClient
            .from('health_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false });

        if (error) {
            console.error("履歴取得エラー:", error);
            return;
        }

        const tbody = document.getElementById('historyBody');
        tbody.innerHTML = '';

        data.forEach(log => {
            const tr = document.createElement('tr');
            
            // 日付のフォーマット (YYYY-MM-DD -> MM/DD)
            const dateParts = log.measured_date.split('-');
            const displayDate = `${dateParts[1]}/${dateParts[2]}`;

            // メンタルバッジの判定
            const mClass = `m-${log.mental_condition}`;
            const mText = log.mental_condition ? mentalLabels[log.mental_condition - 1] : "--";

            tr.innerHTML = `
                <td class="col-date">${displayDate}</td>
                <td class="col-val">${log.weight ? log.weight.toFixed(1) + ' <span style="font-size:0.7rem; color:#9ca3af;">kg</span>' : '--'}</td>
                <td class="col-val">${log.sleep_hours ? log.sleep_hours.toFixed(1) + ' <span style="font-size:0.7rem; color:#9ca3af;">h</span>' : '--'}</td>
                <td class="col-mental">
                    <span class="badge-mental ${mClass}">${mText}</span>
                </td>
                <td class="col-note">${log.daily_notes || ''}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    loadHistory();
});