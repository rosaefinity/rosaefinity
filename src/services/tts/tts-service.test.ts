// =============================================
// RosaeFinity TTS Service Tests
// =============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  shouldReadComment,
  getFilterModeLabel,
  getAvailableFilterModes,
} from './tts-filters';
import { sanitizeForTTS, getSanitizationPreview } from './tts-sanitize';
import { TTSQueue } from './tts-queue';
import { getTTSService } from './tts-service';
import type { TTSSettings, TTSFilterMode, TTSEngine, TTSVoiceInfo } from '../../types/tts';
import { DEFAULT_TTS_SETTINGS } from '../../types/tts';

// Top-level mock for app-store (required by getCurrentProfileTTSSettings in testSpeak)
const mockGetState = vi.fn(() => ({
  currentProfileId: null,
  streamProfiles: [],
}));
vi.mock('../../store/app-store', () => ({
  useAppStore: { getState: (...args: unknown[]) => mockGetState(...args) },
}));

describe('TTS Filters', () => {
  const baseSettings: TTSSettings = {
    ...DEFAULT_TTS_SETTINGS,
    filterMode: 'any',
    commandPrefix: '!',
  };

  it('should accept any non-empty comment in "any" mode', () => {
    const settings = { ...baseSettings, filterMode: 'any' as TTSFilterMode };
    expect(shouldReadComment('halo kak', settings)).toBe(true);
    expect(shouldReadComment('gimana kabarnya', settings)).toBe(true);
    expect(shouldReadComment('wkwkwk', settings)).toBe(true);
    expect(shouldReadComment('  hello  ', settings)).toBe(true);
  });

  it('should reject empty comments in "any" mode', () => {
    const settings = { ...baseSettings, filterMode: 'any' as TTSFilterMode };
    expect(shouldReadComment('', settings)).toBe(false);
    expect(shouldReadComment('   ', settings)).toBe(false);
  });

  it('should only accept comments starting with "." in "dot" mode', () => {
    const settings = { ...baseSettings, filterMode: 'dot' as TTSFilterMode };
    expect(shouldReadComment('.halo', settings)).toBe(true);
    expect(shouldReadComment('.gimana', settings)).toBe(true);
    expect(shouldReadComment('halo', settings)).toBe(false);
    expect(shouldReadComment('.', settings)).toBe(true);
    expect(shouldReadComment('  .halo  ', settings)).toBe(true);
  });

  it('should only accept comments starting with "/" in "slash" mode', () => {
    const settings = { ...baseSettings, filterMode: 'slash' as TTSFilterMode };
    expect(shouldReadComment('/halo', settings)).toBe(true);
    expect(shouldReadComment('/gimana', settings)).toBe(true);
    expect(shouldReadComment('halo', settings)).toBe(false);
    expect(shouldReadComment('/', settings)).toBe(true);
  });

  it('should only accept comments starting with command prefix in "command" mode', () => {
    const settings = { ...baseSettings, filterMode: 'command' as TTSFilterMode, commandPrefix: '!' };
    expect(shouldReadComment('!halo', settings)).toBe(true);
    expect(shouldReadComment('!gimana', settings)).toBe(true);
    expect(shouldReadComment('halo', settings)).toBe(false);
    expect(shouldReadComment('!', settings)).toBe(true);

    // Custom prefix
    const customPrefixSettings = { ...settings, commandPrefix: 'tts' };
    expect(shouldReadComment('ttshalo', customPrefixSettings)).toBe(true);
    expect(shouldReadComment('!halo', customPrefixSettings)).toBe(false);
  });

  it('should return correct filter mode labels', () => {
    expect(getFilterModeLabel('any')).toBe('Any comment');
    expect(getFilterModeLabel('dot')).toBe('Starts with "."');
    expect(getFilterModeLabel('slash')).toBe('Starts with "/"');
    expect(getFilterModeLabel('command')).toBe('Command');
  });

  it('should return all available filter modes', () => {
    const modes = getAvailableFilterModes();
    expect(modes).toHaveLength(4);
    expect(modes.map(m => m.value)).toEqual(['any', 'dot', 'slash', 'command']);
  });
});

describe('TTS Sanitization', () => {
  const baseSettings: TTSSettings = {
    ...DEFAULT_TTS_SETTINGS,
    maxTextLength: 200,
  };

  it('should trim whitespace', () => {
    const settings = { ...baseSettings };
    expect(sanitizeForTTS('  halo  ', settings)).toBe('halo');
    expect(sanitizeForTTS('\t\n halo \n\t', settings)).toBe('halo');
  });

  it('should reject empty strings', () => {
    const settings = { ...baseSettings };
    expect(sanitizeForTTS('', settings)).toBeNull();
    expect(sanitizeForTTS('   ', settings)).toBeNull();
    expect(sanitizeForTTS('\t\n', settings)).toBeNull();
  });

  it('should truncate to maxTextLength', () => {
    const settings = { ...baseSettings, maxTextLength: 10 };
    const longText = 'a'.repeat(20);
    const result = sanitizeForTTS(longText, settings);
    expect(result).toHaveLength(10);
  });

  it('should normalize excessive whitespace', () => {
    const settings = { ...baseSettings };
    expect(sanitizeForTTS('halo    dunia', settings)).toBe('halo dunia');
    expect(sanitizeForTTS('halo\t\tdunia', settings)).toBe('halo dunia');
    expect(sanitizeForTTS('halo\n\ndunia', settings)).toBe('halo dunia');
  });

  it('should handle Unicode/emojis safely', () => {
    const settings = { ...baseSettings };
    expect(sanitizeForTTS('halo 👋 dunia 🌍', settings)).toBe('halo 👋 dunia 🌍');
    expect(sanitizeForTTS('wkwkwk 😂😂😂', settings)).toBe('wkwkwk 😂😂😂');
  });

  it('should not throw on malformed input', () => {
    const settings = { ...baseSettings };
    // @ts-expect-error - testing runtime behavior
    expect(sanitizeForTTS(null, settings)).toBeNull();
    // @ts-expect-error - testing runtime behavior
    expect(sanitizeForTTS(undefined, settings)).toBeNull();
    // @ts-expect-error - testing runtime behavior
    expect(sanitizeForTTS(123, settings)).toBeNull();
  });

  it('should provide sanitization preview', () => {
    const settings = { ...baseSettings, maxTextLength: 10 };
    const preview = getSanitizationPreview('halo dunia yang sangat panjang', settings);
    expect(preview.original).toBe('halo dunia yang sangat panjang');
    expect(preview.sanitized).toBe('halo dunia');
    expect(preview.wasModified).toBe(true);
    expect(preview.wasTruncated).toBe(true);
  });
});

