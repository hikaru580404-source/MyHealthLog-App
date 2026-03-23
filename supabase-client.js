const SUPABASE_URL = "https://qzxajtlisscwxwidicfh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6eGFqdGxpc3Njd3h3aWRpY2ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4ODMyODcsImV4cCI6MjA4OTQ1OTI4N30.a_p0H8IA9G2GzCQXirIDmHCsw38SDGGxIBwRFvbJtf0";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAuth() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();
    if (error || !user) {
        window.location.href = "login.html";
        return null;
    }
    return user;
}

async function getSessionUser() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    return user;
}