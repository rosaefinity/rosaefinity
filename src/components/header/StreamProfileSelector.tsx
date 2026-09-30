import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Settings, Lock, Crown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/app-store';
import { useLicenseStore } from '../../store/license-store';
import { useNavigate } from 'react-router-dom';
import { ProfileSettingsModal } from '../profiles/ProfileSettingsModal';
import type { StreamProfile } from '../../types';

export function StreamProfileSelector(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<StreamProfile | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const streamProfiles = useAppStore((s) => s.streamProfiles);
  const currentProfileId = useAppStore((s) => s.currentProfileId);
  const switchProfile = useAppStore((s) => s.switchProfile);
  const maxProfiles = useLicenseStore((s) => s.getMaxStreamProfiles());
  const isPro = useLicenseStore((s) => s.effectivePlan()) === 'pro';

  const activeProfile = streamProfiles.find((p) => p.id === currentProfileId);

  const handleSwitchProfile = useCallback(
    (profileId: string) => {
      if (profileId === currentProfileId) return;
      switchProfile(profileId);
      setIsOpen(false);
    },
    [currentProfileId, switchProfile]
  );

  const handleOpenSettings = useCallback(
    (e: React.MouseEvent, profile: StreamProfile) => {
      e.stopPropagation();
      setEditingProfile(profile);
    },
    []
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close dropdown on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen]);

  // Show all profiles — locked ones get a lock indicator
  const allProfiles = streamProfiles;

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'flex items-center gap-2 h-9 px-3 rounded-xl text-sm font-medium transition-all',
            'border border-white/[0.08] hover:border-white/[0.15]',
            'bg-white/[0.04] hover:bg-white/[0.08]',
            'text-white/80 hover:text-white'
          )}
          title="Stream Profile"
        >
          <span className="text-base leading-none">{activeProfile?.icon || '🌹'}</span>
          <span className="hidden sm:inline max-w-[120px] truncate">
            {activeProfile?.name || 'Stream Profile 1'}
          </span>
          <ChevronDown
            className={cn(
              'w-3 h-3 text-white/40 transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {/* Dropdown */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#1a1a24] border border-white/[0.08] shadow-2xl overflow-hidden z-50"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white/90">Stream Profiles</h3>
                {isPro && (
                  <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    PRO
                  </span>
                )}
              </div>

              {/* Available Profiles */}
              <div className="p-1.5 max-h-80 overflow-y-auto">
                {allProfiles.map((profile, index) => {
                  const isActive = profile.id === currentProfileId;
                  const isLocked = profile.locked || index >= maxProfiles;
                  return (
                    <button
                      key={profile.id}
                      onClick={() => {
                        if (isLocked) return;
                        handleSwitchProfile(profile.id);
                      }}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group',
                        isActive
                          ? 'bg-primary/10 border border-primary/20'
                          : isLocked
                            ? 'opacity-50 cursor-not-allowed border border-transparent'
                            : 'hover:bg-white/[0.04] border border-transparent'
                      )}
                    >
                      {/* Status indicator */}
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full shrink-0 transition-colors',
                          isActive ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-white/10'
                        )}
                      />

                      {/* Icon */}
                      <span className="text-base leading-none shrink-0">
                        {profile.icon || '🌹'}
                      </span>

                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'text-sm truncate',
                              isActive ? 'text-white font-medium' : isLocked ? 'text-white/40' : 'text-white/60'
                            )}
                          >
                            {profile.name}
                          </span>
                          {isLocked && (
                            <Lock className="w-3 h-3 text-white/30 shrink-0" />
                          )}
                          {isActive && !isLocked && (
                            <span className="text-[10px] text-success font-medium shrink-0">
                              Aktif
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Settings gear */}
                      <button
                        onClick={(e) => handleOpenSettings(e, profile)}
                        className={cn(
                          'shrink-0 p-1 rounded-lg transition-all',
                          'text-white/20 hover:text-white/80 hover:bg-white/[0.08]',
                          'opacity-0 group-hover:opacity-100',
                          isActive && 'opacity-100'
                        )}
                        title={`Settings — ${profile.name}`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  );
                })}
              </div>

              {/* Locked Profiles (Free users) */}
              {!isPro && allProfiles.some(p => p.locked) && (
                <>
                  <div className="border-t border-white/[0.06] mx-3" />
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 text-white/30 text-xs mb-2">
                      <Lock className="w-3 h-3" />
                      <span>Additional profiles require Pro</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        navigate('/settings#license');
                      }}
                      className="w-full flex items-center justify-center gap-2 h-8 px-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-white text-xs font-medium hover:shadow-lg hover:shadow-primary/30 transition-all"
                    >
                      <Crown className="w-3 h-3" />
                      Upgrade to Pro
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Profile Settings Modal */}
      {editingProfile && (
        <ProfileSettingsModal
          profile={editingProfile}
          onClose={() => setEditingProfile(null)}
        />
      )}
    </>
  );
}
