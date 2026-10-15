import React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAppStore, isDefaultProfile } from '../../store/app-store';
import type { StreamProfile } from '../../types';

const PROFILE_ICONS = ['🌹', '🔥', '🎮', '❤️', '💬', '🎁', '🙂', '👍', '📞', '☑️', '🎵', '⭐', '🎥', '🎙️', '⚡', '🎯', '💎', '👑', '🚀', '🎨'] as const;
const MAX_NAME_LENGTH = 30;

interface ProfileSettingsModalProps { profile: StreamProfile; onClose: () => void; }

export function ProfileSettingsModal({ profile, onClose }: ProfileSettingsModalProps): React.JSX.Element {
  const updateProfile = useAppStore((s) => s.updateProfile);
  const deleteProfile = useAppStore((s) => s.deleteProfile);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(profile.name);
  const [selectedIcon, setSelectedIcon] = useState(profile.icon || '🌹');
  useEffect(() => { setName(profile.name); setSelectedIcon(profile.icon || '🌹'); setConfirmDelete(false); }, [profile.name, profile.icon]);
  const canSave = name.trim().length > 0;
  const handleSave = (): void => { if (!canSave) return; updateProfile(profile.id, { name: name.trim(), icon: selectedIcon }); onClose(); };
  const handleKeyDown = (e: React.KeyboardEvent): void => { if (e.key === 'Enter' && canSave) handleSave(); };
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 flex items-center justify-center p-4 z-[60]" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="relative w-full max-w-sm bg-[#1a1a2e] border border-white/[0.08] rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10"><h3 className="text-base font-semibold text-white">Profile Settings</h3><button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10" title="Close"><X className="w-4 h-4" /></button></div>
          <div className="px-5 py-5 space-y-5" onKeyDown={handleKeyDown}>
            <div className="flex justify-center"><div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-3xl">{selectedIcon}</div></div>
            <div><label className="block text-xs font-medium text-white/50 mb-1.5">Profile Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME_LENGTH} className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" placeholder="Enter profile name" autoFocus /><div className="flex justify-end mt-1"><span className="text-[10px] text-white/20">{name.length}/{MAX_NAME_LENGTH}</span></div></div>
            <div><label className="block text-xs font-medium text-white/50 mb-2">Select Icon</label><div className="grid grid-cols-8 gap-1.5">{PROFILE_ICONS.map((icon) => <button key={icon} onClick={() => setSelectedIcon(icon)} className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-lg', selectedIcon === icon ? 'bg-primary/20 border border-primary/40' : 'bg-white/[0.03] border border-transparent')} title={`Select ${icon}`}>{icon}</button>)}</div></div>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-t border-white/10">
            {!isDefaultProfile(profile) && (confirmDelete ? <div className="flex items-center gap-2 text-xs text-red-300"><span>Delete {profile.name}?</span><button onClick={() => { deleteProfile(profile.id); onClose(); }} className="px-3 py-1.5 rounded-lg bg-red-600 text-white">Confirm</button><button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg bg-white/10 text-white/70">Cancel</button></div> : <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-300 bg-red-500/10 rounded-lg"><AlertTriangle className="w-3.5 h-3.5" /> Delete Profile</button>)}
            <div className="flex items-center justify-end gap-2 ml-auto"><button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 bg-white/5 rounded-lg">Cancel</button><button onClick={handleSave} disabled={!canSave} className={cn('px-4 py-2 text-sm text-white rounded-lg', canSave ? 'bg-purple-600' : 'bg-white/10 text-white/30')}>Save</button></div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
