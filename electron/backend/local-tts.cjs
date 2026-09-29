// =============================================
// RosaeFinity — Local TTS Process Manager
// Manages the Piper worker process from the
// Electron main process. Handles spawning,
// communication, and cleanup.
// =============================================

const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app, ipcMain } = require('electron');

// ── State ──
let workerProcess = null;
let isStarting = false;
let activeRequest = null;     // { resolve, reject, timeout }
let requestCounter = 0;

const SYNTHESIS_TIMEOUT_MS = 15000;
const WORKER_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 min idle → kill
let idleTimer = null;

// ── Paths ──
function getTTSDataPath() {
  return path.join(app.getPath('userData'), 'tts');
}

function getModelsPath() {
  return path.join(getTTSDataPath(), 'models');
}

function getWorkerScriptPath() {
  // In production (packaged): worker is in extraResources → process.resourcesPath/tts/
  // In development: worker is in source tree → src/services/tts/engines/
  const isPackaged = app.isPackaged;
  if (isPackaged) {
    return path.join(process.resourcesPath, 'tts', 'piper_worker.py');
  }
  // Development path
  return path.join(__dirname, '..', '..', 'src', 'services', 'tts', 'engines', 'piper_worker.py');
}

// ── Language code mapping (Piper → BCP 47) ──
const PIPER_TO_BCP47 = {
  'ar': 'ar', 'ca': 'ca', 'cs': 'cs', 'cy': 'cy', 'da': 'da',
  'de': 'de', 'el': 'el', 'en': 'en', 'es': 'es', 'fa': 'fa',
  'fi': 'fi', 'fr': 'fr', 'hu': 'hu', 'id': 'id', 'is': 'is',
  'it': 'it', 'ka': 'ka', 'kk': 'kk', 'lb': 'lb', 'lv': 'lv',
  'ml': 'ml', 'hi': 'hi', 'ne': 'ne', 'nl': 'nl', 'no': 'no',
  'pl': 'pl', 'pt': 'pt', 'ro': 'ro', 'ru': 'ru', 'sk': 'sk',
  'sl': 'sl', 'sr': 'sr', 'sv': 'sv', 'sw': 'sw', 'te': 'te',
  'tr': 'tr', 'uk': 'uk', 'vi': 'vi', 'zh': 'zh',
};

const PIPER_REGION_MAP = {
  'US': 'US', 'GB': 'GB', 'ES': 'ES', 'AR': 'AR', 'MX': 'MX',
  'BR': 'BR', 'PT': 'PT', 'NL': 'NL', 'BE': 'BE', 'FR': 'FR',
  'DE': 'DE', 'IT': 'IT', 'JP': 'JP', 'KR': 'KR', 'CN': 'CN',
  'ID': 'ID', 'IN': 'IN', 'CD': 'CD',
};

function piperLangToBCP47(piperCode) {
  // piper codes: "id_ID", "en_US", "pt_BR"
  const parts = piperCode.split('_');
  const lang = parts[0]?.toLowerCase() || '';
  const region = parts[1]?.toUpperCase() || '';
  const bcpLang = PIPER_TO_BCP47[lang] || lang;
  const bcpRegion = PIPER_REGION_MAP[region] || region;
  return bcpRegion ? `${bcpLang}-${bcpRegion}` : bcpLang;
}

function piperLangToGroup(piperCode) {
  const lang = piperCode.split('_')[0]?.toLowerCase() || '';
  return PIPER_TO_BCP47[lang] || lang;
}

// ── Curated gender metadata (mirrors MODEL_CATALOG in local-tts-model-manager.ts) ──
// Piper metadata does not contain gender. This map provides curated annotations
// for voices where gender has been verified through research/documentation.
const GENDER_CATALOG = {
  'id_ID-news_tts-medium': 'neutral',
  'en_US-hfc_female-medium': 'female',
  'en_US-hfc_male-medium': 'male',
  'en_GB-alba-medium': 'female',
  'en_GB-southern_english_female-low': 'female',
  'fr_FR-siwis-medium': 'female',
};

