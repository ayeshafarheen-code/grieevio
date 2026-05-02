/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Final Supabase Auth & Vercel Optimized Logic
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

// Initialize Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Auth State Management ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    checkAuth(session);

    supabase.auth.onAuthStateChange((event, session) => {
        console.log("Auth Event:", event);
        checkAuth(session);
    });
});

function checkAuth(session) {
    const path = window.location.pathname.replace(/\/$/, ""); // Remove trailing slash
    
    // Define public routes (handling both .html and clean URLs)
    const publicRoutes = ["", "/", "/index", "/index.html", "/login", "/login.html", "/register", "/register.html"];
    const isPublic = publicRoutes.includes(path);

    if (!session && !isPublic) {
        window.location.href = "/login.html";
    } else if (session && (path === "/login" || path === "/login.html" || path === "/register" || path === "/register.html")) {
        window.location.href = "/dashboard.html";
    }
}

// ─── Login ────────────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    if (!email || !password) return;

    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Logging in...</span>';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        showToast('Welcome back!', 'success');
        const role = data.user.user_metadata?.role || 'citizen';
        setTimeout(() => {
            window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';
        }, 800);
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Login 🚀';
    }
}

// ─── Register ─────────────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone')?.value || '';

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Creating Account...</span>';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username, phone, role: 'citizen' }
            }
        });
        if (error) throw error;

        if (data.session) {
            showToast('Success! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/dashboard.html', 1000);
        } else {
            showToast('Please check your email to confirm registration!', 'info');
            setTimeout(() => window.location.href = '/login.html', 3000);
        }
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = 'Register 🚀';
    }
}

// ─── Logout ───────────────────────────────────────────────────────────────
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/login.html";
}

// ─── Shared Utilities ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}
