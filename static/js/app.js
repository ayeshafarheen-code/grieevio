/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Core Supabase Auth & Shared Utilities
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Supabase Configuration ────────────────────────────────────────────────
const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

// Initialize the Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Auth State Management ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    // Check initial session
    const { data: { session } } = await supabase.auth.getSession();
    handleAuthState(session);

    // Listen for auth changes
    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`Auth Event: ${event}`, session);
        handleAuthState(session);
    });
});

function handleAuthState(session) {
    const path = window.location.pathname;
    const isPublicPage = ['/', '/index.html', '/login.html', '/register.html'].includes(path) || path === '';
    
    if (!session && !isPublicPage) {
        // Redirect to login if trying to access protected page
        window.location.href = '/login.html';
    } else if (session && (path === '/login.html' || path === '/register.html')) {
        // Redirect to dashboard if already logged in and on auth pages
        window.location.href = '/dashboard.html';
    }
}

// ─── Login Function ────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Logging in...';

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) throw error;

        showToast('Success! Redirecting...', 'success');
        
        // Wait a bit for session to settle
        const role = data.user.user_metadata?.role || 'citizen';
        setTimeout(() => {
            window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';
        }, 1000);

    } catch (err) {
        console.error('Login Error:', err);
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Login 🚀';
    }
}

// ─── Register Function ─────────────────────────────────────────────────────
async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone')?.value || '';
    const language = document.getElementById('language')?.value || 'en';

    const btn = e.target.querySelector('button');
    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    phone,
                    language_pref: language,
                    role: 'citizen'
                }
            }
        });

        if (error) throw error;

        if (data.session) {
            showToast('Account created! Redirecting...', 'success');
            setTimeout(() => window.location.href = '/dashboard.html', 1500);
        } else {
            showToast('Account created! Please CHECK YOUR EMAIL to confirm your account before logging in.', 'info');
            setTimeout(() => window.location.href = '/login.html', 4000);
        }

    } catch (err) {
        console.error('Registration Error:', err);
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Register 🚀';
    }
}

// ─── Logout Function ───────────────────────────────────────────────────────
async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
}

// ─── UI Utilities ──────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function formatDate(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status) {
    const s = status || 'Submitted';
    return `<span class="badge badge-${s.toLowerCase().replace(' ', '-')}">${s}</span>`;
}

function getPriorityBadge(priority) {
    const p = priority || 'Medium';
    return `<span class="badge badge-priority-${p.toLowerCase()}">${p}</span>`;
}

function getCategoryBadge(category) {
    return `<span class="badge badge-category">${category || 'General'}</span>`;
}
