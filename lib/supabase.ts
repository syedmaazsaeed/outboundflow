import { createClient } from '@supabase/supabase-js';
import type { 
  User, 
  Campaign, 
  CampaignStatus, 
  Lead, 
  SmtpAccount, 
  EmailMessage, 
  SequenceStep,
  ExecutionLog 
} from '../types';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Only throw error if we're actually trying to use Supabase (when URL is provided)
// This allows the app to work with localStorage fallback
let supabase: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}

export { supabase };

// ==================== AUTHENTICATION ====================

export interface AuthResponse {
  user: User | null;
  error: string | null;
}

export const authService = {
  // Sign up a new user
  async signUp(email: string, password: string, name: string): Promise<AuthResponse> {
    if (!supabase) {
      return { user: null, error: 'Supabase is not configured' };
    }
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        return { user: null, error: authError.message };
      }

      if (!authData.user) {
        return { user: null, error: 'Failed to create user' };
      }

      // Create user profile - try to insert, but if it already exists, that's okay
      let profileData;
      let profileError;
      
      const insertResult = await (supabase as any)
        .from('users')
        .insert({
          id: authData.user.id,
          email,
          name,
        })
        .select()
        .single();

      profileData = insertResult.data;
      profileError = insertResult.error;

      // If profile already exists (e.g., from a previous attempt), fetch it instead
      if (profileError) {
        // Check if it's a duplicate key error (profile already exists)
        const errorMsg = profileError.message || '';
        const errorCode = profileError.code || '';
        
        if (errorMsg.includes('duplicate') || errorMsg.includes('already exists') || errorCode === '23505') {
          // Profile already exists, fetch it
          const fetchResult = await (supabase as any)
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          if (fetchResult.error || !fetchResult.data) {
            console.error('Failed to fetch existing profile:', fetchResult.error);
            // Don't fail signup if profile fetch fails - we'll create it on first sign in
            // Return success but without user data (user will be created on first sign in)
            return { user: null, error: null };
          }

          profileData = fetchResult.data;
        } else {
          // Other error - log it but don't fail signup
          console.error('Error creating user profile:', profileError);
          // Profile creation failed, but auth user was created
          // User can sign in and profile will be auto-created
          return { user: null, error: null };
        }
      }

      if (!profileData) {
        // Profile wasn't created, but that's okay - it will be created on first sign in
        return { user: null, error: null };
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        createdAt: profileData.created_at,
      };

      return { user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Sign in existing user
  async signIn(email: string, password: string): Promise<AuthResponse> {
    if (!supabase) {
      return { user: null, error: 'Supabase is not configured' };
    }
    
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Provide more helpful error messages
        if (authError.message.includes('Email not confirmed') || authError.message.includes('email_not_confirmed')) {
          return { 
            user: null, 
            error: 'Please check your email and click the confirmation link to verify your account before signing in.' 
          };
        }
        return { user: null, error: authError.message };
      }

      // Check if user is confirmed
      if (authData.user && !authData.user.email_confirmed_at) {
        return { 
          user: null, 
          error: 'Please check your email and click the confirmation link to verify your account before signing in.' 
        };
      }

      // Get user profile
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        return { user: null, error: 'User not found' };
      }

      // Check if user profile exists, create if it doesn't
      let { data: profileData, error: profileError } = await (supabase as any)
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      // If profile doesn't exist, create it (this can happen if signup failed or email confirmation happened)
      if (profileError || !profileData) {
        // Try to create the profile
        const insertResult = await (supabase as any)
          .from('users')
          .insert({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          })
          .select()
          .single();

        if (insertResult.error) {
          // If creation fails, check if it's a duplicate (race condition)
          const errorMsg = insertResult.error.message || '';
          const errorCode = insertResult.error.code || '';
          
          if (errorMsg.includes('duplicate') || errorMsg.includes('already exists') || errorCode === '23505') {
            // Profile was created by another request, fetch it
            const fetchResult = await (supabase as any)
              .from('users')
              .select('*')
              .eq('id', authUser.id)
              .single();
            
            if (fetchResult.error || !fetchResult.data) {
              return { user: null, error: `Profile creation failed: ${insertResult.error.message}` };
            }
            profileData = fetchResult.data;
          } else {
            // Other error - return it
            return { user: null, error: `Profile creation failed: ${insertResult.error.message}` };
          }
        } else {
          profileData = insertResult.data;
        }
      }

      const user: User = {
        id: profileData.id,
        email: profileData.email,
        name: profileData.name,
        createdAt: profileData.created_at,
      };

      return { user, error: null };
    } catch (error: any) {
      return { user: null, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Sign out current user
  async signOut(): Promise<void> {
    if (supabase) {
      await supabase.auth.signOut();
    }
  },

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    if (!supabase) return null;
    
    try {
      // First check if there's a session to avoid unnecessary API calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        return null;
      }

      // Now get the user (this should succeed since we have a session)
      const { data: { user: authUser }, error: getUserError } = await supabase.auth.getUser();
      
      if (getUserError) {
        // 403 is expected when not authenticated - don't log it
        if (getUserError.message.includes('403') || getUserError.message.includes('Forbidden')) {
          return null;
        }
        console.error('Error getting user:', getUserError);
        return null;
      }
      
      if (!authUser) return null;

      const { data: profileData, error } = await (supabase as any)
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (error || !profileData) return null;

      return {
        id: (profileData as any).id,
        email: (profileData as any).email,
        name: (profileData as any).name,
        createdAt: (profileData as any).created_at,
      };
    } catch (error: any) {
      // Silently handle errors - 403 is expected when not authenticated
      if (error?.message?.includes('403') || error?.message?.includes('Forbidden')) {
        return null;
      }
      // Only log unexpected errors
      console.error('Unexpected error in getCurrentUser:', error);
      return null;
    }
  },

  // Listen to auth state changes
  onAuthStateChange(callback: (user: User | null) => void) {
    if (!supabase) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        callback(null);
      }
    });
  },

  // Request password reset
  async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  },

  // Update password (after reset)
  async updatePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    if (!supabase) {
      return { success: false, error: 'Supabase is not configured' };
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, error: null };
    } catch (error: any) {
      return { success: false, error: error.message || 'An unexpected error occurred' };
    }
  },
};

