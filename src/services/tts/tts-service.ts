// =============================================
// RosaeFinity TTS Service
// Core TTS Chat functionality
// Uses provider-neutral TTSEngine abstraction.
// =============================================

import type {
  TTSSettings, TTSVoice, TTSVoiceInfo, TTSServiceStatus,
  TTSQueueItem, TTSEngine, TTSSynthesizeOptions,
} from '../../types/tts';
import { DEFAULT_TTS_SETTINGS } from '../../types/tts';
import { shouldReadComment } from './tts-filters';
import { sanitizeForTTS } from './tts-sanitize';
import { TTSQueue } from './tts-queue';
import { useAppStore } from '../../store/app-store';

type TTSServiceCallbacks = {
  onStatusChange?: (status: TTSServiceStatus) => void;
  onVoicesChange?: (voices: TTSVoice[]) => void;
  onQueueChange?: (state: { queue: TTSQueueItem[]; isSpeaking: boolean; currentItem: TTSQueueItem | null }) => void;
};

class TTSService {
  private static instance: TTSService | null = null;
  private settings: TTSSettings = DEFAULT_TTS_SETTINGS;
  private queue: TTSQueue | null = null;
  private callbacks: TTSServiceCallbacks = {};
  private engine: TTSEngine | null = null;
  private voices: TTSVoice[] = [];
  private voicesLoaded = false;
  private initialized = false;

  private constructor() {}

  static getInstance(): TTSService {
    if (!TTSService.instance) {
      TTSService.instance = new TTSService();
    }
    return TTSService.instance;
  }

  /** Set or replace the TTS engine (provider-neutral) */
  setEngine(engine: TTSEngine): void {
    this.engine = engine;
  }

  /** Switch to a different engine by name (only local-piper is supported) */
  async switchEngine(engineName: string): Promise<void> {
    // Normalize any legacy 'webspeech' request to 'local-piper'
    const normalizedEngineName = engineName === 'webspeech' ? 'local-piper' : engineName;

    if (this.engine?.name === normalizedEngineName) return;

    // Save old engine and queue for rollback
    const oldEngine = this.engine;
    const oldQueue = this.queue;

    // Stop current engine
    this.engine?.stop();

    // Destroy queue (it holds a reference to the old engine)
    this.queue?.destroy();
    this.queue = null;
    this.voicesLoaded = false;
    this.voices = [];

    let newEngine: TTSEngine | null = null;

    // Only local-piper is supported
    if (normalizedEngineName === 'local-piper') {
      try {
        const { LocalTTSEngine } = await import('./engines/local-tts-engine');
        const localEngine = new LocalTTSEngine();
        const available = await localEngine.checkAvailability();
        if (available) {
          newEngine = localEngine;
          console.log('[TTS-DEBUG] Switched to LocalTTSEngine');
        } else {
          console.warn('[TTS-DEBUG] LocalTTSEngine not available');
        }
      } catch {
        console.warn('[TTS-DEBUG] LocalTTSEngine import failed');
      }
    }

    // If new engine failed to load, rollback to old engine
    if (!newEngine) {
      this.engine = oldEngine;
      this.queue = oldQueue;
      this.voicesLoaded = false;
      this.voices = [];
      console.warn('[TTS-DEBUG] Engine switch failed, rolled back to previous');
      this.notifyStatusChange();
      return;
    }

    this.engine = newEngine;

    // Reload voices for new engine
    await this.loadVoices();

    // Recreate queue with new engine
    this.queue = new TTSQueue(this.settings, this.engine, {
      onQueueChange: (state) => {
        this.callbacks.onQueueChange?.(state);
      },
    });

    this.notifyStatusChange();
    // Notify UI that voices changed after engine switch
    try { window.dispatchEvent(new CustomEvent('rosae:tts-voices-ready')); } catch { /* not in browser */ }
  }

  /** Get the active TTS engine */
  getEngine(): TTSEngine | null {
    return this.engine;
  }

