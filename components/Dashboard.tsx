
import React, { useMemo } from 'react';
import { Campaign, CampaignStatus } from '../types';
import { Users, Target, MessageSquare, Flame, BarChart3, AlertCircle } from 'lucide-react';

const Dashboard: React.FC<{ campaigns: Campaign[] }> = ({ campaigns }) => {
  const stats = useMemo(() => {
    let totalLeads = 0;
    let contacted = 0;
    let replied = 0;
    let interested = 0;
    let bounced = 0;

    campaigns.forEach(c => {
      c.leads.forEach(l => {
        totalLeads++;
        if (l.status !== 'PENDING') contacted++;
        if (l.status === 'REPLIED') replied++;
        if (l.status === 'INTERESTED') interested++;
        if (l.status === 'BOUNCED') bounced++;
      });
    });

    const openRate = contacted > 0 ? ((contacted / totalLeads) * 100).toFixed(1) : "0";
    const replyRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : "0";

    return { totalLeads, contacted, replied, interested, bounced, openRate, replyRate };
  }, [campaigns]);

  const hasData = campaigns.length > 0 && stats.totalLeads > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Performance</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Real-time metrics aggregated from your active campaigns.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total Contacts" value={stats.totalLeads.toLocaleString()} icon={<Users className="text-blue-600 dark:text-blue-400" />} />
        <StatCard title="Sent / Contacted" value={stats.contacted.toLocaleString()} icon={<Target className="text-purple-600 dark:text-purple-400" />} />
        <StatCard title="Total Replies" value={stats.replied.toLocaleString()} icon={<MessageSquare className="text-emerald-600 dark:text-emerald-400" />} />
        <StatCard title="Conversion Rate" value={`${stats.replyRate}%`} icon={<Flame className="text-orange-500 dark:text-orange-400" />} />
      </div>

      {!hasData ? (
        <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                <BarChart3 className="text-slate-300 dark:text-slate-600" size={32} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No Campaign Activity Detected</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2">Connect an SMTP account and launch a campaign to start tracking real-world performance metrics.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-lg font-bold mb-6 text-slate-800 dark:text-slate-200">Campaign Health</h3>
                <div className="space-y-8">
                    {campaigns.map(c => {
                        const cSent = c.leads.filter(l => l.status !== 'PENDING').length;
                        const cPercent = c.leads.length > 0 ? Math.round((cSent / c.leads.length) * 100) : 0;
                        return (
                            <div key={c.id} className="group">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.name}</div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">{c.status} • {c.leads.length} Leads</div>
                                    </div>
                                    <div className="text-sm font-black text-slate-900 dark:text-slate-100">{cPercent}%</div>
                                </div>
                                <div className="w-full bg-slate-50 dark:bg-slate-700 h-3 rounded-full overflow-hidden border border-slate-100 dark:border-slate-600">
                                    <div className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-1000" style={{ width: `${cPercent}%` }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
                <h3 className="text-lg font-bold mb-8 text-slate-800 dark:text-slate-200">Live Funnel</h3>
                <div className="flex-1 space-y-8">
                    <FunnelStep label="Total Leads" value={stats.totalLeads} total={stats.totalLeads} color="bg-slate-900 dark:bg-slate-700" />
                    <FunnelStep label="Emails Sent" value={stats.contacted} total={stats.totalLeads} color="bg-blue-600 dark:bg-blue-500" />
                    <FunnelStep label="Replies" value={stats.replied} total={stats.totalLeads} color="bg-emerald-500 dark:bg-emerald-400" />
                    <FunnelStep label="Interested" value={stats.interested} total={stats.totalLeads} color="bg-orange-500 dark:bg-orange-400" />
                </div>
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl border border-amber-100 dark:border-amber-800">
                        <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={18} />
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                            Bounce rate is {stats.bounced > 0 ? ((stats.bounced / stats.totalLeads) * 100).toFixed(1) : "0"}%. 
                            Keep this below 3% to maintain high deliverability.
                        </p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{value}</div>
  </div>
);

const FunnelStep: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="space-y-2">
            <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">{label}</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">{value} <span className="text-slate-400 dark:text-slate-500 font-medium ml-1 text-xs">({percent}%)</span></span>
            </div>
            <div className="w-full bg-slate-50 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div className={`${color} h-full transition-all duration-700`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
};

export default Dashboard;
