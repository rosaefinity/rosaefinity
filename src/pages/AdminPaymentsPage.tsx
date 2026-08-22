// =============================================
// RosaeFinity — Admin Payments Page
// Manage QRIS payment approvals
// =============================================

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard, Search, CheckCircle, XCircle, Clock,
  Eye, Loader2, X, AlertCircle, DollarSign, Filter,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useAuthStore } from "../store/auth-store";
import { toast } from "../components/Toast";

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3000/api" : "");

// ── Types ──

interface PaymentUser {
  id: string;
  email: string | null;
  displayName: string | null;
}

interface PaymentPlan {
  id: string;
  name: string;
}

interface Payment {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  paymentMethod: string;
  status: string;
  paymentProofUrl: string | null;
  adminNotes: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  user: PaymentUser;
  approvedBy: PaymentUser | null;
  plan: PaymentPlan;
}

type FilterStatus = "all" | "PENDING" | "PAID" | "REJECTED";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING:  { label: "Pending",  color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
  PAID:     { label: "Approved", color: "text-green-400",  bg: "bg-green-400/10 border-green-400/20" },
  REJECTED: { label: "Rejected", color: "text-red-400",    bg: "bg-red-400/10 border-red-400/20" },
  EXPIRED:  { label: "Expired",  color: "text-white/40",   bg: "bg-white/[0.04] border-white/[0.08]" },
};

// ── Component ──

