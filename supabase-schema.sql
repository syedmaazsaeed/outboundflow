-- OutboundFlow Database Schema for Supabase
-- This file contains all the table definitions needed for the application

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

-- Lead Folders table
CREATE TABLE IF NOT EXISTS public.lead_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
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
    daily_send_limit INTEGER NOT NULL DEFAULT 100, -- Daily send limit per inbox
    sent_today INTEGER NOT NULL DEFAULT 0, -- Emails sent today (resets daily)
    last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE, -- Track when sent_today was last reset
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
    schedule_enabled BOOLEAN NOT NULL DEFAULT false, -- Enable/disable automated scheduling
    schedule_type TEXT NOT NULL DEFAULT 'DAILY' CHECK (schedule_type IN ('DAILY', 'ONCE', 'WEEKLY')), -- Schedule type
    schedule_start_date DATE, -- For 'ONCE' or 'WEEKLY' schedules
    sender_account_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL, -- Deprecated: use campaign_accounts instead
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign Accounts junction table (for multiple SMTP accounts per campaign)
CREATE TABLE IF NOT EXISTS public.campaign_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    smtp_account_id UUID NOT NULL REFERENCES public.smtp_accounts(id) ON DELETE CASCADE,
    rotation_order INTEGER NOT NULL DEFAULT 0, -- Order for rotation
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, smtp_account_id)
);

-- Sequence Steps table
CREATE TABLE IF NOT EXISTS public.sequence_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    delay_days INTEGER NOT NULL DEFAULT 0,
    delay_hours INTEGER NOT NULL DEFAULT 0,
    delay_minutes INTEGER NOT NULL DEFAULT 0,
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
    folder_id UUID REFERENCES public.lead_folders(id) ON DELETE SET NULL, -- Optional folder assignment
    email TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    company TEXT NOT NULL,
    website TEXT,
    custom_variable TEXT,
    custom_fields JSONB DEFAULT '{}'::jsonb,
    verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (verification_status IN ('VERIFIED', 'CATCHALL', 'INVALID', 'UNVERIFIED')),
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONTACTED', 'REPLIED', 'BOUNCED', 'INTERESTED')),
    assigned_inbox_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL, -- Track which inbox is assigned to this lead
    unsubscribed_at TIMESTAMPTZ, -- Timestamp when lead unsubscribed
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
    smtp_account_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL, -- Track which SMTP account was used
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR')),
    error_details TEXT,
    type TEXT NOT NULL CHECK (type IN ('WEBHOOK', 'SEND')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campaign Analytics table
CREATE TABLE IF NOT EXISTS public.campaign_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    emails_sent INTEGER NOT NULL DEFAULT 0,
    emails_delivered INTEGER NOT NULL DEFAULT 0,
    emails_opened INTEGER NOT NULL DEFAULT 0,
    emails_clicked INTEGER NOT NULL DEFAULT 0,
    emails_replied INTEGER NOT NULL DEFAULT 0,
    emails_bounced INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_lead_folders_user_id ON public.lead_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_smtp_accounts_user_id ON public.smtp_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_accounts_campaign_id ON public.campaign_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_accounts_smtp_account_id ON public.campaign_accounts(smtp_account_id);
CREATE INDEX IF NOT EXISTS idx_sequence_steps_campaign_id ON public.sequence_steps(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_folder_id ON public.leads(folder_id);
CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_inbox_id ON public.leads(assigned_inbox_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_user_id ON public.email_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_email_messages_campaign_id ON public.email_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_campaign_id ON public.execution_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_lead_id ON public.execution_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_smtp_account_id ON public.execution_logs(smtp_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON public.campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date ON public.campaign_analytics(date);

-- Enable Row Level Security (RLS)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "Users can view own lead folders" ON public.lead_folders;
DROP POLICY IF EXISTS "Users can insert own lead folders" ON public.lead_folders;
DROP POLICY IF EXISTS "Users can update own lead folders" ON public.lead_folders;
DROP POLICY IF EXISTS "Users can delete own lead folders" ON public.lead_folders;

DROP POLICY IF EXISTS "Users can view campaign accounts of own campaigns" ON public.campaign_accounts;
DROP POLICY IF EXISTS "Users can insert campaign accounts to own campaigns" ON public.campaign_accounts;
DROP POLICY IF EXISTS "Users can delete campaign accounts from own campaigns" ON public.campaign_accounts;

DROP POLICY IF EXISTS "Users can view analytics of own campaigns" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Users can insert analytics for own campaigns" ON public.campaign_analytics;
DROP POLICY IF EXISTS "Users can update analytics of own campaigns" ON public.campaign_analytics;

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

-- Lead Folders policies
CREATE POLICY "Users can view own lead folders" ON public.lead_folders
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lead folders" ON public.lead_folders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lead folders" ON public.lead_folders
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lead folders" ON public.lead_folders
    FOR DELETE USING (auth.uid() = user_id);

-- Campaign Accounts policies
CREATE POLICY "Users can view campaign accounts of own campaigns" ON public.campaign_accounts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_accounts.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert campaign accounts to own campaigns" ON public.campaign_accounts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_accounts.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete campaign accounts from own campaigns" ON public.campaign_accounts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_accounts.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

-- Campaign Analytics policies
CREATE POLICY "Users can view analytics of own campaigns" ON public.campaign_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_analytics.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert analytics for own campaigns" ON public.campaign_analytics
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_analytics.campaign_id 
            AND campaigns.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update analytics of own campaigns" ON public.campaign_analytics
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.campaigns 
            WHERE campaigns.id = campaign_analytics.campaign_id 
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
<<<<<<< HEAD
=======
DROP TRIGGER IF EXISTS update_lead_folders_updated_at ON public.lead_folders;
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665
DROP TRIGGER IF EXISTS update_smtp_accounts_updated_at ON public.smtp_accounts;
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
DROP TRIGGER IF EXISTS update_sequence_steps_updated_at ON public.sequence_steps;
DROP TRIGGER IF EXISTS update_leads_updated_at ON public.leads;
DROP TRIGGER IF EXISTS update_email_messages_updated_at ON public.email_messages;
<<<<<<< HEAD
=======
DROP TRIGGER IF EXISTS update_campaign_analytics_updated_at ON public.campaign_analytics;
>>>>>>> a9ff574285da102ae682d9c316ecbb13c92b4665

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lead_folders_updated_at BEFORE UPDATE ON public.lead_folders
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

CREATE TRIGGER update_campaign_analytics_updated_at BEFORE UPDATE ON public.campaign_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to reset daily send counts (should be called daily via cron or scheduled function)
CREATE OR REPLACE FUNCTION reset_daily_send_counts()
RETURNS void AS $$
BEGIN
    UPDATE public.smtp_accounts
    SET sent_today = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
