document.addEventListener('DOMContentLoaded', async () => {
    // 1. 認証チェック
    const user = await checkAuth();
    if (!user) return;

    // 2. 状態管理（UI要素）
    const btnWake = document.getElementById('btnWaketime');
    const btnBed = document.getElementById('btnBedtime');
    const vValue = document.getElementById('vitalityValue');
    const vCircle = document.getElementById('vitalityCircle');
    const navHistory = document.getElementById('navHistory');
    const navModal = document.getElementById('navConfirmModal');

    // 3. 多言語（簡易版）
    window.currentLang = 'ja';
    const dict = {
        ja: {
            msg_wake: "おはようございます！今日も統治を始めましょう。",
            title_hist: "History & Audit",
            desc_hist: "過去の統治記録を振り返り、修正や監査を行います。"
        }
    };

    // 4. クイックログ機能 (起床・就寝)
    async function quickLog(field, doAnimation = false) {
        const now = new Date();
        let lDate = new Date(now);
        if (now.getHours() < 4) lDate.setDate(lDate.getDate() - 1);
        const dateStr = lDate.toLocaleDateString('sv-SE');

        const { data: existing } = await supabaseClient
            .from('universal_logs')
            .select('id, payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric')
            .eq('payload->>measured_date', dateStr)
            .maybeSingle();
            
        let pToSave = existing && existing.payload ? existing.payload : { measured_date: dateStr };
        pToSave[field] = now.toISOString();

        // 睡眠時間の算出
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
        
        alert(dict.ja.msg_wake);
        loadDashboard();
    }

    if (btnWake) btnWake.onclick = () => quickLog('waketime', false);
    if (btnBed) btnBed.onclick = () => quickLog('bedtime', true);

    // 5. ナビゲーション（不具合解消済）
    if (navHistory) {
        navHistory.onclick = (e) => {
            e.preventDefault();
            document.getElementById('navModalTitle').innerText = dict.ja.title_hist;
            document.getElementById('navModalDesc').innerText = dict.ja.desc_hist;
            navModal.style.display = 'flex';
        };
    }

    const modalProceed = document.getElementById('navModalProceed');
    if (modalProceed) {
        modalProceed.onclick = () => { location.href = 'summary.html'; };
    }

    window.onclick = (event) => {
        if (event.target == navModal) navModal.style.display = "none";
    };

    // 6. ダッシュボード描画
    window.loadDashboard = async function() {
        const { data } = await supabaseClient
            .from('universal_logs')
            .select('payload')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'daily_metric');
        
        let logs = data ? data.map(d => d.payload) : [];
        logs.sort((a, b) => (b.measured_date || "").localeCompare(a.measured_date || ""));

        // 活力スコア算出（直近データ）
        let vScore = 50; 
        if (logs.length > 0) {
            const latest = logs[0];
            const sleepH = latest.sleep_hours || 6;
            vScore = Math.min(100, Math.round(50 + (sleepH / 7) * 40));
        }
        
        if(vValue) vValue.innerText = vScore;
        if(vCircle) vCircle.style.background = `conic-gradient(var(--clr-accent) ${vScore}%, #1e293b ${vScore}%)`;

        // ボタン状態制御
        const now = new Date();
        const lToday = (now.getHours() < 4 ? new Date(now.setDate(now.getDate()-1)) : now).toLocaleDateString('sv-SE');
        const todayLog = logs.find(l => l.measured_date === lToday);
        if (todayLog && todayLog.waketime) {
            btnWake.classList.add('disabled');
        } else {
            btnWake.classList.remove('disabled');
        }
    };

    loadDashboard();
});