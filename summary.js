document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const listContainer = document.getElementById('historyBody');
    if (!listContainer) return;
    listContainer.innerHTML = '<div style="text-align:center; padding: 3rem; color: #8b9bb4;">Loading Governance History...</div>';

    const { data: rawLogs, error } = await supabaseClient
        .from('universal_logs')
        .select('payload')
        .eq('user_id', user.id)
        .eq('project_id', 'jwa')
        .eq('log_type', 'daily_metric');

    if (error) {
        listContainer.innerHTML = '<div style="text-align:center; color:#eecb70;">Error Loading History</div>';
        return;
    }

    let logs = rawLogs ? rawLogs.map(r => r.payload) : [];
    const logMap = {};
    logs.forEach(log => { logMap[log.measured_date] = log; });

    listContainer.innerHTML = '';
    const today = new Date();
    if (today.getHours() < 4) today.setDate(today.getDate() - 1);

    for (let i = 0; i < 30; i++) {
        const d = new Date(today); d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('sv-SE');
        const row = document.createElement('div');
        row.className = 'archive-row';
        row.style.cursor = 'pointer';
        row.onclick = () => { location.href = `form.html?date=${dateStr}`; };

        const dws = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dateDisplay = `${dateStr.slice(5).replace('-', '/')} <span style="font-size:0.7rem; opacity:0.6;">${dws[d.getDay()]}</span>`;

        if (logMap[dateStr]) {
            const log = logMap[dateStr];
            const weight = log.weight ? `${log.weight}kg` : '--';
            const sleep = log.sleep_hours ? `${log.sleep_hours}h` : '--';
            row.innerHTML = `<div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
                <div style="font-weight:700;">${dateDisplay}</div>
                <div style="color:var(--clr-accent); font-size:0.9rem;">W: ${weight} / S: ${sleep}</div>
                <i class="fas fa-chevron-right" style="opacity:0.3;"></i>
            </div>`;
        } else {
            row.innerHTML = `<div style="padding:15px; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center; opacity:0.3;">
                <div>${dateDisplay}</div>
                <div style="font-size:0.8rem;">[ NULL ]</div>
                <i class="fas fa-chevron-right"></i>
            </div>`;
        }
        listContainer.appendChild(row);
    }
});