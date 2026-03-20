console.log("[Trace] app.js の読み込みを開始しました。");

document.addEventListener('DOMContentLoaded', async () => {
    console.log("[Trace] DOMContentLoadedが発火しました。認証チェックを開始します...");
    
    const user = await checkAuth();
    if (!user) {
        console.warn("[Trace] 認証に失敗しました。処理を停止します。");
        return;
    }
    console.log("[Trace] 認証成功。ユーザーID:", user.id);
    
    let currentLang = localStorage.getItem('appLang_' + user.id) || 'en';
    const dict = {
        en: { recorded: "Logged", confirm_undo: "Do you want to reset (undo) this record?" },
        ja: { recorded: "記録済み", confirm_undo: "打刻をリセット（取り消し）しますか？" }
    };

    const kpiModal = document.getElementById('kpiModal');
    const btnKpiClose = document.getElementById('btnKpiClose');
    
    console.log("[Trace] KPIモーダルの要素取得状態:", { kpiModal, btnKpiClose });

    if (btnKpiClose && kpiModal) {
        btnKpiClose.addEventListener('click', () => { kpiModal.style.display = 'none'; });
    }

    const cards = document.querySelectorAll('.kpi-card');
    console.log(`[Trace] ${cards.length}個のKPIカードを検出しました。クリックイベントを付与します。`);
    
    cards.forEach((card) => {
        card.addEventListener('click', () => {
            console.log("[Trace] KPIカードがクリックされました！対象:", card.getAttribute('data-kpi-key'));
            if (!kpiModal) {
                console.error("[Trace] エラー: kpiModalが存在しないため表示できません。");
                return;
            }
            kpiModal.style.display = 'flex';
        });
    });

    function setButtonRecorded(type) {
        console.log(`[Trace] UI更新: ${type}ボタンを記録済み状態にします。`);
        let btn = document.getElementById(type === 'wake' ? 'btnWaketime' : 'btnBedtime');
        if(!btn) return;
        btn.classList.add('recorded');
    }

    async function recordTime(type) {
        console.log(`[Trace] recordTime() が呼ばれました。タイプ: ${type}`);
        try {
            const now = new Date();
            const logicalDateStr = now.toISOString().split('T')[0]; // 簡易的な日付
            const timeISO = now.toISOString();

            console.log(`[Trace] データベースへの通信を開始します...`);
            const { data: existing, error: fetchErr } = await supabaseClient.from('health_logs')
                .select('id, waketime, bedtime').eq('user_id', user.id).eq('measured_date', logicalDateStr).maybeSingle();

            if (fetchErr) throw fetchErr;
            console.log(`[Trace] 既存データの確認完了:`, existing);

            let updatePayload = { user_id: user.id, measured_date: logicalDateStr };
            if (type === 'wake') updatePayload.waketime = timeISO;
            if (type === 'bed') updatePayload.bedtime = timeISO;

            if (existing && existing.id) {
                console.log(`[Trace] 既存データをアップデートします。ID: ${existing.id}`);
                const { error: updateErr } = await supabaseClient.from('health_logs').update(updatePayload).eq('id', existing.id);
                if (updateErr) throw updateErr;
            } else {
                console.log(`[Trace] 新規データをインサートします。`);
                const { error: insertErr } = await supabaseClient.from('health_logs').insert(updatePayload);
                if (insertErr) throw insertErr;
            }

            console.log(`[Trace] 保存成功！UIを更新します。`);
            setButtonRecorded(type);

        } catch (e) {
            console.error("[Trace] 保存エラー発生:", e);
            alert("保存エラーが発生しました: " + e.message);
        }
    }

    const btnBedtime = document.getElementById('btnBedtime');
    const btnWaketime = document.getElementById('btnWaketime');
    
    console.log("[Trace] クイックアクションボタンの要素取得状態:", { btnWaketime, btnBedtime });

    if (btnBedtime) btnBedtime.addEventListener('click', () => recordTime('bed'));
    if (btnWaketime) btnWaketime.addEventListener('click', () => recordTime('wake'));

    console.log("[Trace] app.js のすべての初期化が完了しました。");
});