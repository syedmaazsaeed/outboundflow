import { createClient } from '@supabase/supabase-js';
import type { 
  User, 
  Campaign, 
  CampaignStatus, 
  Lead, 
  LeadFolder,
  SmtpAccount, 
  EmailMessage, 
  SequenceStep,
  ExecutionLog,
  CampaignAnalytics
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
        leads (*),
        campaign_accounts (smtp_account_id, rotation_order)
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
    
    try {
      console.log('[getById] Fetching campaign:', id);
      const startTime = Date.now();
      
      // First, check if campaign exists with a simple query (with timeout)
      const existsPromise = (supabase as any)
        .from('campaigns')
        .select('id')
        .eq('id', id)
        .single();
      
      const existsTimeout = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Campaign existence check timed out')), 5000)
      );
      
      let campaignExists: any = null;
      try {
        const existsResult = await Promise.race([existsPromise, existsTimeout]);
        campaignExists = existsResult;
      } catch (existsError: any) {
        if (existsError.code === 'PGRST116') {
          console.log('[getById] Campaign not found (PGRST116)');
          return null;
        }
        console.warn('[getById] Error or timeout checking campaign existence:', existsError.message);
        // Continue anyway - might be a timeout, not a missing campaign
      }
      
      if (!campaignExists) {
        console.log('[getById] Campaign does not exist');
        return null;
      }
      
      console.log('[getById] Campaign exists, fetching full data with relations...');
      
      // Fetch with relations (with timeout)
      const fetchPromise = (supabase as any)
        .from('campaigns')
        .select(`
          *,
          sequence_steps (*),
          leads (*),
          campaign_accounts (smtp_account_id, rotation_order)
        `)
        .eq('id', id)
        .single();
      
      const fetchTimeout = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Campaign fetch with relations timed out')), 10000)
      );

      let data: any = null;
      let error: any = null;
      
      try {
        const result = await Promise.race([fetchPromise, fetchTimeout]);
        data = result.data;
        error = result.error;
      } catch (fetchError: any) {
        console.warn('[getById] Fetch with relations timed out or failed:', fetchError.message);
        // Try fetching just the campaign without relations
        const simpleFetchPromise = (supabase as any)
          .from('campaigns')
          .select('*')
          .eq('id', id)
          .single();
        
        const simpleTimeout = new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Simple fetch timed out')), 5000)
        );
        
        try {
          const simpleResult = await Promise.race([simpleFetchPromise, simpleTimeout]);
          if (simpleResult.data) {
            // Return campaign with empty relations
            const duration = Date.now() - startTime;
            console.log(`[getById] Campaign fetched (simple) in ${duration}ms`);
            return transformCampaign({
              ...simpleResult.data,
              sequence_steps: [],
              leads: [],
              campaign_accounts: []
            });
          }
        } catch (simpleError: any) {
          console.error('[getById] Simple fetch also failed:', simpleError.message);
          return null;
        }
      }

      if (error) {
        console.error('[getById] Error fetching campaign with relations:', error);
        return null;
      }

      if (!data) {
        console.log('[getById] No data returned');
        return null;
      }

      const duration = Date.now() - startTime;
      console.log(`[getById] Campaign fetched successfully in ${duration}ms`);
      return transformCampaign(data);
    } catch (error: any) {
      console.error('[getById] Exception fetching campaign:', error);
      return null;
    }
  },

  // Create campaign
  async create(userId: string, campaign: Omit<Campaign, 'id' | 'createdAt'>): Promise<Campaign | null> {
    if (!supabase) {
      console.error('[Campaign Create] Supabase client not initialized');
      throw new Error('Supabase client not initialized');
    }
    
    console.log('[Campaign Create] Starting campaign creation...', campaign.name);
    
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
        schedule_enabled: campaign.schedule.enabled || false,
        schedule_type: campaign.schedule.type || 'DAILY',
        schedule_start_date: campaign.schedule.startDate || null,
        sender_account_id: campaign.senderAccountId || null,
      } as any))
      .select()
      .single();

    if (campaignError || !campaignData) {
      console.error('[Campaign Create] Error creating campaign:', campaignError);
      throw new Error(`Failed to create campaign: ${campaignError?.message || campaignError?.code || 'Unknown error'}`);
    }
    
    console.log('[Campaign Create] Campaign record created:', campaignData.id);

    // Insert sequence steps
    if (campaign.steps.length > 0) {
      console.log('[Campaign Create] Inserting steps...', campaign.steps.length);
      const stepsToInsert = campaign.steps.map(step => ({
        campaign_id: campaignData.id,
        order_number: step.order,
        delay_days: step.delayDays,
        webhook_url: step.webhookUrl,
        prompt_hint: step.promptHint || null,
      }));

      const { error: stepsError } = await (supabase as any).from('sequence_steps').insert(stepsToInsert);
      if (stepsError) {
        console.error('[Campaign Create] Error inserting steps:', stepsError);
        throw new Error(`Failed to insert steps: ${stepsError.message || stepsError.code || 'Unknown error'}`);
      }
      console.log('[Campaign Create] Steps inserted successfully');
    }

    // Insert campaign accounts (multiple SMTP accounts)
    if (campaign.senderAccountIds && campaign.senderAccountIds.length > 0) {
      console.log('[Campaign Create] Inserting campaign accounts...', campaign.senderAccountIds.length);
      const accountsToInsert = campaign.senderAccountIds.map((accountId, index) => ({
        campaign_id: (campaignData as any).id,
        smtp_account_id: accountId,
        rotation_order: index,
      }));
      const { error: accountsError } = await (supabase as any).from('campaign_accounts').insert(accountsToInsert);
      if (accountsError) {
        console.error('[Campaign Create] Error inserting campaign accounts:', accountsError);
        throw new Error(`Failed to insert campaign accounts: ${accountsError.message || accountsError.code || 'Unknown error'}`);
      }
      console.log('[Campaign Create] Campaign accounts inserted successfully');
    }

    // Insert leads in batches to avoid timeout
    if (campaign.leads.length > 0) {
      console.log('[Campaign Create] Inserting leads...', campaign.leads.length);
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
        folder_id: lead.folderId || null,
        assigned_inbox_id: lead.assignedInboxId || null,
        // Only include unsubscribed_at if it exists (handle schema mismatch gracefully)
        ...(lead.unsubscribedAt !== undefined && lead.unsubscribedAt !== null 
          ? { unsubscribed_at: lead.unsubscribedAt } 
          : {})
      }));

      // Insert leads in batches to avoid timeout
      const batchSize = 100;
      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        console.log(`[Campaign Create] Inserting leads batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(leadsToInsert.length / batchSize)}...`);
        const { error: leadsError } = await (supabase as any).from('leads').insert(batch);
        if (leadsError) {
          console.error(`[Campaign Create] Error inserting leads batch ${Math.floor(i / batchSize) + 1}:`, leadsError);
          // Check if it's a missing column error
          if (leadsError.message && leadsError.message.includes('unsubscribed_at')) {
            throw new Error(`Database schema error: unsubscribed_at column is missing. Please run ADD_UNSUBSCRIBED_AT_COLUMN.sql in Supabase SQL Editor.`);
          }
          throw new Error(`Failed to insert leads: ${leadsError.message || leadsError.code || 'Unknown error'}`);
        }
      }
      console.log('[Campaign Create] All leads inserted successfully');
    } else {
      console.log('[Campaign Create] No leads to insert');
    }

    console.log('[Campaign Create] Campaign created, reconstructing from saved data...');
    
    // Don't call getById - it's slow and can timeout
    // Instead, reconstruct the campaign from what we just created
    const createdCampaign: Campaign = {
      id: (campaignData as any).id,
      name: campaign.name,
      status: campaign.status,
      schedule: campaign.schedule,
      steps: campaign.steps,
      leads: campaign.leads,
      senderAccountId: campaign.senderAccountId,
      senderAccountIds: campaign.senderAccountIds || [],
      createdAt: (campaignData as any).created_at || new Date().toISOString()
    };
    
    console.log('[Campaign Create] Campaign creation completed successfully (reconstructed from saved data)');
    return createdCampaign;
  },

  // Update campaign
  async update(campaign: Campaign): Promise<Campaign | null> {
    if (!supabase) {
      console.error('[Campaign Update] Supabase client not initialized');
      throw new Error('Supabase client not initialized');
    }
    
    console.log('[Campaign Update] Starting update for campaign:', campaign.id);
    
    // Validate campaign ID is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaign.id)) {
      console.log('[Campaign Update] Campaign ID is not a valid UUID, will create new campaign');
      // Force creation instead of update
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session found');
      }
      const { id, createdAt, ...campaignWithoutId } = campaign;
      return await this.create(session.user.id, campaignWithoutId);
    }
    
    // Skip existence check - just try to update directly
    // If it doesn't exist, the update will fail and we'll handle it
    // This is faster and avoids the hanging query issue
    console.log('[Campaign Update] Skipping existence check, attempting direct update...');
    
    console.log('[Campaign Update] Updating campaign record in database...');
    
    // Add timeout to update query (10 seconds)
    const updatePromise = ((supabase as any)
      .from('campaigns')
      .update({
        name: campaign.name,
        status: campaign.status,
        schedule_days: campaign.schedule.days,
        schedule_start_time: campaign.schedule.startTime,
        schedule_end_time: campaign.schedule.endTime,
        schedule_timezone: campaign.schedule.timezone,
        schedule_enabled: campaign.schedule.enabled || false,
        schedule_type: campaign.schedule.type || 'DAILY',
        schedule_start_date: campaign.schedule.startDate || null,
        sender_account_id: campaign.senderAccountId || null,
      } as any))
      .eq('id', campaign.id)
      .select()
      .single();
    
    const updateTimeout = new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Campaign update query timed out after 10 seconds')), 10000)
    );
    
    let campaignData: any = null;
    let campaignError: any = null;
    
    try {
      const result = await Promise.race([updatePromise, updateTimeout]);
      campaignData = result.data;
      campaignError = result.error;
    } catch (updateErr: any) {
      console.error('[Campaign Update] Update query timed out or failed:', updateErr.message);
      // If update fails, try creating instead
      console.log('[Campaign Update] Update failed, attempting to create campaign...');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No user session found');
      }
      const { id, createdAt, ...campaignWithoutId } = campaign;
      return await this.create(session.user.id, campaignWithoutId);
    }

    if (campaignError) {
      // Check if campaign doesn't exist (PGRST116 = not found)
      if (campaignError.code === 'PGRST116') {
        console.log('[Campaign Update] Campaign not found, creating new campaign...');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('No user session found');
        }
        const { id, createdAt, ...campaignWithoutId } = campaign;
        return await this.create(session.user.id, campaignWithoutId);
      }
      console.error('[Campaign Update] Error updating campaign:', campaignError);
      throw new Error(`Failed to update campaign: ${campaignError.message || campaignError.code || 'Unknown error'}`);
    }
    
    if (!campaignData) {
      throw new Error('Campaign update returned no data');
    }
    
    console.log('[Campaign Update] Campaign record updated successfully');

    // Delete existing steps, accounts, and leads (in parallel for speed, with timeout)
    console.log('[Campaign Update] Deleting existing related records...');
    const deleteStartTime = Date.now();
    try {
      // Delete in parallel for better performance, with 15 second timeout
      const deletePromises = [
        (supabase as any).from('sequence_steps').delete().eq('campaign_id', campaign.id),
        (supabase as any).from('campaign_accounts').delete().eq('campaign_id', campaign.id),
        (supabase as any).from('leads').delete().eq('campaign_id', campaign.id)
      ];
      
      const deleteTimeout = new Promise<null>((_, reject) => 
        setTimeout(() => reject(new Error('Delete operations timed out')), 15000)
      );
      
      await Promise.race([Promise.all(deletePromises), deleteTimeout]);
      const deleteDuration = Date.now() - deleteStartTime;
      console.log(`[Campaign Update] Related records deleted successfully in ${deleteDuration}ms`);
    } catch (deleteError: any) {
      const deleteDuration = Date.now() - deleteStartTime;
      console.warn(`[Campaign Update] Error or timeout deleting related records after ${deleteDuration}ms:`, deleteError.message);
      // Continue - might be first save with no existing records, or timeout
      // Don't fail the whole operation if delete times out
    }

    // Insert updated steps
    if (campaign.steps.length > 0) {
      console.log('[Campaign Update] Inserting steps...', campaign.steps.length);
      const stepsToInsert = campaign.steps.map(step => ({
        campaign_id: campaign.id,
        order_number: step.order,
        delay_days: step.delayDays,
        webhook_url: step.webhookUrl,
        prompt_hint: step.promptHint || null,
      }));

      const { error: stepsError } = await (supabase as any).from('sequence_steps').insert(stepsToInsert);
      if (stepsError) {
        console.error('[Campaign Update] Error inserting steps:', stepsError);
        throw new Error(`Failed to insert steps: ${stepsError.message || stepsError.code || 'Unknown error'}`);
      }
      console.log('[Campaign Update] Steps inserted successfully');
    }

    // Insert updated campaign accounts
    if (campaign.senderAccountIds && campaign.senderAccountIds.length > 0) {
      console.log('[Campaign Update] Inserting campaign accounts...', campaign.senderAccountIds.length);
      const accountsToInsert = campaign.senderAccountIds.map((accountId, index) => ({
        campaign_id: campaign.id,
        smtp_account_id: accountId,
        rotation_order: index,
      }));
      const { error: accountsError } = await (supabase as any).from('campaign_accounts').insert(accountsToInsert);
      if (accountsError) {
        console.error('[Campaign Update] Error inserting campaign accounts:', accountsError);
        throw new Error(`Failed to insert campaign accounts: ${accountsError.message || accountsError.code || 'Unknown error'}`);
      }
      console.log('[Campaign Update] Campaign accounts inserted successfully');
    }

      // Update leads - use UPDATE instead of DELETE+INSERT to preserve status changes
      // This ensures lead status updates (like 'CONTACTED') are saved even if delete times out
      if (campaign.leads.length > 0) {
        console.log('[Campaign Update] Updating leads...', campaign.leads.length);
        console.log('[Campaign Update] Lead statuses:', campaign.leads.map(l => ({ email: l.email, status: l.status })));
        
        const batchSize = 50; // Smaller batches for updates
        for (let i = 0; i < campaign.leads.length; i += batchSize) {
          const batch = campaign.leads.slice(i, i + batchSize);
          console.log(`[Campaign Update] Updating leads batch ${Math.floor(i / batchSize) + 1}...`);
          
          // Update each lead individually to ensure status changes are saved
          // This is more reliable than batch operations when status is critical
          for (const lead of batch) {
            const leadData: any = {
              email: lead.email,
              first_name: lead.firstName,
              last_name: lead.lastName,
              company: lead.company,
              website: lead.website || null,
              custom_variable: lead.customVariable || null,
              custom_fields: lead.customFields || {},
              verification_status: lead.verificationStatus,
              status: lead.status, // CRITICAL: This is what updates the dashboard
              folder_id: lead.folderId || null,
              assigned_inbox_id: lead.assignedInboxId || null,
              updated_at: new Date().toISOString()
            };
            
            // Only include unsubscribed_at if it exists
            if (lead.unsubscribedAt !== undefined && lead.unsubscribedAt !== null) {
              leadData.unsubscribed_at = lead.unsubscribedAt;
            }
            
            // Try to update existing lead first
            const { data: existingLead, error: selectError } = await (supabase as any)
              .from('leads')
              .select('id')
              .eq('campaign_id', campaign.id)
              .eq('email', lead.email)
              .single();
              
            if (existingLead && !selectError) {
              // Lead exists, update it
              const { error: updateError } = await (supabase as any)
                .from('leads')
                .update(leadData)
                .eq('id', existingLead.id);
                
              if (updateError) {
                console.error(`[Campaign Update] Failed to update lead ${lead.email}:`, updateError);
                // Check if it's a missing column error
                if (updateError.message && updateError.message.includes('unsubscribed_at')) {
                  throw new Error(`Database schema error: unsubscribed_at column is missing. Please run ADD_UNSUBSCRIBED_AT_COLUMN.sql in Supabase SQL Editor.`);
                }
              } else {
                console.log(`[Campaign Update] ✓ Updated lead ${lead.email} with status: ${lead.status}`);
              }
            } else {
              // Lead doesn't exist, insert it
              const { error: insertError } = await (supabase as any)
                .from('leads')
                .insert({
                  campaign_id: campaign.id,
                  ...leadData
                });
                
              if (insertError) {
                console.error(`[Campaign Update] Failed to insert lead ${lead.email}:`, insertError);
                // Check if it's a missing column error
                if (insertError.message && insertError.message.includes('unsubscribed_at')) {
                  throw new Error(`Database schema error: unsubscribed_at column is missing. Please run ADD_UNSUBSCRIBED_AT_COLUMN.sql in Supabase SQL Editor.`);
                }
              } else {
                console.log(`[Campaign Update] ✓ Inserted new lead ${lead.email} with status: ${lead.status}`);
              }
            }
          }
        }
        console.log('[Campaign Update] All leads updated successfully');
    } else {
      console.log('[Campaign Update] No leads to insert');
    }

    console.log('[Campaign Update] Campaign update completed, skipping getById to avoid timeout');
    
    // Don't call getById - it's slow and can timeout
    // Instead, reconstruct the campaign from what we just saved
    // This is faster and more reliable
    const updatedCampaign: Campaign = {
      ...campaign,
      id: campaignData.id,
      createdAt: campaignData.created_at || campaign.createdAt,
      // Use the campaign data we already have - it's what we just saved
      steps: campaign.steps,
      leads: campaign.leads,
      senderAccountIds: campaign.senderAccountIds || []
    };
    
    console.log('[Campaign Update] Campaign update completed successfully (reconstructed from saved data)');
    return updatedCampaign;
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
          folder_id: lead.folderId || null,
          assigned_inbox_id: lead.assignedInboxId || null,
          // Only include unsubscribed_at if it exists (handle schema mismatch gracefully)
          ...(lead.unsubscribedAt !== undefined && lead.unsubscribedAt !== null 
            ? { unsubscribed_at: lead.unsubscribedAt } 
            : {})
        }));

        // Insert in batches
        for (let i = 0; i < leadsToInsert.length; i += batchSize) {
          const batch = leadsToInsert.slice(i, i + batchSize);
          const { error: insertError } = await ((supabase as any).from('leads').insert(batch) as any);
          
          if (insertError) {
            console.error(`Error inserting leads batch ${Math.floor(i / batchSize) + 1}:`, insertError);
            // Check if it's a missing column error
            if (insertError.message && insertError.message.includes('unsubscribed_at')) {
              throw new Error(`Database schema error: unsubscribed_at column is missing. Please run the migration SQL in Supabase: ADD_UNSUBSCRIBED_AT_COLUMN.sql`);
            }
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
    if (!supabase) {
      const errorMsg = 'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local';
      console.error('[smtpService.create]', errorMsg);
      throw new Error(errorMsg);
    }
    
    console.log('[smtpService.create] Creating account:', { userId, label: account.label });
    
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
        daily_send_limit: account.dailySendLimit || 100,
        sent_today: account.sentToday || 0,
        last_reset_date: account.lastResetDate || new Date().toISOString().split('T')[0],
      })
      .select()
      .single();

    if (error) {
      const errorMsg = `Database error: ${error.message || JSON.stringify(error)}`;
      console.error('[smtpService.create] Error:', errorMsg, error);
      throw new Error(errorMsg);
    }

    if (!data) {
      const errorMsg = 'No data returned from database insert';
      console.error('[smtpService.create]', errorMsg);
      throw new Error(errorMsg);
    }

    console.log('[smtpService.create] Success:', data.id);
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
        daily_send_limit: account.dailySendLimit || 100,
        sent_today: account.sentToday || 0,
        last_reset_date: account.lastResetDate || new Date().toISOString().split('T')[0],
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
    if (!supabase) {
      console.warn('[logService.create] Supabase not configured, log not saved');
      return null;
    }
    
    console.log('[logService.create] Saving execution log:', {
      campaignId: log.campaignId,
      leadId: log.leadId,
      status: log.status,
      type: log.type
    });
    
    const { data, error } = await (supabase as any)
      .from('execution_logs')
      .insert({
        campaign_id: log.campaignId,
        lead_id: log.leadId,
        step_id: log.stepId,
        smtp_account_id: log.smtpAccountId || null,
        timestamp: log.timestamp,
        subject: log.subject || null,
        body: log.body || null,
        status: log.status,
        error_details: log.errorDetails || null,
        type: log.type,
      })
      .select()
      .single();

    if (error) {
      const errorMsg = `Database error creating execution log: ${error.message || JSON.stringify(error)}`;
      console.error('[logService.create] Error:', errorMsg, error);
      // Don't throw - we want execution to continue even if logging fails
      return null;
    }

    if (!data) {
      console.error('[logService.create] No data returned from insert');
      return null;
    }

    console.log('[logService.create] Success:', data.id);
    return transformExecutionLog(data);
  },
};

