document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const gallery = document.getElementById('mealGallery');

    async function loadMeals() {
        gallery.innerHTML = '<div style="color:var(--clr-text-secondary); grid-column: 1 / -1; text-align:center; padding: 2rem;">読み込み中...</div>';

        const { data, error } = await supabaseClient
            .from('meal_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('meal_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            gallery.innerHTML = '<div style="color:#ef4444; grid-column: 1 / -1; text-align:center;">エラーが発生しました</div>';
            return;
        }

        if (!data || data.length === 0) {
            gallery.innerHTML = '<div style="color:var(--clr-text-secondary); grid-column: 1 / -1; text-align:center; padding: 2rem;">食事の記録がありません</div>';
            return;
        }

        gallery.innerHTML = '';

        data.forEach(meal => {
            const dParts = meal.meal_date.split('-');
            const displayDate = `${dParts[1]}/${dParts[2]}`;

            const imageHtml = meal.image_url 
                ? `<img src="${meal.image_url}" alt="Meal Image" loading="lazy">`
                : `<div class="meal-img-placeholder"><i class="fas fa-utensils"></i></div>`;

            const card = document.createElement('div');
            card.className = 'meal-card';
            card.innerHTML = `
                <div class="meal-img-wrapper">${imageHtml}</div>
                <div class="meal-info">
                    <div class="meal-header">
                        <span class="meal-type">${meal.meal_type}</span>
                        <span class="meal-date">${displayDate}</span>
                    </div>
                    <div class="meal-memo">${meal.content || 'メモなし'}</div>
                </div>
            `;
            gallery.appendChild(card);
        });
    }

    loadMeals();
});