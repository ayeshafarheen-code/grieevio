-- ═══════════════════════════════════════════════════════════════════════════
-- GRIEEVIO – Updated Supabase Database Schema
-- Paste this into the Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Profiles Table (Correct UUID mapping)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  phone TEXT,
  role TEXT DEFAULT 'citizen',
  points INTEGER DEFAULT 0,
  badge TEXT DEFAULT 'None',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Complaints Table
CREATE TABLE IF NOT EXISTS public.complaints (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- 3. Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- 4. Profile Policies
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 5. Complaint Policies
CREATE POLICY "Users can view their own complaints" ON public.complaints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own complaints" ON public.complaints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own complaints" ON public.complaints FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all complaints" ON public.complaints FOR SELECT USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
CREATE POLICY "Admins can update any complaint" ON public.complaints FOR UPDATE USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- 6. Automatic Profile Creation Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username', 'citizen');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Storage (Manual Step)
-- Create a bucket named 'complaints' and set to Public.
