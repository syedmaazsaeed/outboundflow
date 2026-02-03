/**
 * Export utilities for CSV/Excel export functionality
 */

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    throw new Error('No data to export');
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);
  
  // Create CSV content
  const csvContent = [
    // Header row
    headers.map(h => `"${h}"`).join(','),
    // Data rows
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle null/undefined
        if (value === null || value === undefined) return '""';
        // Handle objects/arrays
        if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        // Handle strings with quotes and newlines
        return `"${String(value).replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      }).join(',')
    )
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};

export const exportLeadsToCSV = (leads: any[]) => {
  const csvData = leads.map(lead => ({
    'Email': lead.email,
    'First Name': lead.firstName,
    'Last Name': lead.lastName,
    'Company': lead.company,
    'Website': lead.website || '',
    'Status': lead.status,
    'Verification Status': lead.verificationStatus,
    'Folder': lead.folderId || '',
    'Custom Fields': lead.customFields ? JSON.stringify(lead.customFields) : '',
    'Unsubscribed': lead.unsubscribedAt ? 'Yes' : 'No',
    'Unsubscribed Date': lead.unsubscribedAt || ''
  }));
  
  exportToCSV(csvData, 'leads');
};

export const exportCampaignsToCSV = (campaigns: any[]) => {
  const csvData = campaigns.map(campaign => ({
    'Campaign Name': campaign.name,
    'Status': campaign.status,
    'Total Leads': campaign.leads?.length || 0,
    'Steps': campaign.steps?.length || 0,
    'Created Date': campaign.createdAt,
    'Schedule Enabled': campaign.schedule?.enabled ? 'Yes' : 'No',
    'Schedule Type': campaign.schedule?.type || '',
    'Schedule Days': campaign.schedule?.days?.join(', ') || ''
  }));
  
  exportToCSV(csvData, 'campaigns');
};

export const exportAnalyticsToCSV = (analytics: any[], campaignName: string) => {
  const csvData = analytics.map(a => ({
    'Date': a.date,
    'Emails Sent': a.emailsSent || 0,
    'Emails Delivered': a.emailsDelivered || 0,
    'Emails Opened': a.emailsOpened || 0,
    'Open Rate': a.emailsSent > 0 ? `${((a.emailsOpened / a.emailsSent) * 100).toFixed(2)}%` : '0%',
    'Emails Clicked': a.emailsClicked || 0,
    'Click Rate': a.emailsOpened > 0 ? `${((a.emailsClicked / a.emailsOpened) * 100).toFixed(2)}%` : '0%',
    'Emails Replied': a.emailsReplied || 0,
    'Reply Rate': a.emailsSent > 0 ? `${((a.emailsReplied / a.emailsSent) * 100).toFixed(2)}%` : '0%',
    'Emails Bounced': a.emailsBounced || 0,
    'Bounce Rate': a.emailsSent > 0 ? `${((a.emailsBounced / a.emailsSent) * 100).toFixed(2)}%` : '0%'
  }));
  
  exportToCSV(csvData, `${campaignName}_analytics`.replace(/[^a-z0-9]/gi, '_'));
};
