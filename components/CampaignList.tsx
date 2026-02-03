
import React, { useState } from 'react';
import { Campaign, CampaignStatus } from '../types';
import { MoreVertical, Play, Plus, Trash2, Webhook, Clock, Calendar, Users, TrendingUp, Copy } from 'lucide-react';
import { useToastContext } from '../contexts/ToastContext';
import Modal from './Modal';

interface CampaignListProps {
  campaigns: Campaign[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClone?: (campaign: Campaign) => void;
}

const CampaignList: React.FC<CampaignListProps> = ({ campaigns, onSelect, onAdd, onDelete, onClone }) => {
  const toast = useToastContext();
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean; campaignId: string | null; campaignName: string}>({isOpen: false, campaignId: null, campaignName: ''});
  const [cloneModal, setCloneModal] = useState<{isOpen: boolean; campaign: Campaign | null}>({isOpen: false, campaign: null});

  const handleClone = (campaign: Campaign) => {
    if (onClone) {
      const clonedCampaign: Campaign = {
        ...campaign,
        id: Math.random().toString(36).substr(2, 9),
        name: `${campaign.name} (Copy)`,
        status: CampaignStatus.DRAFT,
        leads: campaign.leads.map(l => ({ ...l, id: Math.random().toString(36).substr(2, 9), status: 'PENDING' as const })),
        steps: campaign.steps.map(s => ({ ...s, id: 's' + Date.now() + Math.random() })),
        createdAt: new Date().toISOString()
      };
      onClone(clonedCampaign);
      toast.success(`Campaign "${campaign.name}" cloned successfully`);
      setCloneModal({ isOpen: false, campaign: null });
    }
  };

  const handleDelete = async () => {
    if (!deleteModal.campaignId) return;
    try {
      await onDelete(deleteModal.campaignId);
      toast.success(`Campaign "${deleteModal.campaignName}" deleted successfully`);
      setDeleteModal({ isOpen: false, campaignId: null, campaignName: '' });
    } catch (error) {
      toast.error('Failed to delete campaign. Please try again.');
    }
  };

  return (
    <>
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, campaignId: null, campaignName: '' })}
        onConfirm={handleDelete}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${deleteModal.campaignName}"? This will also delete all associated leads and logs. This action cannot be undone.`}
        type="alert"
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 text-white"
      />
      <Modal
        isOpen={cloneModal.isOpen}
        onClose={() => setCloneModal({ isOpen: false, campaign: null })}
        onConfirm={() => cloneModal.campaign && handleClone(cloneModal.campaign)}
        title="Clone Campaign"
        message={`Create a copy of "${cloneModal.campaign?.name}"? All steps and settings will be duplicated. Leads will be reset to PENDING status.`}
        type="confirm"
        confirmText="Clone"
      />
      <Modal
        isOpen={cloneModal.isOpen}
        onClose={() => setCloneModal({ isOpen: false, campaign: null })}
        onConfirm={() => cloneModal.campaign && handleClone(cloneModal.campaign)}
        title="Clone Campaign"
        message={`Create a copy of "${cloneModal.campaign?.name}"? All steps and settings will be duplicated. Leads will be reset to PENDING status.`}
        type="confirm"
        confirmText="Clone"
      />
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Email Campaigns</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Create, manage, and automate your email outreach sequences.</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-500 dark:to-blue-600 hover:from-blue-700 hover:to-blue-800 dark:hover:from-blue-600 dark:hover:to-blue-700 text-white px-6 py-3 rounded-xl font-black flex items-center gap-2 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          <Plus size={20} />
          New Campaign
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700/50 border-b-2 border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Campaign</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Sequence</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Leads</th>
              <th className="px-6 py-5 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500">
                  No campaigns yet. Click "Create Campaign" to get started.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
              <tr 
                key={c.id} 
                className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-transparent dark:hover:from-blue-900/10 dark:hover:to-transparent cursor-pointer group transition-all border-l-4 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                onClick={() => onSelect(c.id)}
              >
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 rounded-xl flex items-center justify-center text-white font-black shadow-md">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5 flex items-center gap-2">
                          <Calendar size={12} />
                          Created {new Date(c.createdAt).toLocaleDateString()}
                          {c.schedule?.enabled && (
                            <>
                              <span className="text-blue-500 dark:text-blue-400">•</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <Clock size={12} />
                                Scheduled
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Webhook size={16} className="text-blue-500 dark:text-blue-400" />
                      {c.steps.length} Step{c.steps.length !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                      <Users size={16} className="text-purple-500 dark:text-purple-400" />
                      {c.leads.length.toLocaleString()} Lead{c.leads.length !== 1 ? 's' : ''}
                    </div>
                    {c.leads.length > 0 && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {c.leads.filter(l => l.status !== 'PENDING').length} contacted
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
                      >
                        <Play size={14} />
                        Open
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setDeleteModal({ isOpen: true, campaignId: c.id, campaignName: c.name }); }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete campaign"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </>
  );
};

const StatusBadge: React.FC<{ status: CampaignStatus }> = ({ status }) => {
  const styles = {
    [CampaignStatus.DRAFT]: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600',
    [CampaignStatus.ACTIVE]: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
    [CampaignStatus.PAUSED]: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
    [CampaignStatus.COMPLETED]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  };

  return (
    <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase ${styles[status]}`}>
      {status}
    </span>
  );
};

export default CampaignList;
