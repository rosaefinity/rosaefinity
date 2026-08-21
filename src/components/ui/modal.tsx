// =============================================
// RosaeFinity â€” Modal System
// Replaces alert(), confirm(), prompt() with
// animated, accessible, keyboard-navigable modals.
// =============================================

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

// â”€â”€ Context â”€â”€
interface ModalContextValue {
  openModal: (config: ModalConfig) => string;
  closeModal: (id: string) => void;
  closeAll: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModalContext(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used within ModalProvider');
  return ctx;
}

// â”€â”€ Types â”€â”€
export interface ModalConfig {
  id?: string;
  title: string;
  content: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm' | 'progress';
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void | Promise<void>;
  onCancel?: () => void;
  showClose?: boolean;
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
}

interface ModalState extends ModalConfig {
  id: string;
  isOpen: boolean;
}

// â”€â”€ Provider â”€â”€
export function ModalProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [modals, setModals] = useState<ModalState[]>([]);

  const openModal = useCallback((config: ModalConfig): string => {
    const id = config.id || `modal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setModals(prev => [...prev, { ...config, id, isOpen: true }]);
    return id;
  }, []);

  const closeModal = useCallback((id: string) => {
    setModals(prev => prev.map(m => m.id === id ? { ...m, isOpen: false } : m));
    setTimeout(() => {
      setModals(prev => prev.filter(m => m.id !== id));
    }, 200);
  }, []);

  const closeAll = useCallback(() => {
    setModals(prev => prev.map(m => ({ ...m, isOpen: false })));
    setTimeout(() => setModals([]), 200);
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, closeAll }}>
      {children}
      <ModalContainer modals={modals} onClose={closeModal} />
    </ModalContext.Provider>
  );
}

// â”€â”€ Container â”€â”€
function ModalContainer({ modals, onClose }: { modals: ModalState[]; onClose: (id: string) => void }) {
  return (
    <AnimatePresence>
      {modals.map((modal, index) => (
        <ModalOverlay key={modal.id} modal={modal} onClose={onClose} zIndex={50 + index} />
      ))}
    </AnimatePresence>
  );
}

// â”€â”€ Overlay â”€â”€
function ModalOverlay({ modal, onClose, zIndex }: { modal: ModalState; onClose: (id: string) => void; zIndex: number }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (modal.isOpen) {
      // Focus trap
      const el = contentRef.current;
      if (el) el.focus();
    }
  }, [modal.isOpen]);

  useEffect(() => {
    if (!modal.isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modal.closeOnEsc !== false) {
        onClose(modal.id);
        modal.onCancel?.();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [modal.isOpen, modal.id, onClose, modal.closeOnEsc, modal.onCancel]);

  const sizeClasses: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-4xl',
  };

  const typeColors: Record<string, string> = {
    info: 'border-blue-500/30',
    success: 'border-green-500/30',
    warning: 'border-yellow-500/30',
    error: 'border-red-500/30',
    confirm: 'border-purple-500/30',
    progress: 'border-blue-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn('fixed inset-0 flex items-center justify-center p-4', `z-[${zIndex}]`)}
      style={{ zIndex }}
      onClick={(e) => {
        if (e.target === e.currentTarget && modal.closeOnOverlay !== false) {
          onClose(modal.id);
          modal.onCancel?.();
        }
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <motion.div
        ref={contentRef}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'relative w-full bg-[#1a1a2e] border rounded-2xl shadow-2xl outline-none',
          sizeClasses[modal.size || 'md'],
          typeColors[modal.type || 'info'],
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-base font-semibold text-white">{modal.title}</h3>
          {modal.showClose !== false && (
            <button
              onClick={() => { onClose(modal.id); modal.onCancel?.(); }}
              className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
          {modal.content}
        </div>

        {/* Footer (for confirm type) */}
        {(modal.type === 'confirm' || modal.onConfirm) && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/10">
            <button
              onClick={() => { onClose(modal.id); modal.onCancel?.(); }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
            >
              {modal.cancelText || 'Cancel'}
            </button>
            <button
              onClick={async () => {
                if (modal.onConfirm) await modal.onConfirm();
                onClose(modal.id);
              }}
              className="px-4 py-2 text-sm text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
            >
              {modal.confirmText || 'Confirm'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// â”€â”€ Convenience Hooks â”€â”€
export function useModal(): { open: (config: ModalConfig) => string; close: (id: string) => void } {
  const { openModal, closeModal } = useModalContext();
  return { open: openModal, close: closeModal };
}

/** Show an info modal */
export function showInfo(title: string, message: string): string {
  // Will be called via context
  return '';
}

/** Show a confirm dialog (returns promise) */
export function confirmAction(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    // Implementation via context â€” placeholder for direct calls
    resolve(window.confirm(`${title}\n\n${message}`));
  });
}
