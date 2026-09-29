// =============================================
// RosaeFinity Local TTS Model Manager
// Manages downloadable Piper voice models.
// NO automatic downloads — user action required.
// =============================================

// ── Model Catalog ──
// Each entry represents a downloadable Piper voice model.
// URLs point to official HuggingFace Piper voice repository.
// License info is from the repository and MODEL_CARD files.

export interface LocalTTSModelInfo {
  id: string;              // stable identifier (e.g., "id_ID-news_tts-medium")
  name: string;            // display name (e.g., "Indonesian — News TTS (Medium)")
  language: string;        // display language name
  languageCode: string;    // BCP 47 (e.g., "id-ID")
  piperCode: string;       // Piper directory code (e.g., "id_ID")
  size: number;            // estimated size in bytes (0 if unknown)
  downloadUrl: string;     // URL to download the .onnx file
  configUrl: string;       // URL to download the .onnx.json config
  installed: boolean;      // whether currently installed locally
  licenseNote?: string;    // license information if known
  /** Curated gender annotation. Piper metadata does not contain gender. */
  gender?: 'male' | 'female' | 'neutral';
}

export type ModelDownloadState =
  | 'idle'
  | 'downloading'
  | 'verifying'
  | 'installing'
  | 'complete'
  | 'error'
  | 'cancelled';

export interface ModelDownloadProgress {
  state: ModelDownloadState;
  modelId: string;
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  error?: string;
}

const HUGGINGFACE_BASE = 'https://huggingface.co/rhasspy/piper-voices/resolve/main';

/**
 * Curated catalog of available Piper voice models.
 * Each entry has been verified against the official piper-voices repository.
 * This is NOT a complete list — it is a curated subset for common languages.
 *
 * Users can also manually place models in <userData>/tts/models/.
 */
export const MODEL_CATALOG: LocalTTSModelInfo[] = [
  // Indonesian
  {
    id: 'id_ID-news_tts-medium',
    name: 'Indonesian — News TTS (Medium)',
    language: 'Indonesian',
    languageCode: 'id-ID',
    piperCode: 'id_ID',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/id/id_ID/news_tts/medium/id_ID-news_tts-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT. Individual voice MODEL_CARD does not specify a license.',
    gender: 'neutral',
  },
  // English (US)
  {
    id: 'en_US-lessac-medium',
    name: 'English (US) — Lessac (Medium)',
    language: 'English (US)',
    languageCode: 'en-US',
    piperCode: 'en_US',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT. Based on LJ Speech (public domain).',
  },
  // English (US) — Female
  {
    id: 'en_US-hfc_female-medium',
    name: 'English (US) — HFC Female (Medium)',
    language: 'English (US)',
    languageCode: 'en-US',
    piperCode: 'en_US',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
    gender: 'female',
  },
  // English (US) — Male
  {
    id: 'en_US-hfc_male-medium',
    name: 'English (US) — HFC Male (Medium)',
    language: 'English (US)',
    languageCode: 'en-US',
    piperCode: 'en_US',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/en/en_US/hfc_male/medium/en_US-hfc_male-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
    gender: 'male',
  },
  // English (GB) — Alba (Female name)
  {
    id: 'en_GB-alba-medium',
    name: 'English (UK) — Alba (Medium)',
    language: 'English (UK)',
    languageCode: 'en-GB',
    piperCode: 'en_GB',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/en/en_GB/alba/medium/en_GB-alba-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/en/en_GB/alba/medium/en_GB-alba-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT. Dataset: CC-BY 4.0.',
    gender: 'female',
  },
  // English (GB) — Southern English Female
  {
    id: 'en_GB-southern_english_female-low',
    name: 'English (UK) — Southern Female (Low)',
    language: 'English (UK)',
    languageCode: 'en-GB',
    piperCode: 'en_GB',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/en/en_GB/southern_english_female/low/en_GB-southern_english_female-low.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
    gender: 'female',
  },
  // Japanese
  {
    id: 'ja_JP-hi_fi_captain-medium',
    name: 'Japanese — Hi-Fi Captain (Medium)',
    language: 'Japanese',
    languageCode: 'ja-JP',
    piperCode: 'ja_JP',
    size: 77_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/ja/ja_JP/hi_fi_captain/medium/ja_JP-hi_fi_captain-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/ja/ja_JP/hi_fi_captain/medium/ja_JP-hi_fi_captain-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT. Multi-speaker (female/male).',
  },
  // Chinese
  {
    id: 'zh_CN-huayan-medium',
    name: 'Chinese — Huayan (Medium)',
    language: 'Chinese',
    languageCode: 'zh-CN',
    piperCode: 'zh_CN',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
  },
  // French (Siwis — female speaker dataset)
  {
    id: 'fr_FR-siwis-medium',
    name: 'French — Siwis (Medium)',
    language: 'French',
    languageCode: 'fr-FR',
    piperCode: 'fr_FR',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT. Dataset: CC-BY 4.0.',
    gender: 'female',
  },
  // German
  {
    id: 'de_DE-thorsten-medium',
    name: 'German — Thorsten (Medium)',
    language: 'German',
    languageCode: 'de-DE',
    piperCode: 'de_DE',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
  },
  // Spanish
  {
    id: 'es_ES-sharvard-medium',
    name: 'Spanish — Sharvard (Medium)',
    language: 'Spanish',
    languageCode: 'es-ES',
    piperCode: 'es_ES',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
  },
  // Portuguese (Brazil)
  {
    id: 'pt_BR-faber-medium',
    name: 'Portuguese (Brazil) — Faber (Medium)',
    language: 'Portuguese (Brazil)',
    languageCode: 'pt-BR',
    piperCode: 'pt_BR',
    size: 63_000_000,
    downloadUrl: `${HUGGINGFACE_BASE}/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx`,
    configUrl: `${HUGGINGFACE_BASE}/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json`,
    installed: false,
    licenseNote: 'Repository-level MIT.',
  },
];

