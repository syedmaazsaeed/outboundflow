
import React, { useMemo, useState, useEffect } from 'react';
import { Campaign, CampaignStatus, CampaignAnalytics } from '../types';
import { Users, Target, MessageSquare, Flame, BarChart3, AlertCircle, TrendingUp, Mail, MailOpen, MousePointerClick, ArrowUpRight, Download } from 'lucide-react';
import { analyticsService } from '../lib/supabase';
import { exportAnalyticsToCSV, exportCampaignsToCSV } from '../utils/export';
import { AnalyticsChart } from './AnalyticsChart';
import { useToastContext } from '../contexts/ToastContext';

const Dashboard: React.FC<{ campaigns: Campaign[] }> = ({ campaigns }) => {
  const toast = useToastContext();
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignAnalytics, setCampaignAnalytics] = useState<Record<string, CampaignAnalytics[]>>({});
  const [loadingAnalytics, setLoadingAnalytics] = useState<Record<string, boolean>>({});

  const exportCampaigns = () => {
    try {
      exportCampaignsToCSV(campaigns);
      toast.success('Campaigns exported successfully');
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const exportCampaignAnalytics = (campaignId: string, campaignName: string) => {
    try {
      const analytics = campaignAnalytics[campaignId] || [];
      if (analytics.length === 0) {
        toast.warning('No analytics data to export');
        return;
      }
      exportAnalyticsToCSV(analytics, campaignName);
      toast.success('Analytics exported successfully');
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    }
  };
  // Load analytics for campaigns - refresh when campaigns change
  useEffect(() => {
    const loadAnalytics = async () => {
      for (const campaign of campaigns) {
        // Always reload analytics to get latest data (remove the check to force refresh)
        setLoadingAnalytics(prev => ({ ...prev, [campaign.id]: true }));
        try {
          const analytics = await analyticsService.getByCampaign(campaign.id);
          setCampaignAnalytics(prev => ({ ...prev, [campaign.id]: analytics }));
          console.log(`[Dashboard] Loaded analytics for campaign ${campaign.id}:`, {
            count: analytics.length,
            totalSent: analytics.reduce((sum, a) => sum + (a.emailsSent || 0), 0)
          });
        } catch (error) {
          console.error(`[Dashboard] Error loading analytics for campaign ${campaign.id}:`, error);
        } finally {
          setLoadingAnalytics(prev => ({ ...prev, [campaign.id]: false }));
        }
      }
    };
    loadAnalytics();
  }, [campaigns]);

  const stats = useMemo(() => {
    let totalLeads = 0;
    let contacted = 0;
    let replied = 0;
    let interested = 0;
    let bounced = 0;
    let totalOpened = 0;
    let totalClicked = 0;

    campaigns.forEach(c => {
      c.leads.forEach(l => {
        totalLeads++;
        if (l.status !== 'PENDING') contacted++;
        if (l.status === 'REPLIED') replied++;
        if (l.status === 'INTERESTED') interested++;
        if (l.status === 'BOUNCED') bounced++;
      });

      // Add analytics data
      const analytics = campaignAnalytics[c.id] || [];
      analytics.forEach(a => {
        totalOpened += a.emailsOpened || 0;
        totalClicked += a.emailsClicked || 0;
      });
    });

    const openRate = contacted > 0 ? ((totalOpened / contacted) * 100).toFixed(1) : "0";
    const replyRate = contacted > 0 ? ((replied / contacted) * 100).toFixed(1) : "0";
    const clickRate = totalOpened > 0 ? ((totalClicked / totalOpened) * 100).toFixed(1) : "0";

    return { totalLeads, contacted, replied, interested, bounced, totalOpened, totalClicked, openRate, replyRate, clickRate };
  }, [campaigns, campaignAnalytics]);

  const hasData = campaigns.length > 0 && stats.totalLeads > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">System Performance</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Real-time metrics aggregated from your active campaigns.</p>
        </div>
        <button 
          onClick={exportCampaigns}
          disabled={campaigns.length === 0}
          className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-md transition-all disabled:opacity-50"
        >
          <Download size={18} />
          Export Reports
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Contacts" value={stats.totalLeads.toLocaleString()} icon={<Users className="text-blue-600 dark:text-blue-400" />} />
        <StatCard title="Emails Sent" value={stats.contacted.toLocaleString()} icon={<Target className="text-purple-600 dark:text-purple-400" />} />
        <StatCard title="Opens" value={stats.totalOpened.toLocaleString()} subtitle={`${stats.openRate}% open rate`} icon={<MailOpen className="text-indigo-600 dark:text-indigo-400" />} />
        <StatCard title="Replies" value={stats.replied.toLocaleString()} subtitle={`${stats.replyRate}% reply rate`} icon={<MessageSquare className="text-emerald-600 dark:text-emerald-400" />} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Clicks" value={stats.totalClicked.toLocaleString()} subtitle={`${stats.clickRate}% CTR`} icon={<MousePointerClick className="text-cyan-600 dark:text-cyan-400" />} />
        <StatCard title="Conversion Rate" value={`${stats.replyRate}%`} subtitle="Replies / Sent" icon={<Flame className="text-orange-500 dark:text-orange-400" />} />
        <StatCard title="Bounce Rate" value={stats.bounced > 0 ? ((stats.bounced / stats.totalLeads) * 100).toFixed(1) : "0"} subtitle={`${stats.bounced} bounced`} icon={<AlertCircle className="text-red-500 dark:text-red-400" />} />
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
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Campaign Performance</h3>
                  <button
                    onClick={() => setSelectedCampaignId(null)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                      selectedCampaignId === null
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-6">
                    {campaigns.map(c => {
                        const cSent = c.leads.filter(l => l.status !== 'PENDING').length;
                        const cReplied = c.leads.filter(l => l.status === 'REPLIED').length;
                        const cPercent = c.leads.length > 0 ? Math.round((cSent / c.leads.length) * 100) : 0;
                        const analytics = campaignAnalytics[c.id] || [];
                        const totalAnalytics = analytics.reduce((acc, a) => ({
                          sent: acc.sent + (a.emailsSent || 0),
                          opened: acc.opened + (a.emailsOpened || 0),
                          clicked: acc.clicked + (a.emailsClicked || 0),
                          replied: acc.replied + (a.emailsReplied || 0),
                        }), { sent: 0, opened: 0, clicked: 0, replied: 0 });
                        
                        const openRate = totalAnalytics.sent > 0 ? ((totalAnalytics.opened / totalAnalytics.sent) * 100).toFixed(1) : '0';
                        const replyRate = totalAnalytics.sent > 0 ? ((totalAnalytics.replied / totalAnalytics.sent) * 100).toFixed(1) : '0';
                        
                        return (
                            <div 
                              key={c.id} 
                              className={`group p-6 rounded-2xl border transition-all cursor-pointer ${
                                selectedCampaignId === c.id
                                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                                  : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                              }`}
                              onClick={() => setSelectedCampaignId(selectedCampaignId === c.id ? null : c.id)}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                          <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{c.name}</div>
                                          {c.schedule?.enabled && (
                                            <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded text-[9px] font-bold">
                                              SCHEDULED
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">{c.status} • {c.leads.length} Leads</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-slate-900 dark:text-slate-100">{cPercent}%</div>
                                        <div className="text-[10px] text-slate-400 dark:text-slate-500">Sent</div>
                                    </div>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600 mb-4">
                                    <div className="bg-blue-600 dark:bg-blue-500 h-full transition-all duration-1000" style={{ width: `${cPercent}%` }} />
                                </div>
                                
                                    {selectedCampaignId === c.id && (
                                  <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4 animate-in slide-in-from-top-2">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                      <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Sent</div>
                                        <div className="text-lg font-black text-slate-900 dark:text-slate-100">{totalAnalytics.sent || cSent}</div>
                                      </div>
                                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-xl">
                                        <div className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Opened</div>
                                        <div className="text-lg font-black text-indigo-700 dark:text-indigo-300">{totalAnalytics.opened}</div>
                                        <div className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-0.5">{openRate}%</div>
                                      </div>
                                      <div className="bg-cyan-50 dark:bg-cyan-900/20 p-3 rounded-xl">
                                        <div className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">Clicked</div>
                                        <div className="text-lg font-black text-cyan-700 dark:text-cyan-300">{totalAnalytics.clicked}</div>
                                      </div>
                                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">
                                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">Replied</div>
                                        <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{totalAnalytics.replied || cReplied}</div>
                                        <div className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5">{replyRate}%</div>
                                      </div>
                                    </div>
                                    
                                    {analytics.length > 0 && (
                                      <>
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-white dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center justify-between">
                                              <span>Opens Trend</span>
                                              <MailOpen size={14} className="text-indigo-500" />
                                            </div>
                                            <AnalyticsChart analytics={analytics} type="opens" />
                                          </div>
                                          <div className="bg-white dark:bg-slate-700/50 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                                            <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-3 flex items-center justify-between">
                                              <span>Replies Trend</span>
                                              <MessageSquare size={14} className="text-emerald-500" />
                                            </div>
                                            <AnalyticsChart analytics={analytics} type="replies" />
                                          </div>
                                        </div>
                                        
                                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                                          <div className="text-xs font-bold text-slate-600 dark:text-slate-400">Recent Activity</div>
                                          <button
                                            onClick={() => exportCampaignAnalytics(c.id, c.name)}
                                            className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center gap-1.5"
                                          >
                                            <Download size={12} />
                                            Export
                                          </button>
                                        </div>
                                        <div className="space-y-2">
                                          {analytics.slice(0, 5).map(a => (
                                            <div key={a.id} className="flex items-center justify-between text-xs">
                                              <span className="text-slate-500 dark:text-slate-400">{new Date(a.date).toLocaleDateString()}</span>
                                              <div className="flex gap-3">
                                                <span className="text-slate-600 dark:text-slate-300">{a.emailsSent} sent</span>
                                                {a.emailsOpened > 0 && <span className="text-indigo-600 dark:text-indigo-400">{a.emailsOpened} opened</span>}
                                                {a.emailsReplied > 0 && <span className="text-emerald-600 dark:text-emerald-400">{a.emailsReplied} replied</span>}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
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

const StatCard: React.FC<{ title: string; value: string; subtitle?: string; icon: React.ReactNode }> = ({ title, value, subtitle, icon }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-slate-50 dark:bg-slate-700 rounded-lg">{icon}</div>
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{value}</div>
    {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{subtitle}</div>}
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
