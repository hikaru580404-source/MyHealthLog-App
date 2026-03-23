const SUPABASE_URL = "https://qzxajtlisscwxwidicfh.supabase.co";
const SUPABASE_KEY = "あなたのSUPABASE_ANON_KEYをここに貼り付け"; // ドライブ上のファイルにあるキーを維持してください

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkAuth() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}