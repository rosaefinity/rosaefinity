// =============================================
// RosaeFinity Web Speech Engine
// Wraps browser/Electron SpeechSynthesis API
// behind the provider-neutral TTSEngine interface.
// Language-agnostic — exposes ALL system voices.
// =============================================

import type { TTSEngine, TTSVoiceInfo, TTSLanguage, TTSSynthesizeOptions } from '../../../types/tts';

export class WebSpeechEngine implements TTSEngine {
  readonly name = 'webspeech';

  private available = false;

  constructor() {
    this.available = typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  isAvailable(): boolean {
    return this.available;
  }

  /** Discover all system voices — fully language-agnostic */
  getVoices(): TTSVoiceInfo[] {
    if (!this.available) return [];

    const systemVoices = window.speechSynthesis.getVoices();
    return systemVoices.map(v => this.normalizeVoice(v));
  }

  /** Derive available languages dynamically from the voice catalog */
  getLanguages(): TTSLanguage[] {
    const voices = this.getVoices();
    const langMap = new Map<string, { code: string; name: string; voiceCount: number }>();

    for (const voice of voices) {
      const existing = langMap.get(voice.language);
      if (existing) {
        existing.voiceCount++;
      } else {
        langMap.set(voice.language, {
          code: voice.language,
          name: this.formatLanguageName(voice.language),
          voiceCount: 1,
        });
      }
    }

    return Array.from(langMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }

  /**
   * Synthesize speech using the browser SpeechSynthesis API.
   * Returns a Promise that resolves when speech playback completes.
   * For WebSpeechEngine, audio is played directly by the OS — no ArrayBuffer is returned.
   */
  synthesize(
    text: string,
    voiceId: string,
    options: TTSSynthesizeOptions,
  ): Promise<void> {
    if (!this.available) {
      return Promise.reject(new Error('Web Speech API not available'));
    }

    return new Promise<void>((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = this.clampRate(options.rate);
      utterance.pitch = this.clampPitch(options.pitch);
      utterance.volume = this.clampVolume(options.volume);
      utterance.lang = options.lang;

      // Resolve voice by ID (opaque string — matches system voice name)
      if (voiceId) {
        const allVoices = window.speechSynthesis.getVoices();
        const matched = allVoices.find(v => v.name === voiceId);
        if (matched) {
          utterance.voice = matched;
        }
      }

      utterance.onstart = () => {
        console.log('[TTS-DEBUG] WebSpeechEngine utterance onstart');
      };

      utterance.onend = () => {
        console.log('[TTS-DEBUG] WebSpeechEngine utterance onend');
        resolve();
      };

      utterance.onerror = (event) => {
        console.log('[TTS-DEBUG] WebSpeechEngine utterance onerror:', event.error);
        if (event.error === 'interrupted' || event.error === 'cancelled') {
          resolve();
        } else {
          reject(new Error(`SpeechSynthesis error: ${event.error}`));
        }
      };

      try {
        window.speechSynthesis.speak(utterance);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /** Stop all speech */
  stop(): void {
    if (this.available) {
      window.speechSynthesis.cancel();
    }
  }

  /**
   * Wait for voices to be loaded.
   * Some browsers/Electron load voices asynchronously via the 'voiceschanged' event.
   */
  waitForVoices(timeoutMs = 1000): Promise<void> {
    if (!this.available) return Promise.resolve();

    // Already loaded
    if (window.speechSynthesis.getVoices().length > 0) {
      return Promise.resolve();
    }

    return new Promise<void>((resolve) => {
      const handler = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        resolve();
      };
      window.speechSynthesis.addEventListener('voiceschanged', handler);

      // Fallback timeout
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
        resolve();
      }, timeoutMs);
    });
  }

  // ── Private helpers ──

  /** Convert a system SpeechSynthesisVoice to the provider-neutral TTSVoiceInfo */
  private normalizeVoice(v: SpeechSynthesisVoice): TTSVoiceInfo {
    const lang = v.lang || 'und';
    const langGroup = lang.split('-')[0].toLowerCase();

    return {
      id: v.name,
      name: v.name,
      language: lang,
      languageGroup: langGroup,
      gender: this.guessGender(v.name),
      provider: this.name,
      metadata: {
        localService: v.localService,
        default: v.default,
        voiceURI: v.voiceURI,
      },
    };
  }

  /** Best-effort gender guess from voice name — no provider-specific hardcoding */
  private guessGender(name: string): 'male' | 'female' | 'neutral' {
    const lower = name.toLowerCase();
    if (lower.includes('female') || lower.includes(' woman') || lower.includes(' ivona ') || lower.includes(' zira')) {
      return 'female';
    }
    if (lower.includes('male') || lower.includes(' man') || lower.includes(' david') || lower.includes(' mark')) {
      return 'male';
    }
    return 'neutral';
  }

  /** Format a BCP 47 code into a display-friendly language name */
  private formatLanguageName(code: string): string {
    // Use Intl.DisplayNames if available (modern browsers/Electron)
    if (typeof Intl !== 'undefined' && Intl.DisplayNames) {
      try {
        const displayNames = new Intl.DisplayNames([code], { type: 'language' });
        const langGroup = code.split('-')[0];
        const baseName = displayNames.of(langGroup);
        if (baseName) {
          // Append region if present
          const region = code.split('-')[1];
          if (region) {
            try {
              const regionNames = new Intl.DisplayNames([code], { type: 'region' });
              const regionName = regionNames.of(region);
              if (regionName) {
                return `${baseName} (${regionName})`;
              }
            } catch {
              // Region lookup failed — use base name
            }
          }
          return baseName;
        }
      } catch {
        // DisplayNames not supported for this locale
      }
    }

    // Fallback: return the raw BCP 47 code
    return code;
  }

  private clampRate(rate: number): number {
    const valid = typeof rate === 'number' && isFinite(rate) ? rate : 1.0;
    return Math.max(0.1, Math.min(10, valid));
  }

  private clampPitch(pitch: number): number {
    const valid = typeof pitch === 'number' && isFinite(pitch) ? pitch : 1.0;
    return Math.max(0, Math.min(2, valid));
  }

  private clampVolume(volume: number): number {
    const valid = typeof volume === 'number' && isFinite(volume) ? volume : 0.8;
    return Math.max(0, Math.min(1, valid));
  }
}
