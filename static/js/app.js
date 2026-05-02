/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO - NEW SUPABASE AUTH (REBUILT FROM SCRATCH)
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co";
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── AUTH ACTIONS ─────────────────────────────────────────────────────────

async function signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata }
    });
    if (error) throw error;
    return data;
}

async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}

async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.href = "/login.html";
}

async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

// ─── PAGE LOGIC ───────────────────────────────────────────────────────────

// Handle Login Form
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Authenticating...";
        
        const data = await signIn(email, password);
        console.log("Logged in:", data.user);
        
        const role = data.user.user_metadata?.role || 'citizen';
        window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';
    } catch (err) {
        alert("Login Failed: " + err.message);
        btn.disabled = false;
        btn.textContent = "Login";
    }
}

// Handle Register Form
async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value;
    const btn = e.target.querySelector('button');

    try {
        btn.disabled = true;
        btn.textContent = "Creating Account...";
        
        const data = await signUp(email, password, { username, role: 'citizen' });
        
        if (data.session) {
            window.location.href = "/dashboard.html";
        } else {
            alert("Registration Success! Please check your email for a confirmation link.");
            window.location.href = "/login.html";
        }
    } catch (err) {
        alert("Registration Failed: " + err.message);
        btn.disabled = false;
        btn.textContent = "Register";
    }
}

// Global Auth Guard (Run on protected pages)
async function authGuard() {
    const session = await getSession();
    if (!session) {
        window.location.href = "/login.html";
    }
}
