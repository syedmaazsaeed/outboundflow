-- OutboundFlow Database Schema for Supabase (Idempotent Version)
-- This version can be run multiple times without errors
-- It drops existing policies and triggers before recreating them

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SMTP Accounts table
CREATE TABLE IF NOT EXISTS public.smtp_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    user_name TEXT NOT NULL, -- renamed from 'user' as it's a reserved keyword
    pass TEXT NOT NULL,
    secure BOOLEAN NOT NULL DEFAULT false,
    from_email TEXT NOT NULL,
    warmup_enabled BOOLEAN NOT NULL DEFAULT false,
    warmup_sent_today INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED')),
    schedule_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
    schedule_start_time TEXT NOT NULL DEFAULT '09:00',
    schedule_end_time TEXT NOT NULL DEFAULT '17:00',
    schedule_timezone TEXT NOT NULL DEFAULT 'UTC',
    sender_account_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sequence Steps table
CREATE TABLE IF NOT EXISTS public.sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0,
    webhook_url TEXT NOT NULL DEFAULT '',
    prompt_hint TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, order_number)
);

-- Leads table
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company TEXT NOT NULL,
    website TEXT,
    custom_variable TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'CATCHALL', 'INVALID', 'UNVERIFIED')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'REPLIED', 'BOUNCED', 'INTERESTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email Messages table (Inbox)
CREATE TABLE IF NOT EXISTS public.email_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Execution Logs table
CREATE TABLE IF NOT EXISTS public.execution_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    step_id UUID NOT NULL REFERENCES public.sequence_steps(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR')),
    error_details TEXT,
    type TEXT NOT NULL CHECK (type IN ('WEBHOOK', 'SEND')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_smtp_accounts_user_id ON public.smtp_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_campaign_id ON public.sequence_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_id ON public.email_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign_id ON public.execution_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_lead_id ON public.execution_logs(lead_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;

DROP POLICY IF EXISTS "Users can view own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can insert own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can update own smtp accounts" ON public.smtp_accounts;
DROP POLICY IF EXISTS "Users can delete own smtp accounts" ON public.smtp_accounts;

DROP POLICY IF EXISTS "Users can view own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can insert own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.campaigns;

DROP POLICY IF EXISTS "Users can view steps of own campaigns" ON public.sequence_steps;
DROP POLICY IF EXISTS "Users can insert steps to own campaigns" ON public.sequence_steps;
DROP POLICY IF EXISTS "Users can update steps of own campaigns" ON public.sequence_steps;
DROP POLICY IF EXISTS "Users can delete steps of own campaigns" ON public.sequence_steps;

DROP POLICY IF EXISTS "Users can view leads of own campaigns" ON public.leads;
DROP POLICY IF EXISTS "Users can insert leads to own campaigns" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads of own campaigns" ON public.leads;
DROP POLICY IF EXISTS "Users can delete leads of own campaigns" ON public.leads;

DROP POLICY IF EXISTS "Users can view own email messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can insert own email messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can update own email messages" ON public.email_messages;
DROP POLICY IF EXISTS "Users can delete own email messages" ON public.email_messages;

DROP POLICY IF EXISTS "Users can view logs of own campaigns" ON public.execution_logs;
DROP POLICY IF EXISTS "Users can insert logs for own campaigns" ON public.execution_logs;

-- RLS Policies: Users can only access their own data
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- SMTP Accounts policies
CREATE POLICY "Users can view own smtp accounts" ON public.smtp_accounts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own smtp accounts" ON public.smtp_accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own smtp accounts" ON public.smtp_accounts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own smtp accounts" ON public.smtp_accounts
    FOR DELETE USING (auth.uid() = user_id);

-- Campaigns policies
CREATE POLICY "Users can view own campaigns" ON public.campaigns
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own campaigns" ON public.campaigns
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns" ON public.campaigns
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns" ON public.campaigns
    FOR DELETE USING (auth.uid() = user_id);

-- Sequence Steps policies
CREATE POLICY "Users can view steps of own campaigns" ON public.sequence_steps
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = sequence_steps.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert steps to own campaigns" ON public.sequence_steps
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = sequence_steps.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update steps of own campaigns" ON public.sequence_steps
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = sequence_steps.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete steps of own campaigns" ON public.sequence_steps
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = sequence_steps.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

-- Leads policies
CREATE POLICY "Users can view leads of own campaigns" ON public.leads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = leads.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert leads to own campaigns" ON public.leads
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = leads.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update leads of own campaigns" ON public.leads
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = leads.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete leads of own campaigns" ON public.leads
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = leads.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

-- Email Messages policies
CREATE POLICY "Users can view own email messages" ON public.email_messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own email messages" ON public.email_messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own email messages" ON public.email_messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own email messages" ON public.email_messages
    FOR DELETE USING (auth.uid() = user_id);

-- Execution Logs policies
CREATE POLICY "Users can view logs of own campaigns" ON public.execution_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = execution_logs.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert logs for own campaigns" ON public.execution_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = execution_logs.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist (to allow re-running this script)
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
DROP TRIGGER IF EXISTS update_smtp_accounts_updated_at ON public.smtp_accounts;
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
DROP TRIGGER IF EXISTS update_sequence_steps_updated_at ON public.sequence_steps;
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
DROP TRIGGER IF EXISTS update_email_messages_updated_at ON public.email_messages;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_smtp_accounts_updated_at BEFORE UPDATE ON public.smtp_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON public.campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sequence_steps_updated_at BEFORE UPDATE ON public.sequence_steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_messages_updated_at BEFORE UPDATE ON public.email_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