// ── Voice Discovery ──
function discoverVoices() {
  const modelsPath = getModelsPath();
  const voices = [];

  console.log('[LOCAL-TTS-DEBUG] Scanning models path:', modelsPath);
  console.log('[LOCAL-TTS-DEBUG] modelsPath exists:', fs.existsSync(modelsPath));

  if (fs.existsSync(modelsPath)) {
    try {
      console.log('[LOCAL-TTS-DEBUG] modelsPath contents:', fs.readdirSync(modelsPath));
    } catch (e) { console.error('[LOCAL-TTS-DEBUG] readdir error:', e.message); }

    // Check each expected file
    const femaleOnnx = path.join(modelsPath, 'en_US', 'en_US-hfc_female-medium.onnx');
    const femaleJson = path.join(modelsPath, 'en_US', 'en_US-hfc_female-medium.onnx.json');
    const maleOnnx   = path.join(modelsPath, 'en_US', 'en_US-hfc_male-medium.onnx');
    const maleJson   = path.join(modelsPath, 'en_US', 'en_US-hfc_male-medium.onnx.json');
    console.log('[LOCAL-TTS-DEBUG] file check:', femaleOnnx, 'exists=' + fs.existsSync(femaleOnnx));
    console.log('[LOCAL-TTS-DEBUG] file check:', femaleJson, 'exists=' + fs.existsSync(femaleJson));
    console.log('[LOCAL-TTS-DEBUG] file check:', maleOnnx, 'exists=' + fs.existsSync(maleOnnx));
    console.log('[LOCAL-TTS-DEBUG] file check:', maleJson, 'exists=' + fs.existsSync(maleJson));

    // Also scan en_US directly
    const enUsDir = path.join(modelsPath, 'en_US');
    if (fs.existsSync(enUsDir)) {
      console.log('[LOCAL-TTS-DEBUG] en_US contents:', fs.readdirSync(enUsDir));
    } else {
      console.log('[LOCAL-TTS-DEBUG] en_US directory does NOT exist');
    }
  }

  if (!fs.existsSync(modelsPath)) {
    return voices;
  }

  try {
    // Recursively scan for .onnx files
    scanModelsDir(modelsPath, modelsPath, voices);
  } catch (err) {
    console.error('[LOCAL-TTS] Voice discovery error:', err.message);
  }

  console.log('[LOCAL-TTS-DEBUG] discovered voice IDs:', voices.map(v => v.id));
  console.log('[LOCAL-TTS-DEBUG] discovered model paths:', voices.map(v => v.metadata?.modelPath));

  return voices;
}

function scanModelsDir(basePath, currentDir, results) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      scanModelsDir(basePath, fullPath, results);
    } else if (entry.name.endsWith('.onnx') && !entry.name.endsWith('.json')) {
      const configPath = fullPath + '.json';
      const voiceId = path.basename(fullPath, '.onnx');

      let metadata = {};
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, 'utf-8');
          metadata = JSON.parse(raw);
        } catch {
          // Metadata parse failure — still register the voice with defaults
        }
      }

      const langCode = metadata.language?.code_1 || metadata.language?.code_2 || '';
      const langName = metadata.language?.name_1 || metadata.language?.name_2 || langCode;
      const piperCode = langCode ? `${langCode}_${(metadata.language?.code_3 || '').toUpperCase()}` : '';

      const bcp47 = piperCode ? piperLangToBCP47(piperCode) : 'und';
      const languageGroup = piperCode ? piperLangToGroup(piperCode) : 'und';
      const displayName = metadata.language?.name_1 || path.basename(currentDir);
      const modelId = path.basename(fullPath, '.onnx');
      const gender = GENDER_CATALOG[modelId] || undefined;

      results.push({
        id: voiceId,
        name: `${displayName} (${path.basename(fullPath, '.onnx')})`,
        language: bcp47,
        languageGroup,
        ...(gender ? { gender } : {}),
        provider: 'local-piper',
        metadata: {
          modelPath: fullPath,
          sampleRate: metadata.sample_rate || 22050,
          dataset: metadata.dataset || '',
          piperCode,
          numSpeakers: metadata.num_speakers || 1,
          speakerIdMap: metadata.speaker_id_map || null,
          defaultSpeakerId:
            metadata.default_speaker_id !== undefined
              ? metadata.default_speaker_id
              : undefined,
        },
      });
    }
  }
}

