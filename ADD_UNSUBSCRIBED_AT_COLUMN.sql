-- Migration: Add unsubscribed_at column to leads table
-- Run this in Supabase SQL Editor if the column is missing

-- Check if column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'leads' 
        AND column_name = 'unsubscribed_at'
    ) THEN
        ALTER TABLE public.leads 
        ADD COLUMN unsubscribed_at TIMESTAMPTZ;
        
        RAISE NOTICE 'Column unsubscribed_at added to leads table';
    ELSE
        RAISE NOTICE 'Column unsubscribed_at already exists in leads table';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'leads' 
AND column_name = 'unsubscribed_at';
