-- ====================================================================
-- CivicPulse AI: Complete Supabase PostgreSQL Schema & Migration Script
-- Run this script in your Supabase Dashboard:
-- https://supabase.com/dashboard/project/wpqybcukijxmfpzzdykt/sql
-- ====================================================================

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================================================================
-- 2. User Profiles Table (Synced automatically with Supabase Auth)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'civilian' CHECK (role IN ('civilian', 'admin', 'crew')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR auth.role() = 'service_role' OR auth.role() = 'anon');

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR auth.role() = 'service_role');

-- Trigger to automatically mirror new Supabase Auth users to public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role)
  VALUES (
    new.id,
    COALESCE(new.email, 'unknown@civicpulse.org'),
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(COALESCE(new.email, 'citizen'), '@', 1)
    ),
    COALESCE(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      NULL
    ),
    COALESCE(new.raw_user_meta_data->>'role', 'civilian')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = CASE WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name != '' THEN EXCLUDED.name ELSE profiles.name END,
      avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
      role = CASE WHEN EXCLUDED.role IS NOT NULL THEN EXCLUDED.role ELSE profiles.role END;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 3. Incidents Table (Aggregated civic issues across the city)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.incidents (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  category TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
  priority_score INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'Reported',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  assigned_worker TEXT,
  assigned_crew_id TEXT,
  assigned_at TIMESTAMPTZ,
  dispatch_notes TEXT,
  resolution_evidence_url TEXT,
  resolution_notes TEXT,
  resolution_submitted_at TIMESTAMPTZ,
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  rejected_by TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_coords ON public.incidents(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON public.incidents(category);

-- Enable RLS on incidents
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Incidents are viewable by all" ON public.incidents;
CREATE POLICY "Incidents are viewable by all"
  ON public.incidents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Incidents can be created by authenticated or anon" ON public.incidents;
CREATE POLICY "Incidents can be created by authenticated or anon"
  ON public.incidents FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Incidents can be updated by authenticated or anon" ON public.incidents;
CREATE POLICY "Incidents can be updated by authenticated or anon"
  ON public.incidents FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Incidents can be deleted by authenticated or service" ON public.incidents;
CREATE POLICY "Incidents can be deleted by authenticated or service"
  ON public.incidents FOR DELETE
  USING (true);

-- ====================================================================
-- 4. Reports Table (Individual citizen submissions)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  citizen_id TEXT NOT NULL,
  incident_id TEXT REFERENCES public.incidents(id) ON DELETE SET NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  ai_problem TEXT,
  ai_category TEXT,
  ai_severity TEXT,
  ai_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_incident ON public.reports(incident_id);
CREATE INDEX IF NOT EXISTS idx_reports_citizen ON public.reports(citizen_id);

-- Enable RLS on reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Reports are viewable by everyone" ON public.reports;
CREATE POLICY "Reports are viewable by everyone"
  ON public.reports FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Reports can be inserted by anyone" ON public.reports;
CREATE POLICY "Reports can be inserted by anyone"
  ON public.reports FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Reports can be updated by anyone" ON public.reports;
CREATE POLICY "Reports can be updated by anyone"
  ON public.reports FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Reports can be deleted by anyone" ON public.reports;
CREATE POLICY "Reports can be deleted by anyone"
  ON public.reports FOR DELETE
  USING (true);

-- ====================================================================
-- 5. Incident Status History Table (Audit Trail)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.incident_status_history (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  incident_id TEXT NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_history_incident ON public.incident_status_history(incident_id);

-- Enable RLS on status history
ALTER TABLE public.incident_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Status history is viewable by all" ON public.incident_status_history;
CREATE POLICY "Status history is viewable by all"
  ON public.incident_status_history FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Status history can be inserted by all" ON public.incident_status_history;
CREATE POLICY "Status history can be inserted by all"
  ON public.incident_status_history FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Status history can be deleted by all" ON public.incident_status_history;
CREATE POLICY "Status history can be deleted by all"
  ON public.incident_status_history FOR DELETE
  USING (true);

-- ====================================================================
-- 6. Supabase Storage Bucket ('civicpusleai')
-- ====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('civicpusleai', 'civicpusleai', true),
  ('civicpulse-uploads', 'civicpulse-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for civicpusleai and civicpulse-uploads
DROP POLICY IF EXISTS "Public Access to civicpulse-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Public Access to civicpulse storage" ON storage.objects;
CREATE POLICY "Public Access to civicpulse storage"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('civicpusleai', 'civicpulse-uploads'));

DROP POLICY IF EXISTS "Allow Uploads to civicpulse-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads to civicpulse storage" ON storage.objects;
CREATE POLICY "Allow Uploads to civicpulse storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('civicpusleai', 'civicpulse-uploads'));

DROP POLICY IF EXISTS "Allow Updates to civicpulse-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Updates to civicpulse storage" ON storage.objects;
CREATE POLICY "Allow Updates to civicpulse storage"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('civicpusleai', 'civicpulse-uploads'));

DROP POLICY IF EXISTS "Allow Deletes in civicpulse-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes in civicpulse storage" ON storage.objects;
CREATE POLICY "Allow Deletes in civicpulse storage"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('civicpusleai', 'civicpulse-uploads'));

-- ====================================================================
-- Schema Setup Complete!
-- ====================================================================