  /** Get engine-provided voices (provider-neutral) */
  getEngineVoices(): TTSVoiceInfo[] {
    return this.engine?.getVoices() ?? [];
  }

  /** Get engine-provided languages (provider-neutral) */
  getEngineLanguages(): Array<{ code: string; name: string; voiceCount: number }> {
    return this.engine?.getLanguages() ?? [];
  }

  /** Initialize the TTS service */
  async initialize(settings?: Partial<TTSSettings>, callbacks: TTSServiceCallbacks = {}): Promise<void> {
    if (this.initialized) {
      // Update settings if provided
      if (settings) {
        this.updateSettings(settings);
      }
      this.callbacks = callbacks;
      if (this.queue) {
        this.queue.updateSettings(this.settings);
      }
      return;
    }

    console.log('[TTS-DEBUG] initialize() called');
    this.callbacks = callbacks;

    // Apply caller settings BEFORE engine selection so this.settings.engine
    // reflects the profile's engine preference (e.g. 'local-piper').
    if (settings) {
      this.settings = { ...DEFAULT_TTS_SETTINGS, ...settings };
    }

    // Normalize legacy engine preference to local-piper
    this.settings.engine = this.settings.engine === 'webspeech' ? 'local-piper' : this.settings.engine;

    // Lazy-create engine - always use LocalTTSEngine (Piper)
    if (!this.engine) {
      try {
        const { LocalTTSEngine } = await import('./engines/local-tts-engine');
        const localEngine = new LocalTTSEngine();
        const available = await localEngine.checkAvailability();
        if (available) {
          this.engine = localEngine;
          console.log('[TTS-DEBUG] LocalTTSEngine (Piper) selected per settings');
        } else {
          console.warn('[TTS-DEBUG] LocalTTSEngine not available');
        }
      } catch {
        console.warn('[TTS-DEBUG] LocalTTSEngine import failed');
      }
    }

    console.log('[TTS-DEBUG] engine:', this.engine?.name, 'available:', this.engine?.isAvailable());

    if (!this.engine || !this.engine.isAvailable()) {
      console.warn('[TTS-SERVICE] TTS engine not available - TTS disabled');
      this.notifyStatusChange();
      return;
    }

    // Load voices via engine
    await this.loadVoices();
    console.log('[TTS-DEBUG] loadVoices() completed, voicesLoaded:', this.voicesLoaded, 'voiceCount:', this.voices.length);

    // Initialize queue
    this.queue = new TTSQueue(this.settings, this.engine, {
      onQueueChange: (state) => {
        this.callbacks.onQueueChange?.(state);
      },
    });

    // Only mark initialized AFTER voices have been loaded
    this.initialized = true;
    console.log('[TTS-DEBUG] initialized set to true');
    this.notifyStatusChange();
    // Notify UI that voices are ready (fixes race: UI mounts before TTS init completes)
    try { window.dispatchEvent(new CustomEvent('rosae:tts-voices-ready')); } catch { /* not in browser */ }
    console.log('[TTS-SERVICE] Initialized');
  }

  /** Load available voices via engine */
  private async loadVoices(): Promise<void> {
    if (!this.engine || !this.engine.isAvailable()) return;

    // If voices already loaded, no-op
    if (this.voicesLoaded && this.voices.length > 0) {
      console.log('[TTS-DEBUG] loadVoices() voices already loaded:', this.voices.length);
      return;
    }

    // For LocalTTSEngine, async voice discovery
    if (this.engine.name === 'local-piper' && 'loadVoices' in this.engine) {
      await (this.engine as unknown as { loadVoices: () => Promise<unknown[]> }).loadVoices();
    }

    this.refreshVoicesFromEngine();
  }