// ==================== LEAD FOLDERS ====================

export const folderService = {
  // Get all folders for current user
  async getAll(userId: string): Promise<LeadFolder[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('lead_folders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching folders:', error);
      return [];
    }

    return (data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      description: f.description || undefined,
      createdAt: f.created_at,
    }));
  },

  // Create folder
  async create(userId: string, folder: Omit<LeadFolder, 'id' | 'createdAt'>): Promise<LeadFolder | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('lead_folders')
      .insert({
        user_id: userId,
        name: folder.name,
        description: folder.description || null,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error creating folder:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      createdAt: data.created_at,
    };
  },

  // Update folder
  async update(folder: LeadFolder): Promise<LeadFolder | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('lead_folders')
      .update({
        name: folder.name,
        description: folder.description || null,
      })
      .eq('id', folder.id)
      .select()
      .single();

    if (error || !data) {
      console.error('Error updating folder:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      description: data.description || undefined,
      createdAt: data.created_at,
    };
  },

  // Delete folder
  async delete(id: string): Promise<boolean> {
    if (!supabase) return false;
    
    const { error } = await (supabase as any)
      .from('lead_folders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting folder:', error);
      return false;
    }

    return true;
  },
};

// ==================== CAMPAIGN ANALYTICS ====================

export const analyticsService = {
  // Get analytics for a campaign
  async getByCampaign(campaignId: string): Promise<CampaignAnalytics[]> {
    if (!supabase) return [];
    
    const { data, error } = await (supabase as any)
      .from('campaign_analytics')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching analytics:', error);
      return [];
    }

    return (data || []).map((a: any) => ({
      id: a.id,
      campaignId: a.campaign_id,
      date: a.date,
      emailsSent: a.emails_sent || 0,
      emailsDelivered: a.emails_delivered || 0,
      emailsOpened: a.emails_opened || 0,
      emailsClicked: a.emails_clicked || 0,
      emailsReplied: a.emails_replied || 0,
      emailsBounced: a.emails_bounced || 0,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));
  },

  // Update or create analytics for a campaign date
  async upsert(analytics: Omit<CampaignAnalytics, 'id' | 'createdAt' | 'updatedAt'>): Promise<CampaignAnalytics | null> {
    if (!supabase) return null;
    
    const { data, error } = await (supabase as any)
      .from('campaign_analytics')
      .upsert({
        campaign_id: analytics.campaignId,
        date: analytics.date,
        emails_sent: analytics.emailsSent,
        emails_delivered: analytics.emailsDelivered,
        emails_opened: analytics.emailsOpened,
        emails_clicked: analytics.emailsClicked,
        emails_replied: analytics.emailsReplied,
        emails_bounced: analytics.emailsBounced,
      }, {
        onConflict: 'campaign_id,date'
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Error upserting analytics:', error);
      return null;
    }

    return {
      id: data.id,
      campaignId: data.campaign_id,
      date: data.date,
      emailsSent: data.emails_sent || 0,
      emailsDelivered: data.emails_delivered || 0,
      emailsOpened: data.emails_opened || 0,
      emailsClicked: data.emails_clicked || 0,
      emailsReplied: data.emails_replied || 0,
      emailsBounced: data.emails_bounced || 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
};

// ==================== TRANSFORMERS ====================

function transformCampaign(data: any): Campaign {
  // Extract sender account IDs from campaign_accounts junction table
  const senderAccountIds = (data.campaign_accounts || [])
    .sort((a: any, b: any) => a.rotation_order - b.rotation_order)
    .map((ca: any) => ca.smtp_account_id);

  return {
    id: data.id,
    name: data.name,
    status: data.status as CampaignStatus,
    schedule: {
      days: data.schedule_days || [],
      startTime: data.schedule_start_time || '09:00',
      endTime: data.schedule_end_time || '17:00',
      timezone: data.schedule_timezone || 'UTC',
      enabled: data.schedule_enabled || false,
      type: (data.schedule_type || 'DAILY') as 'DAILY' | 'ONCE' | 'WEEKLY',
      startDate: data.schedule_start_date || undefined,
    },
    senderAccountId: data.sender_account_id || undefined, // Keep for backward compatibility
    senderAccountIds: senderAccountIds.length > 0 ? senderAccountIds : undefined,
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
    folderId: data.folder_id || undefined,
    assignedInboxId: data.assigned_inbox_id || undefined,
    unsubscribedAt: data.unsubscribed_at || undefined,
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
    dailySendLimit: data.daily_send_limit || 100,
    sentToday: data.sent_today || 0,
    lastResetDate: data.last_reset_date || new Date().toISOString().split('T')[0],
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
    smtpAccountId: data.smtp_account_id || undefined,
    timestamp: data.timestamp,
    subject: data.subject || '',
    body: data.body || '',
    status: data.status,
    errorDetails: data.error_details || undefined,
    type: data.type,
  };
}

