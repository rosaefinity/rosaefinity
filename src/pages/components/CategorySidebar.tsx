import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { AnyOverlayModule } from '../../overlays/types';
import type { OverlayCategory, CategoryMeta } from '../../overlays/base/constants';
import { CATEGORY_META } from '../../overlays/base/constants';
import {
  Target,
  Gift,
  MessageSquare,
  Bell,
  Zap,
  Sparkles,
  Monitor,
  Settings,
  Trophy,
  FlaskConical,
  LayoutGrid,
} from 'lucide-react';

interface CategorySidebarProps {
  activeCategory: OverlayCategory | 'all';
  onCategoryChange: (category: OverlayCategory | 'all') => void;
  counts: Record<string, number>;
  modules: AnyOverlayModule[];
}

// Map category to Lucide icon
const CATEGORY_ICONS: Record<OverlayCategory, React.ComponentType<{ className?: string }>> = {
  goals: Target,
  gifts: Gift,
  chat: MessageSquare,
  alerts: Bell,
  actions: Zap,
  graphics: Sparkles,
  media: Monitor,
  leaderboard: Trophy,
  utilities: Settings,
  experimental: FlaskConical,
};

function CategorySidebarInner({
  activeCategory,
  onCategoryChange,
  counts,
}: CategorySidebarProps): React.ReactElement {
  // Get categories that actually have overlays
  const availableCategories = useMemo(() => {
    const cats = new Set<OverlayCategory>();
    for (const [cat, count] of Object.entries(counts)) {
      if (count > 0 && cat !== 'all' && CATEGORY_META.some(m => m.id === cat)) {
        cats.add(cat as OverlayCategory);
      }
    }
    return Array.from(cats).sort((a, b) => {
      const aMeta = CATEGORY_META.find(m => m.id === a);
      const bMeta = CATEGORY_META.find(m => m.id === b);
      return (aMeta?.sortOrder ?? 99) - (bMeta?.sortOrder ?? 99);
    });
  }, [counts]);

  const handleAllClick = () => onCategoryChange('all');

  return (
    <div className="w-56 shrink-0 border-r border-[#262631] bg-[#0f0f13] overflow-y-auto py-3 scrollbar-thin">
      <div className="px-3 mb-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/25 mb-2 px-2">Categories</h3>
      </div>
      <nav className="space-y-0.5 px-2">
        {/* All category */}
        <motion.button
          onClick={handleAllClick}
          whileHover={{ x: 3 }}
          whileTap={{ scale: 0.97 }}
          className={cn(
            'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-150',
            activeCategory === 'all'
              ? 'bg-primary/15 text-white font-medium border border-primary/20'
              : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
          )}
        >
          <LayoutGrid className={cn('w-4.5 h-4.5 shrink-0', activeCategory === 'all' ? 'text-primary' : 'text-white/30')} />
          <span className="text-[13px] truncate flex-1">All</span>
          {counts.all > 0 && (
            <span className={cn(
              'text-[10px] font-mono min-w-[20px] text-center px-1.5 py-0.5 rounded-full',
              activeCategory === 'all' ? 'bg-primary/20 text-primary' : 'bg-white/[0.04] text-white/30'
            )}>
              {counts.all}
            </span>
          )}
        </motion.button>

        {/* Category buttons - dynamically generated from CATEGORY_META, filtered to available */}
        {CATEGORY_META
          .filter(meta => availableCategories.includes(meta.id))
          .map((meta) => {
            const isActive = activeCategory === meta.id;
            const count = counts[meta.id] ?? 0;
            const Icon = CATEGORY_ICONS[meta.id];

            return (
              <motion.button
                key={meta.id}
                onClick={() => onCategoryChange(meta.id)}
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  'flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-left transition-all duration-150',
                  isActive
                    ? 'bg-primary/15 text-white font-medium border border-primary/20'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03] border border-transparent'
                )}
              >
                <Icon className={cn('w-4.5 h-4.5 shrink-0', isActive ? 'text-primary' : 'text-white/30')} />
                <span className="text-[13px] truncate flex-1">{meta.label}</span>
                {count > 0 && (
                  <span className={cn(
                    'text-[10px] font-mono min-w-[20px] text-center px-1.5 py-0.5 rounded-full',
                    isActive ? 'bg-primary/20 text-primary' : 'bg-white/[0.04] text-white/30'
                  )}>
                    {count}
                  </span>
                )}
              </motion.button>
            );
          })}
      </nav>
    </div>
  );
}

export const CategorySidebar = memo(CategorySidebarInner);