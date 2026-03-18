document.addEventListener('DOMContentLoaded', async () => {
    // app.js の checkAuth() がグローバルにある前提
    const user = await checkAuth();
    if (!user) return;

    const mentalLabels = ["不調", "低調", "並", "良", "絶好調"];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

        if (!data || data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--clr-premium-sub);">記録がありません</td></tr>`;
            return;
        }

        data.forEach(log => {
            const tr = document.createElement('tr');
            
            // 日付と曜日のフォーマット (YYYY-MM-DD -> MM/DD (Dow))
            const dateObj = new Date(log.measured_date);
            const dow = dayNames[dateObj.getDay()];
            const dateParts = log.measured_date.split('-');
            const displayDate = `${dateParts[1]}/${dateParts[2]} <span class="dow">(${dow})</span>`;

            // メンタルバッジの判定
            let mClass = "m-3"; // デフォルト（並）
            let mText = "--";
            if (log.mental_condition) {
                mClass = `m-${log.mental_condition}`;
                mText = mentalLabels[log.mental_condition - 1];
            }

            // メモが空の場合のプレースホルダー
            const noteText = log.daily_notes ? log.daily_notes : '<span style="color: #d1d5db;">-</span>';

            tr.innerHTML = `
                <td class="col-date">${displayDate}</td>
                <td class="col-val">${log.weight ? log.weight.toFixed(1) + ' <span style="font-size:0.7rem; color:#9ca3af; font-weight:400;">kg</span>' : '--'}</td>
                <td class="col-val">${log.sleep_hours ? log.sleep_hours.toFixed(1) + ' <span style="font-size:0.7rem; color:#9ca3af; font-weight:400;">h</span>' : '--'}</td>
                <td class="col-mental">
                    <span class="badge-mental ${mClass}">${mText}</span>
                </td>
                <td class="col-note">${noteText}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    loadHistory();
});