// =============================================
// RosaeFinity Local TTS Setup Manager
// Detects Piper runtime availability and
// provides explicit user-triggered setup.
// NO automatic downloads or installations.
// =============================================

export type LocalTTSSetupState =
  | 'not-installed'
  | 'checking'
  | 'installing'
  | 'ready'
  | 'error';

export interface LocalTTSSetupStatus {
  state: LocalTTSSetupState;
  error?: string;
  pythonAvailable?: boolean;
  piperInstalled?: boolean;
  workerScriptAvailable?: boolean;
}

/** IPC bridge exposed by preload.cjs */
interface SetupIPC {
  ttsLocalSetupStatus(): Promise<LocalTTSSetupStatus>;
  ttsLocalSetup(): Promise<{ success: boolean; error?: string }>;
  ttsLocalStatus(): Promise<{
    workerScriptAvailable: boolean;
    modelsDirectoryAvailable: boolean;
    workerRunning: boolean;
  }>;
}

function getIPC(): SetupIPC | null {
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).electronAPI) {
    const api = (window as Record<string, unknown>).electronAPI as Record<string, unknown>;
    return {
      ttsLocalSetupStatus: api.ttsLocalSetupStatus as SetupIPC['ttsLocalSetupStatus'],
      ttsLocalSetup: api.ttsLocalSetup as SetupIPC['ttsLocalSetup'],
      ttsLocalStatus: api.ttsLocalStatus as SetupIPC['ttsLocalStatus'],
    };
  }
  return null;
}

/**
 * Check if the local TTS runtime is installed.
 * Does NOT trigger any installation.
 */
export async function checkLocalTTSStatus(): Promise<LocalTTSSetupStatus> {
  const ipc = getIPC();
  if (!ipc?.ttsLocalSetupStatus) {
    return { state: 'not-installed', error: 'IPC not available' };
  }
  try {
    return await ipc.ttsLocalSetupStatus();
  } catch (err) {
    return {
      state: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Explicitly trigger local TTS setup.
 * Only call this when user clicks [Set Up Local TTS].
 * Installs piper-tts via pip if not already present.
 */
export async function setupLocalTTS(): Promise<{ success: boolean; error?: string }> {
  const ipc = getIPC();
  if (!ipc?.ttsLocalSetup) {
    return { success: false, error: 'IPC not available' };
  }
  return ipc.ttsLocalSetup();
}

/**
 * Check if the LocalTTSEngine can actually be used
 * (worker script exists and Python can run it).
 */
export async function checkLocalTTSAvailability(): Promise<boolean> {
  const ipc = getIPC();
  if (!ipc?.ttsLocalStatus) return false;
  try {
    const status = await ipc.ttsLocalStatus();
    return status.workerScriptAvailable;
  } catch {
    return false;
  }
}
