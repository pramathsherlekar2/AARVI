import React, {createContext, useContext, useEffect, useState} from 'react';
import {
  AARVI_16_MODULES,
  INITIAL_APPOINTMENTS,
  INITIAL_HANDOVERS,
  INITIAL_MEDICATIONS,
  INITIAL_PATIENT_PROFILE,
  INITIAL_PREVIEW_MODULES,
} from '../data/aarviSeed';
import type {
  AarviModuleDefinition,
  AccessibilityPreferences,
  AppRoute,
  AppointmentItem,
  AppointmentStatus,
  AuthSession,
  CareHandoverEntry,
  DoseStatus,
  HandoverChecklist,
  MedicationItem,
  PatientProfile,
  PreviewModuleState,
  SyncQueueItem,
  UserRole,
} from '../types/aarvi';

const STORAGE_KEY = 'aarvi_phase2_ui_state_v1';

interface PersistedUiState {
  session: AuthSession | null;
  preferences: AccessibilityPreferences;
  patientProfile: PatientProfile;
  medications: MedicationItem[];
  appointments: AppointmentItem[];
  handovers: CareHandoverEntry[];
  syncQueue: SyncQueueItem[];
  lastLocalSyncAt: string;
  previewModules: PreviewModuleState;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  textScale: 'standard',
  highContrast: false,
  simplifiedPatientView: true,
  reminderTone: 'gentle',
};

const DEFAULT_PERSISTED_STATE: PersistedUiState = {
  session: null,
  preferences: DEFAULT_PREFERENCES,
  patientProfile: INITIAL_PATIENT_PROFILE,
  medications: INITIAL_MEDICATIONS,
  appointments: INITIAL_APPOINTMENTS,
  handovers: INITIAL_HANDOVERS,
  syncQueue: [],
  lastLocalSyncAt: 'Local UI Ready · Backend Sync Pending Phase 3',
  previewModules: INITIAL_PREVIEW_MODULES,
};

function loadInitialState(): PersistedUiState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
    };
  } catch {
    return DEFAULT_PERSISTED_STATE;
  }
}

function formatNowLabel(): string {
  return new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
}

interface AarviContextValue {
  modules: AarviModuleDefinition[];
  session: AuthSession | null;
  activeRoute: AppRoute;
  setActiveRoute: (route: AppRoute) => void;
  preferences: AccessibilityPreferences;
  updatePreferences: (patch: Partial<AccessibilityPreferences>) => void;
  patientProfile: PatientProfile;
  updatePatientProfile: (patch: Partial<PatientProfile>) => void;
  medications: MedicationItem[];
  logMedicationDose: (medId: string, status: DoseStatus, skipReason?: string) => void;
  addMedication: (med: Omit<MedicationItem, 'id' | 'status'>) => void;
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
  browserOnline: boolean;
  simulateOffline: boolean;
  setSimulateOffline: (val: boolean) => void;
  effectiveOnline: boolean;
  syncQueue: SyncQueueItem[];
  pendingQueueCount: number;
  lastLocalSyncAt: string;
  flushLocalSyncQueue: () => void;
  previewModules: PreviewModuleState;
  updatePreviewModules: (updater: (prev: PreviewModuleState) => PreviewModuleState) => void;
  signInLocal: (input: {
    fullName: string;
    email: string;
    role: UserRole;
    relationshipOrTitle: string;
    skipOnboarding?: boolean;
  }) => void;
  switchRolePreview: (role: UserRole) => void;
  completeOnboarding: () => void;
  signOutLocal: () => void;
  resetDemoState: () => void;
}

const AarviContext = createContext<AarviContextValue | null>(null);

const SAMPLE_ROLE_IDENTITIES: Record<
  UserRole,
  {fullName: string; email: string; relationshipOrTitle: string}
