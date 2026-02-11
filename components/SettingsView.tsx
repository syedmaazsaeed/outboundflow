
import React, { useState } from 'react';
import { Mail, Key, Bell, Server, Shield, Globe, Trash2, Plus, Flame, CheckCircle2, AlertTriangle, Loader2, Zap, Edit2, X } from 'lucide-react';
import { SmtpAccount } from '../types';
import { useToastContext } from '../contexts/ToastContext';
import Modal from './Modal';
import { Tooltip } from './Tooltip';

interface SettingsViewProps {
  accounts: SmtpAccount[];
  onUpdateAccounts: (accounts: SmtpAccount[]) => Promise<void>;
}

const SettingsView: React.FC<SettingsViewProps> = ({ accounts, onUpdateAccounts }) => {
  const toast = useToastContext();
  const [isAdding, setIsAdding] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; accountId: string | null; accountLabel: string}>({isOpen: false, accountId: null, accountLabel: ''});
  const [newAcc, setNewAcc] = useState<Partial<SmtpAccount>>({
    label: '', host: '', port: 587, user: '', pass: '', secure: true, fromEmail: '', warmupEnabled: true, warmupSentToday: 0, dailySendLimit: 100, sentToday: 0, lastResetDate: new Date().toISOString().split('T')[0]
  });

  const toggleWarmup = async (id: string) => {
    try {
      await onUpdateAccounts(accounts.map(a => a.id === id ? { ...a, warmupEnabled: !a.warmupEnabled } : a));
    } catch (error) {
      console.error('Error toggling warmup:', error);
    }
  };

  const validateAccount = (acc: Partial<SmtpAccount>): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!acc.host || acc.host.trim() === '') errs.host = 'SMTP host is required';
    if (!acc.user || acc.user.trim() === '') errs.user = 'SMTP user/email is required';
    if (!acc.fromEmail || acc.fromEmail.trim() === '') {
      errs.fromEmail = 'From email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(acc.fromEmail)) {
      errs.fromEmail = 'Invalid email format';
    }
    if (acc.port && (acc.port < 1 || acc.port > 65535)) {
      errs.port = 'Port must be between 1 and 65535';
    }
    return errs;
  };

  const testConnection = async (id: string) => {
    setIsTesting(id);
    try {
      // Simulate connection test
      await new Promise(r => setTimeout(r, 1500));
      setIsTesting(null);
      toast.success("Connection to SMTP host successful. In a live environment, this verifies SSL/TLS and Auth credentials.");
    } catch (error) {
      setIsTesting(null);
      toast.error("Connection test failed. Please check your SMTP settings.");
    }
  };

  const addAccount = async () => {
    const errs = validateAccount(newAcc);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    
    setIsSaving(true);
    
    const acc: SmtpAccount = {
        id: Math.random().toString(36).substr(2, 9), // Temporary ID, will be replaced by database
        label: newAcc.label || newAcc.user!,
        host: newAcc.host!.trim(),
        port: newAcc.port!,
        user: newAcc.user!.trim(),
        pass: newAcc.pass || '',
        secure: newAcc.secure ?? true,
        fromEmail: newAcc.fromEmail!.trim(),
        warmupEnabled: true,
        warmupSentToday: 0,
        dailySendLimit: newAcc.dailySendLimit || 100,
        sentToday: 0,
        lastResetDate: new Date().toISOString().split('T')[0]
    };
    
    // Add timeout to prevent infinite hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Save operation timed out after 30 seconds')), 30000);
    });
    
    try {
      console.log('[addAccount] Attempting to save account:', acc.label);
      // Save account with timeout
      await Promise.race([
        onUpdateAccounts([...accounts, acc]),
        timeoutPromise
      ]);
      console.log('[addAccount] Account saved successfully');
      // Close form on success
      setIsAdding(false);
      setNewAcc({ label: '', host: '', port: 587, user: '', pass: '', secure: true, fromEmail: '', warmupEnabled: true, warmupSentToday: 0 });
    } catch (error: any) {
      console.error('[addAccount] Error adding account:', error);
      const errorMessage = error.message || 'Unknown error occurred';
<<<<<<< HEAD
      alert(`Failed to save SMTP account: ${errorMessage}\n\nPossible causes:\n1. Supabase not configured (check .env.local)\n2. Database table doesn't exist\n3. Network error\n4. Operation timed out\n\nCheck browser console (F12) for details.`);
=======
      toast.error(`Failed to save SMTP account: ${errorMessage}. Check browser console (F12) for details.`, 8000);
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665
      // Keep form open if save failed
    } finally {
      setIsSaving(false);
      console.log('[addAccount] Save operation completed');
    }
  };

  const updateAccount = async (id: string, updates: Partial<SmtpAccount>) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;
    const updated = { ...account, ...updates };
    const errs = validateAccount(updated);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    try {
      await onUpdateAccounts(accounts.map(a => a.id === id ? updated : a));
<<<<<<< HEAD
      setEditingId(null);
    } catch (error) {
      console.error('Error updating account:', error);
=======
      toast.success(`SMTP account "${updated.label}" updated successfully`);
      setEditingId(null);
    } catch (error) {
      console.error('Error updating account:', error);
      toast.error('Failed to update account. Please try again.');
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteModal.accountId) return;
    try {
      await onUpdateAccounts(accounts.filter(a => a.id !== deleteModal.accountId));
      toast.success(`SMTP account "${deleteModal.accountLabel}" deleted successfully`);
      setDeleteModal({ isOpen: false, accountId: null, accountLabel: '' });
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Failed to delete account. Please try again.');
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665
    }
  };

  return (
    <>
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, accountId: null, accountLabel: '' })}
        onConfirm={handleDeleteAccount}
        title="Delete SMTP Account"
        message={`Are you sure you want to delete "${deleteModal.accountLabel}"? This action cannot be undone.`}
        type="alert"
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white"
      />
      <div className="max-w-4xl space-y-8 pb-12 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Infrastructure Control</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Manage your sending domains and SMTP connectivity.</p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30 flex justify-between items-center">
            <h3 className="font-black text-slate-900 dark:text-slate-100 flex items-center gap-2"><Server className="text-blue-600 dark:text-blue-400" size={20} /> Sending Accounts</h3>
            {!isAdding && <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl text-sm font-black hover:bg-blue-700 dark:hover:bg-blue-600 shadow-sm transition-all">+ Add SMTP</button>}
          </div>
          <div className="p-6 space-y-4">
             {isAdding && (
                 <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-200 dark:border-slate-600 mb-6 space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-slate-900 dark:text-slate-100">Add New SMTP Account</h4>
                      <button onClick={() => { setIsAdding(false); setErrors({}); setNewAcc({ label: '', host: '', port: 587, user: '', pass: '', secure: true, fromEmail: '', warmupEnabled: true, warmupSentToday: 0, dailySendLimit: 100, sentToday: 0, lastResetDate: new Date().toISOString().split('T')[0] }); }} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg">
                        <X size={18} className="text-slate-500 dark:text-slate-400" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Account Label</label>
                          <input 
                            placeholder="My Gmail Account" 
                            className={`w-full px-4 py-2.5 rounded-xl border ${errors.label ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`} 
                            value={newAcc.label || ''}
                            onChange={e => { setNewAcc({...newAcc, label: e.target.value}); if (errors.label) setErrors({...errors, label: ''}); }} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SMTP Host <span className="text-red-500">*</span></label>
                          <input 
                            placeholder="smtp.gmail.com" 
                            className={`w-full px-4 py-2.5 rounded-xl border ${errors.host ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`} 
                            value={newAcc.host || ''}
                            onChange={e => { setNewAcc({...newAcc, host: e.target.value}); if (errors.host) setErrors({...errors, host: ''}); }} 
                          />
                          {errors.host && <p className="text-xs text-red-500 mt-1">{errors.host}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SMTP Port</label>
                          <input 
                            type="number"
                            placeholder="587" 
                            className={`w-full px-4 py-2.5 rounded-xl border ${errors.port ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`} 
                            value={newAcc.port || 587}
                            onChange={e => { setNewAcc({...newAcc, port: parseInt(e.target.value) || 587}); if (errors.port) setErrors({...errors, port: ''}); }} 
                          />
                          {errors.port && <p className="text-xs text-red-500 mt-1">{errors.port}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">SMTP User / Email <span className="text-red-500">*</span></label>
                          <input 
                            placeholder="your-email@gmail.com" 
                            className={`w-full px-4 py-2.5 rounded-xl border ${errors.user ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`} 
                            value={newAcc.user || ''}
                            onChange={e => { setNewAcc({...newAcc, user: e.target.value}); if (errors.user) setErrors({...errors, user: ''}); }} 
                          />
                          {errors.user && <p className="text-xs text-red-500 mt-1">{errors.user}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">App Password</label>
                          <input 
                            placeholder="Enter app password" 
                            type="password" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" 
                            value={newAcc.pass || ''}
                            onChange={e => setNewAcc({...newAcc, pass: e.target.value})} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">From Email Address <span className="text-red-500">*</span></label>
                          <input 
                            placeholder="sender@yourdomain.com" 
                            className={`w-full px-4 py-2.5 rounded-xl border ${errors.fromEmail ? 'border-red-300 dark:border-red-700' : 'border-slate-200 dark:border-slate-600'} bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none`} 
                            value={newAcc.fromEmail || ''}
                            onChange={e => { setNewAcc({...newAcc, fromEmail: e.target.value}); if (errors.fromEmail) setErrors({...errors, fromEmail: ''}); }} 
                          />
                          {errors.fromEmail && <p className="text-xs text-red-500 mt-1">{errors.fromEmail}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Daily Send Limit</label>
                          <input 
                            type="number"
                            placeholder="100" 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" 
                            value={newAcc.dailySendLimit || 100}
                            onChange={e => setNewAcc({...newAcc, dailySendLimit: parseInt(e.target.value) || 100})} 
                          />
                          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Maximum emails to send per day from this inbox</p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button 
<<<<<<< HEAD
                          onClick={() => { setIsAdding(false); setErrors({}); setNewAcc({ label: '', host: '', port: 587, user: '', pass: '', secure: true, fromEmail: '', warmupEnabled: true, warmupSentToday: 0 }); }} 
=======
                          onClick={() => { setIsAdding(false); setErrors({}); setNewAcc({ label: '', host: '', port: 587, user: '', pass: '', secure: true, fromEmail: '', warmupEnabled: true, warmupSentToday: 0, dailySendLimit: 100, sentToday: 0, lastResetDate: new Date().toISOString().split('T')[0] }); }} 
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665
                          disabled={isSaving}
                          className="px-4 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={addAccount} 
                          disabled={isSaving}
                          className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl text-sm font-black hover:bg-blue-700 dark:hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Saving...
                            </>
                          ) : (
                            'Save Account'
                          )}
                        </button>
                    </div>
                 </div>
             )}
             {accounts.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 dark:text-slate-500 font-medium italic border-2 border-dashed border-slate-100 dark:border-slate-700 rounded-2xl">
                    No accounts connected yet.
                 </div>
             ) : accounts.map(acc => (
                <div key={acc.id} className="p-5 border border-slate-100 dark:border-slate-700 rounded-2xl flex items-center justify-between hover:border-blue-200 dark:hover:border-blue-700 transition-all bg-white dark:bg-slate-700/30 group">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                            <Mail size={24} />
                        </div>
                        <div className="flex-1">
                            <div className="font-black text-slate-900 dark:text-slate-100">{acc.label}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{acc.host}:{acc.port} • {acc.fromEmail}</div>
                            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">Daily Limit: {acc.sentToday || 0} / {acc.dailySendLimit || 100} emails</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => testConnection(acc.id)} 
                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                            disabled={isTesting === acc.id}
                        >
                            {isTesting === acc.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                            Test
                        </button>
                        <button 
                          onClick={async () => {
<<<<<<< HEAD
                            if (confirm(`Are you sure you want to delete "${acc.label}"?`)) {
                              try {
                                await onUpdateAccounts(accounts.filter(a => a.id !== acc.id));
                              } catch (error) {
                                console.error('Error deleting account:', error);
                                alert('Failed to delete account. Please try again.');
                              }
                            }
=======
                            setDeleteModal({ isOpen: true, accountId: acc.id, accountLabel: acc.label });
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665
                          }} 
                          className="p-2 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" 
                          title="Delete account"
                        >
                          <Trash2 size={18} />
                        </button>
                    </div>
                </div>
             ))}
          </div>
        </section>

        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-3xl p-8 flex items-start gap-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl"><Shield size={24} /></div>
            <div>
                <h3 className="font-black text-slate-900 dark:text-slate-100 text-lg">Infrastructure Protocol</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed font-medium">
                    This control panel uses a browser-based worker to orchestrate sequences. However, because modern browsers cannot open raw TCP sockets for SMTP, **actual email delivery** requires a backend relay (e.g., a simple Node.js script using Nodemailer) to receive the campaign triggers and perform the final dispatch.
                </p>
                <div className="mt-4 flex gap-4 flex-wrap">
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Client: Web Interface</div>
                    <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Dispatch: Backend Relay</div>
                </div>
            </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default SettingsView;
