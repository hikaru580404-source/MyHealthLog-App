// ============================================================
// login.js  |  AsirLabo OS  -  JWA Wellness
// Authentication: Login & Sign-up flow
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

    // --- Login guard: already authenticated → redirect to dashboard ---
    // getSessionUser() is defined in supabase-client.js (NO redirect on null)
    const user = await getSessionUser();
    if (user) {
        window.location.href = "index.html";
        return;
    }

    // --- UI Elements ---
    const authForm       = document.getElementById('authForm');
    const authTitle      = document.getElementById('authTitle');
    const authSubmitBtn  = document.getElementById('authSubmitBtn');
    const authMsg        = document.getElementById('authMsg');
    const toggleAuthMode = document.getElementById('toggleAuthMode');
    const consentGroup   = document.getElementById('consentGroup');
    const consentCheck   = document.getElementById('consentCheck');
    let isLoginMode = true;

    // --- Toggle Login / Sign-up ---
    toggleAuthMode.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authTitle.innerText      = isLoginMode ? "システム ログイン" : "新規アカウント登録";
        authSubmitBtn.innerText  = isLoginMode ? "ログイン"         : "登録メールを送信";
        toggleAuthMode.innerText = isLoginMode
            ? "アカウントをお持ちでない方はこちら（新規登録）"
            : "既にアカウントをお持ちの方はこちら";
        consentGroup.style.display = isLoginMode ? "none" : "block";
        authMsg.innerText = "";
    });

    // --- Form Submit ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Sign-up: consent check
        if (!isLoginMode && !consentCheck.checked) {
            showMsg("エラー: 個人情報の取り扱いに同意してください。", "error");
            return;
        }

        showMsg("処理中...", "info");
        authSubmitBtn.disabled = true;

        if (isLoginMode) {
            // ---- LOGIN ----
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                showMsg("ログインエラー: メールアドレスまたはパスワードが違います。", "error");
                authSubmitBtn.disabled = false;
            } else {
                window.location.href = "index.html";
            }
        } else {
            // ---- SIGN UP ----
            const { error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    emailRedirectTo: window.location.origin + '/index.html'
                }
            });

            if (error) {
                showMsg("登録エラー: " + error.message, "error");
                authSubmitBtn.disabled = false;
            } else {
                showMsg("確認メールを送信しました。メール内のリンクをクリックして登録を完了してください。", "success");
                authForm.reset();
                consentCheck.checked = false;
                authSubmitBtn.disabled = false;
            }
        }
    });

    // --- Helper: message display ---
    function showMsg(text, type) {
        const colors = { error: "#ef4444", success: "#10b981", info: "var(--clr-text-primary)" };
        authMsg.style.color = colors[type] || colors.info;
        authMsg.innerText = text;
    }
});
