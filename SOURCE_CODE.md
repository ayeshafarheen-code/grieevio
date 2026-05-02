# GRIEEVIO Source Code Documentation

## 1. app.py
`python
import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, session  # type: ignore
from flask_login import LoginManager, login_user, logout_user, login_required, current_user  # type: ignore
from flask_cors import CORS  # type: ignore
from werkzeug.utils import secure_filename  # type: ignore

# Local imports
from config import Config  # type: ignore
from models import db, User, Complaint  # type: ignore
from ai_engine import (
    classify_complaint, detect_language, translate_text, 
    get_category_suggestions, verify_visual_resolution, get_hotspot_predictions
)  # type: ignore

# ─── App Setup ────────────────────────────────────────────────────────────────
app = Flask(__name__)
app.config.from_object(Config)
CORS(app)
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login_page'


@login_manager.user_loader
def load_user(user_id):
    try:
        return User.query.get(int(user_id))
    except (ValueError, TypeError, Exception):
        return None


def seed_demo_data():
    """Ensure the admin user exists, but do not seed dummy data."""
    # Seed Admin
    if not User.query.filter_by(role='admin').first():
        admin = User(
            username='admin',
            email='admin@grieevio.com',
            role='admin',
            language_pref='en'
        )
        admin.set_password('admin123')
        db.session.add(admin)
        db.session.commit()
        print("✓ Default admin user seeded.")


# Create tables and directories on startup
with app.app_context():
    try:
        db.create_all()
        if not os.path.exists(app.config['UPLOAD_FOLDER']):
            os.makedirs(app.config['UPLOAD_FOLDER'])
        
        # Auto-seed for Vercel demo robustness
        seed_demo_data()
        
        print("Database and upload folders initialized.")
    except Exception as e:
        print(f"Startup warning: {e}")


@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'database': str(db.engine.url.drivername),
        'storage': 'local-tmp' if os.environ.get('VERCEL') else 'local-dev'
    })


# ═══════════════════════════════════════════════════════════════════════════════
# PAGE ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/login')
def login_page():
    return render_template('login.html')


@app.route('/register')
def register_page():
    return render_template('register.html')


@app.route('/dashboard')
@login_required
def dashboard_page():
    return render_template('dashboard.html')


@app.route('/new-complaint')
@login_required
def new_complaint_page():
    return render_template('new_complaint.html')


@app.route('/track')
@login_required
def track_page():
    return render_template('track.html')


@app.route('/profile')
@login_required
def profile_page():
    return render_template('profile.html')


@app.route('/secret')
def secret_page():
    return render_template('iloveyou.html')


@app.route('/admin')
@login_required
def admin_page():
    if current_user.role != 'admin':
        return redirect(url_for('dashboard_page'))
    return render_template('admin.html')


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH API
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/register', methods=['POST'])
def api_register():
    data = request.get_json()
    username = data.get('username', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')
    phone = data.get('phone', '').strip()
    language = data.get('language_pref', 'en')

    if not username or not email or not password:
        return jsonify({'error': 'Username, email, and password are required'}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already exists'}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email already registered'}), 409

    user = User(username=username, email=email, phone=phone, language_pref=language)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    login_user(user)

    return jsonify({'message': 'Registration successful', 'user': user.to_dict()}), 201


@app.route('/api/login', methods=['POST'])
def api_login():
    data = request.get_json()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify({'error': 'Invalid email or password'}), 401

    login_user(user, remember=True)
    return jsonify({'message': 'Login successful', 'user': user.to_dict()})


@app.route('/api/logout', methods=['POST'])
@login_required
def api_logout():
    logout_user()
    return jsonify({'message': 'Logged out successfully'})


@app.route('/api/me')
@login_required
def api_me():
    return jsonify({'user': current_user.to_dict()})


@app.route('/api/profile', methods=['PUT'])
@login_required
def api_update_profile():
    data = request.get_json()
    user = current_user

    if 'username' in data:
        new_username = data['username'].strip()
        if new_username and new_username != user.username:
            existing = User.query.filter_by(username=new_username).first()
            if existing:
                return jsonify({'error': 'Username already taken'}), 409
            user.username = new_username

    if 'phone' in data:
        user.phone = data['phone'].strip()

    if 'language_pref' in data:
        user.language_pref = data['language_pref']

    if 'new_password' in data and data['new_password']:
        current_password = data.get('current_password', '')
        if not user.check_password(current_password):
            return jsonify({'error': 'Current password is incorrect'}), 400
        if len(data['new_password']) < 6:
            return jsonify({'error': 'New password must be at least 6 characters'}), 400
        user.set_password(data['new_password'])

    db.session.commit()
    return jsonify({'message': 'Profile updated successfully', 'user': user.to_dict()})


# ═══════════════════════════════════════════════════════════════════════════════
# COMPLAINT API
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/complaints', methods=['GET'])
@login_required
def get_complaints():
    complaints = Complaint.query.filter_by(user_id=current_user.id)\
        .order_by(Complaint.created_at.desc()).all()
    return jsonify({'complaints': [c.to_dict() for c in complaints]})


@app.route('/api/complaints', methods=['POST'])
@login_required
def create_complaint():
    data = request.get_json()
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    location = data.get('location', '').strip()
    image_data = data.get('image', None)  # Base64 string
    latitude = data.get('latitude', None)
    longitude = data.get('longitude', None)

    if not title or not description:
        return jsonify({'error': 'Title and description are required'}), 400

    # AI Processing
    lang_code, lang_name = detect_language(description)
    translated = translate_text(description, target='en') if lang_code != 'en' else description
    category, confidence, _ = classify_complaint(translated)

    is_urgent = data.get('is_urgent', False)
    # Emergency One-Tap Logic
    if is_urgent or title.lower().startswith('[emergency]'):
        priority = 'Critical'
        is_urgent = True
    else:
        priority = 'High' if confidence > 80 else 'Medium'

    # SLA Assignment (Example: 24h for Critical, 48h for High, 7d for others)
    sla_hours = 24 if priority == 'Critical' else (48 if priority == 'High' else 168)
    sla_deadline = datetime.utcnow() + timedelta(hours=sla_hours)

    # Handle image if provided
    image_path = None
    if image_data and ',' in image_data:
        try:
            import base64
            import uuid
            header, encoded = image_data.split(',', 1)
            ext = header.split('/')[1].split(';')[0]
            filename = f"complaint_{uuid.uuid4().hex}.{ext}"
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            with open(filepath, "wb") as f:
                f.write(base64.b64decode(encoded))
            image_path = f"/uploads/{filename}"
        except Exception as e:
            print(f"Error saving image: {e}")

    complaint = Complaint(
        user_id=current_user.id,
        title=title,
        description=description,
        original_language=lang_code,
        translated_text=translated if lang_code != 'en' else None,
        category=category,
        location=location,
        status='Submitted',
        priority=priority,
        is_urgent=is_urgent,
        latitude=latitude,
        longitude=longitude,
        image_path=image_path,
        sla_deadline=sla_deadline
    )
    db.session.add(complaint)
    db.session.commit()

    return jsonify({
        'message': 'Complaint submitted successfully',
        'complaint': complaint.to_dict(),
        'ai_info': {
            'detected_language': lang_name,
            'category': category,
            'confidence': confidence
        }
    }), 201


@app.route('/api/complaints/<int:complaint_id>', methods=['GET'])
@login_required
def get_complaint(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    return jsonify({'complaint': complaint.to_dict()})


@app.route('/api/complaints/<int:complaint_id>', methods=['DELETE'])
@login_required
def delete_complaint(complaint_id):
    complaint = Complaint.query.get_or_404(complaint_id)
    if complaint.user_id != current_user.id and current_user.role != 'admin':
        return jsonify({'error': 'Unauthorized'}), 403
    db.session.delete(complaint)
    db.session.commit()
    return jsonify({'message': 'Complaint deleted'})


@app.route('/api/complaints/<int:complaint_id>/verify', methods=['POST'])
@login_required
def verify_complaint(complaint_id):
    """
    Field worker uploads 'After' photo. 
    AI verifies resolution and awards points to the reporting citizen.
    """
    complaint = Complaint.query.get_or_404(complaint_id)
    data = request.get_json()
    after_image_data = data.get('after_image', None)

    if not after_image_data:
        return jsonify({'error': 'After photo is required for verification'}), 400

    # Save After Image
    try:
        import base64
        import uuid
        header, encoded = after_image_data.split(',', 1)
        ext = header.split('/')[1].split(';')[0]
        filename = f"after_{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        
        with open(filepath, "wb") as f:
            f.write(base64.b64decode(encoded))
        complaint.after_image_path = f"/uploads/{filename}"
    except Exception as e:
        return jsonify({'error': f'Error saving image: {e}'}), 500

    # AI Verification
    if complaint.image_path:
        is_valid, score = verify_visual_resolution(complaint.image_path, complaint.after_image_path)
        complaint.verification_score = score
    else:
        # If no before photo, we just mark as verified manually
        is_valid, score = True, 100.0
        complaint.verification_score = 100.0

    if is_valid:
        complaint.status = 'Resolved'
        # Award Points to Citizen
        author = complaint.author
        if author:
            author.points += 50
            if author.points > 1000: author.badge = 'Diamond'
            elif author.points > 500: author.badge = 'Gold'
            elif author.points > 200: author.badge = 'Silver'
            elif author.points > 50: author.badge = 'Bronze'
        
        db.session.commit()
        return jsonify({
            'message': 'Resolution verified and points awarded!',
            'score': score,
            'points': 50,
            'badge': author.badge if author else 'N/A'
        })
    else:
        db.session.commit()
        return jsonify({
            'error': 'Visual verification failed. Location or issue mismatch.',
            'score': score
        }), 422


# ═══════════════════════════════════════════════════════════════════════════════
# AI API
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/classify', methods=['POST'])
def api_classify():
    data = request.get_json()
    text = data.get('text', '')
    category, confidence, scores = classify_complaint(text)
    suggestions = get_category_suggestions(text)
    return jsonify({
        'category': category,
        'confidence': confidence,
        'suggestions': suggestions
    })


@app.route('/api/detect-language', methods=['POST'])
def api_detect_language():
    data = request.get_json()
    text = data.get('text', '')
    lang_code, lang_name = detect_language(text)
    return jsonify({'language_code': lang_code, 'language_name': lang_name})


@app.route('/api/translate', methods=['POST'])
def api_translate():
    data = request.get_json()
    text = data.get('text', '')
    target = data.get('target', 'en')
    translated = translate_text(text, target=target)
    return jsonify({'original': text, 'translated': translated, 'target': target})


@app.route('/api/voice-to-text', methods=['POST'])
def api_voice_to_text():
    """
    Server-side speech recognition.
    Expects an audio file in the request.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = secure_filename(file.filename)
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    try:
        import speech_recognition as sr  # type: ignore
        recognizer = sr.Recognizer()
        with sr.AudioFile(filepath) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return jsonify({'text': text})
    except ImportError:
        return jsonify({'error': 'Speech recognition library not available on server'}), 501
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    except sr.UnknownValueError:
        return jsonify({'error': 'Could not understand audio'}), 422
    except sr.RequestError as e:
        return jsonify({'error': f'Speech service error: {e}'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


@app.route('/api/governance/escalate', methods=['POST'])
def trigger_escalation():
    """
    Autonomous Escalation Logic:
    Checks for complaints past SLA and escalates them.
    """
    now = datetime.utcnow()
    overdue = Complaint.query.filter(
        Complaint.status != 'Resolved',
        Complaint.status != 'Rejected',
        Complaint.sla_deadline < now,
        Complaint.is_escalated == False
    ).all()

    count = 0
    for c in overdue:
        c.is_escalated = True
        c.escalation_level += 1
        c.priority = 'Critical'
        # In a real app, send email/SMS to commissioner here
        count += 1
    
    db.session.commit()
    return jsonify({'message': f'Escalated {count} complaints to higher authority.'})


@app.route('/api/gamification/leaderboard', methods=['GET'])
def get_leaderboard():
    """Returns top citizens by points."""
    top_users = User.query.filter_by(role='citizen')\
        .order_by(User.points.desc()).limit(10).all()
    return jsonify({'leaderboard': [u.to_dict() for u in top_users]})


@app.route('/api/predictive-map', methods=['GET'])
def get_predictive_data():
    """Returns hotspots based on AI analysis."""
    complaints = Complaint.query.all()
    data = [c.to_dict() for c in complaints]
    hotspots = get_hotspot_predictions(data)
    return jsonify({'hotspots': hotspots})


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN API
# ═══════════════════════════════════════════════════════════════════════════════

@app.route('/api/admin/complaints', methods=['GET'])
@login_required
def admin_get_complaints():
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    status_filter = request.args.get('status', '')
    category_filter = request.args.get('category', '')
    query = Complaint.query

    if status_filter:
        query = query.filter_by(status=status_filter)
    if category_filter:
        query = query.filter_by(category=category_filter)

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify({'complaints': [c.to_dict() for c in complaints]})


@app.route('/api/admin/complaints/<int:complaint_id>', methods=['PUT'])
@login_required
def admin_update_complaint(complaint_id):
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    complaint = Complaint.query.get_or_404(complaint_id)
    data = request.get_json()

    if 'status' in data:
        complaint.status = data['status']
    if 'priority' in data:
        complaint.priority = data['priority']
    if 'admin_notes' in data:
        complaint.admin_notes = data['admin_notes']
    if 'assigned_to' in data:
        complaint.assigned_to = data['assigned_to']
    if 'category' in data:
        complaint.category = data['category']

    complaint.updated_at = datetime.utcnow()
    db.session.commit()

    return jsonify({'message': 'Complaint updated', 'complaint': complaint.to_dict()})


@app.route('/api/admin/stats', methods=['GET'])
@login_required
def admin_stats():
    if current_user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    total = Complaint.query.count()
    submitted = Complaint.query.filter_by(status='Submitted').count()
    in_progress = Complaint.query.filter_by(status='In Progress').count()
    resolved = Complaint.query.filter_by(status='Resolved').count()
    rejected = Complaint.query.filter_by(status='Rejected').count()

    # Category breakdown
    categories = db.session.query(
        Complaint.category, db.func.count(Complaint.id)
    ).group_by(Complaint.category).all()

    # Priority breakdown
    priorities = db.session.query(
        Complaint.priority, db.func.count(Complaint.id)
    ).group_by(Complaint.priority).all()

    # Recent complaints (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent = Complaint.query.filter(Complaint.created_at >= week_ago).count()

    return jsonify({
        'total': total,
        'submitted': submitted,
        'in_progress': in_progress,
        'resolved': resolved,
        'rejected': rejected,
        'recent_week': recent,
        'categories': {cat: count for cat, count in categories},
        'priorities': {pri: count for pri, count in priorities},
        'resolution_rate': round((resolved / total) * 100, 1) if total > 0 else 0,
        'points_distributed': db.session.query(db.func.sum(User.points)).scalar() or 0,
        'escalated_count': Complaint.query.filter_by(is_escalated=True).count()
    })


@app.route('/api/public/stats', methods=['GET'])
def public_stats():
    """Public stats for the transparency dashboard."""
    total = Complaint.query.count()
    resolved = Complaint.query.filter_by(status='Resolved').count()
    return jsonify({
        'total': total,
        'resolved': resolved,
        'resolution_rate': round((resolved / total) * 100, 1) if total > 0 else 0,
        'active_now': total - resolved
    })


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True, port=5000)

`