// ==================== CAMPAIGNS ====================

export const campaignService = {
  // Get all campaigns for current user
  async getAll(userId: string): Promise<Campaign[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('campaigns')
      .select(`
        *,
        sequence_steps (*),
        leads (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      return [];
    }

    return (data || []).map(transformCampaign);
  },

  // Get single campaign
  async getById(id: string): Promise<Campaign | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('campaigns')
      .select(`
        *,
        sequence_steps (*),
        leads (*)
      `)
      .eq('id', id)
      .single();

    if (error || !data) return null;

    return transformCampaign(data);
  },

  // Create campaign
  async create(userId: string, campaign: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign | null> {
    if (!supabase) return null;
    
    const { data: campaignData, error: campaignError } = await ((supabase as any)
      .from('campaigns')
      .insert({
        user_id: userId,
        name: campaign.name,
        status: campaign.status,
        schedule_days: campaign.schedule.days,
        schedule_start_time: campaign.schedule.startTime,
        schedule_end_time: campaign.schedule.endTime,
        schedule_timezone: campaign.schedule.timezone,
        sender_account_id: campaign.senderAccountId || null,
      } as any))
      .select()
      .single();

    if (campaignError || !campaignData) {
      console.error('Error creating campaign:', campaignError);
      return null;
    }

    // Insert sequence steps
    if (campaign.steps.length > 0) {
      const stepsToInsert = campaign.steps.map(step => ({
        campaign_id: campaignData.id,
        order_number: step.order,
        delay_days: step.delayDays,
        webhook_url: step.webhookUrl,
        prompt_hint: step.promptHint || null,
      }));

      await (supabase as any).from('sequence_steps').insert(stepsToInsert);
    }

    // Insert leads
    if (campaign.leads.length > 0) {
      const leadsToInsert = campaign.leads.map(lead => ({
        campaign_id: (campaignData as any).id,
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company: lead.company,
        website: lead.website || null,
        custom_variable: lead.customVariable || null,
        custom_fields: lead.customFields || {},
        verification_status: lead.verificationStatus,
        status: lead.status,
      }));

      await (supabase as any).from('leads').insert(leadsToInsert);
    }

    return await this.getById((campaignData as any).id);
  },

  // Update campaign
  async update(campaign: Campaign): Promise<Campaign | null> {
    if (!supabase) return null;
    
    const { error: campaignError } = await ((supabase as any)
      .from('campaigns')
      .update({
        name: campaign.name,
        status: campaign.status,
        schedule_days: campaign.schedule.days,
        schedule_start_time: campaign.schedule.startTime,
        schedule_end_time: campaign.schedule.endTime,
        schedule_timezone: campaign.schedule.timezone,
        sender_account_id: campaign.senderAccountId || null,
      } as any))
      .eq('id', campaign.id);

    if (campaignError) {
      console.error('Error updating campaign:', campaignError);
      return null;
    }

    // Delete existing steps and leads
    await (supabase as any).from('sequence_steps').delete().eq('campaign_id', campaign.id);
    await (supabase as any).from('leads').delete().eq('campaign_id', campaign.id);

    // Insert updated steps
    if (campaign.steps.length > 0) {
      const stepsToInsert = campaign.steps.map(step => ({
        campaign_id: campaign.id,
        order_number: step.order,
        delay_days: step.delayDays,
        webhook_url: step.webhookUrl,
        prompt_hint: step.promptHint || null,
      }));

      await (supabase as any).from('sequence_steps').insert(stepsToInsert);
    }

    // Insert updated leads
    if (campaign.leads.length > 0) {
      const leadsToInsert = campaign.leads.map(lead => ({
        campaign_id: campaign.id,
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company: lead.company,
        website: lead.website || null,
        custom_variable: lead.customVariable || null,
        custom_fields: lead.customFields || {},
        verification_status: lead.verificationStatus,
        status: lead.status,
      }));

      await (supabase as any).from('leads').insert(leadsToInsert);
    }

    return await this.getById(campaign.id);
  },

  // Update campaign leads only
  async updateLeads(campaignId: string, leads: Lead[]): Promise<boolean> {
    if (!supabase) return false;
    
    try {
      // Delete existing leads
      const { error: deleteError } = await (supabase as any)
        .from('leads')
        .delete()
        .eq('campaign_id', campaignId);

      if (deleteError) {
        console.error('Error deleting leads:', deleteError);
        throw new Error(`Failed to delete existing leads: ${deleteError.message}`);
      }

      // Insert new leads in batches to avoid timeout with large imports
      if (leads.length > 0) {
        const batchSize = 100; // Insert 100 leads at a time
        const leadsToInsert = leads.map(lead => ({
          campaign_id: campaignId,
          email: lead.email,
          first_name: lead.firstName,
          last_name: lead.lastName,
          company: lead.company,
          website: lead.website || null,
          custom_variable: lead.customVariable || null,
          custom_fields: lead.customFields || {},
          verification_status: lead.verificationStatus,
          status: lead.status,
        }));

        // Insert in batches
        for (let i = 0; i < leadsToInsert.length; i += batchSize) {
          const batch = leadsToInsert.slice(i, i + batchSize);
          const { error: insertError } = await ((supabase as any).from('leads').insert(batch) as any);
          
          if (insertError) {
            console.error(`Error inserting leads batch ${i / batchSize + 1}:`, insertError);
            throw new Error(`Failed to insert leads: ${insertError.message}`);
          }
        }
      }

      return true;
    } catch (error: any) {
      console.error('Error in updateLeads:', error);
      throw error; // Re-throw so caller can handle it
    }
  },

  // Delete campaign
  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign:', error);
      return false;
    }

    return true;
  },
};

// ==================== SMTP ACCOUNTS ====================

export const smtpService = {
  // Get all SMTP accounts for current user
  async getAll(userId: string): Promise<SmtpAccount[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('smtp_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching SMTP accounts:', error);
      return [];
    }

    return (data || []).map(transformSmtpAccount);
  },

  // Create SMTP account
  async create(userId: string, account: Omit<SmtpAccount, 'id'>): Promise<SmtpAccount | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('smtp_accounts')
      .insert({
        user_id: userId,
        label: account.label,
        host: account.host,
        port: account.port,
        user_name: account.user,
        pass: account.pass,
        secure: account.secure,
        from_email: account.fromEmail,
        warmup_enabled: account.warmupEnabled,
        warmup_sent_today: account.warmupSentToday,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating SMTP account:', error);
      return null;
    }

    return transformSmtpAccount(data);
  },

  // Update SMTP account
  async update(account: SmtpAccount): Promise<SmtpAccount | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('smtp_accounts')
      .update({
        label: account.label,
        host: account.host,
        port: account.port,
        user_name: account.user,
        pass: account.pass,
        secure: account.secure,
        from_email: account.fromEmail,
        warmup_enabled: account.warmupEnabled,
        warmup_sent_today: account.warmupSentToday,
      })
      .eq('id', account.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating SMTP account:', error);
      return null;
    }

    return transformSmtpAccount(data);
  },

  // Delete SMTP account
  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('smtp_accounts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting SMTP account:', error);
      return false;
    }

    return true;
  },
};

// ==================== EMAIL MESSAGES ====================

export const emailService = {
  // Get all email messages for current user
  async getAll(userId: string): Promise<EmailMessage[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('email_messages')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching email messages:', error);
      return [];
    }

    return (data || []).map(transformEmailMessage);
  },

  // Create email message
  async create(userId: string, message: Omit<EmailMessage, 'id'>): Promise<EmailMessage | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('email_messages')
      .insert({
        user_id: userId,
        campaign_id: message.campaignId || null,
        from_email: message.from,
        to_email: message.to,
        subject: message.subject,
        body: message.body,
        date: message.date,
        is_read: message.isRead,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating email message:', error);
      return null;
    }

    return transformEmailMessage(data);
  },

  // Update email message
  async update(message: EmailMessage): Promise<EmailMessage | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('email_messages')
      .update({
        campaign_id: message.campaignId || null,
        from_email: message.from,
        to_email: message.to,
        subject: message.subject,
        body: message.body,
        date: message.date,
        is_read: message.isRead,
      })
      .eq('id', message.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating email message:', error);
      return null;
    }

    return transformEmailMessage(data);
  },

  // Delete email message
  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await supabase
      .from('email_messages')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting email message:', error);
      return false;
    }

    return true;
  },
};

// ==================== EXECUTION LOGS ====================

export const logService = {
  // Get logs for a campaign
  async getByCampaign(campaignId: string): Promise<ExecutionLog[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('execution_logs')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching execution logs:', error);
      return [];
    }

    return (data || []).map(transformExecutionLog);
  },

  // Create execution log
  async create(log: Omit<ExecutionLog, 'id'>): Promise<ExecutionLog | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('execution_logs')
      .insert({
        campaign_id: log.campaignId,
        lead_id: log.leadId,
        step_id: log.stepId,
        timestamp: log.timestamp,
        subject: log.subject,
        body: log.body,
        status: log.status,
        error_details: log.errorDetails || null,
        type: log.type,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating execution log:', error);
      return null;
    }

    return transformExecutionLog(data);
  },
};

// ==================== TRANSFORMERS ====================

function transformCampaign(data: any): Campaign {
  return {
    id: data.id,
    name: data.name,
    status: data.status as CampaignStatus,
    schedule: {
      days: data.schedule_days || [],
      startTime: data.schedule_start_time || '09:00',
      endTime: data.schedule_end_time || '17:00',
      timezone: data.schedule_timezone || 'UTC',
    },
    senderAccountId: data.sender_account_id || undefined,
    createdAt: data.created_at,
    steps: (data.sequence_steps || []).map(transformSequenceStep).sort((a: SequenceStep, b: SequenceStep) => a.order - b.order),
    leads: (data.leads || []).map(transformLead),
  };
}

function transformSequenceStep(data: any): SequenceStep {
  return {
    id: data.id,
    order: data.order_number,
    delayDays: data.delay_days,
    webhookUrl: data.webhook_url,
    promptHint: data.prompt_hint || undefined,
  };
}

function transformLead(data: any): Lead {
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    company: data.company,
    website: data.website || undefined,
    customVariable: data.custom_variable || undefined,
    customFields: data.custom_fields || {},
    verificationStatus: data.verification_status,
    status: data.status,
  };
}

function transformSmtpAccount(data: any): SmtpAccount {
  return {
    id: data.id,
    label: data.label,
    host: data.host,
    port: data.port,
    user: data.user_name,
    pass: data.pass,
    secure: data.secure,
    fromEmail: data.from_email,
    warmupEnabled: data.warmup_enabled,
    warmupSentToday: data.warmup_sent_today,
  };
}

function transformEmailMessage(data: any): EmailMessage {
  return {
    id: data.id,
    from: data.from_email,
    to: data.to_email,
    subject: data.subject,
    body: data.body,
    date: data.date,
    isRead: data.is_read,
    campaignId: data.campaign_id || undefined,
  };
}

function transformExecutionLog(data: any): ExecutionLog {
  return {
    id: data.id,
    campaignId: data.campaign_id,
    leadId: data.lead_id,
    stepId: data.step_id,
    timestamp: data.timestamp,
    subject: data.subject || '',
    body: data.body || '',
    status: data.status,
    errorDetails: data.error_details || undefined,
    type: data.type,
  };
}

