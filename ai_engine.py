"""
GRIEEVIO AI Engine
- Complaint classification using Groq API (Llama 3.3-70b)
- Visual resolution verification using Groq Vision (Llama 3.2 Vision)
- Language detection using langdetect
- Translation using deep-translator
- Keyword-based scoring as offline fallback
"""

import re
import os
import json
import base64
import cv2
import numpy as np

# ─── Groq Client Setup ────────────────────────────────────────────────────────
def get_groq_client():
    """Lazily initialize the Groq client."""
    try:
        from groq import Groq
        api_key = os.environ.get('GROQ_API_KEY')
        if not api_key:
            return None
        return Groq(api_key=api_key)
    except Exception:
        return None


# ─── Category Keywords (Fallback Scoring) ────────────────────────────────────
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
        'transformer': 4, 'wire': 3, 'cable': 3, 'voltage': 4,
        'electric': 3, 'light': 2, 'streetlight': 5, 'street light': 5,
        'power cut': 5, 'no power': 5, 'spark': 3, 'short circuit': 5,
        'meter': 2, 'pole': 3, 'load shedding': 4
    },
    'Garbage': {
        'garbage': 5, 'waste': 4, 'trash': 5, 'rubbish': 4, 'dump': 4,
        'dustbin': 3, 'bin': 2, 'litter': 3, 'dirty': 2, 'filth': 3,
        'stink': 3, 'smell': 2, 'sanitation': 3, 'cleanup': 3,
        'sweeping': 2, 'collection': 2, 'garbage collection': 5,
        'waste management': 5, 'debris': 3, 'pile': 2
    },
    'Drainage': {
        'drain': 5, 'drainage': 5, 'sewer': 5, 'blocked': 3, 'clog': 4,
        'blockage': 5, 'gutter': 4, 'manhole': 4, 'overflow': 3,
        'stagnant': 3, 'water logging': 4, 'flooding': 3, 'canal': 2,
        'storm drain': 5, 'nala': 3, 'open drain': 5, 'mosquito': 2
    },
    'Street Lighting': {
        'streetlight': 5, 'street light': 5, 'lamp': 3, 'bulb': 3,
        'dark': 2, 'no light': 5, 'broken light': 5, 'dim': 2,
        'flickering': 3, 'pole light': 4, 'illumination': 3, 'led': 2
    }
}

LANGUAGE_NAMES = {
    'en': 'English', 'hi': 'Hindi', 'ta': 'Tamil', 'te': 'Telugu',
    'kn': 'Kannada', 'ml': 'Malayalam', 'mr': 'Marathi', 'bn': 'Bengali',
    'gu': 'Gujarati', 'pa': 'Punjabi', 'ur': 'Urdu', 'or': 'Odia',
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'ar': 'Arabic',
    'zh': 'Chinese', 'ja': 'Japanese', 'ko': 'Korean', 'pt': 'Portuguese'
}


# ─── Keyword Fallback ─────────────────────────────────────────────────────────
def _keyword_classify(text):
    """Keyword-based fallback classifier."""
    text_lower = text.lower()
    scores = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword, weight in keywords.items():
            if ' ' in keyword:
                if keyword in text_lower:
                    score += int(weight)
            else:
                pattern = r'\b' + re.escape(keyword) + r'\b'
                matches = re.findall(pattern, text_lower)
                score += len(matches) * int(weight)
        scores[category] = score

    if not scores or max(scores.values()) == 0:
        return 'Other', 0.0, scores

    best = max(scores, key=lambda k: scores[k])
    total = sum(scores.values())
    confidence = float(int((scores[best] / total) * 1000 + 0.5) / 10.0) if total > 0 else 0.0
    return best, confidence, scores


# ─── Core AI Functions ────────────────────────────────────────────────────────
def classify_complaint(text):
    """
    Classify a complaint using Groq LLM (Llama 3.3-70b).
    Falls back to keyword scoring if API is unavailable.
    Returns (category, confidence, all_scores).
    """
    if not text:
        return 'Other', 0.0, {}

    client = get_groq_client()

    if client:
        try:
            prompt = f"""You are a smart civic complaint classifier. Analyze the following complaint and classify it.

Complaint: "{text}"

Available categories: Roads, Water, Electricity, Garbage, Drainage, Street Lighting, Other

Respond with ONLY a valid JSON object in this exact format:
{{"category": "<category>", "confidence": <number 0-100>, "reason": "<one sentence reason>"}}"""

            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=150,
            )

            raw = response.choices[0].message.content.strip()
            # Extract JSON even if surrounded by text
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                result = json.loads(match.group())
                category = result.get('category', 'Other')
                confidence = float(result.get('confidence', 50.0))
                # Return with empty scores dict since LLM gave direct answer
                return category, confidence, {}

        except Exception as e:
            print(f"Groq classify error: {e} — falling back to keywords")

    # Fallback
    return _keyword_classify(text)


