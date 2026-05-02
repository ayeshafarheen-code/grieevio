/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO - FINAL SUPABASE AUTH (ROBUST VERSION)
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1Y3VxYmlqZXZqdHJwaWdjdnNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwMTI4MzgsImV4cCI6MjA5MjU4ODgzOH0.TFYbu9vHMsreNOE2gbZKsjwwASYWycXYoWO2Jl3LD3o";

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── AUTH STATE LISTENER ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    handleAuthState(session);

    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth Event:", event);
        handleAuthState(session);
    });
});

function handleAuthState(session) {
    const path = window.location.pathname.replace(/\/$/, "");
    const isAuthPage = path === "/login" || path === "/login.html" || path === "/register" || path === "/register.html";
    const isPublicPage = path === "" || path === "/" || path === "/index.html" || isAuthPage;

    if (!session && !isPublicPage) {
        window.location.href = "login.html";
    } else if (session && isAuthPage) {
        window.location.href = "dashboard.html";
    }
}

// ─── LOGIN HANDLER ────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Logging in...";
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Redirect based on role in profiles
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
        const role = profile?.role || 'citizen';
        
        window.location.href = role === 'admin' ? 'admin.html' : 'dashboard.html';
    } catch (err) {
        alert("Login Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Login";
    }
}

// ─── REGISTER HANDLER ─────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Creating Account...";
        
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } }
        });

        if (error) throw error;

        if (data.session) {
            window.location.href = "dashboard.html";
        } else {
            alert("Success! Check your email to confirm your account.");
            window.location.href = "login.html";
        }
    } catch (err) {
        alert("Registration Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Register";
    }
}

// ─── LOGOUT HANDLER ───────────────────────────────────────────────────────
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "login.html";
}
