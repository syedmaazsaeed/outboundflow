-- Verification Script: Check if all required database objects exist
-- Run this in Supabase SQL Editor to verify your database is set up correctly

-- ============================================
-- 1. CHECK REQUIRED COLUMNS
-- ============================================

-- Check if unsubscribed_at column exists in leads table
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'leads' 
            AND column_name = 'unsubscribed_at'
        ) THEN '✓ unsubscribed_at column exists'
        ELSE '✗ unsubscribed_at column MISSING - Run ADD_UNSUBSCRIBED_AT_COLUMN.sql'
    END as unsubscribed_at_status;

-- ============================================
-- 2. CHECK REQUIRED INDEXES (for performance)
-- ============================================

-- Check all indexes exist
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_campaign_id') 
        THEN '✓ idx_leads_campaign_id'
        ELSE '✗ idx_leads_campaign_id MISSING'
    END as idx_leads_campaign_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaigns_user_id') 
        THEN '✓ idx_campaigns_user_id'
        ELSE '✗ idx_campaigns_user_id MISSING'
    END as idx_campaigns_user_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_sequence_steps_campaign_id') 
        THEN '✓ idx_sequence_steps_campaign_id'
        ELSE '✗ idx_sequence_steps_campaign_id MISSING'
    END as idx_sequence_steps_campaign_id,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaign_accounts_campaign_id') 
        THEN '✓ idx_campaign_accounts_campaign_id'
        ELSE '✗ idx_campaign_accounts_campaign_id MISSING'
    END as idx_campaign_accounts_campaign_id;

-- ============================================
-- 3. CHECK RLS POLICIES
-- ============================================

-- Check if RLS is enabled on key tables
SELECT 
    tablename,
    CASE WHEN rowsecurity THEN '✓ RLS Enabled' ELSE '✗ RLS Disabled' END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('campaigns', 'leads', 'sequence_steps', 'campaign_accounts')
ORDER BY tablename;

-- Check if key policies exist
SELECT 
    tablename,
    policyname,
    CASE WHEN policyname IS NOT NULL THEN '✓ Policy exists' ELSE '✗ Policy missing' END as policy_status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('campaigns', 'leads')
ORDER BY tablename, policyname;

-- ============================================
-- 4. SUMMARY REPORT
-- ============================================

-- Overall status check
SELECT 
    'Database Setup Verification' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'leads' 
            AND column_name = 'unsubscribed_at'
        )
        AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_leads_campaign_id')
        AND EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_campaigns_user_id')
        THEN '✓ All checks passed - Database is ready!'
        ELSE '⚠ Some checks failed - Review output above'
    END as overall_status;

-- ============================================
-- 5. OPTIONAL: CREATE MISSING INDEXES (if needed)
-- ============================================

-- Uncomment and run these if indexes are missing:

-- CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON public.leads(campaign_id);
-- CREATE INDEX IF NOT EXISTS idx_leads_email ON public.leads(email);
-- CREATE INDEX IF NOT EXISTS idx_leads_folder_id ON public.leads(folder_id);
-- CREATE INDEX IF NOT EXISTS idx_leads_assigned_inbox_id ON public.leads(assigned_inbox_id);
-- CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON public.campaigns(user_id);
-- CREATE INDEX IF NOT EXISTS idx_sequence_steps_campaign_id ON public.sequence_steps(campaign_id);
-- CREATE INDEX IF NOT EXISTS idx_campaign_accounts_campaign_id ON public.campaign_accounts(campaign_id);
-- CREATE INDEX IF NOT EXISTS idx_campaign_accounts_smtp_account_id ON public.campaign_accounts(smtp_account_id);
