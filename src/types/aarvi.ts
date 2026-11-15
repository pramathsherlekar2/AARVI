export type UserRole = 'elderly_patient' | 'family_member' | 'caregiver';

export type TextScale = 'standard' | 'large' | 'xlarge';

export type AppRoute =
  | 'dashboard'
  | 'patient_profile'
  | 'family_care_team'
  | 'medications'
  | 'escalation'
  | 'tasks'
  | 'visits'
  | 'privacy_consent'
  | 'appointments'
  | 'handovers'
  | 'daily_companion'
  | 'refill_tracker'
  | 'ai_assistant'
  | 'notifications'
  | 'offline_sync'
  | 'modules'
  | 'settings';

export type ModuleDomain =
  | 'Identity & Access'
  | 'Daily Care & Clinical'
  | 'Family & Operations'
  | 'Reliability & Governance';

export type ModuleImplementationState = 'active_synced' | 'active_local_queue' | 'configured_required';

export interface AarviModuleDefinition {
  id: number;
  slug: string;
  titleKey: string;
  summaryKey: string;
  domain: ModuleDomain;
  implementationState: ModuleImplementationState;
  backendRequirement: string;
  routeTarget: AppRoute;
}

export interface AccessibilityPreferences {
  textScale: TextScale;
  highContrast: boolean;
  simplifiedPatientView: boolean;
  reminderTone: 'gentle' | 'persistent';
  quietHoursEnabled: boolean;
  emailAlertsEnabled: boolean;
}

export interface AuthSession {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  relationshipOrTitle: string;
  onboardingCompleted: boolean;
  signedInAt: string;
  sessionOrigin: 'supabase_auth' | 'preview_workspace';
  accessToken?: string;
}

export interface CareCircleContact {
  id: string;
  name: string;
  roleLabel: string;
  relation: string;
  phone: string;
  email?: string;
  availability: string;
  isPrimary: boolean;
  permissions?: {
    canEditMedications: boolean;
    canEditAppointments: boolean;
    canWriteHandovers: boolean;
    canManageTeam: boolean;
  };
}

export interface PatientProfile {
  id: string;
  fullName: string;
  preferredName: string;
  age: number;
  bloodGroup: string;
  primaryLanguage: string;
  residenceSummary: string;
  primaryPhysician: string;
  clinicName: string;
  allergies: string[];
  dietaryGuidance: string;
  mobilityNotes: string;
  comfortPreferences: string;
  careCircle: CareCircleContact[];
}

export type TimeSlot = 'Morning' | 'Afternoon' | 'Evening' | 'Night';
export type DoseStatus = 'pending' | 'unconfirmed' | 'taken' | 'late_confirmed' | 'skipped' | 'missed';

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  timeSlot: TimeSlot;
  scheduledTime: string;
  scheduledMinutes24h: number;
  gracePeriodMinutes: number;
  instructions: string;
  purpose: string;
  remainingUnits: number;
  unitsPerDose: number;
  dosesPerDay: number;
  refillThresholdDays: number;
  refillDaysRemaining: number;
  status: DoseStatus;
  loggedAt?: string;
  loggedBy?: string;
  isLateConfirmation?: boolean;
  skipReason?: string;
}

export interface RefillHistoryEntry {
  id: string;
  medicationId: string;
  medicationName: string;
  unitsAdded: number;
  recordedBy: string;
  recordedAtLabel: string;
  pharmacyNote: string;
}

export type AppointmentStatus = 'upcoming' | 'completed' | 'reschedule_requested' | 'cancelled';

export interface AppointmentItem {
  id: string;
  title: string;
  clinician: string;
  specialty: string;
  facility: string;
  dateLabel: string;
  timeLabel: string;
  companionAssigned: string;
  status: AppointmentStatus;
  prepQuestions: string[];
  notes: string;
}

export interface HandoverChecklist {
  mood: 'calm' | 'quiet' | 'anxious' | 'irritable';
  appetite: 'ate_well' | 'light_intake' | 'low_appetite';
  hydration: 'on_track' | 'needs_prompting';
  sleepQuality: 'restful' | 'interrupted';
  mobility: 'steady' | 'extra_assistance';
}

export interface CareHandoverEntry {
  id: string;
  shiftLabel: string;
  authorName: string;
  authorRole: UserRole;
  createdAtLabel: string;
  summary: string;
  checklist: HandoverChecklist;
  pendingFollowUps: string[];
  acknowledgedBy?: string;
  acknowledgedAtLabel?: string;
}

export interface DailyCheckInEntry {
  id: string;
  timeLabel: string;
  authorName: string;
  mood: HandoverChecklist['mood'];
  activityNote: string;
  mealNote: string;
  sleepHours: string;
  hydrationCount: number;
}

