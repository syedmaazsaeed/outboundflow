import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
  fullScreen?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isVisible, 
  message = 'Loading...',
  fullScreen = false 
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50 backdrop-blur-sm animate-in fade-in duration-200 ${
        fullScreen ? '' : 'bg-transparent'
      }`}
    >
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col items-center gap-4 min-w-[200px]">
        <Loader2 className="text-blue-600 dark:text-blue-400 animate-spin" size={32} />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{message}</p>
      </div>
    </div>
  );
};

export const LoadingSpinner: React.FC<{ size?: number; className?: string }> = ({ 
  size = 20, 
  className = '' 
}) => (
  <Loader2 className={`animate-spin text-blue-600 dark:text-blue-400 ${className}`} size={size} />
);
