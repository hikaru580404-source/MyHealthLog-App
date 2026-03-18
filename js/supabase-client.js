// 「**Supabase接続設定**」
const SUPABASE_URL = "https://kaoyiuyiduoqlxhnfrvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthb3lpdXlpZHVvcWx4aG5mcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODI0MDMsImV4cCI6MjA4OTM1ODQwM30.K0ucRuRKOW_SRhqWMuZIkOoPSbqqrE5bOmdfqDQgvJs";

// 「**クライアントの初期化**」
// ライブラリ本体の「supabase」と混同を避けるため、「supabaseClient」と命名します。
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 「**認証状態のチェック（共通関数）**」
 */
async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = "login.html";
    }
    return user;
}
