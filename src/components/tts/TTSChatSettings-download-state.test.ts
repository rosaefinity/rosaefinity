// =============================================
// TTSChatSettings Download State Tests
// Verifies downloadingModel state reset behavior
// including catalog refresh timeout handling.
// =============================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Core timeout + state-reset logic extracted for unit testing ──
// Uses a configurable timeoutMs parameter to allow fast tests with fake timers.

async function handleDownload(opts: {
  downloadModel: () => Promise<{ success: boolean; error?: string }>;
  getModelCatalog: () => Promise<unknown[]>;
  refreshEngineData: () => void;
  setModelCatalog: (catalog: unknown[]) => void;
  setDownloadingModel: (id: string | null) => void;
  downloadingModel: string | null;
  modelId: string;
  timeoutMs?: number;
}): Promise<void> {
  if (opts.downloadingModel) return;
  opts.setDownloadingModel(opts.modelId);
  try {
    const result = await opts.downloadModel();
    if (result.success) {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const updated = await Promise.race([
          opts.getModelCatalog(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Catalog refresh timeout')), opts.timeoutMs ?? 10_000);
          }),
        ]);
        opts.setModelCatalog(updated);
      } catch (refreshErr) {
        console.warn('[TTS-Settings] Catalog refresh failed/timed out:', refreshErr);
      } finally {
        if (timer) clearTimeout(timer);
      }
      opts.refreshEngineData();
    }
  } catch (err) {
    console.error('[TTS-Settings] Model download failed:', err);
  } finally {
    opts.setDownloadingModel(null);
  }
}