// ── Worker Lifecycle ──
function ensureWorker() {
  if (workerProcess && !workerProcess.killed) {
    resetIdleTimer();
    return workerProcess;
  }

  if (isStarting) return null;
  isStarting = true;

  const workerPath = getWorkerScriptPath();
  if (!fs.existsSync(workerPath)) {
    isStarting = false;
    console.warn('[LOCAL-TTS] Worker script not found:', workerPath);
    return null;
  }

  try {
    workerProcess = spawn('python', [workerPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    workerProcess.on('error', (err) => {
      console.error('[LOCAL-TTS] Worker spawn error:', err.message);
      workerProcess = null;
      isStarting = false;
      rejectActiveRequest(new Error('Worker process failed to start'));
    });

    workerProcess.on('exit', (code, signal) => {
      console.log(`[LOCAL-TTS] Worker exited: code=${code} signal=${signal}`);
      workerProcess = null;
      isStarting = false;
      rejectActiveRequest(new Error('Worker process exited'));
    });

    // Read stderr for diagnostics
    workerProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log('[LOCAL-TTS-PIPE]', msg);
    });

    isStarting = false;
    resetIdleTimer();
    return workerProcess;
  } catch (err) {
    isStarting = false;
    console.error('[LOCAL-TTS] Failed to spawn worker:', err.message);
    return null;
  }
}

function killWorker() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  if (workerProcess && !workerProcess.killed) {
    try {
      // Send exit command first
      workerProcess.stdin.write(JSON.stringify({ exit: true }) + '\n');
      workerProcess.kill('SIGTERM');
      // Force kill after 2 seconds
      setTimeout(() => {
        if (workerProcess && !workerProcess.killed) {
          workerProcess.kill('SIGKILL');
        }
      }, 2000);
    } catch {
      // Process may already be dead
    }
  }
  workerProcess = null;
  rejectActiveRequest(new Error('Worker stopped'));
}

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('[LOCAL-TTS] Worker idle timeout, killing.');
    killWorker();
  }, WORKER_IDLE_TIMEOUT_MS);
}

function rejectActiveRequest(err) {
  if (activeRequest) {
    clearTimeout(activeRequest.timeout);
    activeRequest.reject(err);
    activeRequest = null;
  }
}

// ── Synthesis ──
function synthesize(request) {
  return new Promise((resolve, reject) => {
    // Only one request at a time (queue serializes, but enforce here too)
    if (activeRequest) {
      reject(new Error('Another synthesis is in progress'));
      return;
    }

    const proc = ensureWorker();
    if (!proc) {
      reject(new Error('Piper worker not available'));
      return;
    }

    // Timeout
    const timeout = setTimeout(() => {
      cleanup();
      killWorker(); // Kill and let next request respawn
      reject(new Error('Synthesis timed out'));
    }, SYNTHESIS_TIMEOUT_MS);

    activeRequest = { resolve, reject, timeout };

    // Accumulate stdout chunks — worker response may span multiple data events
    let responseBuffer = Buffer.alloc(0);
    let wavLength = -1;

    function cleanup() {
      proc.stdout.removeListener('data', onData);
      clearTimeout(timeout);
      activeRequest = null;
    }

    const onData = (chunk) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);

      // Wait for the 4-byte uint32 LE length header
      if (responseBuffer.length < 4) return;

      // Parse WAV length once from header
      if (wavLength === -1) {
        wavLength = responseBuffer.readUInt32LE(0);

        // Check if this is an error response (JSON)
        if (wavLength < 1000 && wavLength > 2) {
          // Need full payload to parse JSON
          if (responseBuffer.length >= 4 + wavLength) {
            const jsonStr = responseBuffer.slice(4, 4 + wavLength).toString('utf-8');
            try {
              const errResp = JSON.parse(jsonStr);
              if (errResp.error) {
                cleanup();
                reject(new Error(errResp.error));
                return;
              }
            } catch {
              // Not JSON — treat as WAV
            }
          }
        }
      }

      // Wait for complete payload
      const totalExpected = 4 + wavLength;
      if (responseBuffer.length < totalExpected) return;

      // Full response received — clean up and resolve
      cleanup();
      const wavData = responseBuffer.slice(4, 4 + wavLength);
      resolve(Buffer.from(wavData));
    };

    proc.stdout.on('data', onData);

    // Send request
    const jsonRequest = JSON.stringify({
      model: request.modelPath,
      text: request.text,
      rate: request.rate || 1.0,
      pitch: request.pitch || 1.0,
      speaker_id: request.speakerId,
    });

    try {
      proc.stdin.write(jsonRequest + '\n');
    } catch (err) {
      cleanup();
      reject(new Error('Failed to write to worker: ' + err.message));
    }

    resetIdleTimer();
  });
}

