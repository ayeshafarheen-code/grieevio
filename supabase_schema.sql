-- ═══════════════════════════════════════════════════════════════════════════
-- GRIEEVIO – Supabase Database Schema
-- Paste this into the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Other',
    status TEXT DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'In Progress', 'Resolved', 'Rejected')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
    location TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    image_path TEXT,
    admin_notes TEXT,
    verification_score INTEGER,
    is_urgent BOOLEAN DEFAULT FALSE,
    is_escalated BOOLEAN DEFAULT FALSE,
    escalation_level INTEGER DEFAULT 0,
    sla_deadline TIMESTAMPTZ,
    original_language TEXT DEFAULT 'en',
    translated_text TEXT
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Citizens can view their own complaints
CREATE POLICY "Users can view their own complaints" 
ON public.complaints FOR SELECT 
USING (auth.uid() = user_id);

-- Citizens can insert their own complaints
CREATE POLICY "Users can insert their own complaints" 
ON public.complaints FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Citizens can delete their own complaints
CREATE POLICY "Users can delete their own complaints" 
ON public.complaints FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view ALL complaints
CREATE POLICY "Admins can view all complaints" 
ON public.complaints FOR SELECT 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- Admins can update ANY complaint
CREATE POLICY "Admins can update any complaint" 
ON public.complaints FOR UPDATE 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- Public can view basic stats (if needed for index.html)
CREATE POLICY "Public can view complaint count"
ON public.complaints FOR SELECT
USING (true);

-- 4. Storage Bucket
-- IMPORTANT: Go to Storage in Dashboard and create a public bucket named 'complaints'

-- 5. Automatic AI Processing Trigger (Optional)
-- This requires the 'pg_net' extension enabled in Supabase
-- CREATE EXTENSION IF NOT EXISTS pg_net;

-- CREATE OR REPLACE FUNCTION public.trigger_ai_processing()
-- RETURNS TRIGGER AS $$
-- BEGIN
--   PERFORM net.http_post(
--     url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/process-complaint',
--     headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer <YOUR_ANON_KEY>'),
--     body := jsonb_build_object('complaint_id', NEW.id)
--   );
--   RETURN NEW;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;

-- CREATE TRIGGER after_complaint_insert
-- AFTER INSERT ON public.complaints
-- FOR EACH ROW EXECUTE FUNCTION public.trigger_ai_processing();

-- ═══════════════════════════════════════════════════════════════════════════
-- INSTRUCTIONS:
-- 1. Run this SQL in the Supabase Dashboard.
-- 2. Create a Storage Bucket named 'complaints' and set it to Public.
-- 3. Set the Bucket RLS to allow authenticated users to upload to '<user_id>/' folder.
-- ═══════════════════════════════════════════════════════════════════════════