export type NotificationCategory =
  | 'medication'
  | 'missed_dose'
  | 'escalation'
  | 'task'
  | 'visit'
  | 'consent'
  | 'appointment'
  | 'refill'
  | 'handover';

export interface CareNotificationItem {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  timeLabel: string;
  read: boolean;
  emailStatus: 'not_sent' | 'sent' | 'provider_unconfigured' | 'failed';
  emailDetail?: string;
  idempotencyKey?: string;
  deliveryState?: 'queued' | 'sent' | 'failed' | 'acknowledged' | 'provider_unconfigured';
  retryCount?: number;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AuditLogEntry {
  id: string;
  timestampLabel: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  detail: string;
}

export interface SyncQueueItem {
  id: string;
  operationId: string;
  ownerKey: string;
  actionType:
    | 'DOSE_STATUS_UPDATE'
    | 'MEDICATION_ADDED'
    | 'REFILL_LOGGED'
    | 'HANDOVER_CREATED'
    | 'HANDOVER_ACKNOWLEDGED'
    | 'APPOINTMENT_UPDATED'
    | 'PROFILE_UPDATED'
    | 'COMPANION_LOGGED'
    | 'PREFERENCES_UPDATED'
    | 'TEAM_UPDATED'
    | 'ESCALATION_CONFIG_UPDATED'
    | 'ESCALATION_ACKNOWLEDGED'
    | 'ESCALATION_RESOLVED'
    | 'TASK_CREATED'
    | 'TASK_UPDATED'
    | 'TASK_COMPLETED'
    | 'CONSENT_UPDATED'
    | 'VISIT_SCHEDULED'
    | 'VISIT_UPDATED';
  description: string;
  timestampLabel: string;
  syncStatus: 'pending' | 'synced' | 'conflict';
  retryCount: number;
  conflictDetail?: string;
  payload?: Record<string, unknown>;
}

export interface PreviewModuleState {
  hydrationGlasses: number;
  hydrationTarget: number;
  lastMealNote: string;
  dailyCheckIns: DailyCheckInEntry[];
  careCircleNotes: Array<{
    id: string;
    author: string;
    role: string;
    time: string;
    message: string;
  }>;
  errands: Array<{
    id: string;
    title: string;
    assignee: string;
    due: string;
    done: boolean;
  }>;
  consentToggles: {
    shareMedicationLogsWithFamily: boolean;
    shareShiftNotesWithFamily: boolean;
    allowCaregiverAppointmentEdits: boolean;
  };
}

export interface SystemCapabilities {
  supabaseConfigured: boolean;
  geminiConfigured: boolean;
  emailProviderConfigured: boolean;
  emailProvider: 'resend' | 'none';
}

/* ============================================================================
 * MODULE 17: INTELLIGENT CARE ESCALATION SYSTEM
 * ========================================================================== */

export type EscalationStage = 1 | 2 | 3 | 4;
export type EscalationEventStatus =
  | 'stage_1_patient_reminder'
  | 'stage_2_caregiver_alert'
  | 'stage_3_family_alert'
  | 'resolved';

export type EscalationResolutionMethod =
  | 'patient_confirmed_taken'
  | 'patient_reported_skipped'
  | 'caregiver_confirmed_taken'
  | 'caregiver_marked_missed'
  | 'family_acknowledged_resolved'
  | 'cancelled';

export interface EscalationConfig {
  patientId: string;
  gracePeriodMinutes: number;
  stage1ToStage2Minutes: number;
  stage2ToStage3Minutes: number;
  escalationOrder: Array<'patient' | 'caregiver' | 'family'>;
  assignedCaregiverId: string;
  assignedCaregiverName: string;
  authorizedFamilyIds: string[];
  channels: {
    inApp: boolean;
    email: boolean;
    push: boolean;
  };
  quietHoursEnabled: boolean;
  quietStartHour24: number;
  quietEndHour24: number;
  updatedAt: string;
  updatedBy: string;
}

export interface EscalationTimelineStep {
  id: string;
  stage: EscalationStage;
  actorName: string;
  actorRole?: UserRole | 'system';
  action: string;
  timestampIso: string;
  timestampLabel: string;
  note?: string;
}

export interface EscalationEvent {
  id: string;
  patientId: string;
  patientName: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string;
  scheduledMinutes24h: number;
  doseDate: string;
  stage: EscalationStage;
  status: EscalationEventStatus;
  doseConfirmationStatus: DoseStatus;
  idempotencyKeys: string[];
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionMethod?: EscalationResolutionMethod;
  createdAt: string;
  updatedAt: string;
  timeline: EscalationTimelineStep[];
}

export interface NotificationDeliveryRecord {
  id: string;
  idempotencyKey: string;
  patientId: string;
  sourceType: 'escalation' | 'task' | 'visit' | 'consent';
  sourceId: string;
  recipientId: string;
  recipientName: string;
  recipientEmail?: string;
  channel: 'in_app' | 'email' | 'push';
  status: 'queued' | 'sent' | 'failed' | 'acknowledged' | 'provider_unconfigured';
  retryCount: number;
  title: string;
  body: string;
  errorDetail?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/* ============================================================================
 * MODULE 18: FAMILY CARE TASK MANAGER
 * ========================================================================== */

export type CareTaskStatus =
  | 'todo'
  | 'acknowledged'
  | 'in_progress'
  | 'completed'
  | 'overdue'
  | 'cancelled';

export type CareTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type CareTaskCategory =
  | 'refill'
  | 'transport'
  | 'appointment_companion'
  | 'supplies'
  | 'handover'
  | 'wellbeing'
  | 'medical_reports';

export interface CareTaskAssignmentEvent {
  id: string;
  fromAssigneeName?: string;
  toAssigneeId: string;
  toAssigneeName: string;
  toAssigneeRole: UserRole | 'primaryPhysician';
  assignedByName: string;
  timestampIso: string;
  note?: string;
}

export interface CareTaskItem {
  id: string;
  operationId: string;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  category: CareTaskCategory;
  priority: CareTaskPriority;
  status: CareTaskStatus;
  assignedToId: string;
  assignedToName: string;
  assignedToRole: UserRole | 'primaryPhysician';
  createdById: string;
  createdByName: string;
  createdByRole: UserRole;
  dueAtIso: string;
  createdAtIso: string;
  updatedAtIso: string;
  acknowledgedAtIso?: string;
  completedAtIso?: string;
  completedByName?: string;
  internalNotes?: string;
  patientVisibleSummary?: string;
  syncState?: 'synced' | 'queued_offline' | 'conflict';
  assignmentHistory: CareTaskAssignmentEvent[];
}

/* ============================================================================
 * MODULE 19: PATIENT CONSENT & PRIVACY CONTROL CENTER
 * ========================================================================== */

export type ConsentDomain =
  | 'medications'
  | 'appointments'
  | 'medical_documents'
  | 'care_notes'
  | 'wellbeing'
  | 'activity_history';

export type ConsentAccessStatus = 'active' | 'temporary' | 'expired' | 'revoked';

export type ConsentDomainPermissions = Record<ConsentDomain, boolean>;

export interface ConsentGrant {
  id: string;
  patientId: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  memberRole: UserRole;
  relationship: string;
  isLegalRepresentative?: boolean;
  accessStatus: ConsentAccessStatus;
  permissions: ConsentDomainPermissions;
  expiresAtIso?: string | null;
  grantedById: string;
  grantedByName: string;
  updatedAtIso: string;
  reason?: string;
}

export interface ConsentHistoryEntry {
  id: string;
  patientId: string;
  grantId: string;
  memberId: string;
  memberName: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: 'granted' | 'updated' | 'revoked' | 'expired';
  previousPermissions?: ConsentDomainPermissions;
  nextPermissions: ConsentDomainPermissions;
  expiresAtIso?: string | null;
  reason: string;
  timestampIso: string;
}

/* ============================================================================
 * MODULE 20: CAREGIVER VISIT CHECK-IN & VERIFICATION
 * ========================================================================== */

export type CaregiverVisitStatus =
  | 'scheduled'
  | 'ongoing'
  | 'completed'
  | 'cancelled'
  | 'incomplete'
  | 'missed';

export interface VisitActivityEntry {
  id: string;
  recordedAtIso: string;
  recordedByName: string;
  activityType: 'medication' | 'meal' | 'hydration' | 'mobility' | 'observation' | 'other';
  note: string;
}

export interface CaregiverVisit {
  id: string;
  operationId: string;
  patientId: string;
  patientName: string;
  title: string;
  caregiverId: string;
  caregiverName: string;
  scheduledById: string;
  scheduledByName: string;
  scheduledStartIso: string;
  scheduledEndIso: string;
  status: CaregiverVisitStatus;
  hasActiveVerificationCode: boolean;
  verificationExpiresAtIso?: string;
  verificationAttempts: number;
  maxVerificationAttempts: number;
  verificationLocked: boolean;
  checkInAtIso?: string;
  checkInMethod?: 'pin' | 'qr';
  checkOutAtIso?: string;
  activities: VisitActivityEntry[];
  observations: string;
  handoverNote?: string;
  cancelOrIncompleteReason?: string;
  locationConsentOptIn: boolean;
  locationNote?: string;
  createdAtIso: string;
  updatedAtIso: string;
}