  /** Refresh internal voice list from engine */
  private refreshVoicesFromEngine(): void {
    if (!this.engine) return;

    const engineVoices = this.engine.getVoices();
    // Map TTSVoiceInfo → legacy TTSVoice for backward compatibility
    this.voices = engineVoices.map(v => ({
      name: v.name,
      lang: v.language,
      localService: typeof v.metadata?.localService === 'boolean'
        ? v.metadata.localService as boolean
        : true,
      default: typeof v.metadata?.default === 'boolean' ? v.metadata.default as boolean : false,
    }));
    this.voicesLoaded = true;
    console.log('[TTS-DEBUG] refreshVoicesFromEngine(): loaded', this.voices.length, 'voices');
    this.callbacks.onVoicesChange?.(this.voices);
    this.notifyStatusChange();
  }

  /** Update settings (e.g., on profile change) */
  updateSettings(settings: Partial<TTSSettings>): void {
    this.settings = { ...this.settings, ...settings };
    // Normalize legacy engine preference: webspeech is no longer supported
    if (this.settings.engine === 'webspeech') {
      this.settings.engine = 'local-piper';
    }
    if (this.queue) {
      this.queue.updateSettings(this.settings);
    }
    console.log('[TTS-SERVICE] Settings updated:', this.settings);
  }

  /** Get current settings */
  getSettings(): TTSSettings {
    return { ...this.settings };
  }

  /** Get available voices (legacy TTSVoice for backward compatibility) */
  getVoices(): TTSVoice[] {
    return [...this.voices];
  }

  /** Get voices filtered by language */
  getVoicesForLanguage(language: string): TTSVoice[] {
    const langPrefix = language.split('-')[0].toLowerCase();
    return this.voices.filter(v => v.lang.toLowerCase().startsWith(langPrefix));
  }

  /** Resolve voice ID for current settings (provider-neutral) */
  resolveVoiceId(): string | null {
    if (!this.engine) return null;

    const engineVoices = this.engine.getVoices();
    console.log('[VOICE-DEBUG] resolveVoiceId: requested:', this.settings.voice, '| available:', engineVoices.map(v => v.id));

    // If random voice enabled, pick from compatible voices
    if (this.settings.randomVoice) {
      const compatible = engineVoices.filter(v =>
        v.language.toLowerCase().startsWith(this.settings.language.split('-')[0].toLowerCase()),
      );
      if (compatible.length > 0) {
        return compatible[Math.floor(Math.random() * compatible.length)].id;
      }
      // Fallback to all voices
      if (engineVoices.length > 0) {
        return engineVoices[Math.floor(Math.random() * engineVoices.length)].id;
      }
      return null;
    }

    // Specific voice selected (by name/ID — backward compatible with existing settings.voice)
    if (this.settings.voice) {
      const found = engineVoices.find(v => v.id === this.settings.voice || v.name === this.settings.voice);
      console.log('[VOICE-DEBUG] exact match:', !!found, '| id match:', engineVoices.findIndex(v => v.id === this.settings.voice), '| name match:', engineVoices.findIndex(v => v.name === this.settings.voice));
      if (found) return found.id;

      // For Piper: selected voice not installed — do NOT silently fall back to another voice.
      // Return null so the caller can report the voice as unavailable.
      if (this.engine.name === 'local-piper') {
        console.warn('[VOICE-DEBUG] Piper voice not installed:', this.settings.voice);
        return null;
      }
    }

    // Auto: find best match for language
    const langPrefix = this.settings.language.split('-')[0].toLowerCase();
    const compatible = engineVoices.filter(v =>
      v.language.toLowerCase().startsWith(langPrefix),
    );
    if (compatible.length > 0) {
      console.log('[VOICE-DEBUG] FALLBACK to compatible[0]:', compatible[0].id);
      return compatible[0].id;
    }

    // Default voice (metadata.default or first available)
    const defaultVoice = engineVoices.find(v => v.metadata?.default === true);
    if (defaultVoice) return defaultVoice.id;

    // First available
    return engineVoices.length > 0 ? engineVoices[0].id : null;
  }

