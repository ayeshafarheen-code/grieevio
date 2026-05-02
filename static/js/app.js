/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO - BULLETPROOF SUPABASE AUTH
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co";
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

let supabase;

try {
    // Standard initialization for Supabase v2 CDN
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase Initialized Successfully");
} catch (e) {
    alert("CRITICAL: Failed to initialize Supabase library. Please check your internet connection.");
    console.error(e);
}

// ─── LOGIN HANDLER ────────────────────────────────────────────────────────

async function handleLogin(e) {
    e.preventDefault();
    console.log("Login attempt started...");
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = e.target.querySelector('button');

    if (!supabase) {
        alert("Error: Supabase is not initialized. Check console.");
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "⏳ Authenticating...";

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) throw error;

        console.log("Login successful!", data);
        const role = data.user.user_metadata?.role || 'citizen';
        window.location.href = role === 'admin' ? '/admin.html' : '/dashboard.html';

    } catch (err) {
        console.error("Login failed:", err);
        alert("Login Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Login";
    }
}

// ─── REGISTER HANDLER ─────────────────────────────────────────────────────

async function handleRegister(e) {
    e.preventDefault();
    console.log("Registration attempt started...");

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const username = document.getElementById('username').value.trim();
    const btn = e.target.querySelector('button');

    if (!supabase) {
        alert("Error: Supabase is not initialized. Check console.");
        return;
    }

    try {
        btn.disabled = true;
        btn.textContent = "⏳ Creating Account...";

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    role: 'citizen'
                }
            }
        });

        if (error) throw error;

        if (data.session) {
            console.log("Registered and Logged In:", data);
            window.location.href = "/dashboard.html";
        } else {
            console.log("Registered, awaiting confirmation");
            alert("Success! Now check your email for the confirmation link to activate your account.");
            window.location.href = "/login.html";
        }

    } catch (err) {
        console.error("Registration failed:", err);
        alert("Registration Error: " + err.message);
        btn.disabled = false;
        btn.textContent = "Register";
    }
}

// ─── LOGOUT HANDLER ───────────────────────────────────────────────────────

async function handleLogout() {
    if (supabase) {
        await supabase.auth.signOut();
    }
    window.location.href = "/login.html";
}
