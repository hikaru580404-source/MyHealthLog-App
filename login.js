document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginMsg = document.getElementById('loginMsg');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        loginMsg.innerText = "認証中...";

        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            loginMsg.style.color = "#ef4444";
            loginMsg.innerText = "ログイン失敗: " + error.message;
        } else {
            window.location.href = "index.html";
        }
    });
});