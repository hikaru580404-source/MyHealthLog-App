document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    
    const weightDisplay = document.getElementById('kpiWeight');
    const fatDisplay = document.getElementById('kpiFat');
    const logCountDisplay = document.getElementById('kpiLogCount');
    const monthLabel = document.getElementById('currentMonthLabel');

    const now = new Date();
    monthLabel.innerText = `${now.getFullYear()}年 ${now.getMonth() + 1}月`;

    async function updateDashboard() {
        const { data: latestData } = await supabaseClient
            .from('health_logs')
            .select('weight, body_fat')
            .eq('user_id', user.id)
            .order('measured_date', { ascending: false })
            .limit(1);

        if (latestData && latestData.length > 0) {
            weightDisplay.innerText = `${latestData[0].weight.toFixed(1)} kg`;
            fatDisplay.innerText = latestData[0].body_fat ? `${latestData[0].body_fat.toFixed(1)} %` : "-- %";
        }

        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count } = await supabaseClient
            .from('health_logs')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .gte('measured_date', firstDay);

        if (count !== null) {
            logCountDisplay.innerText = `${count} 日`;
        }
    }

    updateDashboard();
});