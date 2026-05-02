import os
from datetime import timedelta

# Handle Vercel's read-only filesystem
if os.environ.get('VERCEL'):
    BASE_DIR = '/tmp'
else:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    # Use a fixed key if not in env to prevent session invalidation on restart
    SECRET_KEY = os.environ.get('SECRET_KEY', 'grieevio-persistent-premium-key-2026')
    
    # Database configuration: Prefer Postgres (Supabase/Vercel) over SQLite
    db_url = os.environ.get('DATABASE_URL')
    if db_url and db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)
    
    SQLALCHEMY_DATABASE_URI = db_url or ('sqlite:///' + os.path.join(BASE_DIR, 'grieevio.db'))
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    
    # Session Security
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)

    # Groq AI Integration
    GROQ_API_KEY = os.environ.get('GROQ_API_KEY', '')

    # Supabase Integration
    SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', '')
