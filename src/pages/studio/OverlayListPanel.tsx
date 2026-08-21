import React, { useState, useCallback, useMemo, memo } from 'react';
import { cn } from '../../lib/utils';
import { useOverlayStore } from '../../lib/overlay-store';
import { getOverlayModules } from '../../overlays/registry';
import { Search, ChevronLeft, Power, PowerOff } from 'lucide-react';

interface OverlayListPanelProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack: () => void;
  className?: string;
}

function OverlayListPanelInner({
  selectedId,
  onSelect,
  onBack,
  className,
}: OverlayListPanelProps): React.ReactElement {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const instances = useOverlayStore((s) => s.instances);
  const modules = useMemo(() => getOverlayModules(), []);

  // Build a map of moduleId → first instance
  const instanceByModule = useMemo(() => {
    const map = new Map<string, { id: string; enabled: boolean }>();
    for (const inst of instances) {
      if (!map.has(inst.moduleId)) {
        map.set(inst.moduleId, { id: inst.id, enabled: inst.enabled });
      }
    }
    return map;
  }, [instances]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const mod of modules) cats.add(mod.metadata.category);
    return ['All', ...Array.from(cats).sort()];
  }, [modules]);

  const filtered = useMemo(() => {
    return modules.filter((mod) => {
      const matchesSearch = !search ||
        mod.metadata.name.toLowerCase().includes(search.toLowerCase()) ||
        mod.metadata.description.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === 'All' ||
        mod.metadata.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [modules, search, activeCategory]);

  return (
    <div className={cn('flex flex-col h-full bg-[#0f0f13] border-r border-white/[0.06]', className)}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/[0.06] transition-colors"
            title="Back to Gallery"
            aria-label="Back to Gallery"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-semibold text-white/80">Overlays</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search overlays..."
            className="w-full h-8 pl-8 pr-3 text-xs bg-white/[0.03] border border-white/[0.06] rounded-lg text-white/70 placeholder:text-white/25 focus:outline-none focus:border-primary/30 transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex gap-1 px-4 py-2 border-b border-white/[0.06] overflow-x-auto">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-2.5 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-colors capitalize',
              activeCategory === cat
                ? 'bg-primary/20 text-primary border border-primary/30'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Overlay list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
        {filtered.map((mod) => {
          const inst = instanceByModule.get(mod.metadata.id);
          const isSelected = selectedId === inst?.id;

          return (
            <button
              key={mod.metadata.id}
              type="button"
              onClick={() => inst && onSelect(inst.id)}
              disabled={!inst}
              className={cn(
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors',
                isSelected
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-white/[0.04] border border-transparent',
                !inst && 'opacity-40 cursor-not-allowed',
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-white/70 truncate">
                  {mod.metadata.name}
                </div>
                <div className="text-[10px] text-white/30 truncate capitalize">
                  {mod.metadata.category}
                </div>
              </div>
              {inst && (
                <div className={cn(
                  'w-5 h-5 rounded flex items-center justify-center shrink-0',
                  inst.enabled ? 'text-success' : 'text-white/20',
                )}>
                  {inst.enabled ? (
                    <Power className="w-3 h-3" />
                  ) : (
                    <PowerOff className="w-3 h-3" />
                  )}
                </div>
              )}
            </button>
          );
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-2xl mb-2 opacity-20">📭</div>
            <p className="text-xs text-white/30">No overlays found</p>
          </div>
        )}
      </div>
    </div>
  );
}

export const OverlayListPanel = memo(OverlayListPanelInner);
OverlayListPanel.displayName = 'OverlayListPanel';
