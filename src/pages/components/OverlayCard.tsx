import { memo, useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import type { AnyOverlayModule, OverlayInstance } from '../../overlays/types';
import { getBrowserSourceUrlForModule } from '../../lib/browser-source-url';
import { emitTestEvent } from '../../events/EventDispatcher';
import { useOverlayStore } from '../../lib/overlay-store';
import { createOverlayConfig } from '../../overlays/createConfig';
import { OverlayPreview } from '../../overlays/preview';
import {
  CheckCircle2,
  ExternalLink,
  Settings2,
  Play,
  Power,
  PowerOff,
  AlertCircle,
  Copy,
  Eye,
  Monitor,
  Wifi,
} from 'lucide-react';

type StatusVariant = 'success' | 'warning' | 'info' | 'error';

interface StatusInfo {
  label: string;
  variant: StatusVariant;
  dotClass: string;
}

interface OverlayCardProps {
  module: AnyOverlayModule;
  instance: OverlayInstance | null;
}

function OverlayCardInner({
  module,
  instance,
}: OverlayCardProps): React.ReactElement {
  const navigate = useNavigate();
  const { addInstance, toggleEnabled } = useOverlayStore();
  const [copied, setCopied] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const meta = module.metadata;
  const browserSourceUrl = useMemo(
    () => getBrowserSourceUrlForModule(meta.id),
    [meta.id]
  );

  const status = useMemo((): StatusInfo => {
    if (!instance) {
      return { label: 'Not Installed', variant: 'info', dotClass: 'text-info' };
    }
    if (instance.enabled) {
      return { label: 'Enabled', variant: 'success', dotClass: 'text-success animate-pulse-subtle' };
    }
    return { label: 'Disabled', variant: 'warning', dotClass: 'text-warning' };
  }, [instance]);

  const handleEnable = useCallback(async () => {
    if (!instance) {
      const mod = module;
      const newInstance = addInstance({
        moduleId: mod.metadata.id,
        name: mod.metadata.name,
        enabled: true,
        config: createOverlayConfig(mod),
        configVersion: mod.metadata.configVersion ?? 1,
      });
      if (newInstance) {
        navigate(`/customize/${newInstance.id}`);
      }
    } else {
      toggleEnabled(instance.id);
    }
  }, [instance, module, addInstance, toggleEnabled, navigate]);

  const handleDisable = useCallback(() => {
    if (instance) {
      toggleEnabled(instance.id);
    }
  }, [instance, toggleEnabled]);

  const handleCustomize = useCallback(() => {
    if (!instance) {
      const mod = module;
      const newInstance = addInstance({
        moduleId: mod.metadata.id,
        name: mod.metadata.name,
        enabled: true,
        config: createOverlayConfig(mod),
        configVersion: mod.metadata.configVersion ?? 1,
      });
      if (newInstance) {
        navigate(`/customize/${newInstance.id}`);
      }
    } else {
      navigate(`/customize/${instance.id}`);
    }
  }, [instance, module, addInstance, navigate]);

  const handlePreview = useCallback(() => {
    emitTestEvent(module.metadata.id, 'gift', {
      username: 'TestUser',
      giftName: 'Rose',
      diamonds: 50,
      repeatCount: 1,
    });
  }, [module.metadata.id]);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(browserSourceUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [browserSourceUrl]);

  const handleDoubleClick = useCallback(() => {
    handleCustomize();
  }, [handleCustomize]);

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-[#262631] bg-[#18181f] overflow-hidden transition-all duration-200',
        'hover:border-primary/30 hover:shadow-[0_0_24px_rgba(139,92,246,0.1)]',
        'min-w-[480px] w-[520px] max-w-[620px] flex-shrink-0'
      )}
      onDoubleClick={handleDoubleClick}
      style={{ cursor: 'pointer' }}
    >
      {/* Header - Overlay Name & Badges */}
      <div className="px-6 py-4 border-b border-[#262631] bg-[#101018]/80 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-white/95 truncate">{meta.name}</h3>
            <p className="text-[11px] text-white/50 truncate mt-0.5">{meta.description}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {meta.beta && (
              <span className="px-2 py-0.5 text-[9px] font-mono bg-yellow-500/15 text-yellow-400/80 border border-yellow-500/20 rounded">
                BETA
              </span>
            )}
            {meta.premium && (
              <span className="px-2 py-0.5 text-[9px] font-mono bg-purple-500/15 text-purple-400/80 border border-purple-500/20 rounded">
                PRO
              </span>
            )}
            {meta.featured && (
              <span className="px-2 py-0.5 text-[9px] font-mono bg-primary/15 text-primary/80 border border-primary/20 rounded">
                FEATURED
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="relative flex-1 min-h-[280px] bg-[#101018]">
        <OverlayPreview
          module={module}
          className="w-full h-full"
          aspectRatio="auto"
          showBadge={false}
        />
        {previewError && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#101018]/90">
            <div className="text-center p-4">
              <AlertCircle className="w-8 h-8 text-error mx-auto mb-2" />
              <p className="text-sm text-white/60">Preview unavailable</p>
            </div>
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[#262631]" />

      {/* Browser Source URL */}
      <div className="px-6 py-4 border-b border-[#262631] bg-[#101018]/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-semibold uppercase text-white/30 mb-0 tracking-wide">
            Browser Source URL
          </label>
          <span className="flex items-center gap-1 text-[10px] text-white/20">
            <Monitor className="w-3 h-3" />
            OBS Ready
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            readOnly
            value={browserSourceUrl}
            className="w-full pl-3 pr-12 py-2 text-[11px] bg-[#0f0f13] border border-[#262631] rounded-lg text-white/50 placeholder:text-white/20 focus:outline-none focus:border-primary/40 focus:bg-white/[0.03]"
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleCopyUrl(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-white/[0.03] text-white/30 border border-white/10 hover:bg-white/[0.06] hover:text-white/60 flex items-center justify-center transition-all"
            aria-label={copied ? 'Copied!' : 'Copy Browser Source URL'}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-success" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div className="px-6 py-3 border-b border-[#262631] bg-[#101018]/50">
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full', status.dotClass)} />
          <span className={cn('text-sm font-medium',
            status.variant === 'success' && 'text-success',
            status.variant === 'warning' && 'text-warning',
            status.variant === 'info' && 'text-info',
            status.variant === 'error' && 'text-error'
          )}>
            {status.label}
          </span>
          {instance && (
            <span className="ml-auto text-[10px] font-mono text-white/20">
              ID: {instance.id.slice(0, 8)}...
            </span>
          )}
        </div>
      </div>

      {/* Action Buttons - 4 equal width */}
      <div className="px-6 py-4 bg-[#101018]/80 grid grid-cols-4 gap-2">
        {/* Enable/Disable Button */}
        {!instance || !instance.enabled ? (
          <button
            onClick={(e) => { e.stopPropagation(); handleEnable(); }}
            className="col-span-1 h-10 px-4 rounded-lg bg-primary/20 text-primary border border-primary/30 text-sm font-medium hover:bg-primary/30 hover:border-primary/40 transition-all flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            <span>Enable</span>
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); handleDisable(); }}
            className="col-span-1 h-10 px-4 rounded-lg bg-white/[0.03] text-white/50 border border-white/10 text-sm font-medium hover:bg-white/10 hover:text-white/70 hover:border-white/20 transition-all flex items-center justify-center gap-2"
          >
            <PowerOff className="w-4 h-4" />
            <span>Disable</span>
          </button>
        )}

        {/* Customize Button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCustomize(); }}
          className="col-span-1 h-10 px-4 rounded-lg bg-white/[0.03] text-white/60 border border-white/10 text-sm font-medium hover:bg-white/10 hover:text-white/80 hover:border-white/20 transition-all flex items-center justify-center gap-2"
        >
          <Settings2 className="w-4 h-4" />
          <span>Customize</span>
        </button>

        {/* Preview Button */}
        <button
          onClick={(e) => { e.stopPropagation(); handlePreview(); }}
          className="col-span-1 h-10 px-4 rounded-lg bg-white/[0.03] text-white/60 border border-white/10 text-sm font-medium hover:bg-white/10 hover:text-white/80 hover:border-white/20 transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-4 h-4" />
          <span>Preview</span>
        </button>

        {/* Copy URL Button */}
        <button
          onClick={(e) => { e.stopPropagation(); handleCopyUrl(); }}
          className="col-span-1 h-10 px-4 rounded-lg bg-white/[0.03] text-white/60 border border-white/10 text-sm font-medium hover:bg-white/10 hover:text-white/80 hover:border-white/20 transition-all flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" />
          <span>Copy URL</span>
        </button>
      </div>
    </div>
  );
}

export const OverlayCard = memo(OverlayCardInner);