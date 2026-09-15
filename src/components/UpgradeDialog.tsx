// =============================================
// RosaeFinity — Upgrade Dialog
// Reusable modal shown when user hits a feature/limit gate.
// =============================================

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Sparkles, Check, X } from 'lucide-react';
import { Button } from './ui/button';
import { safeNavigate } from '../lib/safe-navigate';

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  /** Reason for showing the dialog */
  reason?: 'action_limit' | 'scene_limit' | 'overlay_limit' | 'feature_locked';
  /** Current usage count (e.g., 5) */
  currentUsage?: number;
  /** Maximum allowed (e.g., 5) */
  limit?: number;
}

const PRO_BENEFITS = [
  'Unlimited Actions',
  'Unlimited Scenes',
  'Unlimited Overlay Presets',
  'Multi Screen',
  'Premium Overlay',
  'Cloud Backup',
  'Priority Support',
  'Early Access',
];

export function UpgradeDialog({
  open,
  onClose,
  reason = 'feature_locked',
  currentUsage,
  limit,
}: UpgradeDialogProps): JSX.Element {
  const navigate = () => {
    onClose();
    safeNavigate('/payment', 'UpgradeDialog:navigate');
  };

  const reasonMessages: Record<string, { title: string; subtitle: string }> = {
    action_limit: {
      title: 'Action Limit Reached',
      subtitle: `You've used all ${limit ?? 5} actions on the Free plan.`,
    },
    scene_limit: {
      title: 'Scene Limit Reached',
      subtitle: `You've reached the maximum of ${limit ?? 1} scene on the Free plan.`,
    },
    overlay_limit: {
      title: 'Overlay Limit Reached',
      subtitle: `You've reached the maximum of ${limit ?? 10} overlay presets on the Free plan.`,
    },
    feature_locked: {
      title: 'Premium Feature',
      subtitle: 'This feature requires a higher plan.',
    },
  };

  const msg = reasonMessages[reason] ?? reasonMessages.feature_locked;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md mx-4 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex flex-col items-center text-center px-6 pt-8 pb-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center mb-5">
                <Lock className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{msg.title}</h3>
              <p className="text-sm text-white/40">{msg.subtitle}</p>
            </div>

            {/* Pro Benefits */}
            <div className="px-6 pb-4">
              <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                <p className="text-xs font-medium text-purple-400 uppercase tracking-wider mb-3">
                  Upgrade to RosaeFinity Pro
                </p>
                <div className="space-y-2">
                  {PRO_BENEFITS.map((benefit) => (
                    <div key={benefit} className="flex items-center gap-2 text-sm text-white/70">
                      <Check className="w-4 h-4 text-green-400 shrink-0" />
                      {benefit}
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.06] text-center">
                  <span className="text-2xl font-bold text-white">Rp150.000</span>
                  <span className="text-sm text-white/40"> / month</span>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 px-6 pb-6">
              <Button
                variant="ghost"
                onClick={onClose}
                className="flex-1"
              >
                Later
              </Button>
              <Button
                onClick={navigate}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Pro
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