  /**
   * Resolve legacy SpeechSynthesisVoice for backward compatibility.
   * Used by VoiceTester UI that directly accesses speechSynthesis.
   * @deprecated Use resolveVoiceId() + engine.synthesize() instead
   */
  resolveVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !window.speechSynthesis) return null;

    const voiceId = this.resolveVoiceId();
    if (!voiceId) return null;

    const allVoices = window.speechSynthesis.getVoices();
    return allVoices.find(v => v.name === voiceId) || null;
  }

  /** Check if TTS is available */
  isAvailable(): boolean {
    return (this.engine?.isAvailable() ?? false) && this.initialized;
  }

  /** Get service status */
  getStatus(): TTSServiceStatus {
    return {
      available: this.engine?.isAvailable() ?? false,
      voicesLoaded: this.voicesLoaded,
      voiceCount: this.voices.length,
    };
  }

  /** Handle incoming TikTok comment event */
  async handleCommentEvent(event: {
    type: string;
    screenId?: string;
    user: string;
    nickname: string;
    comment: string;
    timestamp?: number;
  }): Promise<void> {
    // Only process comment events
    if (event.type !== 'comment') return;

    // Lazy-init: deferred initialization in use-init may not have fired yet
    if (!this.initialized) {
      await this.initialize();
    }

    // Check if TTS is enabled (after init so profile settings are applied)
    if (!this.settings.enabled) return;

    // Check if service is available
    if (!this.isAvailable()) return;

    // Check filter
    if (!shouldReadComment(event.comment, this.settings)) return;

    // Sanitize text
    const sanitized = sanitizeForTTS(event.comment, this.settings);
    if (!sanitized) return;

    // Enqueue for speech
    const eventData: TTSQueueItem['eventData'] = {
      user: event.user,
      nickname: event.nickname,
      screenId: event.screenId || 'screen-0',
    };

    this.queue?.enqueue(sanitized, eventData);
  }

  /** Test speech (for Voice Tester) - bypasses queue */
  async testSpeak(text: string, overrideSettings?: Partial<TTSSettings>): Promise<void> {
    console.log('[TTS-DEBUG] testSpeak() called, text length:', text.length);
    console.log('[TTS-DEBUG] initialized:', this.initialized, 'voicesLoaded:', this.voicesLoaded, 'voiceCount:', this.voices.length);

    // Lazy-init: deferred initialization in use-init may not have fired yet
    if (!this.initialized) {
      console.log('[TTS-DEBUG] testSpeak() not initialized, calling initialize() now...');
      await this.initialize();
      console.log('[TTS-DEBUG] testSpeak() initialize() complete, initialized:', this.initialized, 'voicesLoaded:', this.voicesLoaded, 'voiceCount:', this.voices.length);
    }

    if (!this.isAvailable()) {
      console.log('[TTS-DEBUG] testSpeak() TTS not available, aborting');
      throw new Error('TTS not available');
    }

    if (!this.engine) {
      console.log('[TTS-DEBUG] testSpeak() no engine, aborting');
      throw new Error('TTS engine not available');
    }

    // Ensure voices are loaded
    if (!this.voicesLoaded) {
      console.log('[TTS-DEBUG] testSpeak() voices not loaded, loading now...');
      await this.loadVoices();
      console.log('[TTS-DEBUG] testSpeak() loadVoices() complete, voiceCount:', this.voices.length);
    }

    const sanitized = sanitizeForTTS(text, this.settings);
    if (!sanitized) {
      console.log('[TTS-DEBUG] testSpeak() sanitization returned null, aborting');
      throw new Error('Invalid text');
    }

    // Use caller-provided settings (from UI local state) if available,
    // otherwise fall back to persisted profile settings.
    if (overrideSettings) {
      this.updateSettings({ ...this.settings, ...overrideSettings });
    } else {
      const freshSettings = getCurrentProfileTTSSettings();
      this.updateSettings(freshSettings);
    }

    // Force a fresh voice catalog scan — clear BOTH the TTSService stale guard
    // AND the engine's internal cachedVoices so IPC discovery is re-triggered
    if (this.engine && 'loadVoices' in this.engine) {
      this.voicesLoaded = false;
      if ('cachedVoices' in this.engine) {
        (this.engine as unknown as { cachedVoices: TTSVoiceInfo[] | null }).cachedVoices = null;
      }
      await this.loadVoices();
    }

    const voiceId = this.resolveVoiceId();
    console.log('[TTS-DEBUG] resolveVoiceId() result:', voiceId ?? 'null');

    // Piper: if a specific voice was requested but not installed, fail clearly
    if (!voiceId && this.settings.voice && this.engine.name === 'local-piper') {
      throw new Error(`Suara yang dipilih tidak tersedia: ${this.settings.voice}`);
    }

    const options: TTSSynthesizeOptions = {
      rate: this.settings.defaultSpeed,
      pitch: this.settings.defaultPitch,
      volume: this.settings.volume,
      lang: this.settings.language || 'id-ID',
      speakerId: this.settings.speakerId,
    };

    console.log('[TTS-DEBUG] engine.synthesize() calling');
    await this.engine.synthesize(sanitized, voiceId || '', options);
    console.log('[TTS-DEBUG] engine.synthesize() completed');
  }

  /** Stop current speech and clear queue */
  stop(): void {
    this.queue?.stop();
  }

  /** Clear queue without stopping current speech */
  clearQueue(): void {
    this.queue?.clear();
  }

  /** Get queue state */
  getQueueState() {
    return this.queue?.getState() || { queue: [], isSpeaking: false, currentItem: null };
  }

  /** Check if currently speaking */
  isSpeaking(): boolean {
    return this.queue?.isCurrentlySpeaking() || false;
  }

  /** Notify status change */
  private notifyStatusChange(): void {
    this.callbacks.onStatusChange?.(this.getStatus());
  }

  /** Reset for logout/account switch */
  reset(): void {
    this.queue?.stop();  // Stop engine before destroying queue
    this.queue?.destroy();
    this.queue = null;
    this.initialized = false;
    this.voicesLoaded = false;
    this.voices = [];
    this.settings = DEFAULT_TTS_SETTINGS;
    console.log('[TTS-SERVICE] Reset');
  }
}

