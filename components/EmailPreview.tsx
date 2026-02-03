import React from 'react';
import { Mail, X } from 'lucide-react';

interface EmailPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  subject: string;
  body: string;
  html?: string;
  fromEmail?: string;
  toEmail?: string;
}

export const EmailPreview: React.FC<EmailPreviewProps> = ({
  isOpen,
  onClose,
  subject,
  body,
  html,
  fromEmail,
  toEmail
}) => {
  if (!isOpen) return null;

  const emailHtml = html || body.replace(/\n/g, '<br>');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Mail className="text-blue-600 dark:text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">Email Preview</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">How your email will appear to recipients</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-8">
            {/* Email Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 pb-4 mb-6">
              {fromEmail && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-bold">From:</span> {fromEmail}
                </div>
              )}
              {toEmail && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  <span className="font-bold">To:</span> {toEmail}
                </div>
              )}
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                <span className="font-bold">Subject:</span> {subject || '(No subject)'}
              </div>
            </div>

            {/* Email Body */}
            <div 
              className="prose prose-slate dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: emailHtml }}
            />
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-bold text-sm transition-all"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