export default function AdminPaymentsPage() {
  const navigate = useNavigate();
  const { hasRole } = useAuthStore();
  const isAdmin = hasRole("admin");

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // ── Access Control ──
  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      toast("Access denied. Admin privileges required.");
    }
  }, [isAdmin, navigate]);

  // ── Fetch Payments ──
  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("rf_access_token");
      const params = new URLSearchParams({ limit: "100" });
      if (filter !== "all") params.set("status", filter);

      const res = await fetch(`${API_URL}/v1/payment/all?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setPayments(data.data || []);
      }
    } catch (err) {
      console.error("[ADMIN-PAYMENTS] Fetch error:", err);
      toast("Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // ── Approve ──
  const handleApprove = async (payment: Payment) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("rf_access_token");
      const res = await fetch(`${API_URL}/v1/payment/${payment.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        toast(`Payment approved. ${payment.user.email} now has Pro.`);
        setShowApproveModal(false);
        setSelectedPayment(null);
        fetchPayments();
      } else {
        toast(data.error || "Approval failed.");
      }
    } catch (err) {
      console.error("[ADMIN-PAYMENTS] Approve error:", err);
      toast("Approval failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject ──
  const handleReject = async (payment: Payment) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem("rf_access_token");
      const res = await fetch(`${API_URL}/v1/payment/${payment.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: rejectNotes || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        toast("Payment rejected.");
        setShowRejectModal(false);
        setSelectedPayment(null);
        setRejectNotes("");
        fetchPayments();
      } else {
        toast(data.error || "Rejection failed.");
      }
    } catch (err) {
      console.error("[ADMIN-PAYMENTS] Reject error:", err);
      toast("Rejection failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtered List ──
  const filtered = payments.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        p.user.email?.toLowerCase().includes(q) ||
        p.user.displayName?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const stats = {
    total: payments.length,
    pending: payments.filter((p) => p.status === "PENDING").length,
    paid: payments.filter((p) => p.status === "PAID").length,
    rejected: payments.filter((p) => p.status === "REJECTED").length,
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <CreditCard className="w-4 h-4 text-primary-light" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Payment Management</h1>
              <p className="text-xs text-white/40">Review and approve QRIS payments</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total", value: stats.total, icon: DollarSign, color: "text-white/60" },
              { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-400" },
              { label: "Approved", value: stats.paid, icon: CheckCircle, color: "text-green-400" },
              { label: "Rejected", value: stats.rejected, icon: XCircle, color: "text-red-400" },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                  <span className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</span>
                </div>
                <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Filters & Search */}
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {(["all", "PENDING", "PAID", "REJECTED"] as FilterStatus[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 h-7 rounded-lg text-xs font-medium transition-all",
                    filter === f
                      ? "bg-primary/20 border border-primary/30 text-white"
                      : "text-white/40 hover:text-white/60 border border-transparent"
                  )}
                >
                  {f === "all" ? "All" : STATUS_CONFIG[f]?.label || f}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
              <input
                type="text"
                placeholder="Search email, name, ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-white/20 outline-none focus:border-primary/40 transition-all w-56"
              />
            </div>
          </div>
        </motion.div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-primary/50 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <CreditCard className="w-10 h-10 text-white/10 mb-3" />
            <p className="text-sm text-white/40">No payments found</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                  <th className="text-left px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">User</th>
                  <th className="text-left px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Plan</th>
                  <th className="text-left px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Amount</th>
                  <th className="text-left px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Status</th>
                  <th className="text-left px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Date</th>
                  <th className="text-right px-4 py-3 text-[10px] text-white/30 uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => {
                  const st = STATUS_CONFIG[payment.status] || STATUS_CONFIG.EXPIRED;
                  return (
                    <tr key={payment.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm text-white/80 font-medium">{payment.user.displayName || "—"}</p>
                          <p className="text-[10px] text-white/30">{payment.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-white/60 capitalize">{payment.plan.name}</td>
                      <td className="px-4 py-3 text-sm text-white/60 font-mono">Rp{payment.amount.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border", st.bg, st.color)}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-white/40">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedPayment(payment)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all"
                            title="View Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {payment.status === "PENDING" && (
                            <>
                              <button
                                onClick={() => { setSelectedPayment(payment); setShowApproveModal(true); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-green-400/60 hover:text-green-400 hover:bg-green-400/10 transition-all"
                                title="Approve"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => { setSelectedPayment(payment); setShowRejectModal(true); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                                title="Reject"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      <AnimatePresence>
        {selectedPayment && !showApproveModal && !showRejectModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedPayment(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">Payment Details</h3>
                <button onClick={() => setSelectedPayment(null)} className="p-1 rounded-lg hover:bg-white/[0.06]">
                  <X className="w-4 h-4 text-white/30" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Payment ID", value: selectedPayment.id },
                  { label: "User", value: `${selectedPayment.user.displayName || "—"} (${selectedPayment.user.email})` },
                  { label: "Plan", value: selectedPayment.plan.name },
                  { label: "Amount", value: `Rp${selectedPayment.amount.toLocaleString()}` },
                  { label: "Method", value: selectedPayment.paymentMethod.toUpperCase() },
                  { label: "Status", value: STATUS_CONFIG[selectedPayment.status]?.label || selectedPayment.status },
                  { label: "Created", value: new Date(selectedPayment.createdAt).toLocaleString() },
                  ...(selectedPayment.approvedAt ? [{ label: "Approved At", value: new Date(selectedPayment.approvedAt).toLocaleString() }] : []),
                  ...(selectedPayment.approvedBy ? [{ label: "Approved By", value: selectedPayment.approvedBy.email || "—" }] : []),
                  ...(selectedPayment.adminNotes ? [{ label: "Admin Notes", value: selectedPayment.adminNotes }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-white/40">{row.label}</span>
                    <span className="text-white/70 text-right max-w-[60%] truncate">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Payment Proof */}
              {selectedPayment.paymentProofUrl && (
                <div className="mt-4">
                  <p className="text-xs text-white/40 mb-2">Payment Proof</p>
                  <img
                    src={selectedPayment.paymentProofUrl}
                    alt="Payment proof"
                    className="w-full rounded-xl border border-white/[0.08] object-contain max-h-64"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                </div>
              )}

              {selectedPayment.status === "PENDING" && (
                <div className="flex gap-3 mt-5">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="flex-1 h-10 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="flex-1 h-10 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium hover:bg-green-500/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Approve Confirmation Modal ── */}
      <AnimatePresence>
        {showApproveModal && selectedPayment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowApproveModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Approve Payment?</h3>
                <p className="text-sm text-white/40 mb-1">
                  This will activate <span className="text-white/60 font-medium">Pro</span> for
                </p>
                <p className="text-sm text-white/60 font-medium mb-4">{selectedPayment.user.email}</p>
                <p className="text-xs text-white/30 mb-6">This action cannot be undone. The user will immediately get Pro access.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowApproveModal(false)}
                    className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleApprove(selectedPayment)}
                    disabled={actionLoading}
                    className="flex-1 h-11 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Approve
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Reject Modal ── */}
      <AnimatePresence>
        {showRejectModal && selectedPayment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => { setShowRejectModal(false); setRejectNotes(""); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm mx-4 p-6 rounded-2xl bg-[#18181f] border border-white/[0.08] shadow-2xl"
            >
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
                  <AlertCircle className="w-7 h-7 text-red-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">Reject Payment?</h3>
                <p className="text-sm text-white/40 mb-4">
                  Reject payment from <span className="text-white/60 font-medium">{selectedPayment.user.email}</span>
                </p>
                <textarea
                  placeholder="Rejection reason (optional)"
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  className="w-full h-20 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/40 transition-all resize-none mb-5"
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowRejectModal(false); setRejectNotes(""); }}
                    className="flex-1 h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white/60 text-sm font-medium hover:bg-white/[0.06] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleReject(selectedPayment)}
                    disabled={actionLoading}
                    className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Reject
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
