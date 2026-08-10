// =============================================
// RosaeFinity â€” Notification Center
// Centralized, stacking, auto-dismissing notifications
// with history panel.
// =============================================

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Bell, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';

// â”€â”€ Types â”€â”€
export type NotificationType = 'success' | 'warning' | 'error' | 'info';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  timestamp: number;
  dismissed: boolean;
}

// â”€â”€ Context â”€â”€
interface NotificationContextValue {
  notifications: Notification[];
  history: Notification[];
  add: (type: NotificationType, title: string, message?: string, duration?: number) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
  clearHistory: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}

// â”€â”€ Provider â”€â”€
export function NotificationProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [history, setHistory] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, dismissed: true } : n));
    // Move to history
    setNotifications(prev => {
      const dismissed = prev.find(n => n.id === id);
      if (dismissed) {
        setHistory(h => [{ ...dismissed, dismissed: true }, ...h].slice(0, 100));
      }
      return prev.filter(n => n.id !== id);
    });
  }, []);

  const add = useCallback((type: NotificationType, title: string, message?: string, duration = 4000): string => {
    const id = `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const notification: Notification = {
      id, type, title, message, duration, timestamp: Date.now(), dismissed: false,
    };
    setNotifications(prev => [...prev.slice(-9), notification]); // Max 10 visible

    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }

    return id;
  }, [dismiss]);

  const clearAll = useCallback(() => {
    setNotifications(prev => {
      setHistory(h => [...prev.map(n => ({ ...n, dismissed: true })), ...h].slice(0, 100));
      return [];
    });
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  return (
    <NotificationContext.Provider value={{ notifications, history, add, dismiss, clearAll, clearHistory }}>
      {children}
      <NotificationContainer notifications={notifications} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

// â”€â”€ Container â”€â”€
function NotificationContainer({ notifications, onDismiss }: {
  notifications: Notification[];
  onDismiss: (id: string) => void;
}) {
  const visible = notifications.filter(n => !n.dismissed);
  if (visible.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[100] space-y-2 w-80">
      <AnimatePresence>
        {visible.map(n => (
          <NotificationItem key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// â”€â”€ Item â”€â”€
const TYPE_CONFIG: Record<NotificationType, { icon: typeof CheckCircle2; color: string; border: string; bg: string }> = {
  success: { icon: CheckCircle2, color: 'text-green-400', border: 'border-green-500/20', bg: 'bg-green-500/10' },
  warning: { icon: AlertTriangle, color: 'text-yellow-400', border: 'border-yellow-500/20', bg: 'bg-yellow-500/10' },
  error: { icon: XCircle, color: 'text-red-400', border: 'border-red-500/20', bg: 'bg-red-500/10' },
  info: { icon: Info, color: 'text-blue-400', border: 'border-blue-500/20', bg: 'bg-blue-500/10' },
};

function NotificationItem({ notification, onDismiss }: { notification: Notification; onDismiss: (id: string) => void }) {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl border shadow-xl shadow-black/20',
        config.bg, config.border,
      )}
    >
      <Icon className={cn('w-5 h-5 mt-0.5 shrink-0', config.color)} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{notification.title}</div>
        {notification.message && (
          <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">{notification.message}</div>
        )}
      </div>
      <button
        onClick={() => onDismiss(notification.id)}
        className="text-gray-500 hover:text-white transition-colors shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// â”€â”€ History Panel â”€â”€
export function NotificationHistory(): JSX.Element {
  const { history, clearHistory } = useNotifications();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5"
      >
        <Bell className="w-5 h-5" />
        {history.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-purple-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {Math.min(history.length, 99)}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 top-full mt-2 w-80 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <span className="text-sm font-medium text-white">Notification History</span>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-white flex items-center gap-1">
                  <Trash2 className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
            <div className="max-h-80 overflow-y-auto scrollbar-thin">
              {history.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">No notifications yet</div>
              ) : (
                history.map(n => {
                  const config = TYPE_CONFIG[n.type];
                  const Icon = config.icon;
                  return (
                    <div key={n.id} className="flex items-start gap-2.5 px-4 py-2.5 border-b border-white/5">
                      <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white">{n.title}</div>
                        {n.message && <div className="text-[11px] text-gray-500 line-clamp-1">{n.message}</div>}
                      </div>
                      <span className="text-[10px] text-gray-600 shrink-0">
                        {new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// â”€â”€ Global toast function â”€â”€
let _addNotification: NotificationContextValue['add'] | null = null;

export function setNotificationAdder(adder: NotificationContextValue['add']): void {
  _addNotification = adder;
}

/** Global notification function â€” works anywhere */
export function notify(type: NotificationType, title: string, message?: string): string {
  if (_addNotification) return _addNotification(type, title, message);
  // Fallback â€” notification provider not yet initialized
  return '';
  return '';
}
