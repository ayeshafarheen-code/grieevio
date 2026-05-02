# ⚡ GRIEEVIO – AI-Powered Civic Governance Platform

GRIEEVIO is a cutting-edge civic platform designed to bridge the gap between citizens and local authorities using AI-driven automation, real-time tracking, and visual proof-of-work.

## 🚀 Quick Deploy to Vercel

1. **Push this repository** to your GitHub account.
2. **Import the project** in Vercel.
3. **Configure Environment Variables** in Vercel Settings:

| Key | Description |
|---|---|
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |
| `GROQ_API_KEY` | Your API key from [Groq Console](https://console.groq.com) |
| `SUPABASE_URL` | Your Supabase Project URL |
| `SUPABASE_KEY` | Your Supabase Service Role or Anon key |
| `SECRET_KEY` | A random string for session security |

4. **Deploy!** Vercel will automatically detect the configuration in `vercel.json`.

## 🛠️ Tech Stack
- **Backend**: Python (Flask)
- **Frontend**: HTML5, CSS3 (Glassmorphism), Vanilla JS
- **AI Engine**: Groq (Llama 3.3-70b + Llama 3.2 Vision)
- **Database**: PostgreSQL (via Supabase)
- **Real-time**: Supabase Realtime (WebSockets)
- **Deployment**: Vercel Serverless Functions

## 📁 Key Files
- `app.py`: Main Flask application logic
- `ai_engine.py`: AI-driven classification and verification
- `models.py`: Database schemas
- `api/index.py`: Vercel serverless entry point
- `vercel.json`: Deployment configuration

## ⚖️ Features
- **Smart Classification**: Auto-routes complaints based on text description.
- **Visual Proof-of-Work**: AI compares 'Before' and 'After' photos to verify resolutions.
- **Autonomous Escalation**: Automatic priority boosting for SLA breaches.
- **Gamification**: Citizen badges and points for active reporting.
- **Multilingual Support**: Real-time translation for diverse communities.

---
© 2026 GRIEEVIO Team.