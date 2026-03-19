// --- 初期設定 ---
const measuredDateInput = document.getElementById('measured_date');
if (measuredDateInput) {
  measuredDateInput.value = new Date().toISOString().split('T')[0];
}

let selectedMental = 3;
const condBtns = document.querySelectorAll('.cond-btn');
condBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    condBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMental = parseInt(btn.dataset.val);
  });
});

/**
 * 行動KPIを取得しダッシュボードを更新
 */
async function refreshKPIDashboard() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // KPIテーブルから最新値を取得
    const { data: stats, error } = await supabase
      .from('user_kpi_stats')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (stats) {
      // 継続日数
      document.getElementById('current-streak').textContent = stats.current_streak;
      // 累計
      document.getElementById('total-days').textContent = stats.total_log_days;
      
      // 目標達成率の計算 (例: 登録日からの経過日数に対する記録日数の割合)
      const joinedDate = new Date(user.created_at);
      const today = new Date();
      const diffDays = Math.max(1, Math.floor((today - joinedDate) / (1000 * 60 * 60 * 24)) + 1);
      const rate = Math.min(100, Math.round((stats.total_log_days / diffDays) * 100));
      document.getElementById('completion-rate').textContent = rate;
    }
  } catch (err) {
    console.error('[KPI_FETCH_ERROR]:', err.message);
  }
}

/**
 * 健康ログの保存処理
 */
const healthForm = document.getElementById('health-form');
if (healthForm) {
  healthForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('認証セッションがありません');

      const formData = {
        user_id: user.id,
        measured_date: document.getElementById('measured_date').value,
        bedtime: document.getElementById('bedtime').value ? `${document.getElementById('measured_date').value}T${document.getElementById('bedtime').value}:00Z` : null,
        waketime: document.getElementById('waketime').value ? `${document.getElementById('measured_date').value}T${document.getElementById('waketime').value}:00Z` : null,
        weight: parseFloat(document.getElementById('weight').value) || null,
        body_fat: parseFloat(document.getElementById('body_fat').value) || null,
        mental_condition: selectedMental,
        daily_notes: document.getElementById('daily_notes').value
      };

      const { error } = await supabase
        .from('health_logs')
        .upsert(formData, { onConflict: 'user_id, measured_date' });

      if (error) throw error;

      alert('ログを保存しました');
      // KPIを再取得して表示を更新
      await refreshKPIDashboard();
      
    } catch (err) {
      console.error('[SAVE_ERROR]:', err.message);
      alert('保存に失敗しました: ' + err.message);
    }
  });
}

// ページ読み込み時にKPIを表示
document.addEventListener('DOMContentLoaded', refreshKPIDashboard);

// ログアウト処理
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });
}