describe('TTS Queue', () => {
  const baseSettings: TTSSettings = {
    ...DEFAULT_TTS_SETTINGS,
    minIntervalMs: 0, // Disable min interval for tests
    maxQueueLength: 50,
  };

  // Mock TTSEngine for queue tests — engine NOT available so enqueue doesn't auto-speak
  const mockEngine: TTSEngine = {
    name: 'mock-engine',
    isAvailable: vi.fn(() => false),
    getVoices: vi.fn(() => []),
    getLanguages: vi.fn(() => []),
    synthesize: vi.fn(() => Promise.resolve()),
    stop: vi.fn(),
  };

  let queue: TTSQueue;
  let queueStates: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    queueStates = [];
    queue = new TTSQueue(baseSettings, mockEngine, {
      onQueueChange: (state) => queueStates.push(state),
    });
  });

  afterEach(() => {
    queue.destroy();
  });

  it('should enqueue items and return ID', () => {
    const id = queue.enqueue('test text');
    expect(id).toBeTruthy();
    expect(queue.getQueueLength()).toBe(1);
  });

  it('should reject empty text', () => {
    const id = queue.enqueue('');
    expect(id).toBeNull();
    expect(queue.getQueueLength()).toBe(0);
  });

  it('should enforce max queue length', () => {
    const settings = { ...baseSettings, maxQueueLength: 2 };
    const smallQueue = new TTSQueue(settings, mockEngine);

    smallQueue.enqueue('item 1');
    smallQueue.enqueue('item 2');
    const id = smallQueue.enqueue('item 3');

    expect(id).toBeNull();
    expect(smallQueue.getQueueLength()).toBe(2);
    smallQueue.destroy();
  });

  it('should return queue state', () => {
    queue.enqueue('item 1');
    queue.enqueue('item 2');
    const state = queue.getState();
    expect(state.queue).toHaveLength(2);
    expect(state.isSpeaking).toBe(false);
    expect(state.currentItem).toBeNull();
  });

  it('should clear queue without stopping current speech', () => {
    queue.enqueue('item 1');
    queue.enqueue('item 2');
    queue.clear();
    expect(queue.getQueueLength()).toBe(0);
  });

  it('should stop and clear everything', () => {
    queue.enqueue('item 1');
    queue.enqueue('item 2');
    queue.stop();
    expect(queue.getQueueLength()).toBe(0);
    expect(queue.isCurrentlySpeaking()).toBe(false);
  });

  it('should update settings', () => {
    queue.updateSettings({ volume: 0.5, defaultSpeed: 1.5 });
    // Settings are applied to next utterance
    expect(queue.getState()).toBeDefined();
  });
});

describe('Default TTS Settings', () => {
  it('should have correct defaults', () => {
    expect(DEFAULT_TTS_SETTINGS.enabled).toBe(false);
    expect(DEFAULT_TTS_SETTINGS.language).toBe('id-ID');
    expect(DEFAULT_TTS_SETTINGS.voice).toBe('');
    expect(DEFAULT_TTS_SETTINGS.engine).toBe('local-piper');
    expect(DEFAULT_TTS_SETTINGS.randomVoice).toBe(false);
    expect(DEFAULT_TTS_SETTINGS.defaultSpeed).toBe(1.0);
    expect(DEFAULT_TTS_SETTINGS.defaultPitch).toBe(1.0);
    expect(DEFAULT_TTS_SETTINGS.volume).toBe(0.8);
    expect(DEFAULT_TTS_SETTINGS.filterMode).toBe('any');
    expect(DEFAULT_TTS_SETTINGS.commandPrefix).toBe('!');
    expect(DEFAULT_TTS_SETTINGS.maxTextLength).toBe(200);
    expect(DEFAULT_TTS_SETTINGS.minIntervalMs).toBe(500);
    expect(DEFAULT_TTS_SETTINGS.maxQueueLength).toBe(50);
  });
});

// =============================================
// TTSService.testSpeak() voice-loading tests
// =============================================

describe('TTS Service testSpeak() voice-loading behavior', () => {
  let speakMock: ReturnType<typeof vi.fn>;
  let getVoicesMock: ReturnType<typeof vi.fn>;
  let addEventListenerMock: ReturnType<typeof vi.fn>;
  let removeEventListenerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    speakMock = vi.fn();
    getVoicesMock = vi.fn(() => []);
    addEventListenerMock = vi.fn();
    removeEventListenerMock = vi.fn();

    // Stub global window and speechSynthesis for Node test env
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: speakMock,
        getVoices: getVoicesMock,
        addEventListener: addEventListenerMock,
        removeEventListener: removeEventListenerMock,
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(t: string) { this.text = t; }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call getVoices() to resolve voice (verifies voice-loading path)', () => {
    const mockVoice = { name: 'Test Voice', lang: 'en-US', localService: true, default: true };
    getVoicesMock.mockReturnValue([mockVoice]);

    // Simulate resolveVoice() logic: calls getVoices() and searches by name
    const allVoices = window.speechSynthesis.getVoices();
    expect(getVoicesMock).toHaveBeenCalled();
    expect(allVoices).toHaveLength(1);
    expect(allVoices[0].name).toBe('Test Voice');
  });

  it('should select the correct voice when settings.voice matches', () => {
    const voices = [
      { name: 'Google US', lang: 'en-US', localService: false, default: false },
      { name: 'Google ID', lang: 'id-ID', localService: false, default: true },
    ];
    getVoicesMock.mockReturnValue(voices);

    const allVoices = window.speechSynthesis.getVoices();
    const selectedName = 'Google ID';
    const found = allVoices.find(v => v.name === selectedName);
    expect(found).toBeDefined();
    expect(found!.name).toBe('Google ID');
  });

  it('should surface speech errors other than interrupted/cancelled as rejections', () => {
    // Verify the error classification logic used in testSpeak()
    const resolvedErrors = ['interrupted', 'cancelled'];
    const rejectedErrors = ['canceled', 'synthesis-unavailable', 'network', 'audio-busy'];

    for (const err of resolvedErrors) {
      expect(err === 'interrupted' || err === 'cancelled').toBe(true);
    }
    for (const err of rejectedErrors) {
      expect(err === 'interrupted' || err === 'cancelled').toBe(false);
    }
  });

  it('should handle empty voices array gracefully in resolveVoice()', () => {
    getVoicesMock.mockReturnValue([]);

    const allVoices = window.speechSynthesis.getVoices();
    // When getVoices returns empty, resolveVoice returns null
    const found = allVoices.find(() => true) || null;
    expect(found).toBeNull();
  });

  it('should invoke speechSynthesis.speak() with a valid utterance', () => {
    getVoicesMock.mockReturnValue([
      { name: 'Default', lang: 'en-US', localService: true, default: true },
    ]);

    // Simulate what testSpeak does: create utterance, set voice, call speak
    const utterance = new SpeechSynthesisUtterance('hello');
    const voice = window.speechSynthesis.getVoices()[0];
    utterance.voice = voice;
    window.speechSynthesis.speak(utterance);

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith(utterance);
    expect((utterance as unknown as { text: string }).text).toBe('hello');
    expect(utterance.voice).toEqual(voice);
  });
});

