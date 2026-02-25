import os
import speech_recognition as sr
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Local imports
from config import Config
from models import db, User, Complaint
from ai_engine import classify_complaint, detect_language, translate_text, get_category_suggestions

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
    return User.query.get(int(user_id))


# Create tables and directories on startup
with app.app_context():
    db.create_all()
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])


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

    if not title or not description:
        return jsonify({'error': 'Title and description are required'}), 400

    # AI Processing
    lang_code, lang_name = detect_language(description)
    translated = translate_text(description, target='en') if lang_code != 'en' else description
    category, confidence, _ = classify_complaint(translated)

    complaint = Complaint(
        user_id=current_user.id,
        title=title,
        description=description,
        original_language=lang_code,
        translated_text=translated if lang_code != 'en' else None,
        category=category,
        location=location,
        status='Submitted',
        priority='Medium'
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

    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(filepath) as source:
            audio_data = recognizer.record(source)
            # Using Google Web Speech API (basic, no key required for small use)
            text = recognizer.recognize_google(audio_data)
            return jsonify({'text': text})
    except sr.UnknownValueError:
        return jsonify({'error': 'Could not understand audio'}), 422
    except sr.RequestError as e:
        return jsonify({'error': f'Speech service error: {e}'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(filepath):
            os.remove(filepath)


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
        'resolution_rate': round((resolved / total) * 100, 1) if total > 0 else 0
    })


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == '__main__':
    app.run(debug=True, port=5000)
