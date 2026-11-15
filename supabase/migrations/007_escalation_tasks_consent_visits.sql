-- ============================================================================
-- AARVI Migration 007: Modules 17–20 (Additive, Non-Destructive)
-- Preserves all existing tables & migrations 001–006.
-- ============================================================================

-- 1. Granular Patient Consent & Privacy Control Center (Module 19)
-- Created first so RLS policies for Escalation, Tasks, and Visits can enforce active consent.
CREATE TABLE IF NOT EXISTS public.patient_consent_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  member_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  member_email TEXT NOT NULL,
  member_name TEXT NOT NULL,
  member_role TEXT NOT NULL CHECK (member_role IN ('family_member', 'caregiver')),
  relationship TEXT NOT NULL DEFAULT '',
  is_legal_representative BOOLEAN NOT NULL DEFAULT FALSE,
  access_status TEXT NOT NULL DEFAULT 'active' CHECK (access_status IN ('active', 'temporary', 'expired', 'revoked')),
  permissions JSONB NOT NULL DEFAULT '{"medications":false,"appointments":false,"medical_documents":false,"care_notes":false,"wellbeing":false,"activity_history":false}'::jsonb,
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_consent_patient_member_email
  ON public.patient_consent_grants (patient_id, lower(member_email));
CREATE INDEX IF NOT EXISTS idx_consent_patient_status
  ON public.patient_consent_grants (patient_id, access_status, expires_at);

CREATE TABLE IF NOT EXISTS public.patient_consent_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  grant_id UUID NOT NULL REFERENCES public.patient_consent_grants(id) ON DELETE CASCADE,
  actor_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('elderly_patient', 'family_member', 'caregiver')),
  action TEXT NOT NULL CHECK (action IN ('granted', 'updated', 'revoked', 'expired')),
  previous_permissions JSONB,
  next_permissions JSONB NOT NULL,
  expires_at TIMESTAMPTZ,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_history_patient_created
  ON public.patient_consent_history (patient_id, created_at DESC);

-- Helper: checks if the current authenticated user is the patient, a legal representative, or holds active domain consent
CREATE OR REPLACE FUNCTION public.aarvi_has_patient_consent(p_patient_id UUID, p_domain TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients pt
    WHERE pt.id = p_patient_id
      AND pt.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.patient_consent_grants g
    WHERE g.patient_id = p_patient_id
      AND g.member_profile_id = auth.uid()
      AND g.access_status IN ('active', 'temporary')
      AND (g.expires_at IS NULL OR g.expires_at > now())
      AND COALESCE((g.permissions ->> p_domain)::boolean, false) = true
  );
$$;

