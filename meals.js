document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const gallery = document.getElementById('mealGallery');
    const detailModal = document.getElementById('mealDetailModal');
    const mdImageContainer = document.getElementById('mdImageContainer');
    const mdBadge = document.getElementById('mdBadge');
    const mdDate = document.getElementById('mdDate');
    const mdMemo = document.getElementById('mdMemo');
    const btnMdDelete = document.getElementById('btnMdDelete');

    let currentMealId = null;

    document.getElementById('btnMdClose').addEventListener('click', () => {
        detailModal.style.display = 'none';
        currentMealId = null;
    });

    btnMdDelete.addEventListener('click', async () => {
        if (!currentMealId) return;
        if (!confirm('Delete this meal log permanently?')) return;

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
                loadMeals();
            } else {
                alert('Delete failed');
            }
        } catch (error) { console.error(error); }
        finally { btnMdDelete.disabled = false; }
    });

    async function loadMeals() {
        gallery.innerHTML = '';
        const { data, error } = await supabaseClient
            .from('meal_logs')
            .select('*')
            .eq('user_id', user.id)
            .order('meal_date', { ascending: false });

        if (!data || data.length === 0) {
            gallery.innerHTML = '<div style="grid-column:1/-1; padding:50px; text-align:center; color:#666;">No records yet.</div>';
            return;
        }

        data.forEach(meal => {
            const item = document.createElement('div');
            item.className = 'meal-item';
            
            const imgHtml = meal.image_url 
                ? `<img src="${meal.image_url}" loading="lazy">`
                : `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#333;"><i class="fas fa-utensils"></i></div>`;
            
            item.innerHTML = `
                ${imgHtml}
                <div class="meal-badge-overlay">${meal.meal_type[0]}</div>
            `;

            item.addEventListener('click', () => {
                currentMealId = meal.id;
                mdImageContainer.innerHTML = meal.image_url 
                    ? `<img src="${meal.image_url}" class="md-image-full">` 
                    : `<div class="md-image-full" style="display:flex;align-items:center;justify-content:center;font-size:3rem;color:#222;"><i class="fas fa-utensils"></i></div>`;
                
                mdBadge.innerText = meal.meal_type;
                mdDate.innerText = meal.meal_date;
                mdMemo.innerText = meal.content || 'No memo.';
                detailModal.style.display = 'flex';
            });

            gallery.appendChild(item);
        });
    }

    loadMeals();
});