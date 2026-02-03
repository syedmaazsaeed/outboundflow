-- Diagnostic Queries for Supabase Database
-- Run these queries in Supabase SQL Editor to check database state

-- 1. Check if campaigns table exists and has data
SELECT COUNT(*) as total_campaigns FROM public.campaigns;

-- 2. List all campaigns with their IDs and names
SELECT id, name, status, user_id, created_at 
FROM public.campaigns 
ORDER BY created_at DESC 
LIMIT 10;

-- 3. Check for a specific campaign (replace with your campaign ID)
SELECT id, name, status, user_id, created_at 
FROM public.campaigns 
WHERE id = '956dcdf6-cf35-4663-9c70-006de3f45f0e';

-- 4. Check RLS policies on campaigns table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'campaigns';

-- 5. Check if RLS is enabled on campaigns table
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'campaigns' AND schemaname = 'public';

-- 6. Check current user and session
SELECT auth.uid() as current_user_id;

-- 7. Check campaigns for current user
SELECT id, name, status, user_id, created_at 
FROM public.campaigns 
WHERE user_id = auth.uid()
ORDER BY created_at DESC;

-- 8. Check sequence_steps for a campaign
SELECT * FROM public.sequence_steps 
WHERE campaign_id = '956dcdf6-cf35-4663-9c70-006de3f45f0e';

-- 9. Check campaign_accounts for a campaign
SELECT * FROM public.campaign_accounts 
WHERE campaign_id = '956dcdf6-cf35-4663-9c70-006de3f45f0e';

-- 10. Check leads for a campaign
SELECT COUNT(*) as lead_count FROM public.leads 
WHERE campaign_id = '956dcdf6-cf35-4663-9c70-006de3f45f0e';

-- 11. Test RLS policy - try to select campaign as current user
-- This should work if RLS policies are correct
SELECT * FROM public.campaigns 
WHERE id = '956dcdf6-cf35-4663-9c70-006de3f45f0e' 
AND user_id = auth.uid();

-- 12. Check if there are any foreign key constraint issues
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name = 'campaigns';

-- 13. Check for orphaned records (campaigns without user_id match)
SELECT c.id, c.name, c.user_id, u.id as user_exists
FROM public.campaigns c
LEFT JOIN auth.users u ON c.user_id = u.id
WHERE u.id IS NULL;

-- 14. Verify RLS policies are correctly set up
-- This should return policies for campaigns table
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command_type,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename IN ('campaigns', 'sequence_steps', 'leads', 'campaign_accounts')
ORDER BY tablename, policyname;

-- 15. Test query that matches what getById does
-- Replace 'YOUR_USER_ID' with your actual user ID from auth.users
SELECT 
    c.*,
    json_agg(DISTINCT jsonb_build_object(
        'id', ss.id,
        'order', ss.order_number,
        'delayDays', ss.delay_days,
        'webhookUrl', ss.webhook_url,
        'promptHint', ss.prompt_hint
    )) FILTER (WHERE ss.id IS NOT NULL) as sequence_steps,
    json_agg(DISTINCT jsonb_build_object(
        'id', l.id,
        'email', l.email,
        'firstName', l.first_name,
        'lastName', l.last_name,
        'company', l.company,
        'status', l.status
    )) FILTER (WHERE l.id IS NOT NULL) as leads,
    json_agg(DISTINCT jsonb_build_object(
        'smtp_account_id', ca.smtp_account_id,
        'rotation_order', ca.rotation_order
    )) FILTER (WHERE ca.smtp_account_id IS NOT NULL) as campaign_accounts
FROM public.campaigns c
LEFT JOIN public.sequence_steps ss ON c.id = ss.campaign_id
LEFT JOIN public.leads l ON c.id = l.campaign_id
LEFT JOIN public.campaign_accounts ca ON c.id = ca.campaign_id
WHERE c.id = '956dcdf6-cf35-4663-9c70-006de3f45f0e'
  AND c.user_id = auth.uid()
GROUP BY c.id;
