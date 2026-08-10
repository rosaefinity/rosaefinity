import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadAll, getOverlayModules } from '../overlays/registry';
import type { AnyOverlayModule } from '../overlays/types';
import type { OverlayCategory } from '../overlays/base/constants';
import { useOverlayStore } from '../lib/overlay-store';
import { createOverlayConfig } from '../overlays/createConfig';
import { CategorySidebar } from './components/CategorySidebar';
import { OverlayCard } from './components/OverlayCard';
import { emitTestEvent } from '../events/EventDispatcher';
import { getBrowserSourceUrlForModule } from '../lib/browser-source-url';
import { LayoutGrid } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { PreviewProvider } from '../overlays/preview';

export default function OverlayGallery(): React.ReactElement {
  const navigate = useNavigate();

  const [activeCategory, setActiveCategory] = useState<OverlayCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [allModules, setAllModules] = useState<AnyOverlayModule[]>([]);
  const [loading, setLoading] = useState(true);

  const { instances, addInstance, toggleEnabled } = useOverlayStore();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await loadAll(); } catch (err) { console.error('[Gallery] loadAll failed:', err); }
      if (!cancelled) {
        const modules = getOverlayModules();
        setAllModules(modules);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const instanceByModule = useMemo(() => {
    const map = new Map<string, { id: string; enabled: boolean }>();
    for (const inst of instances) {
      if (!map.has(inst.moduleId)) {
        map.set(inst.moduleId, { id: inst.id, enabled: inst.enabled });
      }
    }
    return map;
  }, [instances]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: allModules.length };
    for (const mod of allModules) {
      const cat = mod.metadata.category;
      c[cat] = (c[cat] ?? 0) + 1;
    }
    return c;
  }, [allModules]);

  const filteredModules = useMemo(() => {
    let result = [...allModules];

    if (activeCategory !== 'all') {
      result = result.filter((m) => m.metadata.category === activeCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.metadata.name.toLowerCase().includes(q) ||
        m.metadata.description.toLowerCase().includes(q) ||
        m.metadata.author.toLowerCase().includes(q) ||
        m.metadata.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    result.sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));

    return result;
  }, [allModules, activeCategory, searchQuery]);

  const handleEnable = useCallback((moduleId: string) => {
    const mod = allModules.find((m) => m.metadata.id === moduleId);
    const instance = instanceByModule.get(moduleId);
    if (!mod) return;
    if (!instance) {
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
  }, [allModules, instanceByModule, addInstance, toggleEnabled, navigate]);

  const handleDisable = useCallback((instanceId: string) => {
    toggleEnabled(instanceId);
  }, [toggleEnabled]);

  const handleCustomize = useCallback((moduleId: string) => {
    const mod = allModules.find((m) => m.metadata.id === moduleId);
    const instance = instanceByModule.get(moduleId);
    if (!mod) return;
    if (!instance) {
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
  }, [allModules, instanceByModule, addInstance, navigate]);

  const handlePreview = useCallback((moduleId: string) => {
    emitTestEvent(moduleId, 'gift', {
      username: 'TestUser',
      giftName: 'Rose',
      diamonds: 50,
      repeatCount: 1,
    });
  }, []);

  const handleCopyUrl = useCallback((moduleId: string) => {
    navigator.clipboard.writeText(getBrowserSourceUrlForModule(moduleId));
  }, []);

  const handleDoubleClick = useCallback((moduleId: string) => {
    handleCustomize(moduleId);
  }, [handleCustomize]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-xs text-white/30">Loading overlays...</span>
        </div>
      </div>
    );
  }

  return (
    <PreviewProvider>
      <div className="flex h-full bg-[#0f0f13]">
        <CategorySidebar
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        counts={counts}
        modules={allModules}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262631] bg-[#0f0f13]/80 backdrop-blur-sm sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-white/90">Overlay Configuration</h1>
            <p className="text-[11px] text-white/30 mt-0.5">
              {filteredModules.length} overlay{filteredModules.length !== 1 ? 's' : ''} Â· {instances.length} active
            </p>
          </div>
        </div>

        <div className="px-6 py-4 bg-[#0f0f13]/80 backdrop-blur-sm border-b border-[#262631] sticky top-[40px] z-10">
          <div className="relative max-w-md">
            <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/25" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search overlays..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/[0.03] border border-[#262631] rounded-lg text-white/80 placeholder:text-white/25 focus:outline-none focus:border-primary/40 focus:bg-white/[0.05] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-xs"
              >
                âœ•
              </button>
            )}
          </div>
        </div>

        {filteredModules.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3 opacity-20">ðŸ“­</div>
              <p className="text-sm text-white/30">
                {searchQuery ? 'No overlays match your search' : 'No overlays in this category'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-xs text-primary/60 hover:text-primary mt-2"
                >
                  Clear search
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(480px, 520px))',
                justifyContent: 'center',
                maxWidth: 'calc(3 * 520px + 2 * 16px)',
              }}
            >
              <AnimatePresence mode="popLayout">
                {filteredModules.map((mod) => {
                  const instance = instanceByModule.get(mod.metadata.id) ?? null;
                  return (
                    <OverlayCard
                      key={mod.metadata.id}
                      module={mod}
                      instance={instance}
                      onEnable={() => handleEnable(mod.metadata.id)}
                      onDisable={() => instance && handleDisable(instance.id)}
                      onCustomize={() => handleCustomize(mod.metadata.id)}
                      onPreview={() => handlePreview(mod.metadata.id)}
                      onCopyUrl={() => handleCopyUrl(mod.metadata.id)}
                      onDoubleClick={() => handleDoubleClick(mod.metadata.id)}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
    </PreviewProvider>
  );
}