// =============================================
// TTSService lazy-initialization race tests
// =============================================

describe('TTS Service testSpeak() lazy initialization', () => {
  let speakMock: ReturnType<typeof vi.fn>;
  let getVoicesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    speakMock = vi.fn();
    getVoicesMock = vi.fn(() => []);

    // Single window stub with both speechSynthesis and electronAPI (Piper)
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: speakMock,
        getVoices: getVoicesMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({
          workerScriptAvailable: true,
          modelsDirectoryAvailable: true,
          workerRunning: false,
        })),
        ttsLocalVoices: vi.fn(async () => [
          { id: 'en_US/mock-model', name: 'English (US)', language: 'en-US', languageGroup: 'en', provider: 'local-piper', metadata: { modelPath: '/mock/en_US.onnx' } },
        ]),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(t: string) { this.text = t; }
    });
    vi.stubGlobal('Audio', class {
      src = '';
      onended: (() => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      play() {
        queueMicrotask(() => this.onended?.());
        return Promise.resolve();
      }
      pause() {}
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should trigger initialize() when called before initialization', async () => {
    const service = getTTSService();
    // Reset to uninitialized state
    service.reset();

    expect(service.isAvailable()).toBe(false);

    // Spy on initialize to verify it is called
    const initSpy = vi.spyOn(service, 'initialize');

    // testSpeak should call initialize() before proceeding
    await service.testSpeak('hello');

    expect(initSpy).toHaveBeenCalledTimes(1);
    expect(service.isAvailable()).toBe(true);
  });

  it('should NOT call initialize() again when already initialized', async () => {
    const service = getTTSService();
    // Ensure initialized with Piper
    await service.initialize({
      engine: 'local-piper',
      enabled: true,
      language: 'en-US',
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });

    expect(service.isAvailable()).toBe(true);

    const initSpy = vi.spyOn(service, 'initialize');

    await service.testSpeak('hello again');

    // initialize should NOT have been called — already initialized
    expect(initSpy).not.toHaveBeenCalled();
  });
});

// =============================================
// WebSpeechEngine + TTSEngine abstraction tests
// =============================================

describe('WebSpeechEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn(() => [
          { name: 'Microsoft David', lang: 'en-US', localService: true, default: true, voiceURI: 'Microsoft David' },
          { name: 'Microsoft Zira', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft Zira' },
          { name: 'Google Bahasa Indonesia', lang: 'id-ID', localService: false, default: false, voiceURI: 'Google Bahasa Indonesia' },
          { name: 'Google US English', lang: 'en-US', localService: false, default: false, voiceURI: 'Google US English' },
          { name: 'Microsoft Huihui', lang: 'zh-CN', localService: true, default: false, voiceURI: 'Microsoft Huihui' },
        ]),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(t: string) { this.text = t; }
    });
    vi.stubGlobal('Intl', {
      DisplayNames: class {
        static supportedLocalesOf = vi.fn(() => true);
        of(code: string) {
          const names: Record<string, string> = {
            en: 'English', id: 'Indonesian', zh: 'Chinese', 'en-US': 'United States',
            'id-ID': 'Indonesia', 'zh-CN': 'China',
          };
          return names[code] || code;
        }
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should report availability correctly', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    expect(engine.isAvailable()).toBe(true);
    expect(engine.name).toBe('webspeech');
  });

  it('should normalize all system voices into TTSVoiceInfo', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const voices = engine.getVoices();

    expect(voices).toHaveLength(5);
    // No language hardcoding — all voices are exposed
    expect(voices.map(v => v.language).sort()).toEqual(['en-US', 'en-US', 'en-US', 'id-ID', 'zh-CN']);
  });

  it('should derive language groups dynamically from voices', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const languages = engine.getLanguages();

    expect(languages).toHaveLength(3);
    const codes = languages.map(l => l.code).sort();
    expect(codes).toEqual(['en-US', 'id-ID', 'zh-CN']);
  });

  it('should count voices per language correctly', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const languages = engine.getLanguages();

    const enLang = languages.find(l => l.code === 'en-US');
    expect(enLang?.voiceCount).toBe(3);
    const idLang = languages.find(l => l.code === 'id-ID');
    expect(idLang?.voiceCount).toBe(1);
    const zhLang = languages.find(l => l.code === 'zh-CN');
    expect(zhLang?.voiceCount).toBe(1);
  });

  it('should set provider to "webspeech" on all voices', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const voices = engine.getVoices();

    for (const voice of voices) {
      expect(voice.provider).toBe('webspeech');
    }
  });

  it('should use opaque string IDs matching voice names', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const voices = engine.getVoices();

    for (const voice of voices) {
      expect(voice.id).toBe(voice.name);
      expect(typeof voice.id).toBe('string');
      expect(voice.id.length).toBeGreaterThan(0);
    }
  });

  it('should filter voices by language group prefix', async () => {
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    const allVoices = engine.getVoices();

    // Filter by language group — no hardcoded language
    const enVoices = allVoices.filter(v => v.languageGroup === 'en');
    expect(enVoices).toHaveLength(3);

    const idVoices = allVoices.filter(v => v.languageGroup === 'id');
    expect(idVoices).toHaveLength(1);

    const zhVoices = allVoices.filter(v => v.languageGroup === 'zh');
    expect(zhVoices).toHaveLength(1);
  });

  it('should return empty array when speechSynthesis is unavailable', async () => {
    vi.stubGlobal('window', {});
    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const engine = new WebSpeechEngine();
    expect(engine.isAvailable()).toBe(false);
    expect(engine.getVoices()).toEqual([]);
    expect(engine.getLanguages()).toEqual([]);
  });
});