// ── Status ──
function getStatus() {
  const workerPath = getWorkerScriptPath();
  const workerExists = fs.existsSync(workerPath);
  const modelsPath = getModelsPath();
  const modelsExist = fs.existsSync(modelsPath);

  return {
    workerScriptAvailable: workerExists,
    modelsDirectoryAvailable: modelsExist,
    workerRunning: workerProcess !== null && !workerProcess.killed,
  };
}

// ── Setup Detection ──
let setupState = 'not-installed'; // not-installed | checking | installing | ready | error
let setupDetected = false;

function detectSetupState() {
  if (setupDetected) return;
  setupDetected = true;
  const workerPath = getWorkerScriptPath();
  if (!fs.existsSync(workerPath)) {
    setupState = 'not-installed';
    return;
  }
  try {
    const { execFileSync } = require('child_process');
    // Check Python
    const pyOut = execFileSync('python', ['--version'], { windowsHide: true, timeout: 5000 }).toString();
    if (!pyOut.includes('Python')) throw new Error('no python');
    // Check piper-tts import
    execFileSync('python', ['-c', 'from piper import PiperVoice'], { windowsHide: true, timeout: 5000 });
    setupState = 'ready';
  } catch {
    setupState = 'not-installed';
  }
}

function getSetupStatus() {
  detectSetupState();
  const workerPath = getWorkerScriptPath();
  const workerExists = fs.existsSync(workerPath);
  if (!workerExists) {
    return { state: 'not-installed', workerScriptAvailable: false };
  }
  return { state: setupState, workerScriptAvailable: workerExists };
}

function checkPythonAvailable() {
  return new Promise((resolve) => {
    execFile('python', ['--version'], { windowsHide: true }, (err, stdout) => {
      if (err) {
        // Try python3
        execFile('python3', ['--version'], { windowsHide: true }, (err2, stdout2) => {
          resolve(!err2 && stdout2.includes('Python'));
        });
      } else {
        resolve(stdout.includes('Python'));
      }
    });
  });
}

function checkPiperInstalled() {
  return new Promise((resolve) => {
    // Import-based check: verifies piper-tts is installed AND importable.
    // `python -m piper --version` is invalid — piper has no --version flag.
    execFile('python', ['-c', 'from piper import PiperVoice; print("ok")'], { windowsHide: true }, (err, stdout) => {
      if (err) {
        // Fallback to python3
        execFile('python3', ['-c', 'from piper import PiperVoice; print("ok")'], { windowsHide: true }, (err2, stdout2) => {
          resolve(!err2 && stdout2.includes('ok'));
        });
      } else {
        resolve(stdout.includes('ok'));
      }
    });
  });
}

