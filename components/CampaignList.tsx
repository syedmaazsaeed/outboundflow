
import React from 'react';
import { Campaign, CampaignStatus } from '../types';
import { MoreVertical, Play, Plus, Trash2, Webhook } from 'lucide-react';

interface CampaignListProps {
  campaigns: Campaign[];
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}

const CampaignList: React.FC<CampaignListProps> = ({ campaigns, onSelect, onAdd, onDelete }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Campaigns</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and automate your email sequences.</p>
        </div>
        <button 
          onClick={onAdd}
          className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={20} />
          Create Campaign
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Campaign Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Steps</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Leads</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Action</th>
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
                  className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 cursor-pointer group"
                  onClick={() => onSelect(c.id)}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{c.name}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">Created {new Date(c.createdAt).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                      <Webhook size={14} className="text-blue-500 dark:text-blue-400" />
                      {c.steps.length} Webhook Steps
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{c.leads.length} Leads</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelect(c.id); }}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-500 dark:text-slate-400"
                      >
                        <Play size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg"
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
  );
};

const StatusBadge: React.FC<{ status: CampaignStatus }> = ({ status }) => {
  const styles = {
    [CampaignStatus.DRAFT]: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
    [CampaignStatus.ACTIVE]: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    [CampaignStatus.PAUSED]: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    [CampaignStatus.COMPLETED]: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  };

  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${styles[status]}`}>
      {status}
    </span>
  );
};

export default CampaignList;
