# ⚡ GRIEEVIO – AI-Powered Civic Governance Platform

GRIEEVIO is a cutting-edge, **solely serverless** civic platform designed to bridge the gap between citizens and local authorities using AI-driven automation, real-time tracking, and visual proof-of-work.

## 🚀 Quick Deploy to Vercel

1.  **Push this repository** to your GitHub account.
2.  **Import the project** in Vercel.
3.  **Deploy!** Vercel will automatically detect the configuration in `vercel.json` and host it as a high-performance static SPA.

## 🛠️ Tech Stack
- **Architecture**: Static Single Page Application (SPA)
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JS
- **Backend (Serverless)**: Supabase Edge Functions (TypeScript/Deno)
- **AI Engine**: Groq (Llama 3.3-70b + Llama 3.2 Vision)
- **Database**: PostgreSQL (via Supabase)
- **Real-time**: Supabase Realtime (WebSockets)
- **Hosting**: Vercel (Static)

## 📁 Key Files & Directories
- `static/js/app.js`: Central configuration and auth logic.
- `static/js/complaints.js`: Logic for submitting and viewing complaints.
- `static/js/admin.js`: Real-time admin dashboard logic.
- `supabase/functions/`: Serverless AI logic (Edge Functions).
- `supabase_schema.sql`: Complete database setup script.
- `vercel.json`: Routing and hosting configuration.

## ⚖️ Features
- **Smart Classification**: Auto-routes complaints based on text description via AI Edge Functions.
- **Visual Proof-of-Work**: AI compares 'Before' and 'After' photos to verify resolutions.
- **Real-time Synchronization**: Admin dashboard updates instantly when new complaints arrive.
- **Gamification**: Citizen badges and points for active reporting.
- **Multilingual Support**: Real-time AI translation for diverse communities.

---
© 2026 GRIEEVIO Team.