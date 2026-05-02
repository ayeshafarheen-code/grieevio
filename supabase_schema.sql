-- ═══════════════════════════════════════════════════════════════════════════
-- GRIEEVIO – PUBLIC DATABASE SCHEMA (NO AUTH)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Drop old tables if they exist
DROP TABLE IF EXISTS public.complaints;
DROP TABLE IF EXISTS public.profiles;

-- 2. Complaints Table (Publicly Accessible)
CREATE TABLE public.complaints (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
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

-- 3. Disable RLS or set to Public
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 4. Allow Public Read/Write
CREATE POLICY "Anyone can view complaints" ON public.complaints FOR SELECT USING (true);
CREATE POLICY "Anyone can submit complaints" ON public.complaints FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update complaints" ON public.complaints FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete complaints" ON public.complaints FOR DELETE USING (true);
