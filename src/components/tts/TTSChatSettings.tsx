// =============================================
// RosaeFinity TTS Chat Settings — Simplified UI
// Uses provider-neutral TTSEngine abstraction.
// =============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { getTTSService, getCurrentProfileTTSSettings, applyCurrentProfileTTSSettings, testTTSSpeak } from '../../services/tts';
import { getAvailableFilterModes } from '../../services/tts/tts-filters';
import type { TTSVoiceInfo } from '../../types/tts';
import type { LocalTTSModelInfo } from '../../services/tts/engines/local-tts-model-manager';
import { getModelCatalog, downloadModel } from '../../services/tts/engines/local-tts-model-manager';
import * as Select from '@radix-ui/react-select';
import { Button } from '../ui/button';
import {
  Volume2, Mic, MicOff, Languages, Download, Loader2, CheckCircle,
  ChevronDown, ChevronRight, Check,
} from 'lucide-react';

// ── Main Component ───────────────────────────────────────────

export function TTSChatSettings() {
  const currentProfileId = useAppStore(state => state.currentProfileId);
  const profiles = useAppStore(state => state.streamProfiles);
  const updateProfile = useAppStore(state => state.updateProfile);

  // ── Form state ──
  const [settings, setSettings] = useState(getCurrentProfileTTSSettings());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);

  // ── Voice data from engine ──
  const [engineVoices, setEngineVoices] = useState<TTSVoiceInfo[]>([]);

  // ── Piper model catalog ──
  const [modelCatalog, setModelCatalog] = useState<LocalTTSModelInfo[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);

  // ── Test voice state ──
  const [testText, setTestText] = useState('Halo, ini adalah tes suara TTS.');
  const [testError, setTestError] = useState<string | null>(null);

  // ── Advanced section ──
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── Helpers ──
  const currentProfile = profiles.find(p => p.id === currentProfileId);
  const filterModes = getAvailableFilterModes();

  // ── Mount: load Piper model catalog ──
  useEffect(() => {
    getModelCatalog().then(setModelCatalog);
  }, []);

  // ── Refresh engine voice/language data ──
  const refreshEngineData = useCallback(() => {
    const service = getTTSService();
    const engine = service.getEngine();
    if (!engine) return;
    setEngineVoices(engine.getVoices());
    // Also refresh model catalog so installed flags update after download
    getModelCatalog().then(setModelCatalog);
  }, []);

  useEffect(() => {
    refreshEngineData();

    const cleanupFns: (() => void)[] = [];

    // Piper + general: refresh when TTSService finishes init or engine switch
    const handleVoicesReady = () => refreshEngineData();
    window.addEventListener('rosae:tts-voices-ready', handleVoicesReady);
    cleanupFns.push(() => window.removeEventListener('rosae:tts-voices-ready', handleVoicesReady));

    return () => cleanupFns.forEach(fn => fn());
  }, [refreshEngineData]);

  // ── Sync settings when profile changes ──
  useEffect(() => {
    setSettings(getCurrentProfileTTSSettings());
    setSaved(false);
  }, [currentProfileId]);

  // ── Grouped voices for the combined dropdown ──
  // For Piper: use MODEL_CATALOG so ALL supported voices appear (installed or not)
  const groupedVoices = useMemo(() => {
    const groups: { lang: string; langName: string; voices: { id: string; name: string; language: string; gender?: string; installed?: boolean }[] }[] = [];
    const seen = new Set<string>();

    // Use MODEL_CATALOG — shows all 12 supported voices regardless of install status
    for (const model of modelCatalog) {
      const key = model.languageCode;
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ lang: model.languageCode, langName: model.language, voices: [] });
      }
      groups.find(g => g.lang === model.languageCode)!.voices.push({
        id: model.id,
        name: model.name,
        language: model.languageCode,
        gender: model.gender,
        installed: model.installed,
      });
    }

    // Sort: Indonesian first, then alphabetical
    groups.sort((a, b) => {
      if (a.lang.startsWith('id')) return -1;
      if (b.lang.startsWith('id')) return 1;
      return a.langName.localeCompare(b.langName);
    });

    return groups;
  }, [modelCatalog]);

  // ── Is the currently-selected voice installed (for Piper)? ──
  const selectedVoiceInstalled = useMemo(() => {
    if (!settings.voice) return true; // auto
    // Check against model catalog (includes installed flag)
    const catalogMatch = modelCatalog.find(m => m.id === settings.voice);
    if (catalogMatch) return catalogMatch.installed;
    // Fallback: check against engine voices (filesystem-installed)
    return engineVoices.some(v => v.id === settings.voice);
  }, [settings.voice, modelCatalog, engineVoices]);

  // ── Multi-speaker model detection and speaker info ──
  const selectedVoiceSpeakerMap = useMemo(() => {
    if (!settings.voice || !selectedVoiceInstalled) return null;
    // Get speaker info from engine voices metadata
    const engineVoice = engineVoices.find(v => v.id === settings.voice);
    if (!engineVoice?.metadata) return null;
    const meta = engineVoice.metadata as Record<string, unknown>;
    const numSpeakers = meta.numSpeakers as number | undefined;
    const speakerIdMap = meta.speakerIdMap as Record<string, number> | undefined;
    const defaultSpeakerId = meta.defaultSpeakerId as number | undefined;
    if (!numSpeakers || numSpeakers <= 1 || !speakerIdMap) return null;
    return { numSpeakers, speakerIdMap, defaultSpeakerId };
  }, [settings.voice, selectedVoiceInstalled, engineVoices]);

  // ── Current speaker selection (persisted in settings) ──
  const currentSpeakerId = settings.speakerId;
  const isMultiSpeaker = selectedVoiceSpeakerMap !== null;

  // ── Model info for the selected voice (for Piper download prompt) ──
  const selectedVoiceModel = useMemo(() => {
    if (!settings.voice || selectedVoiceInstalled) return null;
    // Match by voice ID substring to a catalog entry
    return modelCatalog.find(m => settings.voice.includes(m.id)) || null;
  }, [settings.voice, selectedVoiceInstalled, modelCatalog]);

  // ── Handlers ──
  const handleChange = useCallback((key: string, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!currentProfileId) return;
    try {
      const payload = { ...settings };
      await updateProfile(currentProfileId, { ttsSettings: payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      applyCurrentProfileTTSSettings();
    } catch (err) {
      console.error('[TTS-Settings] Save failed:', err);
    }
  }, [currentProfileId, settings, updateProfile]);

  const handleTestSpeak = useCallback(async () => {
    if (testing || !testText.trim()) return;
    setTesting(true);
    setTestError(null);
    try {
      await testTTSSpeak(testText, settings);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Gagal memutar suara');
    } finally {
      setTesting(false);
    }
  }, [testing, testText, settings]);

  const handleTestStop = useCallback(() => {
    getTTSService().stop();
    setTesting(false);
  }, []);

  const handleDownloadVoice = useCallback(async () => {
    if (!selectedVoiceModel || downloadingModel) return;
    setDownloadingModel(selectedVoiceModel.id);
    try {
      const result = await downloadModel(selectedVoiceModel);
      if (result.success) {
        let timer: ReturnType<typeof setTimeout> | null = null;
        try {
          const updated = await Promise.race([
            getModelCatalog(),
            new Promise<never>((_, reject) => {
              timer = setTimeout(() => reject(new Error('Catalog refresh timeout')), 10_000);
            }),
          ]);
          setModelCatalog(updated);
        } catch {
          // Catalog refresh failed/timed out — non-critical
        } finally {
          if (timer) clearTimeout(timer);
        }

        // Invalidate LocalTTSEngine voice cache so newly installed model is discovered
        const service = getTTSService();
        const engine = service.getEngine();
        if (engine?.name === 'local-piper' && 'invalidateVoiceCache' in engine) {
          (engine as { invalidateVoiceCache: () => void }).invalidateVoiceCache();
        }

        refreshEngineData();
      } else {
        const message = result.error || 'Unknown download error';
        setTestError(`Gagal mengunduh model: ${message}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[TTS-Settings] Model download failed:', err);
      setTestError(`Gagal mengunduh model: ${message}`);
    } finally {
      setDownloadingModel(null);
    }
  }, [selectedVoiceModel, downloadingModel, refreshEngineData]);

  // ── RENDER ──

  return (
    <div className="space-y-5">

      {/* ── Profile Context ── */}
      <div className="flex items-center gap-2 text-sm text-white/50">
        <Languages className="w-4 h-4" />
        <span>Profil: <strong className="text-white">{currentProfile?.name || 'Default'}</strong></span>
        {saved && (
          <span className="text-green text-xs flex items-center gap-1 ml-2">
            <CheckCircle className="w-3 h-3" /> Tersimpan
          </span>
        )}
      </div>

      {/* ── Main Settings Card ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-6">

        {/* ── TTS Enable Toggle ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Volume2 className="w-5 h-5 text-accent" />
            <span className="text-white font-semibold">TTS Chat</span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => handleChange('enabled', !settings.enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              settings.enabled ? 'bg-primary' : 'bg-white/15'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ${
                settings.enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* ── Voice Selector (Radix Select — dark themed) ── */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">Suara</label>
          <Select.Root value={settings.voice || '__auto__'} onValueChange={(v) => handleChange('voice', v === '__auto__' ? '' : v)}>
            <Select.Trigger
              className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors data-[state=open]:border-primary/40"
              aria-label="Pilih suara"
            >
              <Select.Value placeholder="Otomatis (berdasarkan bahasa)" />
              <Select.Icon>
                <ChevronDown className="w-4 h-4 text-white/40" />
              </Select.Icon>
            </Select.Trigger>

            <Select.Portal>
              <Select.Content
                className="z-[9999] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl max-h-80"
                position="popper"
                sideOffset={4}
              >
                <Select.ScrollUpButton className="flex items-center justify-center h-6 text-white/40">
                  <ChevronDown className="w-3 h-3 rotate-180" />
                </Select.ScrollUpButton>
                <Select.Viewport className="p-1.5">
                  <Select.Item
                    value="__auto__"
                    className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 outline-none cursor-pointer select-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:text-white"
                  >
                    <Select.ItemText>Otomatis (berdasarkan bahasa)</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </Select.ItemIndicator>
                  </Select.Item>

                  {groupedVoices.length === 0 && (
                    <Select.Item value="__loading__" disabled className="relative flex items-center px-3 py-2 text-sm text-white/30 outline-none">
                      <Select.ItemText>Memuat suara...</Select.ItemText>
                    </Select.Item>
                  )}

                  {groupedVoices.map(group => (
                    <Select.Group key={group.lang}>
                      <Select.Label className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        {group.langName}
                      </Select.Label>
                      {group.voices.map(v => (
                        <Select.Item
                          key={v.id}
                          value={v.id}
                          className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 outline-none cursor-pointer select-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:text-white"
                        >
                          <Select.ItemText>
                            {v.name}{v.gender === 'female' ? ' ♀' : v.gender === 'male' ? ' ♂' : ''}
                          </Select.ItemText>
                          <Select.ItemIndicator className="ml-auto">
                            <Check className="w-3.5 h-3.5 text-primary" />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Group>
                  ))}
                </Select.Viewport>
                <Select.ScrollDownButton className="flex items-center justify-center h-6 text-white/40">
                  <ChevronDown className="w-3 h-3" />
                </Select.ScrollDownButton>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* ── Voice not installed prompt (Piper only) ── */}
        {!selectedVoiceInstalled && settings.voice && (
          <div className="p-3 rounded-xl bg-yellow/5 border border-yellow/20 space-y-2">
            <p className="text-sm text-yellow/80">Suara ini belum tersedia di perangkat Anda.</p>
            <Button
              onClick={handleDownloadVoice}
              disabled={!!downloadingModel}
              size="sm"
              className="gap-2"
            >
              {downloadingModel ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Mengunduh...</>
              ) : (
                <><Download className="w-3.5 h-3.5" /> Download Suara</>
              )}
            </Button>
          </div>
        )}

        {/* ── Multi-speaker voice selector (Piper only) ── */}
        {isMultiSpeaker && selectedVoiceInstalled && (
          <div className="space-y-3">
            <label className="block text-xs font-medium text-white/60 mb-1.5">Speaker</label>
            <Select.Root value={currentSpeakerId ?? (selectedVoiceSpeakerMap?.defaultSpeakerId ?? 0)} onValueChange={v => handleChange('speakerId', v)}>
              <Select.Trigger
                className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors data-[state=open]:border-primary/40"
                aria-label="Pilih speaker"
              >
                <Select.Value placeholder="Pilih speaker" />
                <Select.Icon>
                  <ChevronDown className="w-4 h-4 text-white/40" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="z-[9999] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl"
                  position="popper"
                  sideOffset={4}
                >
                  <Select.Viewport className="p-1.5">
                    {Object.entries(selectedVoiceSpeakerMap!.speakerIdMap!).map(([name, id]) => (
                      <Select.Item
                        key={String(id)}
                        value={id}
                        className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 outline-none cursor-pointer select-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:text-white"
                      >
                        <Select.ItemText>
                          {name === 'female' ? 'Female ♀' : name === 'male' ? 'Male ♂' : name}
                        </Select.ItemText>
                        <Select.ItemIndicator className="ml-auto">
                          <Check className="w-3.5 h-3.5 text-primary" />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        )}

        {/* ── Speed ── */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">
            Kecepatan
            <span className="ml-2 font-mono text-white">{settings.defaultSpeed.toFixed(1)}x</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={settings.defaultSpeed}
            onChange={e => handleChange('defaultSpeed', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* ── Volume ── */}
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1.5">
            Volume
            <span className="ml-2 font-mono text-white">{Math.round(settings.volume * 100)}%</span>
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={settings.volume}
            onChange={e => handleChange('volume', parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        {/* ── Test Voice ── */}
        <div className="pt-2 border-t border-white/10 space-y-3">
          <label className="block text-xs font-medium text-white/60">Uji Suara</label>
          <textarea
            value={testText}
            onChange={e => setTestText(e.target.value)}
            rows={2}
            placeholder="Ketik teks untuk diuji..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/40 resize-none"
            disabled={testing}
          />
          <div className="flex items-center gap-2">
            <Button
              onClick={testing ? handleTestStop : handleTestSpeak}
              disabled={!testing && (!testText.trim() || (!selectedVoiceInstalled && settings.voice))}
              variant={testing ? 'ghost' : 'default'}
              size="sm"
              className={testing ? 'text-red hover:bg-red/10' : 'gap-2'}
            >
              {testing ? (
                <><MicOff className="w-3.5 h-3.5 mr-1" /> Hentikan</>
              ) : (
                <><Mic className="w-3.5 h-3.5 mr-1" /> Uji Suara</>
              )}
            </Button>
            {!selectedVoiceInstalled && settings.voice && !testing && (
              <span className="text-xs text-yellow/80 whitespace-nowrap">Suara belum terpasang — unduh dulu</span>
            )}
          </div>
          {testError && (
            <p className="text-xs text-red/80 bg-red/10 border border-red/20 rounded-lg p-2">{testError}</p>
          )}
        </div>
      </section>

      {/* ── Comment Filter ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Mic className="w-5 h-5 text-accent" />
          <h3 className="text-base font-semibold text-white">Filter Komentar</h3>
        </div>
        <p className="text-xs text-white/40">
          Pilih jenis komentar yang akan dibaca oleh TTS.
        </p>

        <Select.Root value={settings.filterMode} onValueChange={(v) => handleChange('filterMode', v)}>
          <Select.Trigger
            className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-primary/40 transition-colors data-[state=open]:border-primary/40"
            aria-label="Filter komentar"
          >
            <Select.Value />
            <Select.Icon>
              <ChevronDown className="w-4 h-4 text-white/40" />
            </Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content
              className="z-[9999] overflow-hidden rounded-xl border border-white/10 bg-[#1a1a24] shadow-2xl"
              position="popper"
              sideOffset={4}
            >
              <Select.Viewport className="p-1.5">
                {filterModes.map(m => (
                  <Select.Item
                    key={m.value}
                    value={m.value}
                    className="relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/70 outline-none cursor-pointer select-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:text-white"
                  >
                    <Select.ItemText>{m.label}</Select.ItemText>
                    <Select.ItemIndicator className="ml-auto">
                      <Check className="w-3.5 h-3.5 text-primary" />
                    </Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {/* Command prefix — only when command mode is active */}
        {settings.filterMode === 'command' && (
          <div className="pt-2 border-t border-white/10">
            <label className="block text-xs font-medium text-white/60 mb-1">Awalan Perintah</label>
            <input
              type="text"
              value={settings.commandPrefix}
              onChange={e => handleChange('commandPrefix', e.target.value)}
              placeholder="!"
              maxLength={5}
              className="w-full max-w-[120px] bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/40 font-mono"
            />
            <p className="text-xs text-white/30 mt-1">
              Contoh: &quot;{settings.commandPrefix}halo&quot;
            </p>
          </div>
        )}
      </section>

      {/* ── Advanced (collapsible) ── */}
      <section className="rounded-2xl border border-white/10 bg-white/5">
        <button
          type="button"
          onClick={() => setAdvancedOpen(prev => !prev)}
          className="w-full flex items-center justify-between px-6 py-4 text-sm text-white/60 hover:text-white/80 transition-colors"
        >
          <span className="font-medium">Pengaturan Lanjutan</span>
          {advancedOpen
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />
          }
        </button>

        {advancedOpen && (
          <div className="px-6 pb-6 space-y-5 border-t border-white/10 pt-4">
            {/* Random Voice */}
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.randomVoice}
                onChange={e => handleChange('randomVoice', e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-white/5 accent-primary"
              />
              <span className="text-sm text-white/70">Suara Acak</span>
            </label>

            {/* Max Text Length */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Maks. Panjang Teks
                <span className="ml-2 font-mono text-white">{settings.maxTextLength}</span>
              </label>
              <input
                type="range"
                min="50"
                max="500"
                step="10"
                value={settings.maxTextLength}
                onChange={e => handleChange('maxTextLength', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>

            {/* Min Interval */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Min. Interval
                <span className="ml-2 font-mono text-white">{settings.minIntervalMs} ms</span>
              </label>
              <input
                type="range"
                min="0"
                max="2000"
                step="100"
                value={settings.minIntervalMs}
                onChange={e => handleChange('minIntervalMs', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>

            {/* Max Queue Length */}
            <div>
              <label className="block text-xs font-medium text-white/60 mb-1.5">
                Maks. Antrian
                <span className="ml-2 font-mono text-white">{settings.maxQueueLength}</span>
              </label>
              <input
                type="range"
                min="10"
                max="200"
                step="10"
                value={settings.maxQueueLength}
                onChange={e => handleChange('maxQueueLength', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Save Button ── */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-white/30">
          Perubahan berlaku setelah disimpan.
        </p>
        <Button onClick={handleSave} className="gap-2" size="lg">
          {saved ? (
            <><CheckCircle className="w-4 h-4" /> Tersimpan</>
          ) : (
            'Simpan Pengaturan'
          )}
        </Button>
      </div>
    </div>
  );
}

export default TTSChatSettings;
