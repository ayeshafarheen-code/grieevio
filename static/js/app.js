/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO - PUBLIC ACCESS (NO AUTH)
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = "https://kucuqbijevjtrpigcvss.supabase.co";
const SUPABASE_KEY = "sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9";

// Initialize Supabase
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log("✅ Supabase: Public Mode Active");
} catch (e) {
    console.error("❌ Supabase Init Failed:", e);
}

// All Auth logic is now removed. 
// The app will now operate in "Guest Mode" by default.

function handleLogout() {
    window.location.href = "/";
}

// Mock auth data for UI consistency
const mockUser = {
    id: '00000000-0000-0000-0000-000000000000',
    user_metadata: { username: "Guest User" }
};
