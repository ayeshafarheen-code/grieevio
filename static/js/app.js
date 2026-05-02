/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO - AUTOMATIC AUTH CONNECTION (MASTER FIX)
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co";
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

// Initialize Supabase
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase Connection: Active");
} catch (e) {
    console.error("❌ Supabase Init Failed:", e);
}

// ─── AUTOMATIC EVENT ATTACHMENT ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    console.log("🛠️ Initializing GRIEEVIO Auth Listeners...");
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');

    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
        console.log("🔗 Attached: Login Handler");
    }
    
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
        console.log("🔗 Attached: Register Handler");
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// ─── LOGIN HANDLER ────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Checking credentials...";
        
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Redirect based on role
        const role = data.user.user_metadata?.role || 'citizen';
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
            options: { data: { username, role: 'citizen' } }
        });

        if (error) throw error;

        if (data.session) {
            window.location.href = "dashboard.html";
        } else {
            alert("Success! Check your email for the confirmation link.");
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
    if (supabase) await supabase.auth.signOut();
    window.location.href = "login.html";
}
