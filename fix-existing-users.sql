-- Fix: Create user profiles for existing auth users who don't have profiles
-- Run this in Supabase SQL Editor if you have users who can't sign in

-- This will create profiles for all auth users who don't have a profile in the users table
INSERT INTO public.users (id, email, name, created_at)
SELECT 
    au.id,
    au.email,
    COALESCE(au.raw_user_meta_data->>'name', SPLIT_PART(au.email, '@', 1), 'User') as name,
    au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Verify the fix
SELECT 
    au.id,
    au.email,
    au.email_confirmed_at,
    pu.id as profile_exists
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
ORDER BY au.created_at DESC
LIMIT 10;
