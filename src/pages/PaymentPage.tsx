// =============================================
// RosaeFinity — Payment Page (Production)
// QRIS-based payment flow with package selection
// =============================================

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Check, Copy, ArrowLeft, Shield,
  MessageCircle, Zap, Crown, CreditCard, CheckCircle,
  Loader2, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../components/Toast';
import { api } from '../services/electron-service';
import { useAppStore } from '../store/app-store';

// ── Constants ──

const QRIS_IMAGE = '/qris.jpg';
const WHATSAPP_URL = 'https://wa.me/6281214249647';

// ── Plan Data ──

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanCard {
  id: 'basic' | 'pro';
  name: string;
  price: string;
  period: string;
  features: PlanFeature[];
  recommended: boolean;
  gradient: string;
  border: string;
  icon: typeof Zap;
}

const PLANS: PlanCard[] = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'FREE',
    period: '',
    features: [
      { text: 'Maximum 5 Actions', included: true },
      { text: 'Unlimited Overlays', included: true },
      { text: 'Unlimited Browser Sources', included: true },
    ],
    recommended: false,
    gradient: 'from-blue-500/10 to-cyan-500/10',
    border: 'border-blue-500/20',
    icon: Zap,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'Rp150.000',
    period: '/ month',
    features: [
      { text: 'Unlimited Actions', included: true },
      { text: 'Unlimited Overlays', included: true },
      { text: 'Unlimited Browser Sources', included: true },
      { text: 'Unlimited Devices', included: true },
      { text: 'Priority Updates', included: true },
    ],
    recommended: true,
    gradient: 'from-purple-500/15 to-pink-500/15',
    border: 'border-purple-500/30',
    icon: Crown,
  },
];

// ── Payment Instructions ──

const INSTRUCTIONS = [
  'Scan QRIS.',
  'Pay with your banking or e-wallet application.',
  'Click "I\'ve Paid".',
  'Wait for license verification.',
];

// ── Helpers ──

function generatePaymentId(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(100000 + Math.random() * 900000);
  return `RF-${date}-${random}`;
}

// ── Animation Variants ──

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: 'easeOut' },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.1 } },
};

const item = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0 },
};

// ── Main Component ──

