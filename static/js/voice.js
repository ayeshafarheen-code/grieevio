/* ═══════════════════════════════════════════════════════════════════════════
   GRIEEVIO – Voice Input Module (Web Speech API)
   ═══════════════════════════════════════════════════════════════════════════ */

class VoiceInput {
    constructor(options = {}) {
        this.targetInput = options.targetInput || null;
        this.statusElement = options.statusElement || null;
        this.onResult = options.onResult || null;
        this.onEnd = options.onEnd || null;
        this.language = options.language || 'en-US';
        this.recognition = null;
        this.isRecording = false;
        this.transcript = '';

        this.init();
    }

    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.warn('Speech Recognition not supported in this browser.');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = this.language;

        this.recognition.onresult = (event) => {
            let interim = '';
            let final = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const t = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += t + ' ';
                } else {
                    interim += t;
                }
            }

            if (final) {
                this.transcript += final;
            }

            const display = this.transcript + interim;

            if (this.targetInput) {
                this.targetInput.value = display;
            }

            if (this.onResult) {
                this.onResult(display, !!final);
            }

            if (this.statusElement) {
                this.statusElement.textContent = interim ? '🔊 Listening...' : '🎤 Speak now...';
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (this.statusElement) {
                this.statusElement.textContent = `❌ Error: ${event.error}`;
            }
            this.stop();
        };

        this.recognition.onend = () => {
            if (this.isRecording) {
                // Auto restart if still recording
                try { this.recognition.start(); } catch (e) { /* ignore */ }
            } else {
                if (this.statusElement) {
                    this.statusElement.textContent = '✅ Recording stopped';
                }
                if (this.onEnd) {
                    this.onEnd(this.transcript.trim());
                }
            }
        };
    }

    setLanguage(langCode) {
        const langMap = {
            'en': 'en-US', 'hi': 'hi-IN', 'ta': 'ta-IN', 'te': 'te-IN',
            'kn': 'kn-IN', 'ml': 'ml-IN', 'mr': 'mr-IN', 'bn': 'bn-IN',
            'gu': 'gu-IN', 'pa': 'pa-IN', 'ur': 'ur-IN', 'or': 'or-IN',
            'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE', 'ar': 'ar-SA',
            'zh': 'zh-CN', 'ja': 'ja-JP', 'ko': 'ko-KR', 'pt': 'pt-BR'
        };
        this.language = langMap[langCode] || langCode;
        if (this.recognition) {
            this.recognition.lang = this.language;
        }
    }

    start() {
        if (!this.recognition) {
            if (this.statusElement) {
                this.statusElement.textContent = '⚠️ Speech recognition not supported';
            }
            return false;
        }

        this.transcript = '';
        this.isRecording = true;

        try {
            this.recognition.start();
        } catch (e) {
            // Already started
        }

        if (this.statusElement) {
            this.statusElement.textContent = '🎤 Speak now...';
        }
        return true;
    }

    stop() {
        this.isRecording = false;
        if (this.recognition) {
            try { this.recognition.stop(); } catch (e) { /* ignore */ }
        }
    }

    toggle() {
        if (this.isRecording) {
            this.stop();
        } else {
            this.start();
        }
        return this.isRecording;
    }

    isSupported() {
        return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
}

// Export for use in other scripts
window.VoiceInput = VoiceInput;
