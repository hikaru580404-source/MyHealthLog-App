const SUPABASE_URL = "https://kaoyiuyiduoqlxhnfrvq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imthb3lpdXlpZHVvcWx4aG5mcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3ODI0MDMsImV4cCI6MjA4OTM1ODQwM30.K0ucRuRKOW_SRhqWMuZIkOoPSbqqrE5bOmdfqDQgvJs";

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