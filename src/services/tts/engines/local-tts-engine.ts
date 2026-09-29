// =============================================
// RosaeFinity Local TTS Engine
// Uses Piper via Electron IPC to the main
// process. Audio playback happens in renderer.
// Language-agnostic — discovers voices from
// installed model files.
// =============================================

import type { TTSEngine, TTSVoiceInfo, TTSLanguage, TTSSynthesizeOptions } from '../../../types/tts';

/** IPC bridge exposed by preload.cjs */
interface LocalTTSIPC {
  ttsLocalStatus(): Promise<{
    workerScriptAvailable: boolean;
    modelsDirectoryAvailable: boolean;
    workerRunning: boolean;
  }>;
  ttsLocalVoices(): Promise<TTSVoiceInfo[]>;
  ttsLocalSynthesize(request: {
    modelPath: string;
    text: string;
    rate: number;
    pitch: number;
    speakerId?: number;
  }): Promise<ArrayBuffer>;
  ttsLocalStop(): Promise<{ success: boolean }>;
}

function getIPC(): LocalTTSIPC | null {
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).electronAPI) {
    const api = (window as Record<string, unknown>).electronAPI as Record<string, unknown>;
    return {
      ttsLocalStatus: api.ttsLocalStatus as LocalTTSIPC['ttsLocalStatus'],
      ttsLocalVoices: api.ttsLocalVoices as LocalTTSIPC['ttsLocalVoices'],
      ttsLocalSynthesize: api.ttsLocalSynthesize as LocalTTSIPC['ttsLocalSynthesize'],
      ttsLocalStop: api.ttsLocalStop as LocalTTSIPC['ttsLocalStop'],
    };
  }
  return null;
}

export class LocalTTSEngine implements TTSEngine {
  readonly name = 'local-piper';

  private cachedVoices: TTSVoiceInfo[] | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  isAvailable(): boolean {
    const ipc = getIPC();
    if (!ipc || !ipc.ttsLocalStatus) return false;

    // Synchronous check — uses cached status or returns false
    // The actual availability is checked async during initialize()
    return this._available;
  }

  private _available = false;

  /** Async availability check — called during initialization */
  async checkAvailability(): Promise<boolean> {
    const ipc = getIPC();
    if (!ipc || !ipc.ttsLocalStatus) {
      this._available = false;
      return false;
    }
    try {
      const status = await ipc.ttsLocalStatus();
      this._available = status.workerScriptAvailable;
      console.log('[LOCAL-TTS] Availability:', status);
      return this._available;
    } catch {
      this._available = false;
      return false;
    }
  }

  getVoices(): TTSVoiceInfo[] {
    // Return cached voices if available
    if (this.cachedVoices) return this.cachedVoices;

    // Synchronous fallback — return empty; async load via loadVoices()
    return [];
  }

  /** Async voice discovery — called during initialization */
  async loadVoices(): Promise<TTSVoiceInfo[]> {
    const ipc = getIPC();
    if (!ipc || !ipc.ttsLocalVoices) {
      this.cachedVoices = [];
      return [];
    }
    try {
      const voices = await ipc.ttsLocalVoices();
      this.cachedVoices = voices;
      console.log('[LOCAL-TTS] Discovered', voices.length, 'voices');
      return voices;
    } catch (err) {
      console.error('[LOCAL-TTS] Voice discovery failed:', err);
      this.cachedVoices = [];
      return [];
    }
  }

  /** Invalidate the cached voice list so next getVoices() re-discovers from IPC */
  invalidateVoiceCache(): void {
    this.cachedVoices = null;
  }

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
          name: voice.language, // Display name comes from engine
          voiceCount: 1,
        });
      }
    }

    return Array.from(langMap.values()).sort((a, b) => a.code.localeCompare(b.code));
  }

  synthesize(
    text: string,
    voiceId: string,
    options: TTSSynthesizeOptions,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const ipc = getIPC();
      if (!ipc || !ipc.ttsLocalSynthesize) {
        reject(new Error('Local TTS IPC not available'));
        return;
      }

      // Find the voice to get its model path
      const voice = this.cachedVoices?.find(v => v.id === voiceId);
      if (!voice?.metadata?.modelPath) {
        reject(new Error(`Voice not found: ${voiceId}`));
        return;
      }

      console.log('[LOCAL-TTS] Synthesizing:', { text: text.substring(0, 50), voiceId });

      ipc.ttsLocalSynthesize({
        modelPath: voice.metadata.modelPath as string,
        text,
        rate: options.rate,
        pitch: options.pitch,
        speakerId: options.speakerId,
      }).then((wavBuffer: ArrayBuffer) => {
        // Play the WAV audio
        return this.playWav(wavBuffer);
      }).then(() => {
        console.log('[LOCAL-TTS] Playback complete');
        resolve();
      }).catch((err: Error) => {
        console.error('[LOCAL-TTS] Synthesis/playback failed:', err);
        reject(err);
      });
    });
  }

  stop(): void {
    // Stop current audio playback
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.src = '';
      this.currentAudio = null;
    }

    // Stop worker process via IPC
    const ipc = getIPC();
    if (ipc?.ttsLocalStop) {
      ipc.ttsLocalStop().catch(() => {});
    }
  }

  /** Play WAV ArrayBuffer via HTMLAudioElement */
  private playWav(wavBuffer: ArrayBuffer): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Clean up any existing audio
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio.src = '';
      }

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.currentAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      };

      audio.onerror = (event) => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        const target = event.target as HTMLAudioElement;
        const error = target?.error;
        reject(new Error(`Audio playback error: ${error?.message || 'unknown'}`));
      };

      audio.play().catch((err) => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        reject(err);
      });
    });
  }
}
