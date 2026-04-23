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