## 2. models.py
`python
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default='citizen')  # citizen / admin
    language_pref = db.Column(db.String(10), default='en')
    phone = db.Column(db.String(20), nullable=True)
    points = db.Column(db.Integer, default=0)
    badge = db.Column(db.String(50), default='Citizen')  # Citizen, Bronze, Silver, Gold, Diamond
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    complaints = db.relationship('Complaint', backref='author', lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role,
            'language_pref': self.language_pref,
            'phone': self.phone,
            'points': self.points,
            'badge': self.badge,
            'created_at': self.created_at.isoformat()
        }


class Complaint(db.Model):
    __tablename__ = 'complaints'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    original_language = db.Column(db.String(10), default='en')
    translated_text = db.Column(db.Text, nullable=True)
    category = db.Column(db.String(50), default='Other')
    status = db.Column(db.String(30), default='Submitted')  # Submitted / In Progress / Resolved / Rejected
    priority = db.Column(db.String(20), default='Medium')  # Low / Medium / High / Critical
    location = db.Column(db.String(300), nullable=True)
    image_path = db.Column(db.String(300), nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)
    assigned_to = db.Column(db.String(100), nullable=True)
    is_urgent = db.Column(db.Boolean, default=False)
    after_image_path = db.Column(db.String(300), nullable=True)
    verification_score = db.Column(db.Float, default=0.0)
    is_escalated = db.Column(db.Boolean, default=False)
    escalation_level = db.Column(db.Integer, default=0)
    sla_deadline = db.Column(db.DateTime, nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'username': self.author.username if self.author else 'Unknown',
            'title': self.title,
            'description': self.description,
            'original_language': self.original_language,
            'translated_text': self.translated_text,
            'category': self.category,
            'status': self.status,
            'priority': self.priority,
            'is_urgent': self.is_urgent,
            'after_image_path': self.after_image_path,
            'verification_score': self.verification_score,
            'is_escalated': self.is_escalated,
            'escalation_level': self.escalation_level,
            'sla_deadline': self.sla_deadline.isoformat() if self.sla_deadline else None,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'location': self.location,
            'image_path': self.image_path,
            'admin_notes': self.admin_notes,
            'assigned_to': self.assigned_to,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

`

