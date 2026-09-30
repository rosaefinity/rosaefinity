import React from "react";
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../store/app-store';
import type { StreamProfile } from '../../types';

const PROFILE_ICONS = [
  '🌹', '🔥', '🎮', '❤️',
  '💬', '🎁', '🙂', '👍',
  '📞', '☑️', '🎵', '⭐',
  '🎥', '🎙️', '⚡', '🎯',
  '💎', '👑', '🚀', '🎨',
] as const;

const MAX_NAME_LENGTH = 30;

interface ProfileSettingsModalProps {
  profile: StreamProfile;
  onClose: () => void;
}

export function ProfileSettingsModal({ profile, onClose }: ProfileSettingsModalProps): React.JSX.Element {
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [name, setName] = useState(profile.name);
  const [selectedIcon, setSelectedIcon] = useState(profile.icon || '🌹');

  // Reset form when profile changes
  useEffect(() => {
    setName(profile.name);
    setSelectedIcon(profile.icon || '🌹');
  }, [profile.name, profile.icon]);

  const canSave = name.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) return;
    updateProfile(profile.id, { name: name.trim(), icon: selectedIcon });
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' && canSave) {
      handleSave();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 flex items-center justify-center p-4 z-[60]"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/[0.08] rounded-2xl shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <h3 className="text-base font-semibold text-white">Profile Settings</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 py-5 space-y-5" onKeyDown={handleKeyDown}>
            {/* Icon Preview */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-3xl">
                {selectedIcon}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">
                Profile Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={MAX_NAME_LENGTH}
                className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                placeholder="Enter profile name"
                autoFocus
              />
              <div className="flex justify-end mt-1">
                <span className="text-[10px] text-white/20">
                  {name.length}/{MAX_NAME_LENGTH}
                </span>
              </div>
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-xs font-medium text-white/50 mb-2">
                Select Icon
              </label>
              <div className="grid grid-cols-8 gap-1.5">
                {PROFILE_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setSelectedIcon(icon)}
                    className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all',
                      selectedIcon === icon
                        ? 'bg-primary/20 border border-primary/40 scale-110 shadow-[0_0_8px_rgba(139,92,246,0.3)]'
                        : 'bg-white/[0.03] border border-transparent hover:bg-white/[0.06] hover:border-white/[0.1]'
                    )}
                    title={`Select ${icon}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className={cn(
                'px-4 py-2 text-sm text-white rounded-lg transition-all',
                canSave
                  ? 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/20'
                  : 'bg-white/10 text-white/30 cursor-not-allowed'
              )}
            >
              Save
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
