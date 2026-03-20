document.addEventListener('DOMContentLoaded', async () => {
    // 認証チェック
    const user = await checkAuth();
    if (!user) return;

    const gallery = document.getElementById('mealGallery');
    
    // モーダル要素の取得
    const detailModal = document.getElementById('mealDetailModal');
    const mdImageContainer = document.getElementById('mdImageContainer');
    const mdBadge = document.getElementById('mdBadge');
    const mdDate = document.getElementById('mdDate');
    const mdMemo = document.getElementById('mdMemo');
    const btnMdDelete = document.getElementById('btnMdDelete'); // 削除ボタン追加

    // 現在開いている食事のIDを保持する変数
    let currentMealId = null;

    // モーダル閉じるボタン
    document.getElementById('btnMdClose').addEventListener('click', () => {
        detailModal.style.display = 'none';
        currentMealId = null;
    });

    // ★追加：削除ボタンの処理
    btnMdDelete.addEventListener('click', async () => {
        if (!currentMealId) return;
        
        if (!confirm('この食事データを完全に削除してもよろしいですか？\n※この操作は取り消せません。')) {
            return;
        }

        const originalText = btnMdDelete.innerText;
        btnMdDelete.innerText = '削除中...';
        btnMdDelete.disabled = true;

        try {
            const response = await fetch('/api/delete-meal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ meal_id: currentMealId })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                detailModal.style.display = 'none';
                currentMealId = null;
                loadMeals(); // 削除後にギャラリーを再読み込みして更新
            } else {
                alert('削除失敗: ' + (data.details || 'Unknown Error'));
            }
        } catch (error) {
            console.error(error);
            alert('サーバーエラーが発生しました');
        } finally {
            btnMdDelete.innerText = originalText;
            btnMdDelete.disabled = false;
        }
    });

    async function loadMeals() {
        gallery.innerHTML = '<div style="color:var(--clr-text-secondary); grid-column: 1 / -1; text-align:center; padding: 3rem;">Loading...</div>';

        const { data, error } = await supabaseClient
            .from('meal_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('meal_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            gallery.innerHTML = '<div style="color:#ef4444; grid-column: 1 / -1; text-align:center; padding: 3rem;">エラーが発生しました</div>';
            return;
        }

        if (!data || data.length === 0) {
            gallery.innerHTML = '<div style="color:var(--clr-text-secondary); grid-column: 1 / -1; text-align:center; padding: 3rem;">食事の記録がありません</div>';
            return;
        }

        gallery.innerHTML = '';

        data.forEach(meal => {
            const dParts = meal.meal_date.split('-');
            const displayDate = `${dParts[1]}/${dParts[2]}`;

            const item = document.createElement('div');
            item.className = 'meal-item';

            const imageHtml = meal.image_url 
                ? `<img src="${meal.image_url}" alt="Meal" loading="lazy">`
                : `<div class="meal-placeholder"><i class="fas fa-utensils"></i></div>`;

            item.innerHTML = `
                ${imageHtml}
                <div class="meal-overlay">
                    <span class="meal-badge">${meal.meal_type}</span>
                    <span class="meal-date-small">${displayDate}</span>
                </div>
            `;

            // タップ（クリック）時のモーダル表示イベント
            item.addEventListener('click', () => {
                currentMealId = meal.id; // ★タップした食事のIDをセット
                
                mdImageContainer.innerHTML = meal.image_url
                    ? `<img src="${meal.image_url}" class="meal-detail-img">`
                    : `<div class="meal-detail-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:rgba(255,255,255,0.1);"><i class="fas fa-utensils"></i></div>`;
                
                mdBadge.innerText = meal.meal_type;
                mdDate.innerText = meal.meal_date; 
                mdMemo.innerText = meal.content ? meal.content : 'メモはありません。';
                
                detailModal.style.display = 'flex';
            });

            gallery.appendChild(item);
        });
    }

    loadMeals();
});