// (app.js の該当箇所：quickLog 関数周辺を以下のロジックに差し替えた全文)
async function quickLog(field, doAnimation = false) {
    const now = new Date();
    let logicalDate = new Date(now);
    if (now.getHours() < 4) logicalDate.setDate(logicalDate.getDate() - 1);
    const dateStr = logicalDate.toLocaleDateString('sv-SE');

    const { data: existing } = await supabaseClient
        .from('universal_logs')
        .select('id, payload')
        .eq('user_id', user.id)
        .eq('project_id', 'jwa')
        .eq('log_type', 'daily_metric')
        .eq('payload->>measured_date', dateStr)
        .maybeSingle();
        
    let pToSave = existing && existing.payload ? existing.payload : { measured_date: dateStr };
    
    // ISOString (UTC) で保存を統一
    pToSave[field] = now.toISOString();

    if (pToSave.waketime && pToSave.bedtime) {
        let wD = new Date(pToSave.waketime);
        let bD = new Date(pToSave.bedtime);
        let diffM = (wD - bD) / (1000 * 60);
        if (diffM < 0) diffM += 24 * 60;
        pToSave.sleep_hours = Math.round((diffM / 60) * 10) / 10;
    }

    if (existing) {
        await supabaseClient.from('universal_logs').update({ payload: pToSave }).eq('id', existing.id);
    } else {
        await supabaseClient.from('universal_logs').insert({
            user_id: user.id, project_id: 'jwa', log_type: 'daily_metric', payload: pToSave
        });
    }
    
    // ... アニメーション/遷移ロジック継続 ...
}