// ── IPC bridge ──
interface ModelManagerIPC {
  ttsLocalInstallModel(request: {
    modelId: string;
    downloadUrl: string;
    configUrl: string;
    piperCode: string;
  }): Promise<{ success: boolean; error?: string }>;
  ttsLocalDeleteModel(request: {
    piperCode: string;
    modelId: string;
  }): Promise<{ success: boolean; error?: string }>;
  ttsLocalCheckInstalled(): Promise<Array<{ id: string; piperCode: string }>>;
  ttsLocalRefreshVoices(): Promise<void>;
}

function getIPC(): ModelManagerIPC | null {
  if (typeof window !== 'undefined' && (window as Record<string, unknown>).electronAPI) {
    const api = (window as Record<string, unknown>).electronAPI as Record<string, unknown>;
    return {
      ttsLocalInstallModel: api.ttsLocalInstallModel as ModelManagerIPC['ttsLocalInstallModel'],
      ttsLocalDeleteModel: api.ttsLocalDeleteModel as ModelManagerIPC['ttsLocalDeleteModel'],
      ttsLocalCheckInstalled: api.ttsLocalCheckInstalled as ModelManagerIPC['ttsLocalCheckInstalled'],
      ttsLocalRefreshVoices: api.ttsLocalRefreshVoices as ModelManagerIPC['ttsLocalRefreshVoices'],
    };
  }
  return null;
}

// ── Public API ──

/** Get the model catalog with installed status updated */
export async function getModelCatalog(): Promise<LocalTTSModelInfo[]> {
  const ipc = getIPC();
  const catalog = [...MODEL_CATALOG];

  if (!ipc?.ttsLocalCheckInstalled) return catalog;

  try {
    const installed = await ipc.ttsLocalCheckInstalled();
    const installedSet = new Set(installed.map(m => m.id));

    for (const model of catalog) {
      model.installed = installedSet.has(model.id);
    }
  } catch {
    // If check fails, assume none installed
  }

  return catalog;
}

/** Download and install a voice model */
export async function downloadModel(
  model: LocalTTSModelInfo,
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  const ipc = getIPC();
  if (!ipc?.ttsLocalInstallModel) {
    return { success: false, error: 'IPC not available' };
  }

  onProgress?.({
    state: 'downloading',
    modelId: model.id,
    downloadedBytes: 0,
    totalBytes: model.size,
    percentage: 0,
  });

  try {
    const result = await ipc.ttsLocalInstallModel({
      modelId: model.id,
      downloadUrl: model.downloadUrl,
      configUrl: model.configUrl,
      piperCode: model.piperCode,
    });

    if (result.success) {
      onProgress?.({
        state: 'complete',
        modelId: model.id,
        downloadedBytes: model.size,
        totalBytes: model.size,
        percentage: 100,
      });
      // Refresh engine voice catalog
      await ipc.ttsLocalRefreshVoices?.();
    } else {
      onProgress?.({
        state: 'error',
        modelId: model.id,
        downloadedBytes: 0,
        totalBytes: model.size,
        percentage: 0,
        error: result.error,
      });
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Download failed';
    onProgress?.({
      state: 'error',
      modelId: model.id,
      downloadedBytes: 0,
      totalBytes: model.size,
      percentage: 0,
      error: msg,
    });
    return { success: false, error: msg };
  }
}

/** Delete an installed model */
export async function deleteModel(
  model: LocalTTSModelInfo,
): Promise<{ success: boolean; error?: string }> {
  const ipc = getIPC();
  if (!ipc?.ttsLocalDeleteModel) {
    return { success: false, error: 'IPC not available' };
  }

  try {
    const result = await ipc.ttsLocalDeleteModel({
      piperCode: model.piperCode,
      modelId: model.id,
    });

    if (result.success) {
      await ipc.ttsLocalRefreshVoices?.();
    }

    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

/** Refresh the LocalTTSEngine voice catalog */
export async function refreshEngineVoices(): Promise<void> {
  const ipc = getIPC();
  await ipc?.ttsLocalRefreshVoices?.();
}
