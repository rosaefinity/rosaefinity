// =============================================
// RosaeFinity — Admin User Management Page
// Search, filter, activate/deactivate Pro licenses.
// =============================================

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Users, Search, Shield, Crown, Zap, Clock,
  RefreshCw, Loader2, X, Check, ChevronDown,
  AlertTriangle, UserCheck, UserX, Plus, Minus,
} from 'lucide-react';
import { useAuthStore } from '../store/auth-store';
import { toast } from '../components/Toast';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '');

async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('rf_access_token');
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json.data as T;
}

// ── Types ──

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  plan: string | null;
  status: string | null;
  expires_at: string | null;
}

interface UserDetail {
  user: { id: string; email: string; name: string; role: string; created_at: string };
  license: { id: string; user_id: string; plan: string; status: string; expires_at: string | null; created_at: string; updated_at: string } | null;
  devices: any[];
  payments: any[];
  activations: any[];
}

type FilterType = 'all' | 'free' | 'pro' | 'expired' | 'suspended';

// ── Helpers ──

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getPlanBadgeColor(plan: string | null): string {
  if (plan === 'pro') return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
  return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
}

function getStatusBadgeColor(status: string | null): string {
  if (status === 'active') return 'bg-green-500/20 text-green-400 border-green-500/30';
  if (status === 'expired') return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  if (status === 'suspended') return 'bg-red-500/20 text-red-400 border-red-500/30';
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

// ── Main Component ──

export function AdminUsersPage(): JSX.Element {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole('admin');

  // ── State ──
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Access Control ──
  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      toast('Access denied. Admin only.');
    }
  }, [isAdmin, navigate]);

  // ── Load Users ──
  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawUsers = await adminFetch<Array<Record<string, unknown>>>('/admin/users');
      const normalizedUsers: AdminUser[] = rawUsers.map((u) => ({
        id: String(u.id || ''),
        email: String(u.email || ''),
        name: String(u.displayName || u.name || u.username || ''),
        role: String(u.role || 'USER'),
        created_at: String(u.createdAt || u.created_at || ''),
        plan: (u.accountType as string | null) || null,
        status: (u.status as string | null) || null,
        expires_at: (u.expires_at as string | null) || null,
      }));
      setUsers(normalizedUsers);
    } catch (err) {
      console.error('[Admin] Failed to load users:', err);
      setUsers([]);
      toast('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin, loadUsers]);

  // ── Filter Users ──
  useEffect(() => {
    let result = [...users];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q)
      );
    }

    // Plan/status filter
    if (activeFilter !== 'all') {
      result = result.filter(u => {
        const plan = u.plan || 'free';
        const status = u.status || 'active';
        switch (activeFilter) {
          case 'free': return plan === 'free';
          case 'pro': return plan === 'pro' && status === 'active';
          case 'expired': return status === 'expired';
          case 'suspended': return status === 'suspended';
          default: return true;
        }
      });
    }

    setFilteredUsers(result);
  }, [users, searchQuery, activeFilter]);

  // ── View User Detail ──
  const handleViewUser = async (userId: string) => {
    try {
      const detail = await adminFetch<UserDetail>(`/admin/users/${userId}`);
      setSelectedUser(detail);
      setShowDetailModal(true);
    } catch (err) {
      console.error('[Admin] Failed to load user detail:', err);
      toast('Failed to load user details');
    }
  };

  // ── Activate Pro ──
  const handleActivatePro = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);
    try {
      await adminFetch('/license/activate', {
        method: 'POST',
        body: JSON.stringify({ licenseKey: 'ROSAE-PRO-DEMO-DEMO-DEMO', deviceId: 'admin-activate', email: selectedUser.user.email }),
      });
      toast(`Pro activated for ${selectedUser.user.email}`);
      setShowActivateModal(false);
      setShowDetailModal(false);
      loadUsers();
    } catch (err) {
      console.error('[Admin] Activation failed:', err);
      toast('Activation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Extend License ──
  const handleExtendLicense = async (days: number) => {
    if (!selectedUser) return;
    setIsProcessing(true);
    try {
      await adminFetch(`/admin/users/${selectedUser.user.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ days }),
      });
      toast(`Extended by ${days} days`);
      // Refresh user detail
      const detail = await adminFetch<UserDetail>(`/admin/users/${selectedUser.user.id}`);
      setSelectedUser(detail);
      loadUsers();
    } catch (err) {
      console.error('[Admin] Extension failed:', err);
      toast('Extension failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Deactivate Pro ──
  const handleDeactivatePro = async () => {
    if (!selectedUser) return;
    setIsProcessing(true);
    try {
      await adminFetch(`/admin/users/${selectedUser.user.id}/downgrade`, {
        method: 'POST',
      });
      toast(`Pro deactivated for ${selectedUser.user.email}`);
      setShowDeactivateModal(false);
      setShowDetailModal(false);
      loadUsers();
    } catch (err) {
      console.error('[Admin] Deactivation failed:', err);
      toast('Deactivation failed');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Redirect if not admin ──
  if (!isAdmin) return null;

  // ── Render ──
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-400" />
            User Management
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manage user accounts and Pro licenses
          </p>
        </div>
        <button
          onClick={loadUsers}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50 transition-colors"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['all', 'free', 'pro', 'expired', 'suspended'] as FilterType[]).map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                activeFilter === filter
                  ? 'bg-white/10 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No users found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Expires</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map(user => (
                  <tr key={user.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm text-white/80">{user.email}</td>
                    <td className="px-4 py-3 text-sm text-white/60">{user.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                        user.role === 'admin'
                          ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                      }`}>
                        {user.role === 'admin' && <Shield className="w-3 h-3" />}
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getPlanBadgeColor(user.plan)}`}>
                        {user.plan === 'pro' && <Crown className="w-3 h-3" />}
                        {(user.plan || 'free').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusBadgeColor(user.status)}`}>
                        {(user.status || 'active').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">
                      {formatDate(user.expires_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleViewUser(user.id)}
                        className="px-3 py-1.5 rounded-lg bg-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/30 transition-colors"
                      >
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-white">{users.length}</div>
          <div className="text-xs text-gray-400">Total Users</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-purple-400">
            {users.filter(u => u.plan === 'pro' && u.status === 'active').length}
          </div>
          <div className="text-xs text-gray-400">Pro Users</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-blue-400">
            {users.filter(u => !u.plan || u.plan === 'free').length}
          </div>
          <div className="text-xs text-gray-400">Free Users</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-2xl font-bold text-yellow-400">
            {users.filter(u => u.status === 'expired').length}
          </div>
          <div className="text-xs text-gray-400">Expired</div>
        </div>
      </div>

      {/* ══════ USER DETAIL MODAL ══════ */}
      <AnimatePresence>
        {showDetailModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">User Details</h3>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                >
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>

              {/* User Info */}
              <div className="space-y-4 mb-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-400">Email</span>
                    <p className="text-sm text-white">{selectedUser.user.email}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Name</span>
                    <p className="text-sm text-white">{selectedUser.user.name}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Role</span>
                    <p className="text-sm text-white capitalize">{selectedUser.user.role}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400">Created</span>
                    <p className="text-sm text-white">{formatDate(selectedUser.user.created_at)}</p>
                  </div>
                </div>

                {/* License Info */}
                <div className="pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white mb-3">License</h4>
                  {selectedUser.license ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-xs text-gray-400">Plan</span>
                        <p className="text-sm text-white capitalize">{selectedUser.license.plan}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400">Status</span>
                        <p className="text-sm text-white capitalize">{selectedUser.license.status}</p>
                      </div>
                      {selectedUser.license.expires_at && (
                        <div>
                          <span className="text-xs text-gray-400">Expires</span>
                          <p className="text-sm text-white">{formatDate(selectedUser.license.expires_at)}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">No license record (Free user)</p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {(!selectedUser.license || selectedUser.license.plan === 'free') ? (
                  <button
                    onClick={() => setShowActivateModal(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-medium hover:from-purple-500 hover:to-pink-500 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    Activate Pro
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleExtendLicense(30)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      +30 Days
                    </button>
                    <button
                      onClick={() => handleExtendLicense(90)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      +90 Days
                    </button>
                    <button
                      onClick={() => handleExtendLicense(365)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      +365 Days
                    </button>
                    <button
                      onClick={() => setShowDeactivateModal(true)}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-colors"
                    >
                      <UserX className="w-4 h-4" />
                      Deactivate
                    </button>
                  </>
                )}
              </div>

              {/* Recent Activity */}
              {selectedUser.activations && selectedUser.activations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h4 className="text-sm font-medium text-white mb-3">Recent Activity</h4>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedUser.activations.slice(0, 5).map((act: any) => (
                      <div key={act.id} className="flex items-center gap-2 text-xs">
                        <span className="text-gray-400">{formatDate(act.created_at)}</span>
                        <span className="text-white/60">{act.action}</span>
                        <span className="text-gray-500">by {act.performed_by}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ ACTIVATE MODAL ══════ */}
      <AnimatePresence>
        {showActivateModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowActivateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-7 h-7 text-purple-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Activate Pro</h3>
                <p className="text-sm text-white/40">{selectedUser.user.email}</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Plan</span>
                  <span className="text-white font-medium">PRO</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Start</span>
                  <span className="text-white">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Duration</span>
                  <span className="text-white">30 days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Expires</span>
                  <span className="text-white">
                    {new Date(Date.now() + 30 * 86400000).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowActivateModal(false)}
                  className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleActivatePro}
                  disabled={isProcessing}
                  className="flex-1 h-11 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white text-sm font-semibold hover:from-purple-500 hover:to-pink-500 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Activate Pro
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ DEACTIVATE MODAL ══════ */}
      <AnimatePresence>
        {showDeactivateModal && selectedUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeactivateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Deactivate Pro?</h3>
                <p className="text-sm text-white/40">{selectedUser.user.email}</p>
              </div>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Current Plan</span>
                  <span className="text-white">{(selectedUser.license?.plan || 'free').toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Expires</span>
                  <span className="text-white">{formatDate(selectedUser.license?.expires_at)}</span>
                </div>
              </div>

              <p className="text-xs text-red-400/80 text-center mb-6">
                This will immediately downgrade the user to Free plan.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.06] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeactivatePro}
                  disabled={isProcessing}
                  className="flex-1 h-11 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <UserX className="w-4 h-4" />
                      Deactivate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminUsersPage;
