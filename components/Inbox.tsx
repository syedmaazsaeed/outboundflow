
import React, { useState } from 'react';
import { EmailMessage } from '../types';
import { Search, Mail, MailOpen, RefreshCw, Trash2, Reply, Star, CheckCircle } from 'lucide-react';

interface InboxProps {
  emails: EmailMessage[];
  onUpdateEmails: (emails: EmailMessage[]) => void;
}

const Inbox: React.FC<InboxProps> = ({ emails, onUpdateEmails }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmail, setSelectedEmail] = useState<EmailMessage | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filtered = emails.filter(e => 
    e.from.toLowerCase().includes(searchTerm.toLowerCase()) || 
    e.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const refreshInbox = async () => {
    setIsRefreshing(true);
    // Real IMAP/API sync simulation
    await new Promise(r => setTimeout(r, 2000));
    // In a practical app, you would fetch from your backend here.
    setIsRefreshing(false);
  };

  const markAsRead = (id: string) => {
    onUpdateEmails(emails.map(e => e.id === id ? { ...e, isRead: true } : e));
  };

  const deleteEmail = (id: string) => {
    onUpdateEmails(emails.filter(e => e.id !== id));
    if (selectedEmail?.id === id) setSelectedEmail(null);
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Lead Interactions</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Real-time prospect replies detected from your domains.</p>
        </div>
        <button 
          onClick={refreshInbox}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          {isRefreshing ? 'Syncing...' : 'Sync Inbox'}
        </button>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm flex overflow-hidden">
        {/* Email List */}
        <div className="w-1/3 border-r border-slate-100 dark:border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-700/30">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={16} />
                <input 
                  placeholder="Search interactions..."
                  className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
             </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-700">
            {filtered.length === 0 ? (
                <div className="p-12 text-center text-slate-400 dark:text-slate-500 italic text-sm">
                    No replies detected yet.
                </div>
            ) : (
                filtered.map(email => (
                    <div 
                        key={email.id}
                        onClick={() => { setSelectedEmail(email); markAsRead(email.id); }}
                        className={`p-4 cursor-pointer transition-all hover:bg-slate-50 dark:hover:bg-slate-700/50 border-l-4 ${selectedEmail?.id === email.id ? 'bg-blue-50/50 dark:bg-blue-900/20 border-blue-600 dark:border-blue-500' : 'border-transparent'}`}
                    >
                        <div className="flex justify-between items-start mb-1">
                            <span className={`text-sm ${!email.isRead ? 'font-black text-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>{email.from.split('@')[0]}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase">{new Date(email.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className={`text-xs truncate ${!email.isRead ? 'font-black text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>{email.subject}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-1">{email.body}</div>
                    </div>
                ))
            )}
          </div>
        </div>

        {/* Email Content */}
        <div className="flex-1 flex flex-col bg-slate-50/30 dark:bg-slate-900/30">
          {selectedEmail ? (
              <>
                <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center shadow-sm">
                   <div className="flex gap-2">
                       <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400"><Reply size={18} /></button>
                       <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400"><Star size={18} /></button>
                       <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-400"><CheckCircle size={18} /></button>
                   </div>
                   <button onClick={() => deleteEmail(selectedEmail.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 rounded-lg"><Trash2 size={18} /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 p-10 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="mb-8 pb-6 border-b border-slate-100 dark:border-slate-700">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mb-4">{selectedEmail.subject}</h2>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center font-bold text-slate-500 dark:text-slate-400">
                                    {selectedEmail.from.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">{selectedEmail.from}</div>
                                    <div className="text-xs text-slate-400 dark:text-slate-500">Received on: {new Date(selectedEmail.date).toLocaleString()}</div>
                                </div>
                            </div>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                            {selectedEmail.body}
                        </div>
                    </div>
                </div>
              </>
          ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-12 text-center">
                  <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <MailOpen size={40} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-2">No Thread Selected</h3>
                  <p className="text-sm max-w-xs leading-relaxed font-medium text-slate-500 dark:text-slate-400">Click on a prospect's message to view the full interaction history.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inbox;