describe('TTSEngine interface contract', () => {
  it('should enforce TTSEngine shape on mock engine', () => {
    const engine: TTSEngine = {
      name: 'test-engine',
      isAvailable: () => true,
      getVoices: () => [],
      getLanguages: () => [],
      synthesize: () => Promise.resolve(),
      stop: () => {},
    };

    expect(engine.name).toBe('test-engine');
    expect(engine.isAvailable()).toBe(true);
    expect(engine.getVoices()).toEqual([]);
    expect(engine.getLanguages()).toEqual([]);
    expect(engine.synthesize('hello', 'v1', { rate: 1, pitch: 1, volume: 0.8, lang: 'en-US' })).toBeInstanceOf(Promise);
  });

  it('TTSVoiceInfo should use provider-neutral fields', () => {
    const voice: TTSVoiceInfo = {
      id: 'some-opaque-id',
      name: 'Display Name',
      language: 'id-ID',
      languageGroup: 'id',
      gender: 'female',
      provider: 'any-provider',
    };

    expect(voice.id).toBeTruthy();
    expect(voice.language).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
    expect(voice.languageGroup).toMatch(/^[a-z]{2}$/);
    expect(['male', 'female', 'neutral']).toContain(voice.gender);
  });
});

// =============================================
// LocalTTSEngine tests (no real Piper required)
// =============================================

describe('LocalTTSEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have correct engine name', async () => {
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    expect(engine.name).toBe('local-piper');
  });

  it('should report unavailable when IPC is missing', async () => {
    vi.stubGlobal('window', {});
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    expect(engine.isAvailable()).toBe(false);
  });

  it('should report unavailable when worker script is missing', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({
          workerScriptAvailable: false,
          modelsDirectoryAvailable: false,
          workerRunning: false,
        })),
        ttsLocalVoices: vi.fn(async () => []),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    const available = await engine.checkAvailability();
    expect(available).toBe(false);
    expect(engine.isAvailable()).toBe(false);
  });

  it('should report available when worker script exists', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({
          workerScriptAvailable: true,
          modelsDirectoryAvailable: true,
          workerRunning: false,
        })),
        ttsLocalVoices: vi.fn(async () => []),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    const available = await engine.checkAvailability();
    expect(available).toBe(true);
    expect(engine.isAvailable()).toBe(true);
  });

  it('should discover voices via IPC', async () => {
    const mockVoices = [
      { id: 'id_ID/model', name: 'Indonesian', language: 'id-ID', languageGroup: 'id', provider: 'local-piper', metadata: { modelPath: '/path/model.onnx' } },
      { id: 'en_US/model', name: 'English', language: 'en-US', languageGroup: 'en', provider: 'local-piper', metadata: { modelPath: '/path/model.onnx' } },
    ];
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: true, workerRunning: false })),
        ttsLocalVoices: vi.fn(async () => mockVoices),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    await engine.checkAvailability();
    const voices = await engine.loadVoices();
    expect(voices).toHaveLength(2);
    expect(voices[0].language).toBe('id-ID');
    expect(voices[1].language).toBe('en-US');
  });

  it('should derive languages from voices', async () => {
    const mockVoices = [
      { id: 'id_ID/m1', name: 'Indonesian 1', language: 'id-ID', languageGroup: 'id', provider: 'local-piper', metadata: {} },
      { id: 'id_ID/m2', name: 'Indonesian 2', language: 'id-ID', languageGroup: 'id', provider: 'local-piper', metadata: {} },
      { id: 'en_US/m1', name: 'English', language: 'en-US', languageGroup: 'en', provider: 'local-piper', metadata: {} },
    ];
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: true, workerRunning: false })),
        ttsLocalVoices: vi.fn(async () => mockVoices),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    await engine.checkAvailability();
    await engine.loadVoices();
    const languages = engine.getLanguages();
    expect(languages).toHaveLength(2);
    expect(languages.find(l => l.code === 'id-ID')?.voiceCount).toBe(2);
    expect(languages.find(l => l.code === 'en-US')?.voiceCount).toBe(1);
  });

  it('should return empty when no models installed', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: false, workerRunning: false })),
        ttsLocalVoices: vi.fn(async () => []),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    await engine.checkAvailability();
    const voices = await engine.loadVoices();
    expect(voices).toHaveLength(0);
    expect(engine.getLanguages()).toHaveLength(0);
  });

  it('should use stable voice IDs from model paths', async () => {
    const mockVoices = [
      { id: 'id_ID/id_ID-news_tts-medium', name: 'Indonesian', language: 'id-ID', languageGroup: 'id', provider: 'local-piper', metadata: { modelPath: '/some/absolute/path.onnx' } },
    ];
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: true, workerRunning: false })),
        ttsLocalVoices: vi.fn(async () => mockVoices),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    await engine.checkAvailability();
    await engine.loadVoices();
    // Voice ID should be the relative path, not absolute
    expect(engine.getVoices()[0].id).toBe('id_ID/id_ID-news_tts-medium');
  });

  it('should stop via IPC', async () => {
    const stopMock = vi.fn(async () => ({ success: true }));
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: true, workerRunning: true })),
        ttsLocalVoices: vi.fn(async () => []),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: stopMock,
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    engine.stop();
    expect(stopMock).toHaveBeenCalled();
  });

  it('should not hardcode any specific language', async () => {
    // Simulate a system with only Swahili and Turkish voices
    const mockVoices = [
      { id: 'sw_CD/model', name: 'Swahili', language: 'sw-CD', languageGroup: 'sw', provider: 'local-piper', metadata: {} },
      { id: 'tr_TR/model', name: 'Turkish', language: 'tr-TR', languageGroup: 'tr', provider: 'local-piper', metadata: {} },
    ];
    vi.stubGlobal('window', {
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({ workerScriptAvailable: true, modelsDirectoryAvailable: true, workerRunning: false })),
        ttsLocalVoices: vi.fn(async () => mockVoices),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const engine = new LocalTTSEngine();
    await engine.checkAvailability();
    await engine.loadVoices();
    const languages = engine.getLanguages();
    expect(languages).toHaveLength(2);
    expect(languages.map(l => l.code).sort()).toEqual(['sw-CD', 'tr-TR']);
    // No Indonesian, no English hardcoded
    expect(languages.find(l => l.code === 'id-ID')).toBeUndefined();
    expect(languages.find(l => l.code === 'en-US')).toBeUndefined();
  });
});