async function performSetup() {
  setupState = 'checking';
  console.log('[LOCAL-TTS-SETUP] Starting setup...');

  // Step 1: Check Python
  const pythonAvailable = await checkPythonAvailable();
  if (!pythonAvailable) {
    setupState = 'error';
    console.error('[LOCAL-TTS-SETUP] Python not found');
    return { success: false, error: 'Python is not installed. Please install Python 3.9+ from python.org and try again.' };
  }
  console.log('[LOCAL-TTS-SETUP] Python available');

  // Step 2: Check if piper-tts is already installed
  const piperInstalled = await checkPiperInstalled();
  if (piperInstalled) {
    setupState = 'ready';
    console.log('[LOCAL-TTS-SETUP] piper-tts already installed');
    return { success: true };
  }

  // Step 3: Install piper-tts via pip
  setupState = 'installing';
  console.log('[LOCAL-TTS-SETUP] Installing piper-tts...');

  return new Promise((resolve) => {
    const pip = spawn('python', ['-m', 'pip', 'install', 'piper-tts', 'pyopenjtalk'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stderr = '';
    pip.stderr?.on('data', (data) => { stderr += data.toString(); });

    pip.on('error', (err) => {
      setupState = 'error';
      console.error('[LOCAL-TTS-SETUP] pip spawn error:', err.message);
      resolve({ success: false, error: `Failed to run pip: ${err.message}` });
    });

    pip.on('exit', (code) => {
      if (code === 0) {
        setupState = 'ready';
        console.log('[LOCAL-TTS-SETUP] piper-tts installed successfully');
        resolve({ success: true });
      } else {
        setupState = 'error';
        const msg = stderr.includes('Permission denied')
          ? 'Permission denied. Try running as administrator or use: pip install --user piper-tts'
          : `pip install failed (exit code ${code}). Ensure pip is available and try again.`;
        console.error('[LOCAL-TTS-SETUP] Install failed:', msg);
        resolve({ success: false, error: msg });
      }
    });
  });
}

// ── IPC Registration ──
function registerIPC() {
  ipcMain.handle('tts:get-data-path', () => getTTSDataPath());

  ipcMain.handle('tts:local-status', () => getStatus());

  ipcMain.handle('tts:local-voices', () => discoverVoices());

  ipcMain.handle('tts:local-synthesize', async (_, request) => {
    const wavBuffer = await synthesize(request);
    return wavBuffer; // Buffer is serialized as Uint8Array over IPC
  });

  ipcMain.handle('tts:local-stop', () => {
    killWorker();
    return { success: true };
  });

  // ── Setup IPC ──
  ipcMain.handle('tts:local-setup-status', () => getSetupStatus());

  ipcMain.handle('tts:local-setup', async () => {
    return performSetup();
  });

  // ── Model Management IPC ──
  ipcMain.handle('tts:local-check-installed', () => {
    const modelsPath = getModelsPath();
    const installed = [];
    if (!fs.existsSync(modelsPath)) return installed;

    try {
      const entries = fs.readdirSync(modelsPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const dirPath = path.join(modelsPath, entry.name);
          const onnxFiles = fs.readdirSync(dirPath).filter(f => f.endsWith('.onnx'));
          for (const onnx of onnxFiles) {
            const modelId = onnx.replace('.onnx', '');
            installed.push({ id: modelId, piperCode: entry.name });
          }
        }
      }
    } catch (err) {
      console.error('[LOCAL-TTS] Check installed error:', err.message);
    }
    return installed;
  });

  ipcMain.handle('tts:local-install-model', async (_, request) => {
    const { modelId, downloadUrl, configUrl, piperCode } = request;
    const modelsPath = getModelsPath();
    const targetDir = path.join(modelsPath, piperCode);

    try {
      // Create target directory
      fs.mkdirSync(targetDir, { recursive: true });

      const modelFileName = `${modelId}.onnx`;
      const configFileName = `${modelId}.onnx.json`;
      const tempModelPath = path.join(targetDir, `${modelFileName}.tmp`);
      const tempConfigPath = path.join(targetDir, `${configFileName}.tmp`);
      const finalModelPath = path.join(targetDir, modelFileName);
      const finalConfigPath = path.join(targetDir, configFileName);

      console.log(`[LOCAL-TTS-MODEL] Downloading ${modelId}...`);

      // Download model file
      await downloadFile(downloadUrl, tempModelPath);
      console.log(`[LOCAL-TTS-MODEL] Model downloaded: ${tempModelPath}`);

      // Download config file
      await downloadFile(configUrl, tempConfigPath);
      console.log(`[LOCAL-TTS-MODEL] Config downloaded: ${tempConfigPath}`);

      // Verify files exist and are non-empty
      const modelStat = fs.statSync(tempModelPath);
      if (modelStat.size === 0) {
        throw new Error('Downloaded model file is empty');
      }

      const configStat = fs.statSync(tempConfigPath);
      if (configStat.size === 0) {
        throw new Error('Downloaded config file is empty');
      }

      // Verify config is valid JSON
      const configContent = fs.readFileSync(tempConfigPath, 'utf-8');
      JSON.parse(configContent);

      // Atomic move: rename temp files to final names
      fs.renameSync(tempModelPath, finalModelPath);
      fs.renameSync(tempConfigPath, finalConfigPath);

      console.log(`[LOCAL-TTS-MODEL] Installed ${modelId} to ${targetDir}`);
      return { success: true };
    } catch (err) {
      // Cleanup temp files on failure
      try {
        const tempModelPath = path.join(targetDir, `${modelId}.onnx.tmp`);
        const tempConfigPath = path.join(targetDir, `${modelId}.onnx.json.tmp`);
        if (fs.existsSync(tempModelPath)) fs.unlinkSync(tempModelPath);
        if (fs.existsSync(tempConfigPath)) fs.unlinkSync(tempConfigPath);
      } catch { /* cleanup best-effort */ }

      const msg = err instanceof Error ? err.message : 'Download failed';
      console.error(`[LOCAL-TTS-MODEL] Install failed for ${modelId}:`, msg);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('tts:local-delete-model', async (_, request) => {
    const { piperCode, modelId } = request;
    const modelsPath = getModelsPath();
    const modelDir = path.join(modelsPath, piperCode);
    const modelFile = path.join(modelDir, `${modelId}.onnx`);
    const configFile = path.join(modelDir, `${modelId}.onnx.json`);

    try {
      if (fs.existsSync(modelFile)) fs.unlinkSync(modelFile);
      if (fs.existsSync(configFile)) fs.unlinkSync(configFile);

      // Remove directory if empty
      if (fs.existsSync(modelDir)) {
        const remaining = fs.readdirSync(modelDir);
        if (remaining.length === 0) {
          fs.rmdirSync(modelDir);
        }
      }

      console.log(`[LOCAL-TTS-MODEL] Deleted ${modelId}`);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      console.error(`[LOCAL-TTS-MODEL] Delete failed for ${modelId}:`, msg);
      return { success: false, error: msg };
    }
  });

  ipcMain.handle('tts:local-refresh-voices', () => {
    // Force re-discovery of voices by clearing any cache
    // The LocalTTSEngine will call getVoices() which re-scans the models directory
    console.log('[LOCAL-TTS-MODEL] Voice catalog refresh requested');
    return { success: true };
  });
}

// ── Download helper ──
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const http = require('http');
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, { headers: { 'User-Agent': 'RosaeFinity/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect — resolve relative Location against the current URL
        const redirectUrl = new URL(res.headers.location, url).href;
        downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }

      const file = fs.createWriteStream(destPath);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve();
      });

      file.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    });

    request.on('error', (err) => {
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      }
      reject(err);
    });

    request.setTimeout(120000, () => {
      request.destroy();
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch { /* ignore */ }
      }
      reject(new Error('Download timeout'));
    });
  });
}

// ── Cleanup ──
function cleanup() {
  killWorker();
}

module.exports = {
  registerIPC,
  cleanup,
  getTTSDataPath,
  getModelsPath,
  discoverVoices,
  getStatus,
};
