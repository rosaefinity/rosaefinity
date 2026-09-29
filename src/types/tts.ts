// =============================================
// RosaeFinity TTS Types
// =============================================

/**
 * Comment filter modes for TTS Chat
 */
export type TTSFilterMode = 'any' | 'dot' | 'slash' | 'command';

// ── TTS Engine Abstraction ──

/**
 * Provider-neutral language descriptor.
 * The engine is the source of truth for available languages.
 */
export interface TTSLanguage {
  /** BCP 47 code (e.g., 'id-ID', 'en-US') */
  code: string;
  /** Display name (e.g., 'Indonesian (Indonesia)') */
  name: string;
  /** Number of voices available for this language */
  voiceCount: number;
}

/**
 * Provider-neutral voice descriptor.
 * The engine is the source of truth for available voices.
 */
export interface TTSVoiceInfo {
  /** Provider-specific opaque ID (e.g., 'Microsoft David', 'Google: id-ID-Wavenet-C') */
  id: string;
  /** Display name */
  name: string;
  /** BCP 47 language tag (e.g., 'id-ID', 'en-US') */
  language: string;
  /** Language prefix for grouping (e.g., 'id', 'en') */
  languageGroup: string;
  /** Voice gender if known */
  gender?: 'male' | 'female' | 'neutral';
  /** Engine/provider name (e.g., 'webspeech', 'google') */
  provider: string;
  /** Optional preview audio URL */
  previewUrl?: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Options for speech synthesis
 */
export interface TTSSynthesizeOptions {
  /** Speech rate (0.1 - 10) */
  rate: number;
  /** Speech pitch (0 - 2) */
  pitch: number;
  /** Volume (0 - 1) */
  volume: number;
  /** BCP 47 language tag */
  lang: string;
  /** Optional speaker ID for multi-speaker Piper models */
  speakerId?: number;
}

/**
 * Abstract TTS engine interface.
 * All provider-specific logic is encapsulated behind this interface.
 * The application layer must not contain language-specific or provider-specific code.
 */
export interface TTSEngine {
  /** Engine identifier (e.g., 'webspeech', 'google-cloud') */
  readonly name: string;

  /**
   * Discover all available voices from this engine.
   * Returns the engine's complete voice catalog — no filtering or hardcoding.
   */
  getVoices(): TTSVoiceInfo[];

  /**
   * Discover all available languages from this engine.
   * Derived dynamically from the engine's voice catalog.
   */
  getLanguages(): TTSLanguage[];

  /**
   * Synthesize speech from text.
   * For local engines: plays audio directly via OS speech synthesis.
   * For cloud engines (future): fetches audio and plays via Audio element.
   * Resolves when speech playback completes.
   */
  synthesize(
    text: string,
    voiceId: string,
    options: TTSSynthesizeOptions,
  ): Promise<void>;

  /** Stop any currently playing speech */
  stop(): void;

  /** Check if the engine is available on this platform */
  isAvailable(): boolean;
}

// ── Legacy types (backward compatibility) ──

/**
 * TTS Settings stored in StreamProfile
 */
export interface TTSSettings {
  /** Master enable toggle */
  enabled: boolean;

  /** BCP 47 language tag (e.g., 'id-ID', 'en-US') */
  language: string;

  /** Voice name/ID (engine-specific) or empty for auto */
  voice: string;

  /** If true, randomly select from compatible voices per utterance */
  randomVoice: boolean;

  /** Speech rate (0.1 - 10, default 1.0) */
  defaultSpeed: number;

  /** Speech pitch (0 - 2, default 1.0) */
  defaultPitch: number;

  /** Volume (0 - 1, default 0.8) */
  volume: number;

  /** Comment filter mode */
  filterMode: TTSFilterMode;

  /** Prefix for 'command' filter mode */
  commandPrefix: string;

  /** Maximum text length per utterance */
  maxTextLength: number;

  /** Minimum interval between utterances in ms */
  minIntervalMs: number;

  /** Maximum queue length */
  maxQueueLength: number;

  /** Active TTS engine ID: 'webspeech' or 'local-piper' */
  engine: string;

  /** Optional speaker ID for multi-speaker Piper models */
  speakerId?: number;
}

/**
 * Default TTS settings
 */
export const DEFAULT_TTS_SETTINGS: TTSSettings = {
  enabled: false,
  language: 'id-ID',
  voice: '',
  engine: 'local-piper',
  randomVoice: false,
  defaultSpeed: 1.0,
  defaultPitch: 1.0,
  volume: 0.8,
  filterMode: 'any',
  commandPrefix: '!',
  maxTextLength: 200,
  minIntervalMs: 500,
  maxQueueLength: 50,
};

/**
 * TTS Queue item
 */
export interface TTSQueueItem {
  id: string;
  text: string;
  timestamp: number;
  eventData?: {
    user: string;
    nickname: string;
    screenId: string;
  };
}

/**
 * TTS Queue state
 */
export interface TTSQueueState {
  queue: TTSQueueItem[];
  isSpeaking: boolean;
  currentItem: TTSQueueItem | null;
}

/**
 * TTS Voice info (legacy — kept for backward compatibility with existing UI components)
 */
export interface TTSVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

/**
 * TTS Service status
 */
export interface TTSServiceStatus {
  available: boolean;
  voicesLoaded: boolean;
  voiceCount: number;
}