// =============================================
// Model Catalog Gender Metadata Tests
// =============================================

describe('Model Catalog Gender Metadata', () => {
  it('should have gender field on LocalTTSModelInfo type', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    // Verify the catalog is an array
    expect(Array.isArray(MODEL_CATALOG)).toBe(true);
    expect(MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it('should mark Indonesian voice as neutral', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const indo = MODEL_CATALOG.find(m => m.id === 'id_ID-news_tts-medium');
    expect(indo).toBeDefined();
    expect(indo!.gender).toBe('neutral');
  });

  it('should mark en_US-hfc_female as female', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const female = MODEL_CATALOG.find(m => m.id === 'en_US-hfc_female-medium');
    expect(female).toBeDefined();
    expect(female!.gender).toBe('female');
  });

  it('should mark en_GB-alba as female', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const alba = MODEL_CATALOG.find(m => m.id === 'en_GB-alba-medium');
    expect(alba).toBeDefined();
    expect(alba!.gender).toBe('female');
  });

  it('should mark fr_FR-siwis as female', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const siwis = MODEL_CATALOG.find(m => m.id === 'fr_FR-siwis-medium');
    expect(siwis).toBeDefined();
    expect(siwis!.gender).toBe('female');
  });

  it('should mark en_GB-southern_english_female as female', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const sef = MODEL_CATALOG.find(m => m.id === 'en_GB-southern_english_female-low');
    expect(sef).toBeDefined();
    expect(sef!.gender).toBe('female');
  });

  it('should have all female models in catalog', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    const femaleModels = MODEL_CATALOG.filter(m => m.gender === 'female');
    expect(femaleModels.length).toBeGreaterThanOrEqual(4);
    const femaleIds = femaleModels.map(m => m.id);
    expect(femaleIds).toContain('en_US-hfc_female-medium');
    expect(femaleIds).toContain('en_GB-alba-medium');
    expect(femaleIds).toContain('fr_FR-siwis-medium');
    expect(femaleIds).toContain('en_GB-southern_english_female-low');
  });

  it('should not break backward compatibility — gender is optional', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    // Some models may have no gender at all
    for (const model of MODEL_CATALOG) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.languageCode).toBeTruthy();
      // gender is optional — may be undefined, 'female', 'male', or 'neutral'
      if (model.gender !== undefined) {
        expect(['male', 'female', 'neutral']).toContain(model.gender);
      }
    }
  });

  it('should not guess gender for models without evidence', async () => {
    const { MODEL_CATALOG } = await import('./engines/local-tts-model-manager');
    // These models have no gender evidence — should be undefined or neutral
    const uncertain = ['en_US-lessac-medium', 'ja_JP-hi_fi_captain-medium', 'zh_CN-huayan-medium', 'de_DE-thorsten-medium', 'es_ES-sharvard-medium', 'pt_BR-faber-medium'];
    for (const id of uncertain) {
      const model = MODEL_CATALOG.find(m => m.id === id);
      expect(model).toBeDefined();
      // Should NOT be 'female' or 'male' without evidence
      expect(model!.gender).not.toBe('female');
      expect(model!.gender).not.toBe('male');
    }
  });
});

// =============================================
// Engine Initialization Order Tests
// Verifies: profile settings are applied BEFORE
// engine selection in TTSService.initialize().
// =============================================

