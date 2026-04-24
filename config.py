import os

# Handle Vercel's read-only filesystem
if os.environ.get('VERCEL'):
    BASE_DIR = '/tmp'
else:
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))


class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'grieevio-secret-key-2026')
    
    # Database Configuration - supporting all possible Vercel Postgres variable names
    database_url = (
        os.environ.get('POSTGRES_URL') or 
        os.environ.get('POSTGRES_URL_NON_POOLING') or
        os.environ.get('DATABASE_URL')
    )
    
    if database_url:
        # Fix protocol for SQLAlchemy
        if database_url.startswith("postgres://"):
            database_url = database_url.replace("postgres://", "postgresql://", 1)
        
        # Ensure SSL mode for Neon
        if "sslmode" not in database_url:
            separator = "&" if "?" in database_url else "?"
            database_url += f"{separator}sslmode=require"
            
        SQLALCHEMY_DATABASE_URI = database_url
    else:
        # Fallback to local SQLite
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(BASE_DIR, 'grieevio.db')
        
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024
