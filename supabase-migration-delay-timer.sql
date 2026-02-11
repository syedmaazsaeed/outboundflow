-- Migration: Add delay_hours and delay_minutes to sequence_steps for follow-up timers
-- Run this if you have an existing database. New setups can use the updated main schema.

ALTER TABLE public.sequence_steps 
  ADD COLUMN IF NOT EXISTS delay_hours INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delay_minutes INTEGER NOT NULL DEFAULT 0;