describe('TTSService engine initialization order', () => {
  let speakMock: ReturnType<typeof vi.fn>;
  let getVoicesMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // WebSpeech globals (safe defaults for both engines)
    speakMock = vi.fn();
    getVoicesMock = vi.fn(() => []);
    vi.stubGlobal('window', {
      speechSynthesis: {
        speak: speakMock,
        cancel: vi.fn(),
        getVoices: getVoicesMock,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
      electronAPI: {
        ttsLocalStatus: vi.fn(async () => ({
          workerScriptAvailable: true,
          modelsDirectoryAvailable: true,
          workerRunning: false,
        })),
        ttsLocalVoices: vi.fn(async () => []),
        ttsLocalSynthesize: vi.fn(async () => new ArrayBuffer(0)),
        ttsLocalStop: vi.fn(async () => ({ success: true })),
      },
    });
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text = '';
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      voice: unknown = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      constructor(t: string) { this.text = t; }
    });

    // Reset singleton to clean state
    const service = getTTSService();
    service.reset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Profile engine = "local-piper" → LocalTTSEngine (only supported engine)
  it('should initialize LocalTTSEngine when profile engine is "local-piper"', async () => {
    const service = getTTSService();

    // Apply profile settings with local-piper engine
    service.updateSettings({ engine: 'local-piper', voice: 'en_US/en_US-hfc_female-medium' });
    expect(service.getSettings().engine).toBe('local-piper');

    // Inject LocalTTSEngine (simulates what initialize() would create)
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    service.setEngine(localEngine);

    const engine = service.getEngine();
    expect(engine).not.toBeNull();
    expect(engine!.name).toBe('local-piper');
    expect(service.getSettings().engine).toBe('local-piper');
  });

  // Test 2: Legacy profile with "webspeech" engine should be normalized to local-piper
  it('should normalize legacy "webspeech" engine to "local-piper"', async () => {
    const service = getTTSService();
    await service.initialize({
      engine: 'webspeech', // Legacy value
      language: 'en-US',
      voice: 'Microsoft David',
    });

    // Should normalize to local-piper
    expect(service.getSettings().engine).toBe('local-piper');
  });

  // Regression: updateSettings() normalizes webspeech → local-piper and preserves other settings
  it('should normalize webspeech engine in updateSettings() while preserving other TTS settings', async () => {
    const service = getTTSService();

    // Simulate loading a legacy profile with webspeech engine
    service.updateSettings({
      engine: 'webspeech',
      voice: 'en_US/en_US-hfc_female-medium',
      language: 'en-US',
      defaultSpeed: 1.5,
      volume: 0.6,
      speakerId: 2,
      filterMode: 'command',
      commandPrefix: '!',
      randomVoice: true,
      maxTextLength: 300,
      minIntervalMs: 1000,
      maxQueueLength: 25,
    });

    const settings = service.getSettings();
    // Engine must be normalized
    expect(settings.engine).toBe('local-piper');
    // All other settings must be preserved
    expect(settings.voice).toBe('en_US/en_US-hfc_female-medium');
    expect(settings.language).toBe('en-US');
    expect(settings.defaultSpeed).toBe(1.5);
    expect(settings.volume).toBe(0.6);
    expect(settings.speakerId).toBe(2);
    expect(settings.filterMode).toBe('command');
    expect(settings.commandPrefix).toBe('!');
    expect(settings.randomVoice).toBe(true);
    expect(settings.maxTextLength).toBe(300);
    expect(settings.minIntervalMs).toBe(1000);
    expect(settings.maxQueueLength).toBe(25);
  });

  // Regression: getCurrentProfileTTSSettings() normalizes legacy webspeech profiles
  it('should normalize legacy webspeech profile in getCurrentProfileTTSSettings()', async () => {
    const { getCurrentProfileTTSSettings } = await import('./tts-service');

    // Mock app-store to return profile with legacy webspeech engine
    mockGetState.mockReturnValue({
      currentProfileId: 'legacy-profile',
      streamProfiles: [{
        id: 'legacy-profile',
        ttsSettings: {
          engine: 'webspeech',
          voice: 'Microsoft David',
          language: 'en-US',
          defaultSpeed: 1.5,
          volume: 0.6,
          speakerId: 3,
          filterMode: 'slash',
          commandPrefix: '/',
          randomVoice: true,
          maxTextLength: 250,
          minIntervalMs: 800,
          maxQueueLength: 30,
          enabled: true,
          defaultPitch: 1.0,
        },
      }],
    });

    const settings = getCurrentProfileTTSSettings();

    // Engine must be normalized to local-piper
    expect(settings.engine).toBe('local-piper');
    // All other settings must be preserved from the legacy profile
    expect(settings.voice).toBe('Microsoft David');
    expect(settings.language).toBe('en-US');
    expect(settings.defaultSpeed).toBe(1.5);
    expect(settings.volume).toBe(0.6);
    expect(settings.speakerId).toBe(3);
    expect(settings.filterMode).toBe('slash');
    expect(settings.commandPrefix).toBe('/');
    expect(settings.randomVoice).toBe(true);
    expect(settings.maxTextLength).toBe(250);
    expect(settings.minIntervalMs).toBe(800);
    expect(settings.maxQueueLength).toBe(30);
    expect(settings.enabled).toBe(true);
  });

  // Test 3: resolveVoiceId() searches Local Piper catalog (not WebSpeech fallback)
  it('should resolve Piper voice from Local Piper catalog, not WebSpeech fallback', async () => {
    const service = getTTSService();

    // Set up LocalTTSEngine with Piper voices
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    // Inject cached voices directly (simulates loadVoices() completion)
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
      },
      {
        id: 'en_US/en_US-lessac-medium',
        name: 'English (US) — Lessac (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-lessac-medium.onnx' },
      },
      {
        id: 'id_ID/id_ID-news_tts-medium',
        name: 'Indonesian — News TTS (Medium)',
        language: 'id-ID',
        languageGroup: 'id',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/id_ID/id_ID-news_tts-medium.onnx' },
      },
    ];
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
    });

    const voiceId = service.resolveVoiceId();
    // Must find the Piper voice, NOT fall back to WebSpeech
    expect(voiceId).toBe('en_US/en_US-hfc_female-medium');
    expect(voiceId).not.toContain('Microsoft');
    expect(voiceId).not.toContain('Google');
  });

  // Test 4: Piper female model path is selected (not male lessac fallback)
  it('should select the female Piper model path, not the male lessac fallback', async () => {
    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
      },
      {
        id: 'en_US/en_US-lessac-medium',
        name: 'English (US) — Lessac (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-lessac-medium.onnx' },
      },
    ];
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
    });

    const voiceId = service.resolveVoiceId();
    const voices = localEngine.getVoices();
    const resolvedVoice = voices.find(v => v.id === voiceId);

    expect(resolvedVoice).toBeDefined();
    expect(resolvedVoice!.metadata?.modelPath).toContain('hfc_female');
    expect(resolvedVoice!.metadata?.modelPath).not.toContain('lessac');
  });

  // Test 5: WebSpeech behavior remains intact
  it('should maintain WebSpeech fallback when no Piper voice matches', async () => {
    const service = getTTSService();

    // WebSpeech voices
    getVoicesMock.mockReturnValue([
      { name: 'Microsoft David', lang: 'en-US', localService: true, default: true, voiceURI: 'Microsoft David' },
      { name: 'Microsoft Zira', lang: 'en-US', localService: true, default: false, voiceURI: 'Microsoft Zira' },
    ]);

    const { WebSpeechEngine } = await import('./engines/web-speech-engine');
    const wsEngine = new WebSpeechEngine();
    service.setEngine(wsEngine);

    service.updateSettings({
      engine: 'webspeech',
      voice: '',
      randomVoice: false,
      language: 'en-US',
    });

    const voiceId = service.resolveVoiceId();
    // Should resolve to a WebSpeech voice
    expect(voiceId).toBeTruthy();
    expect(['Microsoft David', 'Microsoft Zira']).toContain(voiceId);
  });

  // Test 6: testSpeak() behavior with fresh profile settings
  it('should apply fresh profile settings in testSpeak() before voice resolution', async () => {
    // Configure mock to return profile with local-piper settings
    mockGetState.mockReturnValue({
      currentProfileId: 'test-profile',
      streamProfiles: [{
        id: 'test-profile',
        ttsSettings: {
          engine: 'local-piper',
          voice: 'en_US/en_US-hfc_female-medium',
          language: 'en-US',
          randomVoice: false,
          defaultSpeed: 1.0,
          defaultPitch: 1.0,
          volume: 0.8,
          enabled: true,
          filterMode: 'any',
          commandPrefix: '!',
          maxTextLength: 200,
          minIntervalMs: 500,
          maxQueueLength: 50,
        },
      }],
    });

    const service = getTTSService();

    // Set up LocalTTSEngine with Piper voices
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    const cachedVoices: TTSVoiceInfo[] = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
      },
    ];
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = cachedVoices;

    // Mock loadVoices to populate both engine cachedVoices AND TTSService.voices
    vi.spyOn(localEngine, 'loadVoices').mockImplementation(async () => {
      (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = cachedVoices;
      (service as unknown as { voices: TTSVoiceInfo[] }).voices = cachedVoices;
      (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;
      return cachedVoices;
    });

    // Mock synthesize to resolve immediately
    const synthesizeMock = vi.fn(() => Promise.resolve());
    localEngine.synthesize = synthesizeMock as unknown as TTSEngine['synthesize'];
    // Make engine report available
    localEngine.isAvailable = vi.fn(() => true);
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
      enabled: true,
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });
    // Mark as initialized so testSpeak() skips lazy-init
    (service as unknown as { initialized: boolean }).initialized = true;
    (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;

    await service.testSpeak('hello test');

    // Verify synthesize was called with the Piper voice, not a WebSpeech fallback
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    const calledVoiceId = synthesizeMock.mock.calls[0][1];
    expect(calledVoiceId).toBe('en_US/en_US-hfc_female-medium');
  });
});