CREATE OR REPLACE FUNCTION public.aarvi_can_manage_consent(p_patient_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.patients pt
    WHERE pt.id = p_patient_id
      AND pt.user_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.patient_consent_grants g
    WHERE g.patient_id = p_patient_id
      AND g.member_profile_id = auth.uid()
      AND g.member_role = 'family_member'
      AND g.is_legal_representative = true
      AND g.access_status IN ('active', 'temporary')
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

ALTER TABLE public.patient_consent_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_consent_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS consent_grants_select ON public.patient_consent_grants;
CREATE POLICY consent_grants_select ON public.patient_consent_grants
  FOR SELECT USING (
    public.aarvi_can_manage_consent(patient_id)
    OR member_profile_id = auth.uid()
  );

DROP POLICY IF EXISTS consent_grants_write ON public.patient_consent_grants;
CREATE POLICY consent_grants_write ON public.patient_consent_grants
  FOR ALL USING (public.aarvi_can_manage_consent(patient_id))
  WITH CHECK (
    public.aarvi_can_manage_consent(patient_id)
    AND NOT (member_role = 'caregiver' AND member_profile_id = auth.uid())
  );

DROP POLICY IF EXISTS consent_history_select ON public.patient_consent_history;
CREATE POLICY consent_history_select ON public.patient_consent_history
  FOR SELECT USING (
    public.aarvi_can_manage_consent(patient_id)
    OR public.aarvi_has_patient_consent(patient_id, 'activity_history')
  );

DROP POLICY IF EXISTS consent_history_insert ON public.patient_consent_history;
CREATE POLICY consent_history_insert ON public.patient_consent_history
  FOR INSERT WITH CHECK (public.aarvi_can_manage_consent(patient_id));

-- 2. Intelligent Care Escalation System (Module 17)
CREATE TABLE IF NOT EXISTS public.escalation_configs (
  patient_id UUID PRIMARY KEY REFERENCES public.patients(id) ON DELETE CASCADE,
  grace_period_minutes INTEGER NOT NULL DEFAULT 30 CHECK (grace_period_minutes BETWEEN 5 AND 240),
  stage1_to_stage2_minutes INTEGER NOT NULL DEFAULT 20 CHECK (stage1_to_stage2_minutes BETWEEN 5 AND 240),
  stage2_to_stage3_minutes INTEGER NOT NULL DEFAULT 30 CHECK (stage2_to_stage3_minutes BETWEEN 5 AND 240),
  escalation_order JSONB NOT NULL DEFAULT '["patient","caregiver","family"]'::jsonb,
  assigned_caregiver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  authorized_family_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  channel_preferences JSONB NOT NULL DEFAULT '{"inApp":true,"email":false,"push":false}'::jsonb,
  quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_start_hour INTEGER NOT NULL DEFAULT 22 CHECK (quiet_start_hour BETWEEN 0 AND 23),
  quiet_end_hour INTEGER NOT NULL DEFAULT 7 CHECK (quiet_end_hour BETWEEN 0 AND 23),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.escalation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  dose_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  stage SMALLINT NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 4),
  status TEXT NOT NULL DEFAULT 'stage_1_patient_reminder'
    CHECK (status IN ('stage_1_patient_reminder', 'stage_2_caregiver_alert', 'stage_3_family_alert', 'resolved')),
  dose_confirmation_status TEXT NOT NULL DEFAULT 'unconfirmed'
    CHECK (dose_confirmation_status IN ('pending', 'unconfirmed', 'taken', 'late_confirmed', 'skipped', 'missed')),
  idempotency_key TEXT NOT NULL UNIQUE,
  acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_method TEXT,
  timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_escalation_events_patient_status
  ON public.escalation_events (patient_id, status, dose_date DESC);

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('escalation', 'task', 'visit', 'consent')),
  source_id TEXT NOT NULL,
  recipient_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed', 'acknowledged', 'provider_unconfigured')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_detail TEXT,
  acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_patient_status
  ON public.notification_deliveries (patient_id, status, created_at DESC);

ALTER TABLE public.escalation_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escalation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escalation_configs_select ON public.escalation_configs;
CREATE POLICY escalation_configs_select ON public.escalation_configs
  FOR SELECT USING (public.aarvi_has_patient_consent(patient_id, 'medications'));

DROP POLICY IF EXISTS escalation_configs_write ON public.escalation_configs;
CREATE POLICY escalation_configs_write ON public.escalation_configs
  FOR ALL USING (public.aarvi_can_manage_consent(patient_id))
  WITH CHECK (public.aarvi_can_manage_consent(patient_id));

DROP POLICY IF EXISTS escalation_events_select ON public.escalation_events;
CREATE POLICY escalation_events_select ON public.escalation_events
  FOR SELECT USING (public.aarvi_has_patient_consent(patient_id, 'medications'));

DROP POLICY IF EXISTS escalation_events_write ON public.escalation_events;
CREATE POLICY escalation_events_write ON public.escalation_events
  FOR ALL USING (public.aarvi_has_patient_consent(patient_id, 'medications'))
  WITH CHECK (public.aarvi_has_patient_consent(patient_id, 'medications'));

DROP POLICY IF EXISTS notification_deliveries_select ON public.notification_deliveries;
CREATE POLICY notification_deliveries_select ON public.notification_deliveries
  FOR SELECT USING (
    recipient_profile_id = auth.uid()
    OR public.aarvi_can_manage_consent(patient_id)
  );

