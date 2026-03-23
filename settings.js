// ============================================================
// settings.js  |  AsirLabo OS  -  JWA Wellness
// MIGRATED: health_logs -> universal_logs (payload JSONB)
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const form = document.getElementById('settingsForm');
    const msg  = document.getElementById('saveMsg');
    let mVal = 3;

    // --- Mental condition button toggle ---
    document.querySelectorAll('#mentalGrp .cond-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#mentalGrp .cond-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mVal = btn.dataset.v;
        };
    });

    // --- Initial data load ---
    async function init() {
        // Goal values are stored locally (no DB needed)
        document.getElementById('goalWeight').value = localStorage.getItem('goalWeight_' + user.id) || "";
        document.getElementById('goalFat').value    = localStorage.getItem('goalFat_' + user.id) || "";

        const today = new Date().toLocaleDateString('sv-SE');

        // MIGRATED: query universal_logs with JSONB filter instead of health_logs
        const { data } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', today)
            .maybeSingle();

        if (data && data.payload) {
            const p = data.payload;
            document.getElementById('nowWeight').value = p.weight    || "";
            document.getElementById('nowFat').value    = p.body_fat  || "";

            // Restore bedtime / waketime fields if present
            if (p.bedtime)  document.getElementById('bedtime').value  = extractTime(p.bedtime);
            if (p.waketime) document.getElementById('waketime').value = extractTime(p.waketime);

            if (p.mental_condition) {
                document.querySelectorAll('#mentalGrp .cond-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`.cond-btn[data-v="${p.mental_condition}"]`)?.classList.add('active');
                mVal = p.mental_condition;
            }
        }
    }

    // Helper: "2025-03-23T23:00:00+09" -> "23:00"
    function extractTime(ts) {
        if (!ts) return "";
        const t = ts.replace('T', ' ');
        return t.includes(' ') ? t.split(' ')[1].substring(0, 5) : "";
    }

    init();

    // --- Release notes / guide modal ---
    const openGuideBtn = document.getElementById('openGuideBtn');
    if (openGuideBtn) {
        openGuideBtn.onclick = () => {
            document.getElementById('guideModal').style.display = 'flex';
        };
    }

    // --- Save handler ---
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveAllBtn');
        btn.disabled = true;
        btn.innerText = "Saving...";

        // Persist goal values to localStorage
        const goalW = document.getElementById('goalWeight').value;
        const goalF = document.getElementById('goalFat').value;
        localStorage.setItem('goalWeight_' + user.id, goalW);
        localStorage.setItem('goalFat_' + user.id, goalF);

        const today = new Date().toLocaleDateString('sv-SE');

        // Build payload
        const newData = {
            measured_date:    today,
            weight:           document.getElementById('nowWeight').value    ? parseFloat(document.getElementById('nowWeight').value)   : null,
            body_fat:         document.getElementById('nowFat').value       ? parseFloat(document.getElementById('nowFat').value)      : null,
            mental_condition: parseInt(mVal)
        };

        // Parse time inputs
        const btVal = document.getElementById('bedtime').value;
        const wtVal = document.getElementById('waketime').value;
        if (btVal) {
            const [h, m] = btVal.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            newData.bedtime = d.toISOString();
        }
        if (wtVal) {
            const [h, m] = wtVal.split(':');
            const d = new Date();
            d.setHours(parseInt(h), parseInt(m), 0, 0);
            newData.waketime = d.toISOString();
        }
        // Auto-calculate sleep hours
        if (newData.waketime && newData.bedtime) {
            const diffM = (new Date(newData.waketime) - new Date(newData.bedtime)) / 60000;
            newData.sleep_hours = Math.round(((diffM < 0 ? diffM + 1440 : diffM) / 60) * 10) / 10;
        }

        // MIGRATED: upsert into universal_logs
        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', today)
            .maybeSingle();

        let error;
        if (existing) {
            const mergedPayload = { ...existing.payload, ...newData };
            ({ error } = await supabaseClient
                .from('universal_logs')
                .update({ payload: mergedPayload })
                .eq('id', existing.id));
        } else {
            ({ error } = await supabaseClient
                .from('universal_logs')
                .insert({
                    user_id:    user.id,
                    project_id: 'jwa',
                    log_type:   'daily_metric',
                    payload:    newData
                }));
        }

        if (error) {
            alert("Save Error: " + error.message);
        } else {
            msg.style.display = 'block';
            setTimeout(() => {
                msg.style.display = 'none';
                location.href = 'index.html';
            }, 1500);
        }

        btn.disabled = false;
        btn.innerText = "Save Changes";
    });
});
