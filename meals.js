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

    // モーダル閉じるボタン
    document.getElementById('btnMdClose').addEventListener('click', () => {
        detailModal.style.display = 'none';
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

            // 画像があれば表示、なければプレースホルダーアイコン
            const imageHtml = meal.image_url 
                ? `<img src="${meal.image_url}" alt="Meal" loading="lazy">`
                : `<div class="meal-placeholder"><i class="fas fa-utensils"></i></div>`;

            // グリッド要素の生成
            item.innerHTML = `
                ${imageHtml}
                <div class="meal-overlay">
                    <span class="meal-badge">${meal.meal_type}</span>
                    <span class="meal-date-small">${displayDate}</span>
                </div>
            `;

            // タップ（クリック）時のモーダル表示イベント
            item.addEventListener('click', () => {
                // 画像のセット
                mdImageContainer.innerHTML = meal.image_url
                    ? `<img src="${meal.image_url}" class="meal-detail-img">`
                    : `<div class="meal-detail-img" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:rgba(255,255,255,0.1);"><i class="fas fa-utensils"></i></div>`;
                
                // テキストデータのセット
                mdBadge.innerText = meal.meal_type;
                mdDate.innerText = meal.meal_date; // モーダルでは年号も含めたフル日付を表示
                
                // メモが空の場合は「メモなし」と表示
                mdMemo.innerText = meal.content ? meal.content : 'メモはありません。';
                
                // モーダルを開く
                detailModal.style.display = 'flex';
            });

            gallery.appendChild(item);
        });
    }

    loadMeals();
});