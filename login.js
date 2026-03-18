document.addEventListener('DOMContentLoaded', async () => {
    const user = await getSessionUser();
    if (user) {
        window.location.href = "index.html";
        return;
    }
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authMsg = document.getElementById('authMsg');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    let isLoginMode = true;

    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        if (isLoginMode) {
            authTitle.innerText = "システム ログイン";
            authSubmitBtn.innerText = "ログイン";
            toggleAuthMode.innerText = "アカウントをお持ちでない方はこちら（新規登録）";
        } else {
            authTitle.innerText = "新規アカウント登録";
            authSubmitBtn.innerText = "登録メールを送信";
            toggleAuthMode.innerText = "既にアカウントをお持ちの方はこちら";
        }
        authMsg.innerText = "";
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        authMsg.style.color = "var(--clr-text-primary)";
        authMsg.innerText = isLoginMode ? "認証中..." : "登録メール送信中...";
        authSubmitBtn.disabled = true;

        if (isLoginMode) {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                authMsg.style.color = "var(--clr-expense-dark)";
                authMsg.innerText = "ログイン失敗: " + error.message;
                authSubmitBtn.disabled = false;
            } else {
                window.location.href = "index.html";
            }
        } else {
            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { emailRedirectTo: window.location.origin + '/index.html' }
            });
            if (error) {
                authMsg.style.color = "var(--clr-expense-dark)";
                authMsg.innerText = "登録失敗: " + error.message;
                authSubmitBtn.disabled = false;
            } else {
                authMsg.style.color = "var(--clr-income-dark)";
                authMsg.innerText = "確認メールを送信しました。メール内のURLをクリックして完了してください。";
                authForm.reset();
            }
        }
    });
});