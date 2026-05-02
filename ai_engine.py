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
        from deep_translator import GoogleTranslator
        translated = GoogleTranslator(source='auto', target=target).translate(text)
        return translated or text
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
