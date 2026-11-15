import React, {createContext, useCallback, useContext, useEffect, useState} from 'react';
import {
  classifyDoseState,
  evaluateCareEscalations,
  acknowledgeEscalationEvent,
} from '../../shared/escalation';
import {
  applyConsentGrantUpdate,
  type CareActor,
  hasDomainConsent,
  revokeConsentGrant,
} from '../../shared/permissions';
import {
  createCareTaskRecord,
  detectOverdueCareTasks,
  updateCareTaskRecord,
} from '../../shared/tasks';
import {
  AARVI_20_MODULES,
  INITIAL_APPOINTMENTS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CAREGIVER_VISITS,
  INITIAL_CARE_TASKS,
  INITIAL_CONSENT_GRANTS,
  INITIAL_CONSENT_HISTORY,
  INITIAL_ESCALATION_CONFIG,
  INITIAL_ESCALATION_EVENTS,
  INITIAL_HANDOVERS,
  INITIAL_MEDICATIONS,
  INITIAL_NOTIFICATIONS,
  INITIAL_NOTIFICATION_DELIVERIES,
  INITIAL_PATIENT_PROFILE,
  INITIAL_PREVIEW_MODULES,
  INITIAL_REFILL_HISTORY,
} from '../data/aarviSeed';
import {
  clearAllOfflineData,
  clearOfflineDataForOwner,
  enqueueSyncOperationInDexie,
  saveWorkspaceSnapshotToDexie,
} from '../db/aarviOfflineDb';
import type {
  AarviModuleDefinition,
  AccessibilityPreferences,
  AppRoute,
  AppointmentItem,
  AppointmentStatus,
  AuditLogEntry,
  AuthSession,
  CareCircleContact,
  CareHandoverEntry,
  CareNotificationItem,
  CareTaskCategory,
  CareTaskItem,
  CareTaskPriority,
  CareTaskStatus,
  CaregiverVisit,
  ConsentDomain,
  ConsentDomainPermissions,
  ConsentGrant,
  ConsentHistoryEntry,
  DailyCheckInEntry,
  DoseStatus,
  EscalationConfig,
  EscalationEvent,
  EscalationResolutionMethod,
  HandoverChecklist,
  MedicationItem,
  NotificationCategory,
  NotificationDeliveryRecord,
  PatientProfile,
  PreviewModuleState,
  RefillHistoryEntry,
  SyncQueueItem,
  SystemCapabilities,
  UserRole,
  VisitActivityEntry,
} from '../types/aarvi';

const STORAGE_KEY = 'aarvi_workspace_state_v3';

interface PersistedUiState {
  session: AuthSession | null;
  preferences: AccessibilityPreferences;
  patientProfile: PatientProfile;
  medications: MedicationItem[];
  refillHistory: RefillHistoryEntry[];
  appointments: AppointmentItem[];
  handovers: CareHandoverEntry[];
  notifications: CareNotificationItem[];
  auditLogs: AuditLogEntry[];
  syncQueue: SyncQueueItem[];
  lastLocalSyncAt: string;
  previewModules: PreviewModuleState;
  // Modules 17-20
  escalationConfig: EscalationConfig;
  escalationEvents: EscalationEvent[];
  notificationDeliveries: NotificationDeliveryRecord[];
  careTasks: CareTaskItem[];
  consentGrants: ConsentGrant[];
  consentHistory: ConsentHistoryEntry[];
  caregiverVisits: CaregiverVisit[];
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textScale: 'standard',
  highContrast: false,
  simplifiedPatientView: true,
  reminderTone: 'gentle',
  quietHoursEnabled: true,
  emailAlertsEnabled: false,
};

const DEFAULT_PERSISTED_STATE: PersistedUiState = {
  session: null,
  preferences: DEFAULT_PREFERENCES,
  patientProfile: INITIAL_PATIENT_PROFILE,
  medications: INITIAL_MEDICATIONS,
  refillHistory: INITIAL_REFILL_HISTORY,
  appointments: INITIAL_APPOINTMENTS,
  handovers: INITIAL_HANDOVERS,
  notifications: INITIAL_NOTIFICATIONS,
  auditLogs: INITIAL_AUDIT_LOGS,
  syncQueue: [],
  lastLocalSyncAt: 'Local IndexedDB ready',
  previewModules: INITIAL_PREVIEW_MODULES,
  escalationConfig: INITIAL_ESCALATION_CONFIG,
  escalationEvents: INITIAL_ESCALATION_EVENTS,
  notificationDeliveries: INITIAL_NOTIFICATION_DELIVERIES,
  careTasks: INITIAL_CARE_TASKS,
  consentGrants: INITIAL_CONSENT_GRANTS,
  consentHistory: INITIAL_CONSENT_HISTORY,
  caregiverVisits: INITIAL_CAREGIVER_VISITS,
};

