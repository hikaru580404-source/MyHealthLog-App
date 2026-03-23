// ============================================================
// supabase-client.js  |  AsirLabo OS  -  JWA Wellness
// CLEAN VERSION - All non-ASCII / invisible chars removed
// ============================================================

// --- Connection Settings ---
// IMPORTANT: Replace with your actual Supabase ANON KEY (ASCII only, no spaces)
const SUPABASE_URL = "https://qzxajtlisscwxwidicfh.supabase.co";
const SUPABASE_KEY = "YOUR_SUPABASE_ANON_KEY_HERE";

// --- Client Initialization ---
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// checkAuth()
//   Used by: app.js, form.js, summary.js, meals.js, settings.js
//   If not authenticated, redirect to login.html
// ============================================================
async function checkAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return null;
    }
    return user;
}

// ============================================================
// getSessionUser()
//   Used by: login.js
//   Returns current user WITHOUT redirect (for login page guard)
// ============================================================
async function getSessionUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user || null;
}