describe('handleDownloadModel state-reset logic', () => {
  let setDownloadingModel: ReturnType<typeof vi.fn>;
  let setModelCatalog: ReturnType<typeof vi.fn>;
  let refreshEngineData: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setDownloadingModel = vi.fn();
    setModelCatalog = vi.fn();
    refreshEngineData = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Test 1: Successful download + successful catalog refresh
  it('should update catalog and reset downloadingModel on success', async () => {
    const mockCatalog = [{ id: 'en_US-hfc_male-medium', installed: true }];
    const downloadModel = vi.fn(async () => ({ success: true }));
    const getModelCatalog = vi.fn(async () => mockCatalog);

    await handleDownload({
      downloadModel,
      getModelCatalog,
      refreshEngineData,
      setModelCatalog,
      setDownloadingModel,
      downloadingModel: null,
      modelId: 'en_US-hfc_male-medium',
    });

    expect(downloadModel).toHaveBeenCalledTimes(1);
    expect(getModelCatalog).toHaveBeenCalledTimes(1);
    expect(setModelCatalog).toHaveBeenCalledWith(mockCatalog);
    expect(refreshEngineData).toHaveBeenCalledTimes(1);
    // State must be reset
    expect(setDownloadingModel).toHaveBeenCalledWith('en_US-hfc_male-medium');
    expect(setDownloadingModel).toHaveBeenCalledWith(null);
    expect(setDownloadingModel).toHaveBeenCalledTimes(2);
  });

  // Test 2: Successful download + catalog refresh timeout
  it('should reset downloadingModel even when catalog refresh times out', async () => {
    vi.useFakeTimers();
    const downloadModel = vi.fn(async () => ({ success: true }));
    const getModelCatalog = vi.fn(() => new Promise<never>(() => {})); // hangs forever

    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const downloadPromise = handleDownload({
      downloadModel,
      getModelCatalog,
      refreshEngineData,
      setModelCatalog,
      setDownloadingModel,
      downloadingModel: null,
      modelId: 'en_US-hfc_male-medium',
      timeoutMs: 100, // short timeout for testing
    });

    // Advance past the timeout
    await vi.advanceTimersByTimeAsync(150);
    await downloadPromise;

    expect(downloadModel).toHaveBeenCalledTimes(1);
    // Catalog should NOT have been updated (timeout)
    expect(setModelCatalog).not.toHaveBeenCalled();
    // downloadModel succeeded so refreshEngineData should still be called
    expect(refreshEngineData).toHaveBeenCalledTimes(1);
    // State MUST be reset to null
    expect(setDownloadingModel).toHaveBeenCalledWith(null);
    expect(consoleWarn).toHaveBeenCalledWith(
      expect.stringContaining('Catalog refresh failed/timed out'),
      expect.any(Error),
    );
    vi.useRealTimers();
  });

  // Test 3: Failed download → state resets to null
  it('should reset downloadingModel when download fails', async () => {
    const downloadModel = vi.fn(async () => { throw new Error('HTTP 500'); });
    const getModelCatalog = vi.fn(async () => []);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    await handleDownload({
      downloadModel,
      getModelCatalog,
      refreshEngineData,
      setModelCatalog,
      setDownloadingModel,
      downloadingModel: null,
      modelId: 'en_US-hfc_male-medium',
    });

    expect(downloadModel).toHaveBeenCalledTimes(1);
    // Catalog should NOT be touched on download failure
    expect(getModelCatalog).not.toHaveBeenCalled();
    expect(setModelCatalog).not.toHaveBeenCalled();
    expect(refreshEngineData).not.toHaveBeenCalled();
    // State MUST be reset to null
    expect(setDownloadingModel).toHaveBeenCalledWith(null);
    expect(consoleError).toHaveBeenCalled();
  });

  // Test 4: Subsequent download is possible after catalog refresh timeout
  it('should allow subsequent downloads after a timed-out catalog refresh', async () => {
    vi.useFakeTimers();
    const downloadModel = vi.fn(async () => ({ success: true }));
    let callCount = 0;
    const getModelCatalog = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        // First call hangs forever (simulating stuck IPC)
        return new Promise<never>(() => {});
      }
      // Second call succeeds
      return [{ id: 'en_US-hfc_male-medium', installed: true }];
    });

    // First download (will timeout on catalog refresh)
    const firstPromise = handleDownload({
      downloadModel,
      getModelCatalog,
      refreshEngineData,
      setModelCatalog,
      setDownloadingModel,
      downloadingModel: null,
      modelId: 'en_US-hfc_male-medium',
      timeoutMs: 100,
    });

    await vi.advanceTimersByTimeAsync(150);
    await firstPromise;

    // State was reset after timeout
    expect(setDownloadingModel).toHaveBeenCalledWith(null);

    // Simulate: downloadingModel is now null, second download is possible
    const setDownloadingModel2 = vi.fn();
    const setModelCatalog2 = vi.fn();

    await handleDownload({
      downloadModel,
      getModelCatalog,
      refreshEngineData,
      setModelCatalog: setModelCatalog2,
      setDownloadingModel: setDownloadingModel2,
      downloadingModel: null, // state was reset
      modelId: 'en_US-hfc_male-medium',
    });

    // Second download should succeed and update catalog
    expect(downloadModel).toHaveBeenCalledTimes(2);
    expect(setModelCatalog2).toHaveBeenCalledWith([{ id: 'en_US-hfc_male-medium', installed: true }]);
    expect(setDownloadingModel2).toHaveBeenCalledWith(null);
    vi.useRealTimers();
  });

  // Test 5: Guard blocks double-click
  it('should not proceed if downloadingModel is already set', async () => {
    const downloadModel = vi.fn(async () => ({ success: true }));

    await handleDownload({
      downloadModel,
      getModelCatalog: vi.fn(async () => []),
      refreshEngineData,
      setModelCatalog,
      setDownloadingModel,
      downloadingModel: 'some-other-model', // already downloading
      modelId: 'en_US-hfc_male-medium',
    });

    expect(downloadModel).not.toHaveBeenCalled();
    expect(setDownloadingModel).not.toHaveBeenCalled();
  });
});
