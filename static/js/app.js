/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Shared Utilities & Auth Helpers
   ═══════════════════════════════════════════════════════════════════════════ */

// ─── Toast Notifications ───────────────────────────────────────────────────
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
    setTimeout(() => toast.remove(), 3000);
}

// ─── Supabase Configuration ────────────────────────────────────────────────
// These should be set in Vercel Environment Variables or a config.js
// ─── Supabase Configuration ────────────────────────────────────────────────
// PASTE YOUR KEYS HERE
const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

let supabase;
try {
    if (SUPABASE_URL && SUPABASE_KEY) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("✅ Supabase client initialized.");
    } else {
        console.error("❌ Supabase credentials missing!");
    }
} catch (e) {
    console.error("❌ Failed to initialize Supabase:", e);
}

// ─── API Helpers ───────────────────────────────────────────────────────────
// Note: apiCall is mostly replaced by direct Supabase calls, but kept for Edge Functions
async function apiCall(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.body = JSON.stringify(body);

    try {
        const res = await fetch(url, opts);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed with status ${res.status}`);
        return data;
    } catch (err) {
        console.error(`API Call Error (${url}):`, err);
        throw err;
    }
}

// ─── Auth Functions (Migrated to Supabase) ──────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log('Login Result:', data);
        if (error) throw error;

        showToast('Login successful!', 'success');
        
        const user = data.user;
        const role = user?.user_metadata?.role || 'citizen';
        console.log('User Role:', role);

        setTimeout(() => {
            // Using absolute paths for better compatibility
            window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';
        }, 500);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const phone = document.getElementById('phone')?.value || '';
    const language = document.getElementById('language')?.value || 'en';

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username,
                    phone,
                    language_pref: language,
                    role: 'citizen',
                    points: 0,
                    badge: 'None'
                }
            }
        });
        if (error) throw error;

        showToast('Registration successful! Check your email if verification is enabled.', 'success');
        setTimeout(() => window.location.href = '/dashboard', 1000);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleLogout() {
    try {
        await supabase.auth.signOut();
        window.location.href = '/';
    } catch (err) {
        window.location.href = '/';
    }
}

// ─── Session Listener ──────────────────────────────────────────────────────
if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state change:', event, session);
        if (event === 'SIGNED_OUT') {
            // Optional: Redirect to login if on a protected page
            const protectedPages = ['/dashboard', '/admin', '/new-complaint', '/track', '/profile'];
            if (protectedPages.includes(window.location.pathname)) {
                window.location.href = '/login';
            }
        }
    });
}

// ─── Status Badge Helper ──────────────────────────────────────────────────
function getStatusBadge(status) {
    const cls = status.toLowerCase().replace(/\s+/g, '-');
    return `<span class="badge badge-${cls}">${status}</span>`;
}

function getPriorityBadge(priority) {
    return `<span class="badge badge-priority-${priority.toLowerCase()}">${priority}</span>`;
}

function getCategoryBadge(category) {
    return `<span class="badge badge-category">${category}</span>`;
}

// ─── Date Formatting ──────────────────────────────────────────────────────
function formatDate(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', {
        year: 'numeric', month: 'short', day: 'numeric'
    });
}

function timeAgo(isoStr) {
    const seconds = Math.floor((new Date() - new Date(isoStr)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ─── Navbar Active State ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === path) {
            link.classList.add('active');
        }
    });
});