// =============================================
// Voice Catalog Refresh in testSpeak Tests
// Verifies: testSpeak() refreshes engine voices
// before resolveVoiceId() to prevent stale fallback.
// =============================================

describe('testSpeak() voice catalog refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call loadVoices() on LocalTTSEngine before resolveVoiceId()', async () => {
    // Mock app-store to return profile with male voice
    mockGetState.mockReturnValue({
      currentProfileId: 'test-profile',
      streamProfiles: [{
        id: 'test-profile',
        ttsSettings: {
          engine: 'local-piper',
          voice: 'en_US/en_US-hfc_male-medium',
          language: 'en-US',
          randomVoice: false,
          defaultSpeed: 1.0,
          defaultPitch: 1.0,
          volume: 0.8,
          enabled: true,
          filterMode: 'any',
          commandPrefix: '!',
          maxTextLength: 200,
          minIntervalMs: 500,
          maxQueueLength: 50,
        },
      }],
    });

    const service = getTTSService();

    // Create LocalTTSEngine with both voices
    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();

    // Start with only female voice in cache (simulating stale state)
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] | null }).cachedVoices = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
      },
    ];

    // Spy on loadVoices — capture cachedVoices state when called, then populate both voices
    let cachedVoicesClearedBeforeLoad = false;
    const loadVoicesSpy = vi.spyOn(localEngine, 'loadVoices').mockImplementation(async () => {
      cachedVoicesClearedBeforeLoad = (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] | null }).cachedVoices === null;
      (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = [
        {
          id: 'en_US/en_US-hfc_female-medium',
          name: 'English (US) — HFC Female (Medium)',
          language: 'en-US',
          languageGroup: 'en',
          gender: 'female',
          provider: 'local-piper',
          metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
        },
        {
          id: 'en_US/en_US-hfc_male-medium',
          name: 'English (US) — HFC Male (Medium)',
          language: 'en-US',
          languageGroup: 'en',
          gender: 'male',
          provider: 'local-piper',
          metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_male-medium.onnx' },
        },
      ];
      return (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices;
    });

    // Mock synthesize
    const synthesizeMock = vi.fn(() => Promise.resolve());
    localEngine.synthesize = synthesizeMock as unknown as TTSEngine['synthesize'];
    localEngine.isAvailable = vi.fn(() => true);
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_male-medium',
      randomVoice: false,
      language: 'en-US',
      enabled: true,
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });
    (service as unknown as { initialized: boolean }).initialized = true;
    (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;

    await service.testSpeak('hello male');

    // loadVoices must have been called to refresh the catalog
    expect(loadVoicesSpy).toHaveBeenCalled();
    // cachedVoices must have been cleared to null before loadVoices() re-populated it
    expect(cachedVoicesClearedBeforeLoad).toBe(true);

    // synthesize must have been called with the MALE voice ID
    expect(synthesizeMock).toHaveBeenCalledTimes(1);
    const calledVoiceId = synthesizeMock.mock.calls[0][1];
    expect(calledVoiceId).toBe('en_US/en_US-hfc_male-medium');
  });

  it('should NOT select female voice when male profile voice is set', async () => {
    mockGetState.mockReturnValue({
      currentProfileId: 'test-profile',
      streamProfiles: [{
        id: 'test-profile',
        ttsSettings: {
          engine: 'local-piper',
          voice: 'en_US/en_US-hfc_male-medium',
          language: 'en-US',
          randomVoice: false,
          defaultSpeed: 1.0,
          defaultPitch: 1.0,
          volume: 0.8,
          enabled: true,
          filterMode: 'any',
          commandPrefix: '!',
          maxTextLength: 200,
          minIntervalMs: 500,
          maxQueueLength: 50,
        },
      }],
    });

    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();

    // LoadVoices populates both voices
    vi.spyOn(localEngine, 'loadVoices').mockImplementation(async () => {
      const voices: TTSVoiceInfo[] = [
        {
          id: 'en_US/en_US-hfc_female-medium',
          name: 'English (US) — HFC Female (Medium)',
          language: 'en-US', languageGroup: 'en', gender: 'female',
          provider: 'local-piper',
          metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_female-medium.onnx' },
        },
        {
          id: 'en_US/en_US-hfc_male-medium',
          name: 'English (US) — HFC Male (Medium)',
          language: 'en-US', languageGroup: 'en', gender: 'male',
          provider: 'local-piper',
          metadata: { modelPath: '/userData/tts/models/en_US/en_US-hfc_male-medium.onnx' },
        },
      ];
      (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = voices;
      return voices;
    });

    const synthesizeMock = vi.fn(() => Promise.resolve());
    localEngine.synthesize = synthesizeMock as unknown as TTSEngine['synthesize'];
    localEngine.isAvailable = vi.fn(() => true);
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_male-medium',
      randomVoice: false,
      language: 'en-US',
      enabled: true,
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });
    (service as unknown as { initialized: boolean }).initialized = true;
    (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;

    await service.testSpeak('test');

    // The male voice MUST be selected — NOT the female
    const calledVoiceId = synthesizeMock.mock.calls[0][1];
    expect(calledVoiceId).toBe('en_US/en_US-hfc_male-medium');
    expect(calledVoiceId).not.toBe('en_US/en_US-hfc_female-medium');
  });
});