export function PaymentPage() {
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro'>('pro');
  const [paymentId] = useState(() => generatePaymentId());
  const [copiedPaymentId, setCopiedPaymentId] = useState(false);
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);
  const [qrisError, setQrisError] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'waiting' | 'submitted'>('waiting');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const buttonContainerRef = useRef<HTMLDivElement>(null);

  const currentPlan = useMemo(
    () => PLANS.find(p => p.id === selectedPlan)!,
    [selectedPlan]
  );

  const handleCopyPaymentId = useCallback(() => {
    navigator.clipboard.writeText(paymentId);
    setCopiedPaymentId(true);
    setTimeout(() => setCopiedPaymentId(false), 2000);
  }, [paymentId]);

  const handleCopyWhatsapp = useCallback(() => {
    navigator.clipboard.writeText(WHATSAPP_URL);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 2000);
  }, []);

  const handlePaidClick = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmPaid = useCallback(async () => {
    setShowConfirmDialog(false);
    setIsSubmitting(true);

    try {
      const a = api();
      const userId = useAppStore.getState().currentUserId;

      if (a && userId) {
        // Submit payment via backend IPC
        const result = await a.paymentSubmit(userId, { amount: 150000 });
        if (result.success) {
          setPaymentStatus('submitted');
          toast('Your payment has been submitted. Your license will be activated after verification.');
        } else {
          toast('Payment submission failed. Please try again.');
        }
      } else {
        // Fallback: simulated submission (non-Electron or no user)
        await new Promise(resolve => setTimeout(resolve, 1200));
        setPaymentStatus('submitted');
        toast('Your payment has been submitted. Your license will be activated after verification.');
      }
    } catch (err) {
      console.error('[Payment] Submission error:', err);
      toast('Payment submission failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const handleCancelConfirm = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/license')}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to License
          </button>

          {/* Logo */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-secondary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="w-6 h-6 text-white drop-shadow-sm" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Upgrade to RosaeFinity Pro</h1>
              <p className="text-sm text-white/40">Scan the QRIS below to complete your payment.</p>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* ── Left Column: QRIS + Info ── */}
          <motion.div
            {...fadeIn}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="space-y-6"
          >
            {/* QRIS Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 text-center">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-4">
                Scan QRIS to Pay
              </p>

              {/* QRIS Image */}
              <div className="inline-block p-4 bg-white rounded-2xl shadow-lg mb-4">
                {qrisError ? (
                  <div className="w-48 h-48 flex items-center justify-center bg-gray-100 rounded-xl">
                    <p className="text-sm text-gray-500 text-center px-4">QRIS image not found.</p>
                  </div>
                ) : (
                  <img
                    src={QRIS_IMAGE}
                    alt="QRIS Payment"
                    className="w-48 h-48 object-contain"
                    onError={() => setQrisError(true)}
                  />
                )}
              </div>

              {/* Payment ID */}
              <div className="mb-4">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Payment ID</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="text-sm text-white/70 font-mono bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
                    {paymentId}
                  </code>
                  <button
                    onClick={handleCopyPaymentId}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                    title="Copy Payment ID"
                  >
                    {copiedPaymentId ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/30" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Merchant Info Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Merchant</span>
                  <span className="text-sm font-medium text-white/80">RosaeFinity</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Payment</span>
                  <span className="text-sm font-medium text-white/80">QRIS</span>
                </div>
                <div className="h-px bg-white/[0.06]" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Status</span>
                  {paymentStatus === 'waiting' ? (
                    <span className="text-sm font-medium text-yellow-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                      Waiting for payment
                    </span>
                  ) : (
                    <span className="text-sm font-medium text-amber-400 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Verification pending
                    </span>
                  )}
                </div>
                {paymentStatus === 'submitted' && (
                  <>
                    <div className="h-px bg-white/[0.06]" />
                    <p className="text-[11px] text-white/30 text-right">
                      Verification usually takes less than 5 minutes.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Payment Instructions */}
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-5">
              <h4 className="text-xs font-medium text-white/50 uppercase tracking-wider mb-4">
                Payment Instructions
              </h4>
              <ol className="space-y-3">
                {INSTRUCTIONS.map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs text-primary-light font-semibold shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-sm text-white/60 leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Action Buttons — DEBUG MARKER */}
            <div
              ref={buttonContainerRef}
              className="space-y-3"
              style={{ visibility: 'visible', display: 'block', opacity: 1 }}
            >
              {/* Primary: I've Paid */}
              <button
                type="button"
                onClick={handlePaidClick}
                disabled={paymentStatus === 'submitted' || isSubmitting}
                style={{ visibility: 'visible', display: 'flex', opacity: 1, width: '100%', height: '48px' }}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold transition-all items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
              >
                <CheckCircle className="w-4 h-4" />
                I've Paid
              </button>

              {/* Secondary: Copy WhatsApp */}
              <button
                onClick={handleCopyWhatsapp}
                className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/70 text-sm font-medium transition-all hover:bg-white/[0.06] hover:border-white/[0.12] flex items-center justify-center gap-2"
              >
                {copiedWhatsapp ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4" />
                    Copy WhatsApp Admin
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {/* ── Right Column: Package Cards ── */}
          <motion.div
            {...stagger}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            <motion.h2
              variants={item}
              className="text-sm font-semibold text-white/60 uppercase tracking-wider mb-2"
            >
              Choose Your Plan
            </motion.h2>

            {PLANS.map((plan) => {
              const Icon = plan.icon;
              const isSelected = selectedPlan === plan.id;

              return (
                <motion.button
                  key={plan.id}
                  variants={item}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={cn(
                    'w-full text-left p-5 rounded-2xl border transition-all relative',
                    isSelected
                      ? `${plan.border} bg-gradient-to-br ${plan.gradient} shadow-lg`
                      : 'border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03]'
                  )}
                >
                  {/* Recommended Badge */}
                  {plan.recommended && (
                    <div className="absolute -top-3 left-5 px-3 py-0.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-[10px] font-bold text-white uppercase tracking-wider">
                      Recommended
                    </div>
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        isSelected ? 'bg-white/[0.1]' : 'bg-white/[0.04]'
                      )}>
                        <Icon className={cn(
                          'w-5 h-5',
                          isSelected ? 'text-white' : 'text-white/40'
                        )} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{plan.name}</h3>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-extrabold text-white">{plan.price}</span>
                          <span className="text-xs text-white/40">{plan.period}</span>
                        </div>
                      </div>
                    </div>

                    {/* Selection Indicator */}
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
                      isSelected
                        ? 'border-primary bg-primary'
                        : 'border-white/20'
                    )}>
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-2.5">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2.5">
                        <div className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center',
                          feature.included
                            ? 'bg-green-500/20'
                            : 'bg-white/[0.04]'
                        )}>
                          <Check className={cn(
                            'w-2.5 h-2.5',
                            feature.included ? 'text-green-400' : 'text-white/20'
                          )} />
                        </div>
                        <span className={cn(
                          'text-sm',
                          feature.included ? 'text-white/70' : 'text-white/30'
                        )}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.button>
              );
            })}

            {/* Security Badge */}
            <motion.div
              variants={item}
              className="flex items-center justify-center gap-2 py-3 text-xs text-white/25"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Secure payment via QRIS</span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ══════ CONFIRMATION DIALOG ══════ */}
      <AnimatePresence>
        {showConfirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={handleCancelConfirm}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              {/* Close button */}
              <button
                onClick={handleCancelConfirm}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4 text-white/30" />
              </button>

              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-primary-light" />
                </div>

                <h3 className="text-lg font-bold text-white mb-2">
                  Payment Confirmation
                </h3>
                <p className="text-sm text-white/40 mb-6">
                  Have you completed your QRIS payment?
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={handleCancelConfirm}
                    className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPaid}
                    className="flex-1 h-11 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Yes, I Have Paid
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default PaymentPage;
