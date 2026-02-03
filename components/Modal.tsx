import React, { useEffect } from 'react';
import { X, AlertTriangle, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

export type ModalType = 'confirm' | 'alert' | 'info' | 'success' | 'warning';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void | Promise<void>;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  showCancel?: boolean;
  children?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'info',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonClass,
  showCancel = true,
  children,
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const icons = {
    confirm: <AlertCircle className="text-blue-600 dark:text-blue-400" size={24} />,
    alert: <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />,
    info: <Info className="text-blue-600 dark:text-blue-400" size={24} />,
    success: <CheckCircle2 className="text-emerald-600 dark:text-emerald-400" size={24} />,
    warning: <AlertTriangle className="text-amber-600 dark:text-amber-400" size={24} />,
  };

  const iconColors = {
    confirm: 'bg-blue-100 dark:bg-blue-900/30',
    alert: 'bg-amber-100 dark:bg-amber-900/30',
    info: 'bg-blue-100 dark:bg-blue-900/30',
    success: 'bg-emerald-100 dark:bg-emerald-900/30',
    warning: 'bg-amber-100 dark:bg-amber-900/30',
  };

  const defaultConfirmClass = {
    confirm: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white',
    alert: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white',
    info: 'bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white',
    success: 'bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white',
    warning: 'bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white',
  };

  const handleConfirm = async () => {
    if (onConfirm) {
      await onConfirm();
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`shrink-0 w-12 h-12 rounded-full flex items-center justify-center ${iconColors[type]}`}>
              {icons[type]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-black text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3 rounded-b-2xl">
          {showCancel && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg font-bold text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className={`px-6 py-2 rounded-lg font-black text-sm transition-all shadow-sm hover:shadow-md ${confirmButtonClass || defaultConfirmClass[type]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
