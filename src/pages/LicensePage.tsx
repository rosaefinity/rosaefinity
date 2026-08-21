// =============================================
// RosaeFinity — License Management Page
// Plan comparison, status, device management.
// Uses backend-authoritative license store.
// =============================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLicenseStore } from '../store/license-store';
import { Button } from '../components/ui/button';
import { api, safeInvoke } from '../services/electron-service';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Crown, Zap, User, Check, X, Monitor,
  RefreshCw, Clock, ArrowRight, Sparkles,
  Loader2,
} from 'lucide-react';

const PLAN_DETAILS = {
  free: {
    name: 'Free',
    price: 'Rp0',
    icon: Zap,
    gradient: 'from-blue-600 to-cyan-600',
    features: [
      { label: 'Dashboard', included: true },
      { label: 'TikTok LIVE', included: true },
      { label: 'OBS Integration', included: true },
      { label: 'TTS', included: true },
      { label: 'Goals', included: true },
      { label: 'Overlay', included: true },
      { label: 'Media Library', included: true },
      { label: 'Setup', included: true },
      { label: 'Auto Update', included: true },
      { label: 'Max 5 Actions', included: true },
      { label: 'Max 1 Scene', included: true },
      { label: 'Max 10 Overlay Presets', included: true },
    ],
    limitations: [
      'Maximum 5 Actions',
      'Maximum 1 Scene',
      'Maximum 10 Overlay Presets',
      'No Multi Screen',
      'No Premium Overlay',
      'No Cloud Backup',
      '1 Active Device',
      'Community Support',
    ],
  },
  pro: {
    name: 'Pro',
    price: 'Rp150.000/month',
    icon: Crown,
    gradient: 'from-purple-600 to-pink-600',
    features: [
      { label: 'Everything in Free', included: true },
      { label: 'Unlimited Actions', included: true },
      { label: 'Unlimited Scenes', included: true },
      { label: 'Unlimited Overlay Presets', included: true },
      { label: 'Multi Screen', included: true },
      { label: 'Premium Overlay', included: true },
      { label: 'Cloud Backup', included: true },
      { label: 'Priority Support', included: true },
      { label: 'Early Access', included: true },
    ],
    limitations: [
      'Still only 1 active device',
    ],
  },
};

export function LicensePage(): JSX.Element {
  const navigate = useNavigate();
  const {
    plan, status, features, expiresAt,
    isInitialized, isLoading, lastError,
    refresh,
  } = useLicenseStore();

  const [devices, setDevices] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'plans' | 'status' | 'devices'>('plans');

  useEffect(() => {
    if (isInitialized) {
      loadDevices();
    }
  }, [isInitialized]);

  const loadDevices = async () => {
    try {
      const a = api();
      if (a) {
        const result = await safeInvoke(a.deviceList);
        if (result.success && result.data) {
          setDevices(result.data);
        }
      }
    } catch (err) {
      console.error('[License] Failed to load devices:', err);
    }
  };

  const currentPlan = PLAN_DETAILS[plan] ?? PLAN_DETAILS.free;
  const Icon = currentPlan.icon;

  // Calculate remaining days
  const remainingDays = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-5xl mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-purple-400" />
            License & Plans
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage your subscription and unlock features</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading} className="border-white/10">
          <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Current Status Banner */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${
        status === 'active' ? 'bg-green-500/10 border-green-500/20' :
        status === 'expired' ? 'bg-yellow-500/10 border-yellow-500/20' :
        status === 'suspended' ? 'bg-red-500/10 border-red-500/20' :
        'bg-white/5 border-white/10'
      }`}>
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${currentPlan.gradient} flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium text-white">
            {currentPlan.name} Plan
          </div>
          <div className="text-xs text-gray-400 capitalize">Status: {status}</div>
        </div>
        {expiresAt && (
          <div className="text-right">
            <div className="text-xs text-gray-400">Expires</div>
            <div className="text-sm text-gray-200 font-mono">
              {new Date(expiresAt).toLocaleDateString()}
            </div>
            {remainingDays !== null && (
              <div className="text-xs text-gray-400">
                {remainingDays} days remaining
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-lg p-1">
        {(['plans', 'status', 'devices'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {tab === 'plans' ? 'Plans' : tab === 'status' ? 'License Status' : 'Devices'}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'plans' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className={`relative rounded-xl border p-6 transition-all ${
            plan === 'free'
              ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/20'
              : 'border-white/10 bg-white/5'
          }`}>
            {plan === 'free' && (
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full uppercase">
                Current
              </div>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center mb-3">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Free</h3>
            <p className="text-2xl font-bold text-white mb-4">Rp0</p>
            <div className="space-y-2 text-sm">
              {PLAN_DETAILS.free.limitations.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-400">
                  <X className="w-4 h-4 text-gray-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            {plan === 'free' && (
              <div className="mt-4 w-full py-2 text-center text-xs text-blue-400 border border-blue-500/20 rounded-lg">
                Current Plan
              </div>
            )}
          </div>

          {/* Pro Plan */}
          <div className={`relative rounded-xl border p-6 transition-all ${
            plan === 'pro'
              ? 'border-purple-500/50 bg-purple-500/10 ring-1 ring-purple-500/20'
              : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
          }`}>
            {plan === 'pro' && (
              <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-purple-600 text-white text-[10px] font-bold rounded-full uppercase">
                Current
              </div>
            )}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center mb-3">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">Pro</h3>
            <p className="text-2xl font-bold text-white mb-1">Rp150.000</p>
            <p className="text-xs text-gray-400 mb-4">/ month</p>
            <div className="space-y-2 text-sm">
              {PLAN_DETAILS.pro.features.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-300">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {item.label}
                </div>
              ))}
            </div>
            {plan === 'pro' ? (
              <div className="mt-4 w-full py-2 text-center text-xs text-purple-400 border border-purple-500/20 rounded-lg">
                Current Plan
              </div>
            ) : (
              <Button
                className="mt-4 w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                onClick={() => navigate('/payment')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Upgrade to Pro
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">License Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Plan</span>
                <p className="text-white font-medium capitalize">{plan}</p>
              </div>
              <div>
                <span className="text-gray-400">Status</span>
                <p className="text-white font-medium capitalize">{status}</p>
              </div>
              {expiresAt && (
                <>
                  <div>
                    <span className="text-gray-400">Expires At</span>
                    <p className="text-white font-medium">{new Date(expiresAt).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Remaining</span>
                    <p className="text-white font-medium">{remainingDays ?? 'N/A'} days</p>
                  </div>
                </>
              )}
            </div>

            {/* Feature Flags */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <h4 className="text-sm font-medium text-white mb-3">Active Features</h4>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(features).filter(([_, v]) => typeof v === 'boolean').map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {value ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <X className="w-4 h-4 text-gray-500" />
                    )}
                    <span className={value ? 'text-gray-300' : 'text-gray-500'}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Renew button if expired */}
            {status === 'expired' && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <Button
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
                  onClick={() => navigate('/payment')}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Renew Pro
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Registered Devices</h3>
            {devices.length === 0 ? (
              <p className="text-sm text-gray-400">No devices registered yet.</p>
            ) : (
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <Monitor className="w-5 h-5 text-gray-400" />
                    <div className="flex-1">
                      <p className="text-sm text-white">{device.name}</p>
                      <p className="text-xs text-gray-400">{device.platform}</p>
                    </div>
                    <div className="text-xs text-gray-400">
                      Last seen: {new Date(device.last_seen_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default LicensePage;
