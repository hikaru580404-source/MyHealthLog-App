document.addEventListener('DOMContentLoaded', async () => {
    const user = await getSessionUser();
    if (user) { window.location.href = "index.html"; return; }
    
    const authForm = document.getElementById('authForm');
    const authTitle = document.getElementById('authTitle');
    const authSubmitBtn = document.getElementById('authSubmitBtn');
    const authMsg = document.getElementById('authMsg');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const consentGroup = document.getElementById('consentGroup');
    const consentCheck = document.getElementById('consentCheck');
    let isLoginMode = true;

    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authTitle.innerText = isLoginMode ? "システム ログイン" : "新規アカウント登録";
        authSubmitBtn.innerText = isLoginMode ? "ログイン" : "登録メールを送信";
        toggleAuthMode.innerText = isLoginMode ? "アカウントをお持ちでない方はこちら（新規登録）" : "既にアカウントをお持ちの方はこちら";
        consentGroup.style.display = isLoginMode ? "none" : "block";
        authMsg.innerText = "";
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!isLoginMode && !consentCheck.checked) {
            authMsg.style.color = "var(--clr-expense)";
            authMsg.innerText = "エラー: 個人情報の取り扱いに同意してください。";
            return;
        }

        authMsg.style.color = "var(--clr-text-primary)";
        authMsg.innerText = "処理中...";
        authSubmitBtn.disabled = true;

        if (isLoginMode) {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                authMsg.innerText = "エラー: " + error.message;
                authSubmitBtn.disabled = false;
            } else {
                window.location.href = "index.html";
            }
        } else {
            const { error } = await supabaseClient.auth.signUp({
                email, password,
                options: { emailRedirectTo: window.location.origin + '/index.html' }
            });
            if (error) {
                authMsg.innerText = "登録エラー: " + error.message;
                authSubmitBtn.disabled = false;
            } else {
                authMsg.innerText = "確認メールを送信しました。";
                authForm.reset();
                consentCheck.checked = false;
            }
        }
    });
});