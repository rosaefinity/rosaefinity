// ─────────────────────────────────────────────────────
// RosaeFinity — Coin Jar Editor Page
// Left: settings panel. Right: live preview.
// Follows existing overlay editor navigation flow.
// ─────────────────────────────────────────────────────

import { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Target, Copy, CheckCircle2, RotateCcw, Save, Zap, ArrowLeft } from 'lucide-react';
import { useCoinJarStore } from '../store/coin-jar-store';
import { CoinJarProRenderer } from '../overlays/coin-jar-pro/CoinJarProRenderer';
import type { CoinJarProConfig } from '../overlays/coin-jar-pro/types';
import { toast } from '../components/Toast';
import { getOverlayWidgetUrl } from '../lib/browser-source-url';

export function CoinJarEditor() {
  const navigate = useNavigate();
  const { config, currentAmount, saveConfig, reset } = useCoinJarStore();

  // Local draft for editing (not persisted until Save)
  const [draftGoal, setDraftGoal] = useState(config.goalCoins);
  const [copied, setCopied] = useState(false);

  const browserSourceUrl = useMemo(() => {
    const base = getOverlayWidgetUrl().replace('overlay-widget.html', 'coin-jar.html');
    return base;
  }, []);

  const handleSave = useCallback(() => {
    if (draftGoal < 1) {
      toast('Goal must be at least 1', 'error');
      return;
    }
    const updated: CoinJarProConfig = { ...config, goalCoins: draftGoal };
    saveConfig(updated);
    toast('Coin Jar settings saved', 'success');
  }, [config, draftGoal, saveConfig]);

  const handleReset = useCallback(() => {
    reset();
    toast('Coin Jar reset to 0', 'success');
  }, [reset]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(browserSourceUrl);
      setCopied(true);
      toast('URL copied to clipboard', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('Failed to copy URL', 'error');
    }
  }, [browserSourceUrl]);

  const handleTestGift = useCallback(() => {
    const w = window as Record<string, unknown>;
    const testFn = w.__coinJarProTest as (() => void) | undefined;
    if (testFn) testFn();
  }, []);

  // Preview config uses the current config + any draft changes
  const previewConfig = useMemo<CoinJarProConfig>(
    () => ({ ...config, goalCoins: draftGoal }),
    [config, draftGoal],
  );

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header with back navigation */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/overlays')}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Overlays
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center">
              <Target className="w-4 h-4 text-green" />
            </div>
            <h1 className="text-lg font-bold text-white">Coin Jar Pro</h1>
          </div>
        </div>
      </motion.div>

      {/* Main layout: settings left, preview right */}
      <div className="flex gap-6" style={{ height: 'calc(100% - 60px)' }}>
        {/* ── LEFT: Settings Panel ── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="w-[340px] shrink-0 space-y-4"
        >
          {/* Settings */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-4">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Settings</p>

            <label className="block text-xs text-white/50 mb-1">Goal Amount (Coins)</label>
            <input
              type="number"
              min={1}
              value={draftGoal}
              onChange={(e) => setDraftGoal(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40 transition-colors"
            />

            <div className="mt-3 flex items-center justify-between px-1">
              <span className="text-xs text-white/40">Current Amount</span>
              <span className="text-sm font-semibold text-white/70 tabular-nums">
                {currentAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-4 space-y-3">
            <div className="flex gap-2">
              <button
                onClick={handleTestGift}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/20 border border-primary/30 text-primary-light text-xs font-semibold hover:bg-primary/30 transition-colors"
              >
                <Zap className="w-3.5 h-3.5" />
                Test Gift
              </button>
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs font-semibold hover:bg-white/[0.08] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
            <button
              onClick={handleSave}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Changes
            </button>
          </div>

          {/* Browser Source URL */}
          <div className="rounded-2xl border border-white/[0.06] bg-card p-4">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Browser Source</p>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3">
              <code className="text-[11px] text-white/60 break-all leading-relaxed font-mono">{browserSourceUrl}</code>
            </div>
            <button
              onClick={handleCopyUrl}
              className="w-full flex items-center justify-center gap-1.5 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-xs font-semibold hover:bg-white/[0.08] transition-colors"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-green" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </motion.div>

        {/* ── RIGHT: Live Preview ── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="flex-1 min-w-0 flex flex-col"
        >
          <div className="rounded-2xl border border-white/[0.06] bg-card p-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Live Preview</h3>
              <span className="text-[10px] text-white/30 uppercase tracking-wider">Real Renderer</span>
            </div>
            <div className="flex-1 flex items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-card to-[#0a0a12] overflow-hidden min-h-[300px]">
              <div className="w-full h-full">
                <CoinJarProRenderer
                  config={previewConfig}
                  mode="preview"
                  initialTotalCoins={currentAmount}
                  size={{ width: 500, height: 500 }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default CoinJarEditor;