> = {
  elderly_patient: {
    fullName: 'Meera Kulkarni',
    email: 'meera.kulkarni@example.org',
    relationshipOrTitle: 'Elderly Patient',
  },
  family_member: {
    fullName: 'Ananya Kulkarni',
    email: 'ananya.kulkarni@example.org',
    relationshipOrTitle: 'Daughter · Primary Coordinator',
  },
  caregiver: {
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

  const effectiveOnline = browserOnline && !simulateOffline;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors in restricted sandboxes
    }
  }, [state]);

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

  function enqueueOrRecord(
    prev: PersistedUiState,
    actionType: SyncQueueItem['actionType'],
    description: string,
  ): Pick<PersistedUiState, 'syncQueue' | 'lastLocalSyncAt'> {
    const item: SyncQueueItem = {
      id: `sq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actionType,
      description,
      timestampLabel: formatNowLabel(),
      syncStatus: effectiveOnline ? 'flushed_in_ui_state' : 'pending_local_queue',
    };
    return {
      syncQueue: [item, ...prev.syncQueue].slice(0, 25),
      lastLocalSyncAt: effectiveOnline
        ? `Saved locally at ${formatNowLabel()} (server API pending Phase 3)`
        : prev.lastLocalSyncAt,
    };
  }

  const updatePreferences = (patch: Partial<AccessibilityPreferences>) => {
    setState((prev) => {
      const syncPatch = enqueueOrRecord(
        prev,
        'PREFERENCES_UPDATED',
        'Updated accessibility & reminder preferences',
      );
      return {
        ...prev,
        preferences: {...prev.preferences, ...patch},
        ...syncPatch,
      };
    });
  };

  const updatePatientProfile = (patch: Partial<PatientProfile>) => {
    setState((prev) => {
      const syncPatch = enqueueOrRecord(
        prev,
        'PROFILE_UPDATED',
        `Updated patient profile (${Object.keys(patch).join(', ')})`,
      );
      return {
        ...prev,
        patientProfile: {...prev.patientProfile, ...patch},
        ...syncPatch,
      };
    });
  };

  const logMedicationDose = (medId: string, status: DoseStatus, skipReason?: string) => {
    setState((prev) => {
      const actor = prev.session?.fullName ?? 'Care Team';
      const target = prev.medications.find((m) => m.id === medId);
      const nextMeds = prev.medications.map((m) =>
        m.id === medId
          ? {
              ...m,
              status,
              loggedAt: status === 'pending' ? undefined : formatNowLabel(),
              loggedBy: status === 'pending' ? undefined : actor,
              skipReason: status === 'skipped' ? skipReason || 'Deferred by care team' : undefined,
            }
          : m,
      );
      const syncPatch = enqueueOrRecord(
        prev,
        'DOSE_STATUS_UPDATE',
        `${target?.name ?? 'Medication'} marked as ${status}`,
      );
      return {
        ...prev,
        medications: nextMeds,
        ...syncPatch,
      };
    });
  };

  const addMedication = (med: Omit<MedicationItem, 'id' | 'status'>) => {
    setState((prev) => {
      const newMed: MedicationItem = {
        ...med,
        id: `med-${Date.now()}`,
        status: 'pending',
      };
      const syncPatch = enqueueOrRecord(
        prev,
        'DOSE_STATUS_UPDATE',
        `Added medication ${med.name} (${med.dosage})`,
      );
      return {
        ...prev,
        medications: [...prev.medications, newMed],
        ...syncPatch,
      };
    });
  };

  const updateAppointmentStatus = (aptId: string, status: AppointmentStatus) => {
    setState((prev) => {
      const target = prev.appointments.find((a) => a.id === aptId);
      const nextApts = prev.appointments.map((a) => (a.id === aptId ? {...a, status} : a));
      const syncPatch = enqueueOrRecord(
        prev,
        'APPOINTMENT_UPDATED',
        `${target?.title ?? 'Appointment'} status set to ${status}`,
      );
      return {
        ...prev,
        appointments: nextApts,
        ...syncPatch,
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
      const syncPatch = enqueueOrRecord(
        prev,
        'APPOINTMENT_UPDATED',
        `Added appointment: ${apt.title}`,
      );
      return {
        ...prev,
        appointments: [newApt, ...prev.appointments],
        ...syncPatch,
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
      const syncPatch = enqueueOrRecord(
        prev,
        'HANDOVER_CREATED',
        `Logged handover note for ${input.shiftLabel}`,
      );
      return {
        ...prev,
        handovers: [entry, ...prev.handovers],
        ...syncPatch,
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
      const syncPatch = enqueueOrRecord(
        prev,
        'HANDOVER_ACKNOWLEDGED',
        `Acknowledged shift handover (${handoverId})`,
      );
      return {
        ...prev,
        handovers: nextHandovers,
        ...syncPatch,
      };
    });
  };

  const flushLocalSyncQueue = () => {
    if (!effectiveOnline) return;
    setState((prev) => ({
      ...prev,
      syncQueue: prev.syncQueue.map((item) => ({
        ...item,
        syncStatus: 'flushed_in_ui_state',
      })),
      lastLocalSyncAt: `Local queue reconciled at ${formatNowLabel()} (awaiting Phase 3 API)`,
    }));
  };

  const updatePreviewModules = (updater: (prev: PreviewModuleState) => PreviewModuleState) => {
    setState((prev) => ({
      ...prev,
      previewModules: updater(prev.previewModules),
    }));
  };

  const signInLocal = (input: {
    fullName: string;
    email: string;
    role: UserRole;
    relationshipOrTitle: string;
    skipOnboarding?: boolean;
  }) => {
    setState((prev) => ({
      ...prev,
      session: {
        userId: `local-${input.role}-${Date.now()}`,
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        role: input.role,
        relationshipOrTitle: input.relationshipOrTitle.trim(),
        onboardingCompleted: Boolean(input.skipOnboarding),
        signedInAt: formatNowLabel(),
        sessionOrigin: 'local_phase2_ui',
      },
      preferences:
        input.role === 'elderly_patient'
          ? {...prev.preferences, textScale: 'large'}
          : prev.preferences,
    }));
    setActiveRoute('dashboard');
  };

  const switchRolePreview = (role: UserRole) => {
    const sample = SAMPLE_ROLE_IDENTITIES[role];
    setState((prev) => ({
      ...prev,
      session: {
        userId: `preview-${role}`,
        fullName: sample.fullName,
        email: sample.email,
        role,
        relationshipOrTitle: sample.relationshipOrTitle,
        onboardingCompleted: true,
        signedInAt: formatNowLabel(),
        sessionOrigin: 'local_phase2_ui',
      },
      preferences:
        role === 'elderly_patient' && prev.preferences.textScale === 'standard'
          ? {...prev.preferences, textScale: 'large'}
          : prev.preferences,
    }));
    setActiveRoute('dashboard');
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

  const signOutLocal = () => {
    setState((prev) => ({
      ...prev,
      session: null,
    }));
    setActiveRoute('dashboard');
  };

  const resetDemoState = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(DEFAULT_PERSISTED_STATE);
    setSimulateOffline(false);
    setActiveRoute('dashboard');
  };

  const pendingQueueCount = state.syncQueue.filter(
    (item) => item.syncStatus === 'pending_local_queue',
  ).length;

  return (
    <AarviContext.Provider
      value={{
        modules: AARVI_16_MODULES,
        session: state.session,
        activeRoute,
        setActiveRoute,
        preferences: state.preferences,
        updatePreferences,
        patientProfile: state.patientProfile,
        updatePatientProfile,
        medications: state.medications,
        logMedicationDose,
        addMedication,
        appointments: state.appointments,
        updateAppointmentStatus,
        addAppointment,
        handovers: state.handovers,
        createHandover,
        acknowledgeHandover,
        browserOnline,
        simulateOffline,
        setSimulateOffline,
        effectiveOnline,
        syncQueue: state.syncQueue,
        pendingQueueCount,
        lastLocalSyncAt: state.lastLocalSyncAt,
        flushLocalSyncQueue,
        previewModules: state.previewModules,
        updatePreviewModules,
        signInLocal,
        switchRolePreview,
        completeOnboarding,
        signOutLocal,
        resetDemoState,
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
