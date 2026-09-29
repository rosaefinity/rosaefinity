// =============================================
// RosaeFinity Voice Tester Component
// Uses provider-neutral TTSEngine abstraction.
// =============================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../../store/app-store';
import { testTTSSpeak, getTTSService, getCurrentProfileTTSSettings } from '../../services/tts';
import type { TTSVoiceInfo } from '../../types/tts';
import { Button } from '../ui/button';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';

export function VoiceTester() {
  const [text, setText] = useState('Halo, ini adalah tes suara TTS.');
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [engineVoices, setEngineVoices] = useState<TTSVoiceInfo[]>([]);

  const currentProfileId = useAppStore(state => state.currentProfileId);

  const settings = getCurrentProfileTTSSettings();
  console.log('[VOICE-DEBUG] VoiceTester settings.voice:', settings.voice, 'engine:', settings.engine);

  // Load voices from the active TTSEngine
  useEffect(() => {
    const service = getTTSService();
    const engine = service.getEngine();
    if (!engine) return;

    const refresh = () => {
      setEngineVoices(engine.getVoices());
    };

    refresh();

    // For WebSpeechEngine, listen for voiceschanged to refresh when system voices load
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      const handler = () => refresh();
      window.speechSynthesis.addEventListener('voiceschanged', handler);
      return () => {
        window.speechSynthesis.removeEventListener('voiceschanged', handler);
      };
    }
  }, [currentProfileId]);

  // Voices filtered by the current profile's language
  const filteredVoices = useMemo(() => {
    if (!settings.language) return engineVoices;
    const langPrefix = settings.language.split('-')[0].toLowerCase();
    return engineVoices.filter(v => v.language.toLowerCase().startsWith(langPrefix));
  }, [engineVoices, settings.language]);

  const handleTestSpeak = useCallback(async () => {
    if (!text.trim()) {
      setError('Masukkan teks untuk diuji');
      return;
    }

    setIsPlaying(true);
    setError(null);

    try {
      await testTTSSpeak(text);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal memutar suara';
      setError(message);
      console.error('[VoiceTester] Test speak failed:', err);
    } finally {
      setIsPlaying(false);
    }
  }, [text]);

  const handleStop = useCallback(() => {
    const service = getTTSService();
    service.stop();
    setIsPlaying(false);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Volume2 className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-semibold text-white">Voice Tester</h3>
      </div>

      <p className="text-sm text-white/50">
        Uji pengaturan suara dengan teks kustom. Teks ini tidak masuk ke antrian komentar.
      </p>

      {/* Voice selection preview */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Bahasa</label>
            <select
              value={settings.language}
              onChange={() => {}} // Read-only in tester, change in settings
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
              disabled
            >
              {filteredVoices.length > 0 ? (
                <option value={settings.language}>{settings.language}</option>
              ) : (
                <option value={settings.language}>{settings.language}</option>
              )}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-white/60 mb-1">Suara (Preview)</label>
            <select
              value={settings.voice}
              onChange={() => {}} // Read-only in tester
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
              disabled
            >
              <option value="">Otomatis</option>
              {filteredVoices.length === 0 ? (
                <option value="" disabled>Memuat suara...</option>
              ) : filteredVoices.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.language}){v.gender === 'female' ? ' ♀' : v.gender === 'male' ? ' ♂' : ''}
                </option>
              ))}
              {filteredVoices.length === 0 && <option value="" disabled>Tidak ada suara tersedia</option>}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Teks Uji Coba</label>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Ketik teks untuk diuji..."
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/40 resize-none"
            disabled={isPlaying}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleTestSpeak}
            disabled={isPlaying || !text.trim()}
            className="flex-1"
            size="lg"
          >
            {isPlaying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Memutar...
              </>
            ) : (
              <>
                <Mic className="w-4 h-4 mr-2" />
                Putar
              </>
            )}
          </Button>

          {isPlaying && (
            <Button
              onClick={handleStop}
              variant="ghost"
              size="lg"
              className="text-red hover:bg-red/10"
            >
              <MicOff className="w-4 h-4 mr-2" />
              Hentikan
            </Button>
          )}
        </div>

        {error && (
          <div className="text-sm text-red/80 bg-red/10 border border-red/20 rounded-lg p-3">
            {error}
          </div>
        )}

        <div className="text-xs text-white/40 pt-2 border-t border-white/10">
          <p>Pengaturan: Kecepatan {settings.defaultSpeed}x · Pitch {settings.defaultPitch} · Volume {Math.round(settings.volume * 100)}%</p>
          <p className="mt-1">Mode Filter: {settings.filterMode === 'any' ? 'Semua Komentar' : settings.filterMode === 'dot' ? 'Awali dengan "."' : settings.filterMode === 'slash' ? 'Awali dengan "/"' : `Perintah (${settings.commandPrefix})`}</p>
        </div>
      </div>
    </div>
  );
}

export default VoiceTester;
