import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOverlayModule } from '../overlays/registry';
import { useOverlayStore } from '../lib/overlay-store';
import { SchemaSettings } from '../components/SchemaSettings';
import { cn } from '../lib/utils';
import { getBrowserSourceUrl } from '../lib/browser-source-url';
import {
  ArrowLeft, Copy, Check, ExternalLink, FlaskConical,
} from 'lucide-react';

export function CustomizePage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const [copiedUrl, setCopiedUrl] = useState(false);

  const instances = useOverlayStore((s) => s.instances);
  const instance = useOverlayStore((s) =>
    s.instances.find((i) => i.id === instanceId)
  );
  const updateConfig = useOverlayStore((s) => s.updateConfig);

  const mod = instance ? getOverlayModule(instance.moduleId) : undefined;

  const handleConfigChange = useCallback(
    (key: string, value: unknown) => {
      if (instance) {
        updateConfig(instance.id, { ...instance.config, [key]: value });
      }
    },
    [instance, updateConfig]
  );

  const browserSourceUrl = instance ? getBrowserSourceUrl(instance.browserSourceId) : '';

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(browserSourceUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  if (!instance || !mod) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/40">Overlay not found.</p>
      </div>
    );
  }

  const Renderer = mod.renderer;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <button
            onClick={() => navigate('/overlays')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors mb-3"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Gallery
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <mod.metadata.icon className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{instance.name}</h1>
              <p className="text-xs text-white/40 capitalize">{mod.metadata.category} overlay</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Preview Panel */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="space-y-4"
            >
              {/* Preview Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Preview</h2>
                <div className="flex gap-1">
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                    title="Open in Browser Source"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                    title="Test Overlay"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Box */}
              <div className="relative aspect-video rounded-xl border border-white/[0.08] bg-[#050505] overflow-hidden">
                <Renderer
                  key={instance.id}
                  config={instance.config}
                  mode="preview"
                />
              </div>

              {/* Browser Source URL */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-white/40 uppercase tracking-wider">Browser Source URL</span>
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-all
                      bg-primary/20 text-primary-light border border-primary/30 hover:bg-primary/30"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedUrl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <code className="text-xs text-white/30 break-all font-mono bg-black/30 px-2 py-1.5 rounded">
                  {browserSourceUrl}
                </code>
              </div>
            </motion.div>
          </div>

          {/* Settings Panel */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-sm font-semibold text-white mb-4">Settings</h2>
              <SchemaSettings
                schema={mod.settingsSchema}
                values={instance.config}
                onChange={handleConfigChange}
              />
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CustomizePage;