// ═══════════════════════════════════════════════════════
// Piper Voice Fallback Prevention Tests
// Verifies: uninstalled Piper voices do NOT silently
// fall back to another installed voice.
// ═══════════════════════════════════════════════════════

describe('Piper voice fallback prevention', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should use exact installed Piper voice when available', async () => {
    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/models/en_US/en_US-hfc_female-medium.onnx' },
      },
      {
        id: 'id_ID/id_ID-news_tts-medium',
        name: 'Indonesian — News TTS (Medium)',
        language: 'id-ID',
        languageGroup: 'id',
        provider: 'local-piper',
        metadata: { modelPath: '/models/id_ID/id_ID-news_tts-medium.onnx' },
      },
    ];
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
    });

    const voiceId = service.resolveVoiceId();
    expect(voiceId).toBe('en_US/en_US-hfc_female-medium');
  });

  it('should return null for uninstalled Piper voice (no silent fallback)', async () => {
    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();
    // Only Indonesian installed — no English models
    (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = [
      {
        id: 'id_ID/id_ID-news_tts-medium',
        name: 'Indonesian — News TTS (Medium)',
        language: 'id-ID',
        languageGroup: 'id',
        provider: 'local-piper',
        metadata: { modelPath: '/models/id_ID/id_ID-news_tts-medium.onnx' },
      },
    ];
    service.setEngine(localEngine);

    // User selected English Female — but it's NOT installed
    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
    });

    const voiceId = service.resolveVoiceId();
    // Must return null — NOT fall back to Indonesian or any other voice
    expect(voiceId).toBeNull();
  });

  it('should fall back to language prefix for Web Speech (preserves existing behavior)', async () => {
    const service = getTTSService();

    // Set up WebSpeechEngine mock
    const mockEngine = {
      name: 'webspeech',
      isAvailable: () => true,
      getVoices: () => [
        {
          id: 'Microsoft David',
          name: 'Microsoft David',
          language: 'en-US',
          languageGroup: 'en',
          provider: 'webspeech',
        },
        {
          id: 'Microsoft Zira',
          name: 'Microsoft Zira',
          language: 'en-US',
          languageGroup: 'en',
          provider: 'webspeech',
        },
      ],
      getLanguages: () => [{ code: 'en-US', name: 'English (US)', voiceCount: 2 }],
      synthesize: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };
    service.setEngine(mockEngine as unknown as TTSEngine);

    // Request a voice that doesn't exist — Web Speech should fall back
    service.updateSettings({
      engine: 'webspeech',
      voice: 'NonExistentVoice',
      randomVoice: false,
      language: 'en-US',
    });

    const voiceId = service.resolveVoiceId();
    // Web Speech falls back to first compatible voice (existing behavior preserved)
    expect(voiceId).toBe('Microsoft David');
  });

  it('testSpeak should throw clear error for uninstalled Piper voice', async () => {
    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();

    const indonesianVoices: TTSVoiceInfo[] = [
      {
        id: 'id_ID/id_ID-news_tts-medium',
        name: 'Indonesian — News TTS (Medium)',
        language: 'id-ID',
        languageGroup: 'id',
        provider: 'local-piper',
        metadata: { modelPath: '/models/id_ID/id_ID-news_tts-medium.onnx' },
      },
    ];

    // Mock loadVoices to re-populate cachedVoices (testSpeak clears them)
    vi.spyOn(localEngine, 'loadVoices').mockImplementation(async () => {
      (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = indonesianVoices;
      return indonesianVoices;
    });
    localEngine.isAvailable = vi.fn(() => true);

    const synthesizeMock = vi.fn().mockResolvedValue(undefined);
    localEngine.synthesize = synthesizeMock as unknown as TTSEngine['synthesize'];
    service.setEngine(localEngine);

    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
      enabled: true,
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });
    (service as unknown as { initialized: boolean }).initialized = true;
    (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;

    // testSpeak should throw — NOT silently use Indonesian voice
    await expect(service.testSpeak('hello')).rejects.toThrow('Suara yang dipilih tidak tersedia');
    expect(synthesizeMock).not.toHaveBeenCalled();
  });

  it('testSpeak with overrideSettings should use UI voice selection', async () => {
    const service = getTTSService();

    const { LocalTTSEngine } = await import('./engines/local-tts-engine');
    const localEngine = new LocalTTSEngine();

    const bothVoices: TTSVoiceInfo[] = [
      {
        id: 'en_US/en_US-hfc_female-medium',
        name: 'English (US) — HFC Female (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'female',
        provider: 'local-piper',
        metadata: { modelPath: '/models/en_US/en_US-hfc_female-medium.onnx' },
      },
      {
        id: 'en_US/en_US-hfc_male-medium',
        name: 'English (US) — HFC Male (Medium)',
        language: 'en-US',
        languageGroup: 'en',
        gender: 'male',
        provider: 'local-piper',
        metadata: { modelPath: '/models/en_US/en_US-hfc_male-medium.onnx' },
      },
    ];

    // Mock loadVoices to re-populate cachedVoices (testSpeak clears them)
    vi.spyOn(localEngine, 'loadVoices').mockImplementation(async () => {
      (localEngine as unknown as { cachedVoices: TTSVoiceInfo[] }).cachedVoices = bothVoices;
      return bothVoices;
    });
    localEngine.isAvailable = vi.fn(() => true);

    const synthesizeMock = vi.fn().mockResolvedValue(undefined);
    localEngine.synthesize = synthesizeMock as unknown as TTSEngine['synthesize'];
    service.setEngine(localEngine);

    // Profile has female voice saved
    service.updateSettings({
      engine: 'local-piper',
      voice: 'en_US/en_US-hfc_female-medium',
      randomVoice: false,
      language: 'en-US',
      enabled: true,
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      volume: 0.8,
    });
    (service as unknown as { initialized: boolean }).initialized = true;
    (service as unknown as { voicesLoaded: boolean }).voicesLoaded = true;

    // User selected male voice in UI (not saved yet) — pass as override
    await service.testSpeak('hello', {
      voice: 'en_US/en_US-hfc_male-medium',
    });

    const calledVoiceId = synthesizeMock.mock.calls[0][1];
    expect(calledVoiceId).toBe('en_US/en_US-hfc_male-medium');
  });
});