## 3. ai_engine.py
`python
"""
GRIEEVIO AI Engine
- Complaint classification using keyword-based weighted scoring
- Language detection using langdetect
- Translation support (with fallback)
"""

import re
import os
import cv2
import numpy as np
from datetime import datetime


# ─── Category Keywords with Weights ──────────────────────────────────────────
CATEGORY_KEYWORDS = {
    'Roads': {
        'road': 3, 'pothole': 5, 'crack': 2, 'pavement': 3, 'highway': 3,
        'street': 2, 'asphalt': 3, 'bridge': 2, 'footpath': 2, 'sidewalk': 2,
        'damaged road': 5, 'broken road': 5, 'bumpy': 2, 'uneven': 2,
        'traffic': 1, 'accident': 2, 'construction': 2, 'paving': 3,
        'tar': 2, 'gravel': 2, 'lane': 1, 'intersection': 2
    },
    'Water': {
        'water': 3, 'pipe': 3, 'leakage': 5, 'leak': 4, 'supply': 2,
        'tap': 3, 'drinking': 2, 'contaminated': 4, 'dirty water': 5,
        'no water': 5, 'water supply': 5, 'pipeline': 4, 'plumbing': 3,
        'flood': 3, 'overflow': 3, 'tank': 2, 'bore': 2, 'well': 2,
        'sewage': 3, 'waterlogging': 4
    },
    'Electricity': {
        'electricity': 4, 'power': 3, 'outage': 5, 'blackout': 5,
        'transformer': 4, 'wire': 3, 'cable': 3, 'voltage': 4, 'current': 2,
        'electric': 3, 'light': 2, 'streetlight': 5, 'street light': 5,
        'power cut': 5, 'no power': 5, 'spark': 3, 'short circuit': 5,
        'meter': 2, 'pole': 3, 'generator': 2, 'load shedding': 4
    },
    'Garbage': {
        'garbage': 5, 'waste': 4, 'trash': 5, 'rubbish': 4, 'dump': 4,
        'dustbin': 3, 'bin': 2, 'litter': 3, 'dirty': 2, 'filth': 3,
        'stink': 3, 'smell': 2, 'sanitation': 3, 'cleanup': 3,
        'sweeping': 2, 'collection': 2, 'garbage collection': 5,
        'waste management': 5, 'debris': 3, 'pile': 2, 'overflow': 3
    },
    'Drainage': {
        'drain': 5, 'drainage': 5, 'sewer': 5, 'blocked': 3, 'clog': 4,
        'blockage': 5, 'gutter': 4, 'manhole': 4, 'overflow': 3,
        'stagnant': 3, 'water logging': 4, 'flooding': 3, 'canal': 2,
        'storm drain': 5, 'nala': 3, 'open drain': 5, 'mosquito': 2,
        'breeding': 2, 'stench': 3
    },
    'Street Lighting': {
        'streetlight': 5, 'street light': 5, 'lamp': 3, 'bulb': 3,
        'dark': 2, 'no light': 5, 'broken light': 5, 'dim': 2,
        'flickering': 3, 'pole light': 4, 'night': 1, 'illumination': 3,
        'led': 2, 'lighting': 3
    }
}

LANGUAGE_NAMES = {
    'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu',
    'kn': 'Kannada', 'ml': 'Malayalam', 'mr': 'Marathi', 'bn': 'Bengali',
    'gu': 'Gujarati', 'pa': 'Punjabi', 'ur': 'Urdu', 'or': 'Odia',
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'ar': 'Arabic',
    'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pt': 'Portuguese'
}


def classify_complaint(text):
    """
    Classify complaint text into a category using keyword-based weighted scoring.
    Returns (category, confidence_score, all_scores).
    """
    if not text:
        return 'Other', 0.0, {}

    text_lower = text.lower()
    scores: dict[str, int] = {}

    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword, weight in keywords.items():
            # Use word boundary matching for single words, substring for phrases
            if ' ' in keyword:
                if keyword in text_lower:
                    score += int(weight)
            else:
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, text_lower)
                score += len(matches) * int(weight)
        scores[category] = score

    if not scores or max(list(scores.values())) == 0:
        return 'Other', 0.0, scores

    best_category = max(scores, key=lambda k: scores[k])
    max_score = int(scores[best_category])
    total = sum(scores.values())
    # Manual rounding to 1 decimal place to satisfy linter type checking
    confidence = float(int((max_score / total) * 1000 + 0.5) / 10.0) if total > 0 else 0.0

    return best_category, confidence, scores


def detect_language(text):
    """Detect the language of the given text."""
    if not text or len(text.strip()) < 3:
        return 'en', 'English'

    try:
        from langdetect import detect
        lang_code = detect(text)
        lang_name = LANGUAGE_NAMES.get(lang_code, lang_code)
        return lang_code, lang_name
    except Exception:
        return 'en', 'English'


def translate_text(text, source='auto', target='en'):
    """
    Translate text to the target language.
    Falls back to returning original text if translation fails.
    """
    if not text:
        return text

    # If already in target language, skip
    try:
        detected_lang, _ = detect_language(text)
        if detected_lang == target:
            return text
    except Exception:
        pass

    try:
        from googletrans import Translator
        translator = Translator()
        result = translator.translate(text, src=source, dest=target)
        return result.text
    except Exception:
        # Fallback: return original text
        return text


def get_category_suggestions(text):
    """Get top 3 category suggestions with scores."""
    _, _, scores = classify_complaint(text)
    items = list(scores.items())
    # Explicitly sort to help linter
    items.sort(key=lambda x: x[1], reverse=True)
    
    # Avoid any slicing to satisfy strict linter indexing
    top_3 = []
    count = 0
    for item in items:
        if count < 3:
            top_3.append(item)
            count += 1
        else:
            break
            
    return [{'category': str(cat), 'score': int(score)} for cat, score in top_3 if int(score) > 0]




def verify_visual_resolution(before_path, after_path):
    """
    AI Proof of Work: Compare 'Before' and 'After' photos.
    Uses ORB feature matching to ensure it's the same location.
    Returns (success_boolean, confidence_score).
    """
    if not before_path or not after_path:
        return False, 0.0
    
    # Strip leading slash for local path joining
    b_path = before_path.lstrip('/')
    a_path = after_path.lstrip('/')
    
    if not os.path.exists(b_path) or not os.path.exists(a_path):
        return False, 0.0

    try:
        img1 = cv2.imread(b_path, cv2.IMREAD_GRAYSCALE)
        img2 = cv2.imread(a_path, cv2.IMREAD_GRAYSCALE)

        if img1 is None or img2 is None:
            return False, 0.0

        # Initialize ORB detector
        orb = cv2.ORB_create(nfeatures=500)
        kp1, des1 = orb.detectAndCompute(img1, None)
        kp2, des2 = orb.detectAndCompute(img2, None)

        if des1 is None or des2 is None:
            return False, 0.0

        # Brute-Force Matcher
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        
        # Sort matches by distance
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Heuristic: If we have enough good matches, it's the same place
        # In a real app, you'd also check if the issue (e.g. pothole) is gone
        # For this demo, we check location consistency
        good_matches = [m for m in matches if m.distance < 50]
        
        score = len(good_matches) / 50.0  # Normalize to 0.0 - 1.0
        confidence = min(score * 100, 100.0)
        
        return confidence > 30, round(confidence, 2)
    except Exception as e:
        print(f"AI Verification Error: {e}")
        return True, 50.0  # Fallback for demo


def get_hotspot_predictions(complaints_data):
    """
    Predictive Analytics: Identify areas likely to have issues.
    Expects a list of dicts with 'lat', 'lng', 'category', 'created_at'.
    """
    hotspots = []
    if not complaints_data:
        return hotspots

    # Group by category and location (rounded to 2 decimal places ~1.1km)
    clusters = {}
    for c in complaints_data:
        if not c.get('latitude') or not c.get('longitude'):
            continue
            
        key = (
            round(float(c['latitude']), 2),
            round(float(c['longitude']), 2),
            c['category']
        )
        clusters[key] = clusters.get(key, 0) + 1

    # Filter clusters with high density
    for (lat, lng, cat), count in clusters.items():
        if count >= 3:  # Threshold for a hotspot
            hotspots.append({
                'lat': lat,
                'lng': lng,
                'category': cat,
                'intensity': min(count / 10.0, 1.0),
                'risk_level': 'High' if count > 5 else 'Medium',
                'prediction': f"Likely recurring {cat} issue detected."
            })
            
    return hotspots

`

## 4. config.py
`python
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

    # Supabase Integration
    SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://kucuqbijevjtrpigcvss.supabase.co')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY', 'sb_publishable_31sQhl2dQv8nryFyOYEvEA_8sDVJdA9')

`

