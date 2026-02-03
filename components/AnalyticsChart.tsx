import React from 'react';
import { CampaignAnalytics } from '../types';

interface AnalyticsChartProps {
  analytics: CampaignAnalytics[];
  type: 'opens' | 'clicks' | 'replies' | 'bounces';
}

export const AnalyticsChart: React.FC<AnalyticsChartProps> = ({ analytics, type }) => {
  if (!analytics || analytics.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No data available
      </div>
    );
  }

  // Sort by date
  const sortedAnalytics = [...analytics].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Get max value for scaling
  const getValue = (a: CampaignAnalytics) => {
    switch (type) {
      case 'opens': return a.emailsOpened || 0;
      case 'clicks': return a.emailsClicked || 0;
      case 'replies': return a.emailsReplied || 0;
      case 'bounces': return a.emailsBounced || 0;
      default: return 0;
    }
  };

  const maxValue = Math.max(...sortedAnalytics.map(getValue), 1);

  return (
    <div className="h-32 flex items-end gap-1">
      {sortedAnalytics.slice(-14).map((a, index) => {
        const value = getValue(a);
        const height = maxValue > 0 ? (value / maxValue) * 100 : 0;
        const color = type === 'opens' ? 'bg-indigo-500' :
                     type === 'clicks' ? 'bg-cyan-500' :
                     type === 'replies' ? 'bg-emerald-500' :
                     'bg-red-500';
        
        return (
          <div key={a.id} className="flex-1 flex flex-col items-center group relative">
            <div
              className={`w-full ${color} rounded-t transition-all hover:opacity-80 cursor-pointer`}
              style={{ height: `${height}%`, minHeight: value > 0 ? '4px' : '0' }}
              title={`${new Date(a.date).toLocaleDateString()}: ${value}`}
            />
            {index % 3 === 0 && (
              <span className="text-[8px] text-slate-400 dark:text-slate-500 mt-1 transform -rotate-45 origin-left">
                {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
