// ============================================================
// meals.js  |  AsirLabo OS  -  JWA Wellness
// MIGRATED: meal_logs → universal_logs (project_id='jwa', log_type='meal')
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const gallery        = document.getElementById('mealGallery');
    const detailModal    = document.getElementById('mealDetailModal');
    const mdImageContainer = document.getElementById('mdImageContainer');
    const mdBadge        = document.getElementById('mdBadge');
    const mdDate         = document.getElementById('mdDate');
    const mdMemo         = document.getElementById('mdMemo');
    const btnMdDelete    = document.getElementById('btnMdDelete');
    const btnMdClose     = document.getElementById('btnMdClose');

    let currentLogId = null; // universal_logs の id (uuid)

    // --- モーダルを閉じる ---
    btnMdClose.addEventListener('click', () => {
        detailModal.style.display = 'none';
        currentLogId = null;
    });

    // --- 削除処理（universal_logs を直接削除）---
    btnMdDelete.addEventListener('click', async () => {
        if (!currentLogId) return;
        if (!confirm('Delete this meal log permanently?')) return;

        btnMdDelete.disabled = true;
        try {
            const { error } = await supabaseClient
                .from('universal_logs')
                .delete()
                .eq('id', currentLogId)
                .eq('user_id', user.id); // 安全のため user_id も条件に追加

            if (error) throw error;

            detailModal.style.display = 'none';
            currentLogId = null;
            loadMeals();
        } catch (error) {
            console.error('Delete error:', error);
            alert('削除に失敗しました: ' + error.message);
        } finally {
            btnMdDelete.disabled = false;
        }
    });

    // --- 食事ログの読み込み（universal_logs から取得）---
    async function loadMeals() {
        gallery.innerHTML = '<div style="grid-column:1/-1; padding:50px; text-align:center; color:#666;">Loading...</div>';

        const { data: rawLogs, error } = await supabaseClient
            .from('universal_logs')
            .select('id, payload, created_at')
            .eq('user_id', user.id)
            .eq('project_id', 'jwa')
            .eq('log_type', 'meal')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('loadMeals error:', error);
            gallery.innerHTML = '<div style="grid-column:1/-1; padding:50px; text-align:center; color:#ef4444;">Error loading meals.</div>';
            return;
        }

        if (!rawLogs || rawLogs.length === 0) {
            gallery.innerHTML = '<div style="grid-column:1/-1; padding:50px; text-align:center; color:#666;">No records yet.</div>';
            return;
        }

        gallery.innerHTML = '';

        rawLogs.forEach(log => {
            const meal = log.payload; // JSONB フィールドから各値を取得
            const logId = log.id;

            const item = document.createElement('div');
            item.className = 'meal-item';

            const imgHtml = meal.image_url
                ? `<img src="${meal.image_url}" loading="lazy">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#333;font-size:2rem;"><i class="fas fa-utensils"></i></div>`;

            const mealTypeInitial = (meal.meal_type || '?')[0].toUpperCase();

            item.innerHTML = `
                ${imgHtml}
                <div class="meal-badge-overlay">${mealTypeInitial}</div>
            `;

            item.addEventListener('click', () => {
                currentLogId = logId;

                mdImageContainer.innerHTML = meal.image_url
                    ? `<img src="${meal.image_url}" class="md-image-full">`
                    : `<div class="md-image-full" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:#222;"><i class="fas fa-utensils"></i></div>`;

                mdBadge.innerText = meal.meal_type || '';
                mdDate.innerText  = meal.meal_date || '';
                mdMemo.innerText  = meal.content   || 'No memo.';
                detailModal.style.display = 'flex';
            });

            gallery.appendChild(item);
        });
    }

    loadMeals();
});
