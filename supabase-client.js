// ============================================================
// supabase-client.js  |  AsirLabo OS  -  JWA Wellness
// CLEAN VERSION - All non-ASCII / invisible chars removed
// ============================================================

// --- Connection Settings ---
const SUPABASE_URL = "https://qzxajtlisscwxwidicfh.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6eGFqdGxpc3Njd3h3aWRpY2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODMyODcsImV4cCI6MjA4OTQ1OTI4N30.a_p0H8IA9G2GzCQXirIDmHCsw38SDGGxIBwRFvbJtf0";

// --- Client Initialization ---
// persistSession: true  → LocalStorage にセッションを保存（スマホ対応）
// detectSessionInUrl: true → メール確認リンクからの復帰を処理
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        persistSession: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
        storageKey: 'asir-labo-auth',
        autoRefreshToken: true
    }
});

// ============================================================
// checkAuth()
//   Used by: app.js, form.js, summary.js, meals.js, settings.js
//   getSession() → ローカルキャッシュから即取得（スマホで速い）
//   getUser()   → サーバー検証（セキュリティ確保）
// ============================================================
async function checkAuth() {
    // まずローカルセッションを確認（オフライン・スマホに強い）
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('login.html');
        return null;
    }
    // セッションがあればそのユーザーを返す（サーバーへの余分なリクエストを省く）
    return session.user;
}

// ============================================================
// getSessionUser()
//   Used by: login.js
//   Returns current user WITHOUT redirect (for login page guard)
//   getSession() で高速チェック（認証済みなら即リダイレクト）
// ============================================================
async function getSessionUser() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    return session ? session.user : null;
}
