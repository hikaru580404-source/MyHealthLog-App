document.addEventListener('DOMContentLoaded', async () => {
    const user = await checkAuth();
    if (!user) return;

    const form = document.getElementById('settingsForm');
    const msg = document.getElementById('saveMsg');

    // 保存されている設定を読み込む
    const savedWeight = localStorage.getItem('goalWeight_' + user.id) || "";
    const savedSleep = localStorage.getItem('goalSleep_' + user.id) || "";
    const savedLang = localStorage.getItem('appLang_' + user.id) || "en";

    document.getElementById('goalWeight').value = savedWeight;
    document.getElementById('goalSleep').value = savedSleep;
    document.getElementById('appLang').value = savedLang;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const weight = document.getElementById('goalWeight').value;
        const sleep = document.getElementById('goalSleep').value;
        const lang = document.getElementById('appLang').value;

        // localStorageに保存
        localStorage.setItem('goalWeight_' + user.id, weight);
        localStorage.setItem('goalSleep_' + user.id, sleep);
        localStorage.setItem('appLang_' + user.id, lang);

        msg.style.display = 'block';
        setTimeout(() => { msg.style.display = 'none'; }, 3000);
    });
});