/** Get TTS service singleton */
export function getTTSService(): TTSService {
  return TTSService.getInstance();
}

/** Initialize TTS service (convenience function) */
export async function initializeTTS(settings?: Partial<TTSSettings>, callbacks: TTSServiceCallbacks = {}): Promise<void> {
  const service = getTTSService();
  await service.initialize(settings, callbacks);
}

/** Handle comment event (convenience function) */
export function handleTTSCommentEvent(event: Parameters<TTSService['handleCommentEvent']>[0]): void {
  const service = getTTSService();
  service.handleCommentEvent(event);
}

/** Test speak (convenience function) */
export async function testTTSSpeak(text: string, overrideSettings?: Partial<TTSSettings>): Promise<void> {
  const service = getTTSService();
  return service.testSpeak(text, overrideSettings);
}

/** Stop TTS */
export function stopTTS(): void {
  const service = getTTSService();
  service.stop();
}

/** Get TTS settings from current profile */
export function getCurrentProfileTTSSettings(): TTSSettings {
  const state = useAppStore.getState();
  const currentProfile = state.streamProfiles.find(p => p.id === state.currentProfileId);
  const settings = currentProfile?.ttsSettings
    ? { ...DEFAULT_TTS_SETTINGS, ...currentProfile.ttsSettings }
    : DEFAULT_TTS_SETTINGS;
  // Normalize legacy engine preference: webspeech is no longer supported
  if (settings.engine === 'webspeech') {
    settings.engine = 'local-piper';
  }
  return settings;
}

/** Apply current profile TTS settings to service */
export function applyCurrentProfileTTSSettings(): void {
  const settings = getCurrentProfileTTSSettings();
  const service = getTTSService();
  service.updateSettings(settings);
}