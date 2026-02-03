-- Migration script to add new columns and tables for feature expansion
-- This script is idempotent and can be run multiple times safely

-- IMPORTANT: Create new tables FIRST before adding foreign key references

-- Create Lead Folders table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.lead_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Now add columns to existing tables if they don't exist

-- Add columns to leads table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'folder_id') THEN
        ALTER TABLE public.leads ADD COLUMN folder_id UUID REFERENCES public.lead_folders(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_inbox_id') THEN
        ALTER TABLE public.leads ADD COLUMN assigned_inbox_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'unsubscribed_at') THEN
        ALTER TABLE public.leads ADD COLUMN unsubscribed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add columns to smtp_accounts table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_accounts' AND column_name = 'daily_send_limit') THEN
        ALTER TABLE public.smtp_accounts ADD COLUMN daily_send_limit INTEGER NOT NULL DEFAULT 100;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_accounts' AND column_name = 'sent_today') THEN
        ALTER TABLE public.smtp_accounts ADD COLUMN sent_today INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'smtp_accounts' AND column_name = 'last_reset_date') THEN
        ALTER TABLE public.smtp_accounts ADD COLUMN last_reset_date DATE NOT NULL DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Add columns to campaigns table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'schedule_enabled') THEN
        ALTER TABLE public.campaigns ADD COLUMN schedule_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'schedule_type') THEN
        ALTER TABLE public.campaigns ADD COLUMN schedule_type TEXT NOT NULL DEFAULT 'DAILY' CHECK (schedule_type IN ('DAILY', 'ONCE', 'WEEKLY'));
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'campaigns' AND column_name = 'schedule_start_date') THEN
        ALTER TABLE public.campaigns ADD COLUMN schedule_start_date DATE;
    END IF;
END $$;

-- Add column to execution_logs table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'execution_logs' AND column_name = 'smtp_account_id') THEN
        ALTER TABLE public.execution_logs ADD COLUMN smtp_account_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Campaign Accounts junction table
CREATE TABLE IF NOT EXISTS public.campaign_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    smtp_account_id UUID NOT NULL REFERENCES public.smtp_accounts(id) ON DELETE CASCADE,
    rotation_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(campaign_id, smtp_account_id)
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_lead_folders_user_id ON public.lead_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_accounts_campaign_id ON public.campaign_accounts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_accounts_smtp_account_id ON public.campaign_accounts(smtp_account_id);
CREATE INDEX IF NOT EXISTS idx_leads_folder_id ON public.leads(folder_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_inbox_id ON public.leads(assigned_inbox_id);
CREATE INDEX IF NOT EXISTS idx_execution_logs_smtp_account_id ON public.execution_logs(smtp_account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_campaign_id ON public.campaign_analytics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_analytics_date ON public.campaign_analytics(date);

-- Enable RLS on new tables
ALTER TABLE public.lead_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow re-running this script)
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

-- Create trigger for lead_folders updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_lead_folders_updated_at ON public.lead_folders;
CREATE TRIGGER update_lead_folders_updated_at BEFORE UPDATE ON public.lead_folders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for campaign_analytics updated_at if it doesn't exist
DROP TRIGGER IF EXISTS update_campaign_analytics_updated_at ON public.campaign_analytics;
CREATE TRIGGER update_campaign_analytics_updated_at BEFORE UPDATE ON public.campaign_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to reset daily send counts if it doesn't exist
CREATE OR REPLACE FUNCTION reset_daily_send_counts()
RETURNS void AS $$
BEGIN
    UPDATE public.smtp_accounts
    SET sent_today = 0,
        last_reset_date = CURRENT_DATE
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
