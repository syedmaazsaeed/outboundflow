/**
 * Scheduled Campaign Execution Service
 * 
 * This service automatically executes campaigns based on their schedule settings.
 * Run this as a cron job or scheduled task (e.g., every 5-15 minutes).
 * 
 * Usage:
 *   node scheduled-execution.js
 * 
 * Or set up as a cron job:
 *   */15 * * * * cd /path/to/project && node scheduled-execution.js
 * 
 * Environment Variables Required:
 *   SUPABASE_URL=https://your-project.supabase.co
 *   SUPABASE_SERVICE_KEY=your-service-key (or SUPABASE_ANON_KEY)
 *   BACKEND_URL=http://localhost:3001 (optional)
 */

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if current time matches campaign schedule
 */
function isTimeInSchedule(schedule, timezone = 'UTC') {
  const now = new Date();
  
  // Convert to campaign timezone
  const campaignTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentDay = campaignTime.getDay(); // 0 = Sunday, 6 = Saturday
  const currentTime = `${String(campaignTime.getHours()).padStart(2, '0')}:${String(campaignTime.getMinutes()).padStart(2, '0')}`;
  
  // Check if today is in schedule days
  if (!schedule.days.includes(currentDay)) {
    return false;
  }
  
  // Check if current time is within schedule window
  if (currentTime < schedule.startTime || currentTime > schedule.endTime) {
    return false;
  }
  
  // Check schedule type
  if (schedule.type === 'ONCE') {
    const startDate = new Date(schedule.startDate);
    const today = new Date(campaignTime.toDateString());
    return today.toDateString() === startDate.toDateString();
  }
  
  if (schedule.type === 'WEEKLY') {
    // Check if today matches the start date's day of week
    if (schedule.startDate) {
      const startDate = new Date(schedule.startDate);
      return currentDay === startDate.getDay();
    }
  }
  
  // DAILY schedule - already checked days and time
  return true;
}

/**
 * Execute a campaign (simplified version - calls backend endpoint)
 */
async function executeCampaign(campaign, smtpAccounts) {
  console.log(`[Scheduled Execution] Executing campaign: ${campaign.name} (${campaign.id})`);
  
  try {
    // This is a simplified execution - in production, you might want to
    // call the actual campaign execution logic or trigger it via webhook
    
    // For now, we'll just log it - the actual execution should be done
    // by calling the campaign execution endpoint or reusing the logic
    console.log(`[Scheduled Execution] Campaign ${campaign.name} should be executed now`);
    console.log(`[Scheduled Execution] Note: Full execution logic should be implemented here`);
    
    // TODO: Implement actual campaign execution
    // This could call a backend endpoint or reuse CampaignEditor execution logic
    
    return true;
  } catch (error) {
    console.error(`[Scheduled Execution] Error executing campaign ${campaign.id}:`, error);
    return false;
  }
}

/**
 * Main execution function
 */
async function runScheduledExecution() {
  console.log(`[Scheduled Execution] Starting scheduled execution check at ${new Date().toISOString()}`);
  
  try {
    // Get all campaigns with scheduling enabled
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select(`
        *,
        campaign_accounts (smtp_account_id, rotation_order),
        smtp_accounts:campaign_accounts (id, label, host, port, user_name, from_email, daily_send_limit, sent_today, last_reset_date)
      `)
      .eq('schedule_enabled', true)
      .eq('status', 'ACTIVE');
    
    if (campaignsError) {
      console.error('[Scheduled Execution] Error fetching campaigns:', campaignsError);
      return;
    }
    
    if (!campaigns || campaigns.length === 0) {
      console.log('[Scheduled Execution] No scheduled campaigns found');
      return;
    }
    
    console.log(`[Scheduled Execution] Found ${campaigns.length} active scheduled campaign(s)`);
    
    // Process each campaign
    for (const campaign of campaigns) {
      const schedule = {
        days: campaign.schedule_days || [],
        startTime: campaign.schedule_start_time || '09:00',
        endTime: campaign.schedule_end_time || '17:00',
        timezone: campaign.schedule_timezone || 'UTC',
        type: campaign.schedule_type || 'DAILY',
        startDate: campaign.schedule_start_date || null,
        enabled: campaign.schedule_enabled || false
      };
      
      // Check if it's time to execute
      if (isTimeInSchedule(schedule, schedule.timezone)) {
        console.log(`[Scheduled Execution] Campaign "${campaign.name}" matches schedule - executing...`);
        
        // Get SMTP accounts for this campaign
        const accountIds = (campaign.campaign_accounts || []).map((ca: any) => ca.smtp_account_id);
        
        // Fetch SMTP account details
        const { data: smtpAccounts } = await supabase
          .from('smtp_accounts')
          .select('*')
          .in('id', accountIds);
        
        if (smtpAccounts && smtpAccounts.length > 0) {
          await executeCampaign(campaign, smtpAccounts);
        } else {
          console.warn(`[Scheduled Execution] Campaign "${campaign.name}" has no SMTP accounts configured`);
        }
      } else {
        console.log(`[Scheduled Execution] Campaign "${campaign.name}" does not match current schedule`);
      }
    }
    
    console.log(`[Scheduled Execution] Completed scheduled execution check`);
  } catch (error) {
    console.error('[Scheduled Execution] Fatal error:', error);
  }
}

// Run immediately if called directly
if (require.main === module) {
  runScheduledExecution()
    .then(() => {
      console.log('[Scheduled Execution] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Scheduled Execution] Script failed:', error);
      process.exit(1);
    });
}

module.exports = { runScheduledExecution, isTimeInSchedule };