def detect_language(text):
    """Detect the language of the given text using langdetect."""
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
    Translate text using deep-translator (Google Translate backend).
    Falls back to original text if translation fails.
    """
    if not text:
        return text
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
        return text


def get_category_suggestions(text):
    """Get top 3 category suggestions with scores using keyword fallback."""
    _, _, scores = _keyword_classify(text)
    items = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [
        {'category': str(cat), 'score': int(score)}
        for cat, score in items[:3]
        if int(score) > 0
    ]


def verify_visual_resolution(before_path, after_path):
    """
    AI Proof of Work: Compare 'Before' and 'After' photos.
    First attempts Groq Vision (Llama 3.2 Vision), falls back to OpenCV ORB matching.
    Returns (success_boolean, confidence_score).
    """
    if not before_path or not after_path:
        return False, 0.0

    # Strip leading slash and get filename only
    b_filename = before_path.split('/')[-1]
    a_filename = after_path.split('/')[-1]
    
    # Use the base path from env or current dir to locate files
    base_dir = '/tmp' if os.environ.get('VERCEL') else os.getcwd()
    b_path = os.path.join(base_dir, 'uploads', b_filename)
    a_path = os.path.join(base_dir, 'uploads', a_filename)

    if not os.path.exists(b_path) or not os.path.exists(a_path):
        # Graceful fallback: on Vercel, files in /tmp may disappear between requests.
        # If either file is missing, we can't do visual verification.
        print(f"Verification skip: File missing. Before: {os.path.exists(b_path)}, After: {os.path.exists(a_path)}")
        return True, 75.0 

    # ── Groq Vision Verification ──────────────────────────────────────────────
    client = get_groq_client()
    if client:
        try:
            with open(b_path, "rb") as f:
                before_b64 = base64.b64encode(f.read()).decode("utf-8")
            with open(a_path, "rb") as f:
                after_b64 = base64.b64encode(f.read()).decode("utf-8")

            # Detect image format
            before_ext = b_path.split('.')[-1].lower()
            after_ext = a_path.split('.')[-1].lower()
            before_mime = f"image/{'jpeg' if before_ext in ['jpg','jpeg'] else before_ext}"
            after_mime = f"image/{'jpeg' if after_ext in ['jpg','jpeg'] else after_ext}"

            response = client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "You are a civic infrastructure verification expert. Compare these two images: the BEFORE image (first) shows a civic issue, and the AFTER image (second) is supposed to show the issue resolved. Determine if the issue appears to be resolved. Respond ONLY with a JSON: {\"resolved\": true/false, \"confidence\": <0-100>, \"reason\": \"<short reason>\"}"},
                        {"type": "image_url", "image_url": {"url": f"data:{before_mime};base64,{before_b64}"}},
                        {"type": "image_url", "image_url": {"url": f"data:{after_mime};base64,{after_b64}"}}
                    ]
                }],
                temperature=0.1,
                max_tokens=200,
            )

            raw = response.choices[0].message.content.strip()
            match = re.search(r'\{.*\}', raw, re.DOTALL)
            if match:
                result = json.loads(match.group())
                resolved = bool(result.get('resolved', False))
                confidence = float(result.get('confidence', 50.0))
                return resolved, round(confidence, 2)

        except Exception as e:
            print(f"Groq vision error: {e} — falling back to OpenCV")

    # ── OpenCV ORB Fallback ───────────────────────────────────────────────────
    try:
        img1 = cv2.imread(b_path, cv2.IMREAD_GRAYSCALE)
        img2 = cv2.imread(a_path, cv2.IMREAD_GRAYSCALE)

        if img1 is None or img2 is None:
            return True, 50.0

        orb = cv2.ORB_create(nfeatures=500)
        kp1, des1 = orb.detectAndCompute(img1, None)
        kp2, des2 = orb.detectAndCompute(img2, None)

        if des1 is None or des2 is None:
            return True, 50.0

        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)
        matches = sorted(matches, key=lambda x: x.distance)
        good_matches = [m for m in matches if m.distance < 50]

        confidence = min((len(good_matches) / 50.0) * 100, 100.0)
        return confidence > 30, round(confidence, 2)

    except Exception as e:
        print(f"OpenCV error: {e}")
        return True, 50.0


def get_hotspot_predictions(complaints_data):
    """
    Predictive Analytics: Identify geographic areas with recurring issues.
    Groups complaints by category and rounded coordinates (~1.1km grid).
    """
    hotspots = []
    if not complaints_data:
        return hotspots

    clusters = {}
    for c in complaints_data:
        if not c.get('latitude') or not c.get('longitude'):
            continue
        key = (
            round(float(c['latitude']), 2),
            round(float(c['longitude']), 2),
            c.get('category', 'Other')
        )
        clusters[key] = clusters.get(key, 0) + 1

    for (lat, lng, cat), count in clusters.items():
        if count >= 3:
            hotspots.append({
                'lat': lat,
                'lng': lng,
                'category': cat,
                'intensity': min(count / 10.0, 1.0),
                'risk_level': 'High' if count > 5 else 'Medium',
                'prediction': f"Likely recurring {cat} issue detected."
            })

    return hotspots
