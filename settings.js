document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const form = document.getElementById('settingsForm');
    const msg = document.getElementById('saveMsg');
    let mVal = 3;

    // メンタルボタンの切り替え
    document.querySelectorAll('#mentalGrp .cond-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('#mentalGrp .cond-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            mVal = btn.dataset.v;
        };
    });

    // 初期値読み込み
    async function init() {
        document.getElementById('goalWeight').value = localStorage.getItem('goalWeight_' + user.id) || "";
        document.getElementById('goalFat').value = localStorage.getItem('goalFat_' + user.id) || "";

        const today = new Date().toLocaleDateString('sv-SE');
        const { data } = await supabaseClient.from('health_logs').select('*').eq('user_id', user.id).eq('measured_date', today).maybeSingle();
        if (data) {
            document.getElementById('nowWeight').value = data.weight || "";
            document.getElementById('nowFat').value = data.body_fat || "";
            if (data.mental_condition) {
                document.querySelectorAll('#mentalGrp .cond-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`.cond-btn[data-v="${data.mental_condition}"]`)?.classList.add('active');
                mVal = data.mental_condition;
            }
        }
    }
    init();

    // ★修正：リリースノートモーダルを表示する
    document.getElementById('openGuideBtn').onclick = () => {
        document.getElementById('guideModal').style.display = 'flex';
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('saveAllBtn');
        btn.disabled = true; btn.innerText = "Saving...";

        const goalW = document.getElementById('goalWeight').value;
        const goalF = document.getElementById('goalFat').value;
        localStorage.setItem('goalWeight_' + user.id, goalW);
        localStorage.setItem('goalFat_' + user.id, goalF);

        const today = new Date().toLocaleDateString('sv-SE');
        const payload = {
            user_id: user.id,
            measured_date: today,
            weight: document.getElementById('nowWeight').value ? parseFloat(document.getElementById('nowWeight').value) : null,
            body_fat: document.getElementById('nowFat').value ? parseFloat(document.getElementById('nowFat').value) : null,
            mental_condition: parseInt(mVal)
        };

        const bt = document.getElementById('bedtime').value;
        const wt = document.getElementById('waketime').value;
        if (bt) {
            const d = new Date(); const [h, m] = bt.split(':');
            d.setHours(h, m, 0, 0); payload.bedtime = d.toISOString();
        }
        if (wt) {
            const d = new Date(); const [h, m] = wt.split(':');
            d.setHours(h, m, 0, 0); payload.waketime = d.toISOString();
        }

        const { data: existing } = await supabaseClient.from('health_logs').select('id').eq('user_id', user.id).eq('measured_date', today).maybeSingle();
        let error;
        if (existing) error = (await supabaseClient.from('health_logs').update(payload).eq('id', existing.id)).error;
        else error = (await supabaseClient.from('health_logs').insert(payload)).error;

        if (error) alert("Save Error: " + error.message);
        else {
            msg.style.display = 'block';
            setTimeout(() => { msg.style.display = 'none'; location.href = 'index.html'; }, 1500);
        }
        btn.disabled = false; btn.innerText = "Save Changes";
    });
});