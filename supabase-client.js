// 「**Supabase接続設定：環境固有のキーを定義**」
const SUPABASE_URL = "https://kaoyiuyiduoqlxhnfrvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthb3lpdXlpZHVvcWx4aG5mcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODI0MDMsImV4cCI6MjA4OTM1ODQwM30.K0ucRuRKOW_SRhqWMuZIkOoPSbqqrE5bOmdfqDQgvJs";

// 「**クライアントの初期化**」
// グローバル空間の「supabase」オブジェクトを使用し、実務的な接続インスタンスを生成します。
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * 「**認証状態のチェック（共通ロジック）**」
 * 各画面の初期化時に呼び出し、未ログイン時はログイン画面へ強制遷移させます。
 */
async function checkAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    
    // セッションが無効、またはエラー時はログイン画面へリダイレクト
    if (error || !user) {
        window.location.href = "login.html";
        return null;
    }
    
    return user;
}

/**
 * 「**現在のユーザー情報を取得（リダイレクトなし）**」
 * ログイン画面などの遷移制御に使用する論理関数です。
 */
async function getSessionUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}