"""
Seed script: creates an admin user and sample complaints for demo.
Run: python seed_data.py
"""
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from app import app
from models import db, User, Complaint


def seed():
    with app.app_context():
        db.create_all()

        # Create admin user
        if not User.query.filter_by(email='admin@grieevio.com').first():
            admin = User(
                username='admin',
                email='admin@grieevio.com',
                role='admin',
                language_pref='en'
            )
            admin.set_password('admin123')
            db.session.add(admin)
            print('✓ Admin user created (admin@grieevio.com / admin123)')

        # Create demo citizen
        if not User.query.filter_by(email='citizen@demo.com').first():
            citizen = User(
                username='demo_citizen',
                email='citizen@demo.com',
                role='citizen',
                language_pref='en',
                phone='+91-9876543210'
            )
            citizen.set_password('citizen123')
            db.session.add(citizen)
            db.session.flush()

            # Sample complaints
            samples = [
                {
                    'title': 'Large pothole on Main Street',
                    'description': 'There is a dangerous pothole on Main Street near the bus stop. Multiple vehicles have been damaged. Urgent repair needed.',
                    'category': 'Roads',
                    'location': 'Main Street, Sector 15',
                    'priority': 'High',
                    'status': 'In Progress'
                },
                {
                    'title': 'No water supply since 3 days',
                    'description': 'Our area has not received water supply for the past 3 days. The water pipeline seems to be broken near the junction.',
                    'category': 'Water',
                    'location': 'Block C, Green Valley Colony',
                    'priority': 'Critical',
                    'status': 'Submitted'
                },
                {
                    'title': 'Garbage not collected for a week',
                    'description': 'Garbage has not been collected from our neighborhood for over a week. The waste is overflowing from bins and creating a health hazard.',
                    'category': 'Garbage',
                    'location': 'Lane 4, Rose Garden Area',
                    'priority': 'Medium',
                    'status': 'Resolved'
                },
                {
                    'title': 'Street lights not working',
                    'description': 'Multiple street lights on Park Road are not functioning. The area becomes very dark at night, creating safety concerns.',
                    'category': 'Street Lighting',
                    'location': 'Park Road, Near City Mall',
                    'priority': 'Medium',
                    'status': 'Submitted'
                },
                {
                    'title': 'Blocked drainage causing flooding',
                    'description': 'The drainage system near the market is completely blocked. During rain, the entire area gets flooded with dirty water.',
                    'category': 'Drainage',
                    'location': 'Central Market, Old Town',
                    'priority': 'High',
                    'status': 'In Progress'
                },
            ]

            for s in samples:
                c = Complaint(user_id=citizen.id, **s)
                db.session.add(c)

            print(f'✓ Demo citizen created (citizen@demo.com / citizen123)')
            print(f'✓ {len(samples)} sample complaints added')

        db.session.commit()
        print('\n✅ Database seeded successfully!')


if __name__ == '__main__':
    seed()