-- 3. Family Care Task Manager (Module 18)
CREATE TABLE IF NOT EXISTS public.care_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('refill', 'transport', 'appointment_companion', 'supplies', 'handover', 'wellbeing', 'medical_reports')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'acknowledged', 'in_progress', 'completed', 'overdue', 'cancelled')),
  assigned_to_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to_name TEXT NOT NULL,
  assigned_to_role TEXT NOT NULL,
  created_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_name TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completed_by_name TEXT,
  internal_notes TEXT,
  patient_visible_summary TEXT,
  assignment_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_care_tasks_patient_status_due
  ON public.care_tasks (patient_id, status, due_at);

ALTER TABLE public.care_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_tasks_select ON public.care_tasks;
CREATE POLICY care_tasks_select ON public.care_tasks
  FOR SELECT USING (public.aarvi_has_patient_consent(patient_id, 'care_notes'));

DROP POLICY IF EXISTS care_tasks_insert ON public.care_tasks;
CREATE POLICY care_tasks_insert ON public.care_tasks
  FOR INSERT WITH CHECK (public.aarvi_has_patient_consent(patient_id, 'care_notes'));

DROP POLICY IF EXISTS care_tasks_update ON public.care_tasks;
CREATE POLICY care_tasks_update ON public.care_tasks
  FOR UPDATE USING (
    public.aarvi_can_manage_consent(patient_id)
    OR (
      assigned_to_profile_id = auth.uid()
      AND public.aarvi_has_patient_consent(patient_id, 'care_notes')
    )
  );

-- 4. Caregiver Visit Check-in & Verification (Module 20)
CREATE TABLE IF NOT EXISTS public.caregiver_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  caregiver_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  caregiver_name TEXT NOT NULL,
  scheduled_by_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled', 'incomplete', 'missed')),
  verification_pin_hash TEXT,
  verification_pin_salt TEXT,
  verification_qr_hash TEXT,
  verification_expires_at TIMESTAMPTZ,
  verification_attempts INTEGER NOT NULL DEFAULT 0,
  max_verification_attempts INTEGER NOT NULL DEFAULT 5,
  check_in_at TIMESTAMPTZ,
  check_in_method TEXT CHECK (check_in_method IN ('pin', 'qr')),
  check_out_at TIMESTAMPTZ,
  activities JSONB NOT NULL DEFAULT '[]'::jsonb,
  observations TEXT NOT NULL DEFAULT '',
  handover_id UUID REFERENCES public.care_handovers(id) ON DELETE SET NULL,
  cancel_or_incomplete_reason TEXT,
  location_consent_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  location_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_caregiver_visits_patient_start
  ON public.caregiver_visits (patient_id, scheduled_start DESC);

ALTER TABLE public.caregiver_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS caregiver_visits_select ON public.caregiver_visits;
CREATE POLICY caregiver_visits_select ON public.caregiver_visits
  FOR SELECT USING (
    public.aarvi_can_manage_consent(patient_id)
    OR (
      caregiver_profile_id = auth.uid()
      AND public.aarvi_has_patient_consent(patient_id, 'care_notes')
    )
    OR public.aarvi_has_patient_consent(patient_id, 'appointments')
  );

DROP POLICY IF EXISTS caregiver_visits_insert ON public.caregiver_visits;
CREATE POLICY caregiver_visits_insert ON public.caregiver_visits
  FOR INSERT WITH CHECK (public.aarvi_can_manage_consent(patient_id));

DROP POLICY IF EXISTS caregiver_visits_update ON public.caregiver_visits;
CREATE POLICY caregiver_visits_update ON public.caregiver_visits
  FOR UPDATE USING (
    public.aarvi_can_manage_consent(patient_id)
    OR (
      caregiver_profile_id = auth.uid()
      AND public.aarvi_has_patient_consent(patient_id, 'care_notes')
    )
  );
