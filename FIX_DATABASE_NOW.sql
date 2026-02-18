-- ============================================================================
-- ONE-STEP FIX: Drop everything and rebuild clean
-- Copy this ENTIRE file and run it in Supabase SQL Editor
-- ============================================================================

-- STEP 1: DROP EVERYTHING
DROP TABLE IF EXISTS public.campaign_analytics CASCADE;
DROP TABLE IF EXISTS public.execution_logs CASCADE;
DROP TABLE IF EXISTS public.campaign_accounts CASCADE;
DROP TABLE IF EXISTS public.email_messages CASCADE;
DROP TABLE IF EXISTS public.lead_folders CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.sequence_steps CASCADE;
DROP TABLE IF EXISTS public.smtp_accounts CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- STEP 2: CREATE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- STEP 3: CREATE TABLES
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.smtp_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    user_name TEXT NOT NULL,
    pass TEXT NOT NULL,
    secure BOOLEAN DEFAULT true,
    from_email TEXT NOT NULL,
    warmup_enabled BOOLEAN DEFAULT true,
    warmup_sent_today INTEGER DEFAULT 0,
    daily_send_limit INTEGER DEFAULT 100,
    sent_today INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'DRAFT',
    schedule_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5],
    schedule_start_time TEXT DEFAULT '09:00',
    schedule_end_time TEXT DEFAULT '17:00',
    schedule_timezone TEXT DEFAULT 'UTC',
    schedule_enabled BOOLEAN DEFAULT false,
    schedule_type TEXT DEFAULT 'DAILY',
    schedule_start_date DATE,
    sender_account_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.sequence_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    order_number INTEGER NOT NULL,
    delay_days INTEGER DEFAULT 0,
    delay_hours INTEGER DEFAULT 0,
    delay_minutes INTEGER DEFAULT 0,
    webhook_url TEXT NOT NULL,
    prompt_hint TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    website TEXT,
    custom_variable TEXT,
    custom_fields JSONB DEFAULT '{}',
    verification_status TEXT DEFAULT 'NOT_VERIFIED',
    status TEXT DEFAULT 'ACTIVE',
    folder_id UUID,
    assigned_inbox_id UUID,
    unsubscribed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.campaign_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    smtp_account_id UUID NOT NULL REFERENCES public.smtp_accounts(id) ON DELETE CASCADE,
    rotation_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, smtp_account_id)
);

CREATE TABLE public.email_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    from_email TEXT NOT NULL,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.execution_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    step_id UUID REFERENCES public.sequence_steps(id) ON DELETE SET NULL,
    smtp_account_id UUID REFERENCES public.smtp_accounts(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    subject TEXT,
    body TEXT,
    status TEXT NOT NULL,
    error_details TEXT,
    type TEXT NOT NULL
);

CREATE TABLE public.lead_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.campaign_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    emails_sent INTEGER DEFAULT 0,
    emails_delivered INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    emails_replied INTEGER DEFAULT 0,
    emails_bounced INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(campaign_id, date)
);

-- STEP 4: ENABLE RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smtp_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_analytics ENABLE ROW LEVEL SECURITY;

-- STEP 5: CREATE POLICIES
CREATE POLICY "users_select" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "smtp_select" ON public.smtp_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "smtp_insert" ON public.smtp_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "smtp_update" ON public.smtp_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "smtp_delete" ON public.smtp_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "campaigns_delete" ON public.campaigns FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "steps_all" ON public.sequence_steps FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));
CREATE POLICY "leads_all" ON public.leads FOR ALL USING (campaign_id IS NULL OR campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));
CREATE POLICY "campaign_accounts_all" ON public.campaign_accounts FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

CREATE POLICY "emails_select" ON public.email_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "emails_insert" ON public.email_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "emails_update" ON public.email_messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "emails_delete" ON public.email_messages FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "folders_select" ON public.lead_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "folders_insert" ON public.lead_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "folders_update" ON public.lead_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "folders_delete" ON public.lead_folders FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "logs_select" ON public.execution_logs FOR SELECT USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));
CREATE POLICY "logs_insert" ON public.execution_logs FOR INSERT WITH CHECK (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

CREATE POLICY "analytics_all" ON public.campaign_analytics FOR ALL USING (campaign_id IN (SELECT id FROM campaigns WHERE user_id = auth.uid()));

-- STEP 6: LINK YOUR USER
INSERT INTO public.users (id, email, name)
SELECT id, email, COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- STEP 7: CREATE INDEXES
CREATE INDEX idx_smtp_user ON smtp_accounts(user_id);
CREATE INDEX idx_campaigns_user ON campaigns(user_id);
CREATE INDEX idx_emails_user ON email_messages(user_id);

-- DONE
SELECT 'SUCCESS! Tables created: ' || COUNT(*)::text FROM information_schema.tables WHERE table_schema = 'public';
