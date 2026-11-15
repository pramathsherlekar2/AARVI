export type UserRole = 'elderly_patient' | 'family_member' | 'caregiver';

export type TextScale = 'standard' | 'large' | 'xlarge';

export type AppRoute =
  | 'dashboard'
  | 'patient_profile'
  | 'medications'
  | 'appointments'
  | 'handovers'
  | 'offline_sync'
  | 'modules';

export type ModuleDomain =
  | 'Identity & Access'
  | 'Daily Care & Clinical'
  | 'Family & Operations'
  | 'Reliability & Governance';

export type ModuleImplementationState = 'phase2_ui_active' | 'phase2_ui_preview';

export interface AarviModuleDefinition {
  id: number;
  slug: string;
  title: string;
  domain: ModuleDomain;
  summary: string;
  implementationState: ModuleImplementationState;
  backendRequirement: string;
  routeTarget: AppRoute;
  previewNotes?: string;
}

export interface AccessibilityPreferences {
  textScale: TextScale;
  highContrast: boolean;
  simplifiedPatientView: boolean;
  reminderTone: 'gentle' | 'persistent';
}

export interface AuthSession {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  relationshipOrTitle: string;
  onboardingCompleted: boolean;
  signedInAt: string;
  sessionOrigin: 'local_phase2_ui';
}

export interface CareCircleContact {
  id: string;
  name: string;
  roleLabel: string;
  relation: string;
  phone: string;
  availability: string;
  isPrimary: boolean;
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
export type DoseStatus = 'pending' | 'taken' | 'skipped';

export interface MedicationItem {
  id: string;
  name: string;
  dosage: string;
  timeSlot: TimeSlot;
  scheduledTime: string;
  instructions: string;
  purpose: string;
  refillDaysRemaining: number;
  status: DoseStatus;
  loggedAt?: string;
  loggedBy?: string;
  skipReason?: string;
}

export type AppointmentStatus = 'upcoming' | 'completed' | 'reschedule_requested';

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
  mood: 'Calm & cheerful' | 'Quiet / tired' | 'Anxious' | 'Irritable';
  appetite: 'Ate well' | 'Light intake' | 'Low appetite';
  hydration: 'On track' | 'Needs gentle prompting';
  sleepQuality: 'Restful' | 'Interrupted';
  mobility: 'Steady with support' | 'Needed extra assistance';
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

export interface SyncQueueItem {
  id: string;
  actionType:
    | 'DOSE_STATUS_UPDATE'
    | 'HANDOVER_CREATED'
    | 'HANDOVER_ACKNOWLEDGED'
    | 'APPOINTMENT_UPDATED'
    | 'PROFILE_UPDATED'
    | 'PREFERENCES_UPDATED';
  description: string;
  timestampLabel: string;
  syncStatus: 'pending_local_queue' | 'flushed_in_ui_state';
}

export interface PreviewModuleState {
  hydrationGlasses: number;
  hydrationTarget: number;
  lastMealNote: string;
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
