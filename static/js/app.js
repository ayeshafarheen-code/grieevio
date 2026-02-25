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

// ─── API Helpers ───────────────────────────────────────────────────────────
async function apiCall(url, method = 'GET', body = null) {
    const opts = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin'
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

// ─── Auth Functions ────────────────────────────────────────────────────────
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const data = await apiCall('/api/login', 'POST', { email, password });
        showToast('Login successful!', 'success');
        setTimeout(() => {
            if (data.user.role === 'admin') {
                window.location.href = '/admin';
            } else {
                window.location.href = '/dashboard';
            }
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
        await apiCall('/api/register', 'POST', { username, email, password, phone, language_pref: language });
        showToast('Registration successful!', 'success');
        setTimeout(() => window.location.href = '/dashboard', 500);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function handleLogout() {
    try {
        await apiCall('/api/logout', 'POST');
        window.location.href = '/';
    } catch (err) {
        window.location.href = '/';
    }
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