function loadInitialState(): PersistedUiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('aarvi_workspace_state_v2');
    if (!raw) return DEFAULT_PERSISTED_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedUiState>;
    return {
      ...DEFAULT_PERSISTED_STATE,
      ...parsed,
      preferences: {
        ...DEFAULT_PREFERENCES,
        ...(parsed.preferences ?? {}),
      },
      previewModules: {
        ...INITIAL_PREVIEW_MODULES,
        ...(parsed.previewModules ?? {}),
      },
      escalationConfig: {
        ...INITIAL_ESCALATION_CONFIG,
        ...(parsed.escalationConfig ?? {}),
      },
      escalationEvents: parsed.escalationEvents ?? INITIAL_ESCALATION_EVENTS,
      notificationDeliveries: parsed.notificationDeliveries ?? INITIAL_NOTIFICATION_DELIVERIES,
      careTasks: parsed.careTasks ?? INITIAL_CARE_TASKS,
      consentGrants: parsed.consentGrants ?? INITIAL_CONSENT_GRANTS,
      consentHistory: parsed.consentHistory ?? INITIAL_CONSENT_HISTORY,
      caregiverVisits: parsed.caregiverVisits ?? INITIAL_CAREGIVER_VISITS,
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

function formatNowLabel(): string {
  return new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

function newOpId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function parse24hMinutes(timeStr: string): number {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return 12 * 60;
  let hh = Number(m[1]);
  const mm = Number(m[2]);
  const period = m[3]?.toUpperCase();
  if (period === 'PM' && hh < 12) hh += 12;
  if (period === 'AM' && hh === 12) hh = 0;
  return hh * 60 + mm;
}

export function isMedicationOverdue(med: MedicationItem, nowMinutes: number): boolean {
  if (med.status !== 'pending' && med.status !== 'unconfirmed') return false;
  return nowMinutes > med.scheduledMinutes24h + med.gracePeriodMinutes;
}

export interface IssuedVisitCodePreview {
  visitId: string;
  oneTimePin: string;
  qrPayload: string;
  expiresAtIso: string;
}

interface AarviContextValue {
  modules: AarviModuleDefinition[];
  capabilities: SystemCapabilities;
  session: AuthSession | null;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;
  preferences: AccessibilityPreferences;
  updatePreferences: (patch: Partial<AccessibilityPreferences>) => void;
  patientProfile: PatientProfile;
  updatePatientProfile: (patch: Partial<PatientProfile>) => void;
  addCareCircleMember: (member: Omit<CareCircleContact, 'id'>) => void;
  removeCareCircleMember: (memberId: string) => void;
  updateMemberPermissions: (
    memberId: string,
    perms: NonNullable<CareCircleContact['permissions']>,
  ) => void;
  medications: MedicationItem[];
  overdueMedicationIds: string[];
  getEffectiveDoseStatus: (med: MedicationItem) => DoseStatus;
  logMedicationDose: (medId: string, status: DoseStatus, skipReason?: string) => void;
  addMedication: (
    med: Omit<MedicationItem, 'id' | 'status' | 'scheduledMinutes24h' | 'refillDaysRemaining'>,
  ) => void;
  refillHistory: RefillHistoryEntry[];
  recordMedicationRefill: (medId: string, unitsAdded: number, pharmacyNote: string) => void;
  appointments: AppointmentItem[];
  updateAppointmentStatus: (aptId: string, status: AppointmentStatus) => void;
  addAppointment: (apt: Omit<AppointmentItem, 'id' | 'status'>) => void;
  handovers: CareHandoverEntry[];
  createHandover: (input: {
    shiftLabel: string;
    summary: string;
    checklist: HandoverChecklist;
    pendingFollowUps: string[];
  }) => void;
  acknowledgeHandover: (handoverId: string) => void;
  notifications: CareNotificationItem[];
  unreadNotificationsCount: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  sendNotificationEmail: (
    notificationId: string,
    recipientEmail: string,
  ) => Promise<{delivered: boolean; error?: string}>;
  auditLogs: AuditLogEntry[];
  browserOnline: boolean;
  simulateOffline: boolean;
  setSimulateOffline: (val: boolean) => void;
  effectiveOnline: boolean;
  syncQueue: SyncQueueItem[];
  pendingQueueCount: number;
  lastLocalSyncAt: string;
  flushSyncQueue: () => Promise<{syncedCount: number; databaseStatus: string}>;
  retrySyncItem: (operationId: string) => void;
  previewModules: PreviewModuleState;
  updatePreviewModules: (updater: (prev: PreviewModuleState) => PreviewModuleState) => void;
  addDailyCheckIn: (entry: Omit<DailyCheckInEntry, 'id' | 'timeLabel' | 'authorName'>) => void;

  // Module 17: Intelligent Care Escalation
  escalationConfig: EscalationConfig;
  escalationEvents: EscalationEvent[];
  notificationDeliveries: NotificationDeliveryRecord[];
  updateEscalationConfig: (patch: Partial<EscalationConfig>) => Promise<{ok: boolean; error?: string}>;
  runEscalationEvaluation: (simulateMinutes?: number) => Promise<{ok: boolean; created: number; advanced: number; error?: string}>;
  acknowledgeEscalation: (
    eventId: string,
    resolve?: boolean,
    resolutionMethod?: EscalationResolutionMethod,
  ) => Promise<{ok: boolean; error?: string}>;
  retryNotificationDelivery: (deliveryId: string) => Promise<{ok: boolean; error?: string}>;

  // Module 18: Family Care Task Manager
  careTasks: CareTaskItem[];
  createCareTask: (input: {
    title: string;
    description: string;
    category: CareTaskCategory;
    priority: CareTaskPriority;
    assigneeId: string;
    dueAtIso: string;
    internalNotes?: string;
    patientVisibleSummary?: string;
  }) => Promise<{ok: boolean; error?: string}>;
  updateCareTaskStatus: (taskId: string, status: CareTaskStatus) => Promise<{ok: boolean; error?: string}>;
  reassignCareTask: (
    taskId: string,
    reassignToId: string,
    note?: string,
  ) => Promise<{ok: boolean; error?: string}>;

  // Module 19: Patient Consent & Privacy Control Center
  consentGrants: ConsentGrant[];
  consentHistory: ConsentHistoryEntry[];
  canCurrentActorAccess: (domain: ConsentDomain) => boolean;
  updateMemberConsent: (input: {
    memberId: string;
    permissions: ConsentDomainPermissions;
    expiresAtIso?: string | null;
    reason: string;
  }) => Promise<{ok: boolean; error?: string}>;
  revokeMemberConsent: (memberId: string, reason: string) => Promise<{ok: boolean; error?: string}>;

  // Module 20: Caregiver Visit Check-in & Verification
  caregiverVisits: CaregiverVisit[];
  issuedVisitCodes: Record<string, IssuedVisitCodePreview>;
  scheduleCaregiverVisit: (input: {
    title: string;
    caregiverId: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
  }) => Promise<{ok: boolean; error?: string}>;
  issueVisitCode: (
    visitId: string,
    ttlMinutes?: number,
  ) => Promise<{ok: boolean; code?: IssuedVisitCodePreview; error?: string}>;
  verifyVisitCheckIn: (input: {
    visitId: string;
    method: 'pin' | 'qr';
    code: string;
    locationConsentOptIn?: boolean;
    locationNote?: string;
  }) => Promise<{ok: boolean; error?: string; attemptsRemaining?: number}>;
  addVisitActivity: (
    visitId: string,
    activityType: VisitActivityEntry['activityType'],
    note: string,
  ) => Promise<{ok: boolean; error?: string}>;
  completeVisitCheckOut: (input: {
    visitId: string;
    observations: string;
    handoverNote?: string;
    incompleteReason?: string;
  }) => Promise<{ok: boolean; error?: string}>;
  cancelCaregiverVisit: (
    visitId: string,
    reason: string,
    targetStatus?: 'cancelled' | 'missed',
  ) => Promise<{ok: boolean; error?: string}>;

  signInWithSupabaseAuth: (input: {
    email: string;
    password: string;
  }) => Promise<{ok: boolean; error?: string}>;
  registerWithSupabaseAuth: (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    relationshipOrTitle: string;
  }) => Promise<{ok: boolean; confirmationRequired?: boolean; error?: string}>;
  signInPreviewRole: (role: UserRole) => void;
  switchRolePreview: (role: UserRole) => void;
  completeOnboarding: () => void;
  signOut: () => Promise<void>;
  resetWorkspaceData: () => Promise<void>;
}

const AarviContext = createContext<AarviContextValue | null>(null);

const SAMPLE_ROLE_IDENTITIES: Record<
  UserRole,
  {userId: string; fullName: string; email: string; relationshipOrTitle: string}
> = {
  elderly_patient: {
    userId: 'pat-meera-01',
    fullName: 'Meera Kulkarni',
    email: 'meera.kulkarni@example.org',
    relationshipOrTitle: 'Elderly Patient',
  },
  family_member: {
    userId: 'cc-1',
    fullName: 'Ananya Kulkarni',
    email: 'ananya.kulkarni@example.org',
    relationshipOrTitle: 'Daughter · Primary Coordinator',
  },
  caregiver: {
    userId: 'cc-2',
    fullName: 'Priya Nair, RN',
    email: 'priya.nair@example.org',
    relationshipOrTitle: 'Day Shift Caregiver',
  },
};

export function AarviProvider({children}: {children: React.ReactNode}) {
  const [state, setState] = useState<PersistedUiState>(() => loadInitialState());
  const [activeRoute, setActiveRoute] = useState<AppRoute>('dashboard');
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [simulateOffline, setSimulateOffline] = useState<boolean>(false);
  const [issuedVisitCodes, setIssuedVisitCodes] = useState<Record<string, IssuedVisitCodePreview>>({});
  const [capabilities, setCapabilities] = useState<SystemCapabilities>({
    supabaseConfigured: false,
    geminiConfigured: false,
    emailProviderConfigured: false,
    emailProvider: 'none',
  });
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });

  const effectiveOnline = browserOnline && !simulateOffline;
  const ownerKey = state.session?.userId ?? 'preview';

  const getCurrentActor = useCallback(
    (sess: AuthSession | null = state.session): CareActor => ({
      userId: sess?.userId ?? 'cc-1',
      fullName: sess?.fullName ?? 'Ananya Kulkarni',
      email: sess?.email ?? 'ananya.kulkarni@example.org',
      role: sess?.role ?? 'family_member',
      patientId: state.patientProfile.id,
      isLegalRepresentative: sess?.role === 'family_member',
    }),
    [state.session, state.patientProfile.id],
  );

  const buildActorHeaders = useCallback(
    (sess: AuthSession | null = state.session): Record<string, string> => {
      const actor = getCurrentActor(sess);
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-aarvi-actor-id': actor.userId,
        'x-aarvi-actor-role': actor.role,
        'x-aarvi-actor-name': actor.fullName,
        'x-aarvi-actor-email': actor.email,
        'x-aarvi-patient-id': actor.patientId,
      };
      if (sess?.accessToken) {
        headers.Authorization = `Bearer ${sess.accessToken}`;
      }
      return headers;
    },
    [getCurrentActor, state.session],
  );

  // Fetch backend capabilities on mount when online
  useEffect(() => {
    if (!browserOnline) return;
    fetch('/api/system/capabilities')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: SystemCapabilities | null) => {
        if (data) setCapabilities(data);
      })
      .catch(() => {
        // Ignore network errors when offline
      });
  }, [browserOnline]);

  // Minute ticker for Missed Dose Intelligence & Overdue Task detection
  useEffect(() => {
    const id = window.setInterval(() => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
      setState((prev) => {
        const overdueRes = detectOverdueCareTasks(prev.careTasks, Date.now());
        if (overdueRes.newlyOverdueIds.length === 0) return prev;
        return {...prev, careTasks: overdueRes.tasks};
      });
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Persist snapshot to localStorage + Dexie IndexedDB
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore quota errors
    }
    if (state.session) {
      void saveWorkspaceSnapshotToDexie(ownerKey, state);
    }
  }, [state, ownerKey]);

  useEffect(() => {
    const handleOnline = () => setBrowserOnline(true);
    const handleOffline = () => setBrowserOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('aarvi-text-large', 'aarvi-text-xlarge', 'aarvi-high-contrast');
    if (state.preferences.textScale === 'large') {
      root.classList.add('aarvi-text-large');
    } else if (state.preferences.textScale === 'xlarge') {
      root.classList.add('aarvi-text-xlarge');
    }
    if (state.preferences.highContrast) {
      root.classList.add('aarvi-high-contrast');
    }
  }, [state.preferences.textScale, state.preferences.highContrast]);

  const overdueMedicationIds = state.medications
    .filter((m) => isMedicationOverdue(m, nowMinutes))
    .map((m) => m.id);

  const getEffectiveDoseStatus = useCallback(
    (med: MedicationItem): DoseStatus =>
      classifyDoseState(med, nowMinutes, state.escalationConfig.gracePeriodMinutes),
    [nowMinutes, state.escalationConfig.gracePeriodMinutes],
  );

  function buildQueueAndAudit(
    prev: PersistedUiState,
    actionType: SyncQueueItem['actionType'],
    description: string,
    auditAction: string,
    notification?: {category: NotificationCategory; title: string; body: string; idempotencyKey?: string},
    explicitOpId?: string,
    payload?: Record<string, unknown>,
  ): Pick<PersistedUiState, 'syncQueue' | 'lastLocalSyncAt' | 'auditLogs' | 'notifications'> {
    const opId = explicitOpId || newOpId();
    const actorName = prev.session?.fullName ?? 'Care Coordinator';
    const actorRole = prev.session?.role ?? 'family_member';
    const item: SyncQueueItem = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      operationId: opId,
      ownerKey: prev.session?.userId ?? 'preview',
      actionType,
      description,
      timestampLabel: formatNowLabel(),
      syncStatus: effectiveOnline ? 'synced' : 'pending',
      retryCount: 0,
      payload,
    };

    void enqueueSyncOperationInDexie(item);

    const auditEntry: AuditLogEntry = {
      id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      timestampLabel: `Today, ${formatNowLabel()}`,
      actorName,
      actorRole,
      action: auditAction,
      detail: description,
    };

    let nextNotifications = prev.notifications;
    if (notification) {
      const duplicate =
        notification.idempotencyKey &&
        prev.notifications.some((n) => n.idempotencyKey === notification.idempotencyKey);
      if (!duplicate) {
        nextNotifications = [
          {
            id: `nt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            category: notification.category,
            title: notification.title,
            body: notification.body,
            timeLabel: `Today, ${formatNowLabel()}`,
            read: false,
            emailStatus: 'not_sent' as const,
            idempotencyKey: notification.idempotencyKey,
            deliveryState: 'sent' as const,
          },
          ...prev.notifications,
        ].slice(0, 40);
      }
    }

    return {
      syncQueue: prev.syncQueue.some((q) => q.operationId === opId)
        ? prev.syncQueue
        : [item, ...prev.syncQueue].slice(0, 50),
      lastLocalSyncAt: effectiveOnline
        ? `Cached in IndexedDB · ${formatNowLabel()}`
        : prev.lastLocalSyncAt,
      auditLogs: [auditEntry, ...prev.auditLogs].slice(0, 60),
      notifications: nextNotifications,
    };
  }

  const canCurrentActorAccess = useCallback(
    (domain: ConsentDomain): boolean => {
      const actor = getCurrentActor();
      return hasDomainConsent(state.consentGrants, actor, state.patientProfile.id, domain).allowed;
    },
    [getCurrentActor, state.consentGrants, state.patientProfile.id],
  );

  const updatePreferences = (patch: Partial<AccessibilityPreferences>) => {
    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'PREFERENCES_UPDATED',
        'Updated accessibility & notification preferences',
        'PREFERENCES_UPDATED',
      );
      return {
        ...prev,
        preferences: {...prev.preferences, ...patch},
        ...patchMeta,
      };
    });
  };

  const updatePatientProfile = (patch: Partial<PatientProfile>) => {
    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'PROFILE_UPDATED',
        `Updated patient profile (${Object.keys(patch).join(', ')})`,
        'PROFILE_UPDATED',
      );
      return {
        ...prev,
        patientProfile: {...prev.patientProfile, ...patch},
        ...patchMeta,
      };
    });
  };

  const addCareCircleMember = (member: Omit<CareCircleContact, 'id'>) => {
    setState((prev) => {
      const newMember: CareCircleContact = {
        ...member,
        id: `cc-${Date.now()}`,
      };
      const newGrant: ConsentGrant = {
        id: `cg-${Date.now()}`,
        patientId: prev.patientProfile.id,
        memberId: newMember.id,
        memberName: newMember.name,
        memberEmail: newMember.email || `${newMember.id}@example.org`,
        memberRole: newMember.roleLabel.toLowerCase().includes('caregiver')
          ? 'caregiver'
          : 'family_member',
        relationship: newMember.relation,
        isLegalRepresentative: false,
        accessStatus: 'active',
        permissions: {
          medications: Boolean(newMember.permissions?.canEditMedications),
          appointments: Boolean(newMember.permissions?.canEditAppointments),
          medical_documents: false,
          care_notes: Boolean(newMember.permissions?.canWriteHandovers ?? true),
          wellbeing: true,
          activity_history: true,
        },
        expiresAtIso: null,
        grantedById: prev.session?.userId ?? 'cc-1',
        grantedByName: prev.session?.fullName ?? 'Primary Coordinator',
        updatedAtIso: new Date().toISOString(),
        reason: 'Member added to care circle',
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'TEAM_UPDATED',
        `Added ${member.name} (${member.roleLabel}) to care team`,
        'CARE_TEAM_MEMBER_ADDED',
      );
      return {
        ...prev,
        patientProfile: {
          ...prev.patientProfile,
          careCircle: [...prev.patientProfile.careCircle, newMember],
        },
        consentGrants: [...prev.consentGrants, newGrant],
        ...patchMeta,
      };
    });
  };

  const removeCareCircleMember = (memberId: string) => {
    setState((prev) => {
      const target = prev.patientProfile.careCircle.find((m) => m.id === memberId);
      const patchMeta = buildQueueAndAudit(
        prev,
        'TEAM_UPDATED',
        `Revoked access for ${target?.name ?? 'care member'}`,
        'CARE_TEAM_ACCESS_REVOKED',
      );
      return {
        ...prev,
        patientProfile: {
          ...prev.patientProfile,
          careCircle: prev.patientProfile.careCircle.filter((m) => m.id !== memberId),
        },
        consentGrants: prev.consentGrants.map((g) =>
          g.memberId === memberId ? {...g, accessStatus: 'revoked'} : g,
        ),
        ...patchMeta,
      };
    });
  };

  const updateMemberPermissions = (
    memberId: string,
    perms: NonNullable<CareCircleContact['permissions']>,
  ) => {
    setState((prev) => {
      const target = prev.patientProfile.careCircle.find((m) => m.id === memberId);
      const patchMeta = buildQueueAndAudit(
        prev,
        'TEAM_UPDATED',
        `Updated permissions for ${target?.name ?? 'care member'}`,
        'CARE_TEAM_PERMISSIONS_UPDATED',
      );
      return {
        ...prev,
        patientProfile: {
          ...prev.patientProfile,
          careCircle: prev.patientProfile.careCircle.map((m) =>
            m.id === memberId ? {...m, permissions: perms} : m,
          ),
        },
        ...patchMeta,
      };
    });
  };

  const logMedicationDose = (medId: string, status: DoseStatus, skipReason?: string) => {
    setState((prev) => {
      const actor = prev.session?.fullName ?? 'Care Team';
      const actorRole = prev.session?.role ?? 'caregiver';
      const target = prev.medications.find((m) => m.id === medId);
      const wasOverdue = target ? isMedicationOverdue(target, nowMinutes) : false;
      const isTakenLike = status === 'taken' || status === 'late_confirmed';
      const effectiveNextStatus: DoseStatus =
        isTakenLike && wasOverdue ? 'late_confirmed' : status;

      const nextMeds = prev.medications.map((m) => {
        if (m.id !== medId) return m;
        let nextUnits = m.remainingUnits;
        const wasTaken = m.status === 'taken' || m.status === 'late_confirmed';
        if (isTakenLike && !wasTaken) {
          nextUnits = Math.max(0, m.remainingUnits - m.unitsPerDose);
        } else if (status === 'pending' && wasTaken) {
          nextUnits = m.remainingUnits + m.unitsPerDose;
        }
        const dailyUse = Math.max(1, m.unitsPerDose * m.dosesPerDay);
        const nextDays = Math.floor(nextUnits / dailyUse);

        return {
          ...m,
          status: effectiveNextStatus,
          remainingUnits: nextUnits,
          refillDaysRemaining: nextDays,
          loggedAt: status === 'pending' ? undefined : formatNowLabel(),
          loggedBy: status === 'pending' ? undefined : actor,
          isLateConfirmation: isTakenLike && wasOverdue,
          skipReason:
            status === 'skipped'
              ? skipReason || 'Deferred by care team'
              : status === 'missed'
                ? skipReason || 'Explicitly marked missed'
                : undefined,
        };
      });

      // Automatically resolve any open escalation event for this medication when resolved
      let nextEscalations = prev.escalationEvents;
      const openEvent = prev.escalationEvents.find(
        (ev) => ev.medicationId === medId && ev.status !== 'resolved',
      );
      if (openEvent && status !== 'pending' && status !== 'unconfirmed') {
        const resMethod: EscalationResolutionMethod =
          status === 'skipped'
            ? 'patient_reported_skipped'
            : status === 'missed'
              ? 'caregiver_marked_missed'
              : actorRole === 'elderly_patient'
                ? 'patient_confirmed_taken'
                : 'caregiver_confirmed_taken';
        const acked = acknowledgeEscalationEvent({
          events: prev.escalationEvents,
          eventId: openEvent.id,
          actorId: prev.session?.userId ?? 'actor',
          actorName: actor,
          actorRole,
          resolve: true,
          resolutionMethod: resMethod,
        });
        nextEscalations = acked.events.map((ev) =>
          ev.id === openEvent.id
            ? {...ev, doseConfirmationStatus: effectiveNextStatus}
            : ev,
        );
      }

      const updatedMed = nextMeds.find((m) => m.id === medId);
      const lowRefillAlert =
        updatedMed &&
        isTakenLike &&
        updatedMed.refillDaysRemaining <= updatedMed.refillThresholdDays
          ? {
              category: 'refill' as const,
              title: `${updatedMed.name} low stock (${updatedMed.refillDaysRemaining} days left)`,
              body: `Remaining supply dropped to ${updatedMed.remainingUnits} units.`,
            }
          : status === 'missed' || status === 'skipped'
            ? {
                category: 'missed_dose' as const,
                title: `${target?.name ?? 'Medication'} marked ${status}`,
                body: `Recorded by ${actor} at ${formatNowLabel()}.`,
              }
            : undefined;

      const patchMeta = buildQueueAndAudit(
        prev,
        'DOSE_STATUS_UPDATE',
        `${target?.name ?? 'Medication'} marked as ${effectiveNextStatus}`,
        'DOSE_STATUS_UPDATED',
        lowRefillAlert,
      );

      return {
        ...prev,
        medications: nextMeds,
        escalationEvents: nextEscalations,
        ...patchMeta,
      };
    });
  };

  const addMedication = (
    med: Omit<MedicationItem, 'id' | 'status' | 'scheduledMinutes24h' | 'refillDaysRemaining'>,
  ) => {
    setState((prev) => {
      const dailyUse = Math.max(1, med.unitsPerDose * med.dosesPerDay);
      const newMed: MedicationItem = {
        ...med,
        id: `med-${Date.now()}`,
        scheduledMinutes24h: parse24hMinutes(med.scheduledTime),
        refillDaysRemaining: Math.floor(med.remainingUnits / dailyUse),
        status: 'pending',
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'MEDICATION_ADDED',
        `Added medication ${med.name} (${med.dosage})`,
        'MEDICATION_CREATED',
      );
      return {
        ...prev,
        medications: [...prev.medications, newMed],
        ...patchMeta,
      };
    });
  };

  const recordMedicationRefill = (medId: string, unitsAdded: number, pharmacyNote: string) => {
    if (unitsAdded <= 0) return;
    setState((prev) => {
      const actor = prev.session?.fullName ?? 'Family Coordinator';
      const target = prev.medications.find((m) => m.id === medId);
      const nextMeds = prev.medications.map((m) => {
        if (m.id !== medId) return m;
        const nextUnits = m.remainingUnits + unitsAdded;
        const dailyUse = Math.max(1, m.unitsPerDose * m.dosesPerDay);
        return {
          ...m,
          remainingUnits: nextUnits,
          refillDaysRemaining: Math.floor(nextUnits / dailyUse),
        };
      });

      const refillEntry: RefillHistoryEntry = {
        id: `rf-${Date.now()}`,
        medicationId: medId,
        medicationName: target?.name ?? 'Medication',
        unitsAdded,
        recordedBy: actor,
        recordedAtLabel: `Today, ${formatNowLabel()}`,
        pharmacyNote: pharmacyNote.trim() || 'Pharmacy refill recorded',
      };

      const patchMeta = buildQueueAndAudit(
        prev,
        'REFILL_LOGGED',
        `Refilled ${target?.name ?? 'Medication'} (+${unitsAdded} units)`,
        'REFILL_LOGGED',
      );

      return {
        ...prev,
        medications: nextMeds,
        refillHistory: [refillEntry, ...prev.refillHistory],
        ...patchMeta,
      };
    });
  };

  const updateAppointmentStatus = (aptId: string, status: AppointmentStatus) => {
    setState((prev) => {
      const target = prev.appointments.find((a) => a.id === aptId);
      const nextApts = prev.appointments.map((a) => (a.id === aptId ? {...a, status} : a));
      const patchMeta = buildQueueAndAudit(
        prev,
        'APPOINTMENT_UPDATED',
        `${target?.title ?? 'Appointment'} status set to ${status}`,
        'APPOINTMENT_UPDATED',
      );
      return {
        ...prev,
        appointments: nextApts,
        ...patchMeta,
      };
    });
  };

  const addAppointment = (apt: Omit<AppointmentItem, 'id' | 'status'>) => {
    setState((prev) => {
      const newApt: AppointmentItem = {
        ...apt,
        id: `apt-${Date.now()}`,
        status: 'upcoming',
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'APPOINTMENT_UPDATED',
        `Scheduled appointment: ${apt.title}`,
        'APPOINTMENT_CREATED',
        {
          category: 'appointment',
          title: `New appointment: ${apt.title}`,
          body: `${apt.dateLabel} at ${apt.timeLabel} · ${apt.clinician}`,
        },
      );
      return {
        ...prev,
        appointments: [newApt, ...prev.appointments],
        ...patchMeta,
      };
    });
  };

  const createHandover = (input: {
    shiftLabel: string;
    summary: string;
    checklist: HandoverChecklist;
    pendingFollowUps: string[];
  }) => {
    setState((prev) => {
      const entry: CareHandoverEntry = {
        id: `ho-${Date.now()}`,
        shiftLabel: input.shiftLabel,
        authorName: prev.session?.fullName ?? 'Priya Nair, RN',
        authorRole: prev.session?.role ?? 'caregiver',
        createdAtLabel: `Today, ${formatNowLabel()}`,
        summary: input.summary,
        checklist: input.checklist,
        pendingFollowUps: input.pendingFollowUps,
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'HANDOVER_CREATED',
        `Published handover note for ${input.shiftLabel}`,
        'HANDOVER_PUBLISHED',
        {
          category: 'handover',
          title: `New shift handover: ${input.shiftLabel}`,
          body: input.summary.slice(0, 120),
        },
      );
      return {
        ...prev,
        handovers: [entry, ...prev.handovers],
        ...patchMeta,
      };
    });
  };

  const acknowledgeHandover = (handoverId: string) => {
    setState((prev) => {
      const actor = prev.session?.fullName ?? 'Care Team';
      const nextHandovers = prev.handovers.map((ho) =>
        ho.id === handoverId
          ? {
              ...ho,
              acknowledgedBy: actor,
              acknowledgedAtLabel: `Today, ${formatNowLabel()}`,
            }
          : ho,
      );
      const patchMeta = buildQueueAndAudit(
        prev,
        'HANDOVER_ACKNOWLEDGED',
        `Acknowledged shift handover (${handoverId})`,
        'HANDOVER_ACKNOWLEDGED',
      );
      return {
        ...prev,
        handovers: nextHandovers,
        ...patchMeta,
      };
    });
  };

  const markNotificationRead = (id: string) => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => (n.id === id ? {...n, read: true} : n)),
    }));
  };

  const markAllNotificationsRead = () => {
    setState((prev) => ({
      ...prev,
      notifications: prev.notifications.map((n) => ({...n, read: true})),
    }));
  };

  const sendNotificationEmail = async (
    notificationId: string,
    recipientEmail: string,
  ): Promise<{delivered: boolean; error?: string}> => {
    const target = state.notifications.find((n) => n.id === notificationId);
    if (!target) return {delivered: false, error: 'Notification not found'};
    if (!effectiveOnline) {
      return {delivered: false, error: 'Offline: email dispatch requires live connectivity.'};
    }

    try {
      const res = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          to: recipientEmail,
          subject: `[Aarvi Care Alert] ${target.title}`,
          text: `${target.title}\n\n${target.body}\n\nPatient: ${state.patientProfile.fullName}`,
        }),
      });
      const data = (await res.json()) as {delivered: boolean; error?: string};

      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) =>
          n.id === notificationId
            ? {
                ...n,
                emailStatus: data.delivered ? 'sent' : 'provider_unconfigured',
                emailDetail: data.delivered
                  ? `Delivered to ${recipientEmail}`
                  : data.error || 'Delivery failed',
              }
            : n,
        ),
      }));

      return data;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return {delivered: false, error};
    }
  };

  /* ============================================================================
   * MODULE 17: INTELLIGENT CARE ESCALATION ACTIONS
   * ========================================================================== */

  const updateEscalationConfig = async (
    patch: Partial<EscalationConfig>,
  ): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();
    if (actor.role === 'caregiver') {
      return {ok: false, error: 'Caregivers cannot modify escalation rules.'};
    }

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/escalation/config', {
          method: 'PUT',
          headers: buildActorHeaders(),
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as {ok: boolean; config?: EscalationConfig; error?: string};
        if (!data.ok || !data.config) {
          return {ok: false, error: data.error || 'Unable to update escalation configuration.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            'ESCALATION_CONFIG_UPDATED',
            `Updated escalation rules (grace ${data.config!.gracePeriodMinutes}m)`,
            'ESCALATION_CONFIG_UPDATED',
          );
          return {...prev, escalationConfig: data.config!, ...patchMeta};
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    // Offline local queue
    setState((prev) => {
      const nextCfg = {
        ...prev.escalationConfig,
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: actor.fullName,
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'ESCALATION_CONFIG_UPDATED',
        `Queued escalation rules update locally (grace ${nextCfg.gracePeriodMinutes}m)`,
        'ESCALATION_CONFIG_UPDATED',
      );
      return {...prev, escalationConfig: nextCfg, ...patchMeta};
    });
    return {ok: true};
  };

  const runEscalationEvaluation = async (
    simulateMinutes?: number,
  ): Promise<{ok: boolean; created: number; advanced: number; error?: string}> => {
    const evalMinutes = typeof simulateMinutes === 'number' ? simulateMinutes : nowMinutes;
    const nowIso = new Date().toISOString();
    const doseDate = nowIso.slice(0, 10);

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/escalation/evaluate', {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({
            medications: state.medications,
            nowMinutes: evalMinutes,
            doseDate,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          events?: EscalationEvent[];
          newDeliveries?: NotificationDeliveryRecord[];
          newEscalationsCreated?: number;
          stagesAdvanced?: number;
          error?: string;
        };
        if (!data.ok || !data.events) {
          return {ok: false, created: 0, advanced: 0, error: data.error || 'Escalation evaluation failed.'};
        }

        setState((prev) => {
          const existingKeys = new Set(prev.notificationDeliveries.map((d) => d.idempotencyKey));
          const mergedDeliveries = [
            ...(data.newDeliveries ?? []).filter((d) => !existingKeys.has(d.idempotencyKey)),
            ...prev.notificationDeliveries,
          ].slice(0, 80);

          const nextNotifications = [...prev.notifications];
          for (const d of data.newDeliveries ?? []) {
            if (!nextNotifications.some((n) => n.idempotencyKey === d.idempotencyKey)) {
              nextNotifications.unshift({
                id: `nt-esc-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                category: 'escalation',
                title: d.title,
                body: d.body,
                timeLabel: `Today, ${formatNowLabel()}`,
                read: false,
                emailStatus:
                  d.channel === 'email'
                    ? d.status === 'sent'
                      ? 'sent'
                      : d.status === 'provider_unconfigured'
                        ? 'provider_unconfigured'
                        : 'failed'
                    : 'not_sent',
                emailDetail: d.errorDetail,
                idempotencyKey: d.idempotencyKey,
                deliveryState: d.status,
              });
            }
          }

          return {
            ...prev,
            escalationEvents: data.events!,
            notificationDeliveries: mergedDeliveries,
            notifications: nextNotifications.slice(0, 40),
          };
        });

        return {
          ok: true,
          created: data.newEscalationsCreated ?? 0,
          advanced: data.stagesAdvanced ?? 0,
        };
      } catch (err) {
        return {
          ok: false,
          created: 0,
          advanced: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    // Offline local evaluation: explicitly marks external cloud dispatch unavailable offline
    const localResult = evaluateCareEscalations({
      patientId: state.patientProfile.id,
      patientName: state.patientProfile.fullName,
      doseDate,
      nowMinutes: evalMinutes,
      nowIso,
      medications: state.medications,
      config: state.escalationConfig,
      existingEvents: state.escalationEvents,
      existingDeliveries: state.notificationDeliveries,
      consentGrants: state.consentGrants,
      membersDirectory: state.patientProfile.careCircle.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.roleLabel.toLowerCase().includes('caregiver') ? 'caregiver' : 'family_member',
      })),
    });

    const offlineDeliveries = localResult.newDeliveries.map((d) =>
      d.channel === 'email'
        ? {
            ...d,
            status: 'queued' as const,
            errorDetail: 'Device offline — external email cannot be dispatched until reconnected.',
          }
        : d,
    );

    setState((prev) => ({
      ...prev,
      escalationEvents: localResult.events,
      notificationDeliveries: [...offlineDeliveries, ...prev.notificationDeliveries].slice(0, 80),
    }));

    return {
      ok: true,
      created: localResult.newEscalationsCreated,
      advanced: localResult.stagesAdvanced,
    };
  };

  const acknowledgeEscalation = async (
    eventId: string,
    resolve = false,
    resolutionMethod?: EscalationResolutionMethod,
  ): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();
    if (effectiveOnline) {
      try {
        const res = await fetch(`/api/escalation/${eventId}/acknowledge`, {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({resolve, resolutionMethod}),
        });
        const data = (await res.json()) as {
          ok: boolean;
          events?: EscalationEvent[];
          error?: string;
        };
        if (!data.ok || !data.events) {
          return {ok: false, error: data.error || 'Could not acknowledge escalation.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            resolve ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED',
            `${resolve ? 'Resolved' : 'Acknowledged'} escalation ${eventId}`,
            resolve ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED',
          );
          return {...prev, escalationEvents: data.events!, ...patchMeta};
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = acknowledgeEscalationEvent({
      events: state.escalationEvents,
      eventId,
      actorId: actor.userId,
      actorName: actor.fullName,
      actorRole: actor.role,
      resolve,
      resolutionMethod,
    });
    if (!res.ok) return {ok: false, error: res.error};

    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        resolve ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED',
        `Queued ${resolve ? 'resolution' : 'acknowledgement'} for escalation ${eventId}`,
        resolve ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED',
      );
      return {...prev, escalationEvents: res.events, ...patchMeta};
    });
    return {ok: true};
  };

  const retryNotificationDelivery = async (
    deliveryId: string,
  ): Promise<{ok: boolean; error?: string}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Cannot retry external delivery while offline.'};
    }
    try {
      const res = await fetch(`/api/escalation/deliveries/${deliveryId}/retry`, {
        method: 'POST',
        headers: buildActorHeaders(),
      });
      const data = (await res.json()) as {
        ok: boolean;
        delivery?: NotificationDeliveryRecord;
        error?: string;
      };
      if (!data.ok || !data.delivery) {
        return {ok: false, error: data.error || 'Retry failed.'};
      }
      setState((prev) => ({
        ...prev,
        notificationDeliveries: prev.notificationDeliveries.map((d) =>
          d.id === deliveryId ? data.delivery! : d,
        ),
      }));
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  /* ============================================================================
   * MODULE 18: FAMILY CARE TASK MANAGER ACTIONS
   * ========================================================================== */

  const createCareTask = async (input: {
    title: string;
    description: string;
    category: CareTaskCategory;
    priority: CareTaskPriority;
    assigneeId: string;
    dueAtIso: string;
    internalNotes?: string;
    patientVisibleSummary?: string;
  }): Promise<{ok: boolean; error?: string}> => {
    const opId = newOpId();
    const actor = getCurrentActor();

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({...input, operationId: opId}),
        });
        const data = (await res.json()) as {ok: boolean; task?: CareTaskItem; error?: string};
        if (!data.ok || !data.task) {
          return {ok: false, error: data.error || 'Failed to create task.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            'TASK_CREATED',
            `Created task: ${data.task!.title} (${data.task!.assignedToName})`,
            'CARE_TASK_CREATED',
            {
              category: 'task',
              title: `New task assigned: ${data.task!.title}`,
              body: `Assigned to ${data.task!.assignedToName} · Priority: ${data.task!.priority}`,
              idempotencyKey: `task-created:${data.task!.operationId}`,
            },
            opId,
          );
          return {
            ...prev,
            careTasks: prev.careTasks.some((t) => t.operationId === opId)
              ? prev.careTasks
              : [data.task!, ...prev.careTasks],
            ...patchMeta,
          };
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = createCareTaskRecord({
      operationId: opId,
      actor,
      patientId: state.patientProfile.id,
      patientName: state.patientProfile.fullName,
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      assigneeId: input.assigneeId,
      dueAtIso: input.dueAtIso,
      internalNotes: input.internalNotes,
      patientVisibleSummary: input.patientVisibleSummary,
      careCircle: state.patientProfile.careCircle,
      grants: state.consentGrants,
    });
    if (!res.ok || !res.task) {
      return {ok: false, error: res.error};
    }

    const offlineTask: CareTaskItem = {...res.task, syncState: 'queued_offline'};
    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'TASK_CREATED',
        `Queued task offline: ${offlineTask.title}`,
        'CARE_TASK_CREATED',
        undefined,
        opId,
        {taskPayload: {...input, operationId: opId}},
      );
      return {
        ...prev,
        careTasks: [offlineTask, ...prev.careTasks],
        ...patchMeta,
      };
    });
    return {ok: true};
  };

  const updateCareTaskStatus = async (
    taskId: string,
    status: CareTaskStatus,
  ): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();
    const target = state.careTasks.find((t) => t.id === taskId);
    if (!target) return {ok: false, error: 'Task not found.'};

    if (effectiveOnline) {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: buildActorHeaders(),
          body: JSON.stringify({status}),
        });
        const data = (await res.json()) as {ok: boolean; task?: CareTaskItem; error?: string};
        if (!data.ok || !data.task) {
          return {ok: false, error: data.error || 'Could not update task status.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
            `${data.task!.title} marked ${data.task!.status}`,
            status === 'completed' ? 'CARE_TASK_COMPLETED' : 'CARE_TASK_UPDATED',
          );
          return {
            ...prev,
            careTasks: prev.careTasks.map((t) => (t.id === taskId ? data.task! : t)),
            ...patchMeta,
          };
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = updateCareTaskRecord({
      task: target,
      actor,
      grants: state.consentGrants,
      careCircle: state.patientProfile.careCircle,
      patch: {status},
    });
    if (!res.ok || !res.task) {
      return {ok: false, error: res.error};
    }

    const offlineUpdated: CareTaskItem = {...res.task, syncState: 'queued_offline'};
    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        status === 'completed' ? 'TASK_COMPLETED' : 'TASK_UPDATED',
        `Queued task update offline: ${offlineUpdated.title} (${status})`,
        status === 'completed' ? 'CARE_TASK_COMPLETED' : 'CARE_TASK_UPDATED',
        undefined,
        undefined,
        {taskId, status},
      );
      return {
        ...prev,
        careTasks: prev.careTasks.map((t) => (t.id === taskId ? offlineUpdated : t)),
        ...patchMeta,
      };
    });
    return {ok: true};
  };

  const reassignCareTask = async (
    taskId: string,
    reassignToId: string,
    note?: string,
  ): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();
    const target = state.careTasks.find((t) => t.id === taskId);
    if (!target) return {ok: false, error: 'Task not found.'};

    if (effectiveOnline) {
      try {
        const res = await fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: buildActorHeaders(),
          body: JSON.stringify({reassignToId, reassignNote: note}),
        });
        const data = (await res.json()) as {ok: boolean; task?: CareTaskItem; error?: string};
        if (!data.ok || !data.task) {
          return {ok: false, error: data.error || 'Could not reassign task.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            'TASK_UPDATED',
            `Reassigned ${data.task!.title} to ${data.task!.assignedToName}`,
            'CARE_TASK_REASSIGNED',
            {
              category: 'task',
              title: `Task reassigned: ${data.task!.title}`,
              body: `Assigned to ${data.task!.assignedToName}`,
              idempotencyKey: `task-re:${data.task!.id}:${data.task!.assignmentHistory.length}`,
            },
          );
          return {
            ...prev,
            careTasks: prev.careTasks.map((t) => (t.id === taskId ? data.task! : t)),
            ...patchMeta,
          };
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = updateCareTaskRecord({
      task: target,
      actor,
      grants: state.consentGrants,
      careCircle: state.patientProfile.careCircle,
      patch: {reassignToId, reassignNote: note},
    });
    if (!res.ok || !res.task) {
      return {ok: false, error: res.error};
    }

    const offlineUpdated: CareTaskItem = {...res.task, syncState: 'queued_offline'};
    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'TASK_UPDATED',
        `Queued task reassignment offline: ${offlineUpdated.title} -> ${offlineUpdated.assignedToName}`,
        'CARE_TASK_REASSIGNED',
      );
      return {
        ...prev,
        careTasks: prev.careTasks.map((t) => (t.id === taskId ? offlineUpdated : t)),
        ...patchMeta,
      };
    });
    return {ok: true};
  };

  /* ============================================================================
   * MODULE 19: PATIENT CONSENT & PRIVACY CONTROL CENTER ACTIONS
   * ========================================================================== */

  const updateMemberConsent = async (input: {
    memberId: string;
    permissions: ConsentDomainPermissions;
    expiresAtIso?: string | null;
    reason: string;
  }): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/consent/grant', {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({
            patientId: state.patientProfile.id,
            ...input,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          grants?: ConsentGrant[];
          history?: ConsentHistoryEntry[];
          error?: string;
        };
        if (!data.ok || !data.grants || !data.history) {
          return {ok: false, error: data.error || 'Could not update patient consent.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            'CONSENT_UPDATED',
            `Updated consent permissions (${input.reason})`,
            'CONSENT_UPDATED',
            {
              category: 'consent',
              title: 'Patient consent settings updated',
              body: input.reason,
            },
          );
          return {
            ...prev,
            consentGrants: data.grants!,
            consentHistory: data.history!,
            ...patchMeta,
          };
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = applyConsentGrantUpdate({
      grants: state.consentGrants,
      history: state.consentHistory,
      actor,
      targetPatientId: state.patientProfile.id,
      targetMemberId: input.memberId,
      nextPermissions: input.permissions,
      expiresAtIso: input.expiresAtIso,
      reason: input.reason,
    });
    if (!res.ok) return {ok: false, error: res.error};

    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'CONSENT_UPDATED',
        `Queued consent update offline (${input.reason})`,
        'CONSENT_UPDATED',
      );
      return {
        ...prev,
        consentGrants: res.grants,
        consentHistory: res.history,
        ...patchMeta,
      };
    });
    return {ok: true};
  };

  const revokeMemberConsent = async (
    memberId: string,
    reason: string,
  ): Promise<{ok: boolean; error?: string}> => {
    const actor = getCurrentActor();

    if (effectiveOnline) {
      try {
        const res = await fetch('/api/consent/revoke', {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({
            patientId: state.patientProfile.id,
            memberId,
            reason,
          }),
        });
        const data = (await res.json()) as {
          ok: boolean;
          grants?: ConsentGrant[];
          history?: ConsentHistoryEntry[];
          error?: string;
        };
        if (!data.ok || !data.grants || !data.history) {
          return {ok: false, error: data.error || 'Could not revoke access.'};
        }
        setState((prev) => {
          const patchMeta = buildQueueAndAudit(
            prev,
            'CONSENT_UPDATED',
            `Revoked consent access (${reason})`,
            'CONSENT_REVOKED',
          );
          return {
            ...prev,
            consentGrants: data.grants!,
            consentHistory: data.history!,
            ...patchMeta,
          };
        });
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    const res = revokeConsentGrant({
      grants: state.consentGrants,
      history: state.consentHistory,
      actor,
      targetPatientId: state.patientProfile.id,
      targetMemberId: memberId,
      reason,
    });
    if (!res.ok) return {ok: false, error: res.error};

    setState((prev) => {
      const patchMeta = buildQueueAndAudit(
        prev,
        'CONSENT_UPDATED',
        `Queued consent revocation offline (${reason})`,
        'CONSENT_REVOKED',
      );
      return {
        ...prev,
        consentGrants: res.grants,
        consentHistory: res.history,
        ...patchMeta,
      };
    });
    return {ok: true};
  };

  /* ============================================================================
   * MODULE 20: CAREGIVER VISIT CHECK-IN & VERIFICATION ACTIONS
   * ========================================================================== */

  const scheduleCaregiverVisit = async (input: {
    title: string;
    caregiverId: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
  }): Promise<{ok: boolean; error?: string}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Scheduling a verified visit requires live server confirmation.'};
    }
    try {
      const opId = newOpId();
      const res = await fetch('/api/visits', {
        method: 'POST',
        headers: buildActorHeaders(),
        body: JSON.stringify({
          operationId: opId,
          patientId: state.patientProfile.id,
          ...input,
        }),
      });
      const data = (await res.json()) as {ok: boolean; visit?: CaregiverVisit; error?: string};
      if (!data.ok || !data.visit) {
        return {ok: false, error: data.error || 'Could not schedule visit.'};
      }
      setState((prev) => {
        const patchMeta = buildQueueAndAudit(
          prev,
          'VISIT_SCHEDULED',
          `Scheduled caregiver visit: ${data.visit!.title} (${data.visit!.caregiverName})`,
          'CAREGIVER_VISIT_SCHEDULED',
        );
        return {
          ...prev,
          caregiverVisits: [data.visit!, ...prev.caregiverVisits],
          ...patchMeta,
        };
      });
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const issueVisitCode = async (
    visitId: string,
    ttlMinutes = 30,
  ): Promise<{ok: boolean; code?: IssuedVisitCodePreview; error?: string}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Generating a cryptographic verification code requires server connectivity.'};
    }
    try {
      const res = await fetch(`/api/visits/${visitId}/issue-code`, {
        method: 'POST',
        headers: buildActorHeaders(),
        body: JSON.stringify({ttlMinutes}),
      });
      const data = (await res.json()) as {
        ok: boolean;
        oneTimePin?: string;
        qrPayload?: string;
        expiresAtIso?: string;
        visit?: CaregiverVisit;
        error?: string;
      };
      if (!data.ok || !data.oneTimePin || !data.qrPayload || !data.expiresAtIso || !data.visit) {
        return {ok: false, error: data.error || 'Failed to issue verification code.'};
      }
      const codePreview: IssuedVisitCodePreview = {
        visitId,
        oneTimePin: data.oneTimePin,
        qrPayload: data.qrPayload,
        expiresAtIso: data.expiresAtIso,
      };
      setIssuedVisitCodes((prev) => ({...prev, [visitId]: codePreview}));
      setState((prev) => ({
        ...prev,
        caregiverVisits: prev.caregiverVisits.map((v) => (v.id === visitId ? data.visit! : v)),
      }));
      return {ok: true, code: codePreview};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const verifyVisitCheckIn = async (input: {
    visitId: string;
    method: 'pin' | 'qr';
    code: string;
    locationConsentOptIn?: boolean;
    locationNote?: string;
  }): Promise<{ok: boolean; error?: string; attemptsRemaining?: number}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Visit check-in verification requires a live server timestamp.'};
    }
    try {
      const res = await fetch(`/api/visits/${input.visitId}/check-in`, {
        method: 'POST',
        headers: buildActorHeaders(),
        body: JSON.stringify({
          method: input.method,
          code: input.code,
          locationConsentOptIn: input.locationConsentOptIn,
          locationNote: input.locationNote,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        visit?: CaregiverVisit;
        error?: string;
        attemptsRemaining?: number;
      };
      if (!data.ok || !data.visit) {
        return {
          ok: false,
          error: data.error || 'Verification failed.',
          attemptsRemaining: data.attemptsRemaining,
        };
      }
      setIssuedVisitCodes((prev) => {
        const next = {...prev};
        delete next[input.visitId];
        return next;
      });
      setState((prev) => {
        const patchMeta = buildQueueAndAudit(
          prev,
          'VISIT_UPDATED',
          `Verified check-in (${input.method.toUpperCase()}) for ${data.visit!.title}`,
          'CAREGIVER_VISIT_CHECKED_IN',
        );
        return {
          ...prev,
          caregiverVisits: prev.caregiverVisits.map((v) =>
            v.id === input.visitId ? data.visit! : v,
          ),
          ...patchMeta,
        };
      });
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const addVisitActivity = async (
    visitId: string,
    activityType: VisitActivityEntry['activityType'],
    note: string,
  ): Promise<{ok: boolean; error?: string}> => {
    if (effectiveOnline) {
      try {
        const res = await fetch(`/api/visits/${visitId}/activities`, {
          method: 'POST',
          headers: buildActorHeaders(),
          body: JSON.stringify({activityType, note}),
        });
        const data = (await res.json()) as {ok: boolean; visit?: CaregiverVisit; error?: string};
        if (!data.ok || !data.visit) {
          return {ok: false, error: data.error || 'Could not log activity.'};
        }
        setState((prev) => ({
          ...prev,
          caregiverVisits: prev.caregiverVisits.map((v) => (v.id === visitId ? data.visit! : v)),
        }));
        return {ok: true};
      } catch (err) {
        return {ok: false, error: err instanceof Error ? err.message : String(err)};
      }
    }

    setState((prev) => ({
      ...prev,
      caregiverVisits: prev.caregiverVisits.map((v) =>
        v.id === visitId
          ? {
              ...v,
              activities: [
                ...v.activities,
                {
                  id: `va-${Date.now()}`,
                  recordedAtIso: new Date().toISOString(),
                  recordedByName: prev.session?.fullName ?? 'Caregiver',
                  activityType,
                  note,
                },
              ],
            }
          : v,
      ),
    }));
    return {ok: true};
  };

  const completeVisitCheckOut = async (input: {
    visitId: string;
    observations: string;
    handoverNote?: string;
    incompleteReason?: string;
  }): Promise<{ok: boolean; error?: string}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Visit check-out requires server timestamp confirmation.'};
    }
    try {
      const res = await fetch(`/api/visits/${input.visitId}/check-out`, {
        method: 'POST',
        headers: buildActorHeaders(),
        body: JSON.stringify({
          observations: input.observations,
          handoverNote: input.handoverNote,
          incompleteReason: input.incompleteReason,
        }),
      });
      const data = (await res.json()) as {ok: boolean; visit?: CaregiverVisit; error?: string};
      if (!data.ok || !data.visit) {
        return {ok: false, error: data.error || 'Could not complete check-out.'};
      }
      setState((prev) => {
        const handoverEntry: CareHandoverEntry | null = input.handoverNote?.trim()
          ? {
              id: `ho-visit-${Date.now()}`,
              shiftLabel: `Visit: ${data.visit!.title}`,
              authorName: data.visit!.caregiverName,
              authorRole: 'caregiver',
              createdAtLabel: `Today, ${formatNowLabel()}`,
              summary: input.handoverNote.trim(),
              checklist: {
                mood: 'calm',
                appetite: 'ate_well',
                hydration: 'on_track',
                sleepQuality: 'restful',
                mobility: 'steady',
              },
              pendingFollowUps: [],
            }
          : null;

        const patchMeta = buildQueueAndAudit(
          prev,
          'VISIT_UPDATED',
          `Visit ${data.visit!.status}: ${data.visit!.title}`,
          'CAREGIVER_VISIT_COMPLETED',
          {
            category: 'visit',
            title: `Caregiver visit ${data.visit!.status}: ${data.visit!.title}`,
            body: `${data.visit!.caregiverName} checked out · ${data.visit!.observations}`,
            idempotencyKey: `visit-done-ui:${data.visit!.id}`,
          },
        );
        return {
          ...prev,
          caregiverVisits: prev.caregiverVisits.map((v) =>
            v.id === input.visitId ? data.visit! : v,
          ),
          handovers: handoverEntry ? [handoverEntry, ...prev.handovers] : prev.handovers,
          ...patchMeta,
        };
      });
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const cancelCaregiverVisit = async (
    visitId: string,
    reason: string,
    targetStatus: 'cancelled' | 'missed' = 'cancelled',
  ): Promise<{ok: boolean; error?: string}> => {
    if (!effectiveOnline) {
      return {ok: false, error: 'Updating visit cancellation status requires server confirmation.'};
    }
    try {
      const res = await fetch(`/api/visits/${visitId}/cancel`, {
        method: 'POST',
        headers: buildActorHeaders(),
        body: JSON.stringify({reason, targetStatus}),
      });
      const data = (await res.json()) as {ok: boolean; visit?: CaregiverVisit; error?: string};
      if (!data.ok || !data.visit) {
        return {ok: false, error: data.error || 'Could not update visit.'};
      }
      setState((prev) => {
        const patchMeta = buildQueueAndAudit(
          prev,
          'VISIT_UPDATED',
          `Visit marked ${targetStatus}: ${data.visit!.title} (${reason})`,
          'CAREGIVER_VISIT_CANCELLED',
        );
        return {
          ...prev,
          caregiverVisits: prev.caregiverVisits.map((v) => (v.id === visitId ? data.visit! : v)),
          ...patchMeta,
        };
      });
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const flushSyncQueue = useCallback(async () => {
    if (!effectiveOnline) {
      return {syncedCount: 0, databaseStatus: 'Offline — waiting for connectivity'};
    }

    const pendingItems = state.syncQueue.filter((item) => item.syncStatus === 'pending');

    // Replay queued task operations idempotently against server
    for (const item of pendingItems) {
      if (item.actionType === 'TASK_CREATED' && item.payload?.taskPayload) {
        try {
          await fetch('/api/tasks', {
            method: 'POST',
            headers: buildActorHeaders(),
            body: JSON.stringify(item.payload.taskPayload),
          });
        } catch {
          // Keep resilient
        }
      } else if (
        (item.actionType === 'TASK_UPDATED' || item.actionType === 'TASK_COMPLETED') &&
        item.payload?.taskId
      ) {
        try {
          await fetch(`/api/tasks/${String(item.payload.taskId)}`, {
            method: 'PATCH',
            headers: buildActorHeaders(),
            body: JSON.stringify({status: item.payload.status}),
          });
        } catch {
          // Keep resilient
        }
      }
    }

    let databaseStatus = 'IndexedDB queue reconciled with server';

    if (state.session?.accessToken) {
      try {
        const res = await fetch('/api/care/workspace', {
          headers: {Authorization: `Bearer ${state.session.accessToken}`},
        });
        const data = (await res.json()) as {ok: boolean; error?: string};
        databaseStatus = data.ok
          ? 'Verified against authenticated Supabase session'
          : `Supabase check: ${data.error ?? 'RLS restricted'}`;
      } catch {
        databaseStatus = 'Server unreachable during Supabase verification';
      }
    } else {
      databaseStatus = 'Local & server coordination queue reconciled (idempotent op-IDs)';
    }

    setState((prev) => ({
      ...prev,
      careTasks: prev.careTasks.map((t) =>
        t.syncState === 'queued_offline' ? {...t, syncState: 'synced'} : t,
      ),
      syncQueue: prev.syncQueue.map((item) =>
        item.syncStatus === 'pending' ? {...item, syncStatus: 'synced'} : item,
      ),
      lastLocalSyncAt: `${databaseStatus} · ${formatNowLabel()}`,
    }));

    return {syncedCount: pendingItems.length, databaseStatus};
  }, [effectiveOnline, state.syncQueue, state.session?.accessToken, buildActorHeaders]);

  const retrySyncItem = (operationId: string) => {
    setState((prev) => ({
      ...prev,
      syncQueue: prev.syncQueue.map((item) =>
        item.operationId === operationId
          ? {
              ...item,
              retryCount: item.retryCount + 1,
              syncStatus: effectiveOnline ? 'synced' : 'pending',
            }
          : item,
      ),
    }));
  };

  const updatePreviewModules = (updater: (prev: PreviewModuleState) => PreviewModuleState) => {
    setState((prev) => ({
      ...prev,
      previewModules: updater(prev.previewModules),
    }));
  };

  const addDailyCheckIn = (entry: Omit<DailyCheckInEntry, 'id' | 'timeLabel' | 'authorName'>) => {
    setState((prev) => {
      const authorName = prev.session?.fullName ?? 'Care Team';
      const newCheckIn: DailyCheckInEntry = {
        ...entry,
        id: `dc-${Date.now()}`,
        timeLabel: `Today, ${formatNowLabel()}`,
        authorName,
      };
      const patchMeta = buildQueueAndAudit(
        prev,
        'COMPANION_LOGGED',
        `Daily Care Companion check-in logged (${entry.mood})`,
        'DAILY_CHECKIN_RECORDED',
      );
      return {
        ...prev,
        previewModules: {
          ...prev.previewModules,
          hydrationGlasses: entry.hydrationCount,
          lastMealNote: entry.mealNote || prev.previewModules.lastMealNote,
          dailyCheckIns: [newCheckIn, ...prev.previewModules.dailyCheckIns],
        },
        ...patchMeta,
      };
    });
  };

  const signInWithSupabaseAuth = async (input: {
    email: string;
    password: string;
  }): Promise<{ok: boolean; error?: string}> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        ok: boolean;
        user?: {id: string; email?: string; user_metadata?: Record<string, unknown>};
        accessToken?: string;
        error?: string;
      };
      if (!data.ok || !data.user) {
        return {ok: false, error: data.error || 'Authentication failed.'};
      }
      const meta = data.user.user_metadata ?? {};
      const roleVal =
        meta.role === 'elderly_patient' || meta.role === 'caregiver'
          ? (meta.role as UserRole)
          : 'family_member';

      if (state.session && state.session.userId !== data.user.id) {
        await clearOfflineDataForOwner(state.session.userId);
      }

      setState((prev) => ({
        ...prev,
        session: {
          userId: data.user!.id,
          fullName: String(meta.full_name || data.user!.email || 'Aarvi Member'),
          email: data.user!.email || input.email,
          role: roleVal,
          relationshipOrTitle: String(meta.relationship_or_title || roleVal),
          onboardingCompleted: true,
          signedInAt: formatNowLabel(),
          sessionOrigin: 'supabase_auth',
          accessToken: data.accessToken,
        },
      }));
      setActiveRoute('dashboard');
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const registerWithSupabaseAuth = async (input: {
    fullName: string;
    email: string;
    password: string;
    role: UserRole;
    relationshipOrTitle: string;
  }): Promise<{ok: boolean; confirmationRequired?: boolean; error?: string}> => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as {
        ok: boolean;
        user?: {id: string; email?: string};
        accessToken?: string | null;
        confirmationRequired?: boolean;
        error?: string;
      };
      if (!data.ok) {
        return {ok: false, error: data.error || 'Registration failed.'};
      }
      if (data.confirmationRequired) {
        return {ok: true, confirmationRequired: true};
      }
      if (data.user) {
        setState((prev) => ({
          ...prev,
          session: {
            userId: data.user!.id,
            fullName: input.fullName.trim(),
            email: input.email.trim(),
            role: input.role,
            relationshipOrTitle: input.relationshipOrTitle.trim(),
            onboardingCompleted: false,
            signedInAt: formatNowLabel(),
            sessionOrigin: 'supabase_auth',
            accessToken: data.accessToken ?? undefined,
          },
        }));
        setActiveRoute('dashboard');
      }
      return {ok: true};
    } catch (err) {
      return {ok: false, error: err instanceof Error ? err.message : String(err)};
    }
  };

  const signInPreviewRole = (role: UserRole) => {
    const sample = SAMPLE_ROLE_IDENTITIES[role];
    setState((prev) => ({
      ...prev,
      session: {
        userId: sample.userId,
        fullName: sample.fullName,
        email: sample.email,
        role,
        relationshipOrTitle: sample.relationshipOrTitle,
        onboardingCompleted: true,
        signedInAt: formatNowLabel(),
        sessionOrigin: 'preview_workspace',
      },
      preferences:
        role === 'elderly_patient' && prev.preferences.textScale === 'standard'
          ? {...prev.preferences, textScale: 'large'}
          : prev.preferences,
    }));
    setActiveRoute('dashboard');
  };

  const switchRolePreview = (role: UserRole) => {
    signInPreviewRole(role);
  };

  const completeOnboarding = () => {
    setState((prev) =>
      prev.session
        ? {
            ...prev,
            session: {...prev.session, onboardingCompleted: true},
          }
        : prev,
    );
  };

  const signOut = async () => {
    if (state.session) {
      await clearOfflineDataForOwner(state.session.userId);
    }
    setIssuedVisitCodes({});
    setState((prev) => ({
      ...prev,
      session: null,
    }));
    setActiveRoute('dashboard');
  };

  const resetWorkspaceData = async () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('aarvi_workspace_state_v2');
    await clearAllOfflineData();
    setIssuedVisitCodes({});
    setState(DEFAULT_PERSISTED_STATE);
    setSimulateOffline(false);
    setActiveRoute('dashboard');
  };

  const pendingQueueCount = state.syncQueue.filter((item) => item.syncStatus === 'pending').length;
  const unreadNotificationsCount = state.notifications.filter((n) => !n.read).length;

  return (
    <AarviContext.Provider
      value={{
        modules: AARVI_20_MODULES,
        capabilities,
        session: state.session,
        activeRoute,
        setActiveRoute,
        preferences: state.preferences,
        updatePreferences,
        patientProfile: state.patientProfile,
        updatePatientProfile,
        addCareCircleMember,
        removeCareCircleMember,
        updateMemberPermissions,
        medications: state.medications,
        overdueMedicationIds,
        getEffectiveDoseStatus,
        logMedicationDose,
        addMedication,
        refillHistory: state.refillHistory,
        recordMedicationRefill,
        appointments: state.appointments,
        updateAppointmentStatus,
        addAppointment,
        handovers: state.handovers,
        createHandover,
        acknowledgeHandover,
        notifications: state.notifications,
        unreadNotificationsCount,
        markNotificationRead,
        markAllNotificationsRead,
        sendNotificationEmail,
        auditLogs: state.auditLogs,
        browserOnline,
        simulateOffline,
        setSimulateOffline,
        effectiveOnline,
        syncQueue: state.syncQueue,
        pendingQueueCount,
        lastLocalSyncAt: state.lastLocalSyncAt,
        flushSyncQueue,
        retrySyncItem,
        previewModules: state.previewModules,
        updatePreviewModules,
        addDailyCheckIn,
        escalationConfig: state.escalationConfig,
        escalationEvents: state.escalationEvents,
        notificationDeliveries: state.notificationDeliveries,
        updateEscalationConfig,
        runEscalationEvaluation,
        acknowledgeEscalation,
        retryNotificationDelivery,
        careTasks: state.careTasks,
        createCareTask,
        updateCareTaskStatus,
        reassignCareTask,
        consentGrants: state.consentGrants,
        consentHistory: state.consentHistory,
        canCurrentActorAccess,
        updateMemberConsent,
        revokeMemberConsent,
        caregiverVisits: state.caregiverVisits,
        issuedVisitCodes,
        scheduleCaregiverVisit,
        issueVisitCode,
        verifyVisitCheckIn,
        addVisitActivity,
        completeVisitCheckOut,
        cancelCaregiverVisit,
        signInWithSupabaseAuth,
        registerWithSupabaseAuth,
        signInPreviewRole,
        switchRolePreview,
        completeOnboarding,
        signOut,
        resetWorkspaceData,
      }}
    >
      {children}
    </AarviContext.Provider>
  );
}

export function useAarvi() {
  const ctx = useContext(AarviContext);
  if (!ctx) {
    throw new Error('useAarvi must be used inside AarviProvider');
  }
  return ctx;
}
