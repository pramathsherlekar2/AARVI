import crypto from 'crypto';
import {
  acknowledgeEscalationEvent,
  evaluateCareEscalations,
} from '../shared/escalation.ts';
import {
  applyConsentGrantUpdate,
  type CareActor,
  canManagePatientConsent,
  hasDomainConsent,
  isConsentGrantEffective,
  revokeConsentGrant,
} from '../shared/permissions.ts';
import {
  canCreateCareTask,
  createCareTaskRecord,
  deduplicateTaskOperation,
  detectOverdueCareTasks,
  filterTasksForPatient,
  updateCareTaskRecord,
} from '../shared/tasks.ts';
import {
  canAccessCaregiverVisit,
  canScheduleCaregiverVisit,
  sanitizeVisitForClient,
  type ServerCaregiverVisitRecord,
} from '../shared/visits.ts';
import type {
  AuditLogEntry,
  CareCircleContact,
  CaregiverVisit,
  CareTaskCategory,
  CareTaskItem,
  CareTaskPriority,
  CareTaskStatus,
  ConsentDomainPermissions,
  ConsentGrant,
  ConsentHistoryEntry,
  EscalationConfig,
  EscalationEvent,
  EscalationResolutionMethod,
  MedicationItem,
  NotificationDeliveryRecord,
  UserRole,
  VisitActivityEntry,
} from '../src/types/aarvi.ts';
import {dispatchCareEmail} from './notifications.ts';

export const DEFAULT_PATIENT_ID = 'pat-meera-01';
export const DEFAULT_PATIENT_NAME = 'Meera Kulkarni';

const INITIAL_CARE_CIRCLE: CareCircleContact[] = [
  {
    id: 'cc-1',
    name: 'Ananya Kulkarni',
    roleLabel: 'Family Member',
    relation: 'Daughter · Primary Coordinator',
    phone: '+91 98450 22104',
    email: 'ananya.kulkarni@example.org',
    availability: 'Daily check-in · 8:00 PM',
    isPrimary: true,
    permissions: {
      canEditMedications: true,
      canEditAppointments: true,
      canWriteHandovers: true,
      canManageTeam: true,
    },
  },
  {
    id: 'cc-2',
    name: 'Priya Nair, RN',
    roleLabel: 'Caregiver',
    relation: 'Day Shift Caregiver',
    phone: '+91 97412 88310',
    email: 'priya.nair@example.org',
    availability: 'Mon–Sat · 8:00 AM – 4:00 PM',
    isPrimary: true,
    permissions: {
      canEditMedications: true,
      canEditAppointments: false,
      canWriteHandovers: true,
      canManageTeam: false,
    },
  },
  {
    id: 'cc-3',
    name: 'Rohan Kulkarni',
    roleLabel: 'Family Member',
    relation: 'Son · Weekend Support',
    phone: '+91 99001 44582',
    email: 'rohan.kulkarni@example.org',
    availability: 'Sat–Sun · In-person visits',
    isPrimary: false,
    permissions: {
      canEditMedications: false,
      canEditAppointments: true,
      canWriteHandovers: true,
      canManageTeam: false,
    },
  },
];

function createInitialConsentGrants(): ConsentGrant[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'cg-ananya',
      patientId: DEFAULT_PATIENT_ID,
      memberId: 'cc-1',
      memberName: 'Ananya Kulkarni',
      memberEmail: 'ananya.kulkarni@example.org',
      memberRole: 'family_member',
      relationship: 'Daughter · Primary Coordinator',
      isLegalRepresentative: true,
      accessStatus: 'active',
      permissions: {
        medications: true,
        appointments: true,
        medical_documents: true,
        care_notes: true,
        wellbeing: true,
        activity_history: true,
      },
      expiresAtIso: null,
      grantedById: 'pat-meera-01',
      grantedByName: 'Meera Kulkarni',
      updatedAtIso: nowIso,
      reason: 'Designated legal family care coordinator',
    },
    {
      id: 'cg-priya',
      patientId: DEFAULT_PATIENT_ID,
      memberId: 'cc-2',
      memberName: 'Priya Nair, RN',
      memberEmail: 'priya.nair@example.org',
      memberRole: 'caregiver',
      relationship: 'Day Shift Caregiver',
      isLegalRepresentative: false,
      accessStatus: 'active',
      permissions: {
        medications: true,
        appointments: false,
        medical_documents: false,
        care_notes: true,
        wellbeing: true,
        activity_history: true,
      },
      expiresAtIso: null,
      grantedById: 'pat-meera-01',
      grantedByName: 'Meera Kulkarni',
      updatedAtIso: nowIso,
      reason: 'Active shift caregiver medication & care note consent',
    },
    {
      id: 'cg-rohan',
      patientId: DEFAULT_PATIENT_ID,
      memberId: 'cc-3',
      memberName: 'Rohan Kulkarni',
      memberEmail: 'rohan.kulkarni@example.org',
      memberRole: 'family_member',
      relationship: 'Son · Weekend Support',
      isLegalRepresentative: false,
      accessStatus: 'temporary',
      permissions: {
        medications: true,
        appointments: true,
        medical_documents: false,
        care_notes: true,
        wellbeing: true,
        activity_history: false,
      },
      expiresAtIso: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      grantedById: 'cc-1',
      grantedByName: 'Ananya Kulkarni',
      updatedAtIso: nowIso,
      reason: 'Weekend care support (30-day temporary access)',
    },
  ];
}

function createInitialEscalationConfig(): EscalationConfig {
  return {
    patientId: DEFAULT_PATIENT_ID,
    gracePeriodMinutes: 30,
    stage1ToStage2Minutes: 20,
    stage2ToStage3Minutes: 30,
    escalationOrder: ['patient', 'caregiver', 'family'],
    assignedCaregiverId: 'cc-2',
    assignedCaregiverName: 'Priya Nair, RN',
    authorizedFamilyIds: ['cc-1'],
    channels: {
      inApp: true,
      email: false,
      push: false,
    },
    quietHoursEnabled: true,
    quietStartHour24: 22,
    quietEndHour24: 7,
    updatedAt: new Date().toISOString(),
    updatedBy: 'Ananya Kulkarni',
  };
}

function createInitialTasks(): CareTaskItem[] {
  const now = Date.now();
  const createdIso = new Date(now - 3 * 3600 * 1000).toISOString();
  const tomorrowIso = new Date(now + 24 * 3600 * 1000).toISOString();
  const in4HoursIso = new Date(now + 4 * 3600 * 1000).toISOString();
  const twoHoursAgoIso = new Date(now - 2 * 3600 * 1000).toISOString();

  return [
    {
      id: 'task-seed-1',
      operationId: 'seed-op-task-1',
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      title: 'Collect Atorvastatin 10 mg refill strip',
      description: 'Remaining stock is 6 days. Collect 30-tablet strip from MedPlus Indiranagar.',
      category: 'refill',
      priority: 'urgent',
      status: 'acknowledged',
      assignedToId: 'cc-1',
      assignedToName: 'Ananya Kulkarni',
      assignedToRole: 'family_member',
      createdById: 'cc-2',
      createdByName: 'Priya Nair, RN',
      createdByRole: 'caregiver',
      dueAtIso: in4HoursIso,
      createdAtIso: createdIso,
      updatedAtIso: createdIso,
      acknowledgedAtIso: createdIso,
      internalNotes: 'Confirm batch expiry date is 2027 or later before billing.',
      patientVisibleSummary: 'Pharmacy pickup for Atorvastatin refill',
      syncState: 'synced',
      assignmentHistory: [
        {
          id: 'ah-seed-1',
          toAssigneeId: 'cc-1',
          toAssigneeName: 'Ananya Kulkarni',
          toAssigneeRole: 'family_member',
          assignedByName: 'Priya Nair, RN',
          timestampIso: createdIso,
          note: 'Assigned to primary family coordinator',
        },
      ],
    },
    {
      id: 'task-seed-2',
      operationId: 'seed-op-task-2',
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      title: 'Arrange cab & accompaniment for Geriatric Review',
      description: 'Sankalp Senior Care Clinic Room 204 · carry prescription folder and lab summary.',
      category: 'appointment_companion',
      priority: 'high',
      status: 'todo',
      assignedToId: 'cc-3',
      assignedToName: 'Rohan Kulkarni',
      assignedToRole: 'family_member',
      createdById: 'cc-1',
      createdByName: 'Ananya Kulkarni',
      createdByRole: 'family_member',
      dueAtIso: tomorrowIso,
      createdAtIso: createdIso,
      updatedAtIso: createdIso,
      internalNotes: 'Keep wheelchair assistance option noted at clinic entrance.',
      patientVisibleSummary: 'Clinic visit accompaniment & transport',
      syncState: 'synced',
      assignmentHistory: [
        {
          id: 'ah-seed-2',
          toAssigneeId: 'cc-3',
          toAssigneeName: 'Rohan Kulkarni',
          toAssigneeRole: 'family_member',
          assignedByName: 'Ananya Kulkarni',
          timestampIso: createdIso,
        },
      ],
    },
    {
      id: 'task-seed-3',
      operationId: 'seed-op-task-3',
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      title: 'Collect fasting lipid & HbA1c lab report',
      description: 'Verify printed copy is placed inside hallway medical folder for Dr. Deshmukh.',
      category: 'medical_reports',
      priority: 'high',
      status: 'overdue',
      assignedToId: 'cc-2',
      assignedToName: 'Priya Nair, RN',
      assignedToRole: 'caregiver',
      createdById: 'cc-1',
      createdByName: 'Ananya Kulkarni',
      createdByRole: 'family_member',
      dueAtIso: twoHoursAgoIso,
      createdAtIso: createdIso,
      updatedAtIso: createdIso,
      internalNotes: 'Ask lab reception if digital PDF was emailed to Ananya.',
      patientVisibleSummary: 'Diagnostic lab report collection',
      syncState: 'synced',
      assignmentHistory: [
        {
          id: 'ah-seed-3',
          toAssigneeId: 'cc-2',
          toAssigneeName: 'Priya Nair, RN',
          toAssigneeRole: 'caregiver',
          assignedByName: 'Ananya Kulkarni',
          timestampIso: createdIso,
        },
      ],
    },
  ];
}

function createInitialVisits(): ServerCaregiverVisitRecord[] {
  const now = Date.now();
  const in30Min = new Date(now + 30 * 60 * 1000).toISOString();
  const in4Hours = new Date(now + 4 * 3600 * 1000).toISOString();
  const yesterdayStart = new Date(now - 24 * 3600 * 1000).toISOString();
  const yesterdayCheckIn = new Date(now - 24 * 3600 * 1000 + 4 * 60 * 1000).toISOString();
  const yesterdayEnd = new Date(now - 20 * 3600 * 1000).toISOString();

  return [
    {
      id: 'visit-seed-upcoming',
      operationId: 'seed-op-visit-1',
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      title: 'Evening Medication & Dinner Assistance Visit',
      caregiverId: 'cc-2',
      caregiverName: 'Priya Nair, RN',
      scheduledById: 'cc-1',
      scheduledByName: 'Ananya Kulkarni',
      scheduledStartIso: in30Min,
      scheduledEndIso: in4Hours,
      status: 'scheduled',
      hasActiveVerificationCode: false,
      verificationAttempts: 0,
      maxVerificationAttempts: 5,
      verificationLocked: false,
      activities: [],
      observations: '',
      locationConsentOptIn: false,
      createdAtIso: yesterdayStart,
      updatedAtIso: yesterdayStart,
    },
    {
      id: 'visit-seed-completed',
      operationId: 'seed-op-visit-2',
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      title: 'Morning Medication & Courtyard Mobility Visit',
      caregiverId: 'cc-2',
      caregiverName: 'Priya Nair, RN',
      scheduledById: 'cc-1',
      scheduledByName: 'Ananya Kulkarni',
      scheduledStartIso: yesterdayStart,
      scheduledEndIso: yesterdayEnd,
      status: 'completed',
      hasActiveVerificationCode: false,
      verificationAttempts: 1,
      maxVerificationAttempts: 5,
      verificationLocked: false,
      checkInAtIso: yesterdayCheckIn,
      checkInMethod: 'pin',
      checkOutAtIso: yesterdayEnd,
      activities: [
        {
          id: 'va-1',
          recordedAtIso: yesterdayCheckIn,
          recordedByName: 'Priya Nair, RN',
          activityType: 'medication',
          note: 'Administered morning Amlodipine 5 mg after breakfast.',
        },
        {
          id: 'va-2',
          recordedAtIso: yesterdayEnd,
          recordedByName: 'Priya Nair, RN',
          activityType: 'mobility',
          note: '12-minute shaded courtyard walk with walking cane; steady gait.',
        },
      ],
      observations: 'Calm mood, good appetite, hydration on track.',
      handoverNote: 'All morning routines completed smoothly.',
      locationConsentOptIn: false,
      createdAtIso: yesterdayStart,
      updatedAtIso: yesterdayEnd,
    },
  ];
}

export class CareCoordinationStore {
  careCircle: CareCircleContact[] = [...INITIAL_CARE_CIRCLE];
  consentGrants: ConsentGrant[] = createInitialConsentGrants();
  consentHistory: ConsentHistoryEntry[] = [
    {
      id: 'ch-seed-1',
      patientId: DEFAULT_PATIENT_ID,
      grantId: 'cg-priya',
      memberId: 'cc-2',
      memberName: 'Priya Nair, RN',
      actorId: 'pat-meera-01',
      actorName: 'Meera Kulkarni',
      actorRole: 'elderly_patient',
      action: 'granted',
      nextPermissions: {
        medications: true,
        appointments: false,
        medical_documents: false,
        care_notes: true,
        wellbeing: true,
        activity_history: true,
      },
      reason: 'Initial caregiver onboarding consent',
      timestampIso: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    },
  ];
  escalationConfig: EscalationConfig = createInitialEscalationConfig();
  escalationEvents: EscalationEvent[] = [];
  deliveries: NotificationDeliveryRecord[] = [];
  tasks: CareTaskItem[] = createInitialTasks();
  visits: ServerCaregiverVisitRecord[] = createInitialVisits();
  auditLogs: AuditLogEntry[] = [];
  private processedOperationIds = new Set<string>(['seed-op-task-1', 'seed-op-task-2', 'seed-op-task-3', 'seed-op-visit-1', 'seed-op-visit-2']);

  private hashSecret(secret: string, salt: string): string {
    return crypto.createHash('sha256').update(`${salt}:${secret.trim()}`).digest('hex');
  }

  private constantTimeCompare(aHex: string, bHex: string): boolean {
    if (aHex.length !== bHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(aHex, 'hex'), Buffer.from(bHex, 'hex'));
  }

  private emitAudit(actor: CareActor, action: string, detail: string) {
    this.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestampLabel: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
      actorName: actor.fullName,
      actorRole: actor.role,
      action,
      detail,
    });
    if (this.auditLogs.length > 100) {
      this.auditLogs.length = 100;
    }
  }

  private addIdempotentDelivery(record: NotificationDeliveryRecord) {
    if (this.deliveries.some((d) => d.idempotencyKey === record.idempotencyKey)) {
      return;
    }
    this.deliveries.unshift(record);
    if (this.deliveries.length > 100) {
      this.deliveries.length = 100;
    }
  }

  private getEffectiveConsentGrants(nowMs: number = Date.now()): ConsentGrant[] {
    return this.consentGrants.map((g) => {
      if (g.accessStatus !== 'revoked' && g.expiresAtIso) {
        const expMs = new Date(g.expiresAtIso).getTime();
        if (!Number.isNaN(expMs) && expMs <= nowMs) {
          return {...g, accessStatus: 'expired' as const};
        }
      }
      return g;
    });
  }

  getWorkspaceSnapshot(actor: CareActor, targetPatientId: string) {
    const nowMs = Date.now();
    if (actor.patientId !== targetPatientId) {
      return {ok: false as const, statusCode: 403, error: 'Cross-patient workspace access denied.'};
    }

    const effectiveGrants = this.getEffectiveConsentGrants(nowMs);
    const overdueCheck = detectOverdueCareTasks(this.tasks, nowMs);
    this.tasks = overdueCheck.tasks;

    const patientScopedTasks = this.tasks.filter((t) => t.patientId === targetPatientId);
    const patientScopedVisits = this.visits
      .filter((v) => v.patientId === targetPatientId)
      .filter((v) => canAccessCaregiverVisit(actor, v, effectiveGrants, nowMs).allowed)
      .map(sanitizeVisitForClient);

    if (actor.role === 'elderly_patient') {
      return {
        ok: true as const,
        statusCode: 200,
        data: {
          consentGrants: effectiveGrants.filter((g) => g.patientId === targetPatientId),
          consentHistory: this.consentHistory.filter((h) => h.patientId === targetPatientId),
          escalationConfig: this.escalationConfig,
          escalationEvents: this.escalationEvents.filter((e) => e.patientId === targetPatientId),
          deliveries: this.deliveries.filter(
            (d) => d.patientId === targetPatientId && d.recipientId === actor.userId,
          ),
          tasks: filterTasksForPatient(patientScopedTasks),
          visits: patientScopedVisits,
          auditLogs: this.auditLogs,
        },
      };
    }

    const canSeeMeds = hasDomainConsent(effectiveGrants, actor, targetPatientId, 'medications', nowMs).allowed;
    const canSeeNotes = hasDomainConsent(effectiveGrants, actor, targetPatientId, 'care_notes', nowMs).allowed;
    const canSeeHistory = hasDomainConsent(effectiveGrants, actor, targetPatientId, 'activity_history', nowMs).allowed;

    return {
      ok: true as const,
      statusCode: 200,
      data: {
        consentGrants: effectiveGrants.filter((g) => g.patientId === targetPatientId),
        consentHistory: canSeeHistory
          ? this.consentHistory.filter((h) => h.patientId === targetPatientId)
          : [],
        escalationConfig: this.escalationConfig,
        escalationEvents: canSeeMeds
          ? this.escalationEvents.filter((e) => e.patientId === targetPatientId)
          : [],
        deliveries: canSeeMeds || canSeeNotes
          ? this.deliveries.filter((d) => d.patientId === targetPatientId)
          : [],
        tasks: canSeeNotes ? patientScopedTasks : [],
        visits: patientScopedVisits,
        auditLogs: canSeeHistory ? this.auditLogs : [],
      },
    };
  }

  /* ================= MODULE 17: ESCALATION ================= */

  updateEscalationConfig(actor: CareActor, patch: Partial<EscalationConfig>) {
    if (actor.patientId !== this.escalationConfig.patientId) {
      return {ok: false, statusCode: 403, error: 'Cross-patient escalation configuration forbidden.'};
    }
    if (actor.role === 'caregiver') {
      return {
        ok: false,
        statusCode: 403,
        error: 'Only patients or authorized family coordinators can alter escalation rules.',
      };
    }
    const grants = this.getEffectiveConsentGrants();
    if (actor.role === 'family_member') {
      const check = canManagePatientConsent(actor, this.escalationConfig.patientId, grants);
      if (!check.allowed) {
        return {ok: false, statusCode: 403, error: check.reason};
      }
    }

    // Validate authorized caregiver and family recipients
    if (patch.assignedCaregiverId) {
      const cg = grants.find(
        (g) => g.memberId === patch.assignedCaregiverId && g.memberRole === 'caregiver',
      );
      if (!cg || !isConsentGrantEffective(cg) || !cg.permissions.medications) {
        return {
          ok: false,
          statusCode: 403,
          error: 'Assigned caregiver must hold active medication consent.',
        };
      }
    }
    if (patch.authorizedFamilyIds) {
      for (const famId of patch.authorizedFamilyIds) {
        const fg = grants.find((g) => g.memberId === famId && g.memberRole === 'family_member');
        if (!fg || !isConsentGrantEffective(fg) || !fg.permissions.medications) {
          return {
            ok: false,
            statusCode: 403,
            error: `Family recipient ${famId} does not hold active medication consent.`,
          };
        }
      }
    }

    this.escalationConfig = {
      ...this.escalationConfig,
      ...patch,
      gracePeriodMinutes: Math.min(Math.max(Number(patch.gracePeriodMinutes ?? this.escalationConfig.gracePeriodMinutes), 5), 240),
      stage1ToStage2Minutes: Math.min(Math.max(Number(patch.stage1ToStage2Minutes ?? this.escalationConfig.stage1ToStage2Minutes), 5), 240),
      stage2ToStage3Minutes: Math.min(Math.max(Number(patch.stage2ToStage3Minutes ?? this.escalationConfig.stage2ToStage3Minutes), 5), 240),
      updatedAt: new Date().toISOString(),
      updatedBy: actor.fullName,
    };

    this.emitAudit(actor, 'ESCALATION_CONFIG_UPDATED', `Grace period: ${this.escalationConfig.gracePeriodMinutes}m`);
    return {ok: true, statusCode: 200, config: this.escalationConfig};
  }

  async evaluateEscalations(input: {
    actor: CareActor;
    medications: MedicationItem[];
    nowMinutes: number;
    doseDate?: string;
  }) {
    if (input.actor.patientId !== this.escalationConfig.patientId) {
      return {ok: false, statusCode: 403, error: 'Cross-patient escalation check denied.'};
    }

    const nowIso = new Date().toISOString();
    const doseDate = input.doseDate || nowIso.slice(0, 10);
    const grants = this.getEffectiveConsentGrants();

    const result = evaluateCareEscalations({
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      doseDate,
      nowMinutes: input.nowMinutes,
      nowIso,
      medications: input.medications,
      config: this.escalationConfig,
      existingEvents: this.escalationEvents,
      existingDeliveries: this.deliveries,
      consentGrants: grants,
      membersDirectory: this.careCircle.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        role: c.roleLabel.toLowerCase().includes('caregiver') ? 'caregiver' : 'family_member',
      })),
    });

    this.escalationEvents = result.events;

    // Attempt honest external delivery for any queued email deliveries
    for (const del of result.newDeliveries) {
      if (del.channel === 'email' && del.recipientEmail) {
        const emailResult = await dispatchCareEmail({
          to: del.recipientEmail,
          subject: del.title,
          text: del.body,
        });
        del.status = emailResult.delivered
          ? 'sent'
          : emailResult.provider === 'none'
            ? 'provider_unconfigured'
            : 'failed';
        del.errorDetail = emailResult.error;
        del.updatedAt = new Date().toISOString();
      }
      this.addIdempotentDelivery(del);
    }

    return {
      ok: true,
      statusCode: 200,
      events: this.escalationEvents,
      newDeliveries: result.newDeliveries,
      newEscalationsCreated: result.newEscalationsCreated,
      stagesAdvanced: result.stagesAdvanced,
    };
  }

  acknowledgeEscalation(input: {
    actor: CareActor;
    eventId: string;
    resolve?: boolean;
    resolutionMethod?: EscalationResolutionMethod;
  }) {
    const grants = this.getEffectiveConsentGrants();
    if (input.actor.role !== 'elderly_patient') {
      const check = hasDomainConsent(grants, input.actor, DEFAULT_PATIENT_ID, 'medications');
      if (!check.allowed) {
        return {ok: false, statusCode: 403, error: 'Active medication consent is required to acknowledge alerts.'};
      }
    }

    const res = acknowledgeEscalationEvent({
      events: this.escalationEvents,
      eventId: input.eventId,
      actorId: input.actor.userId,
      actorName: input.actor.fullName,
      actorRole: input.actor.role,
      resolve: input.resolve,
      resolutionMethod: input.resolutionMethod,
    });
    if (!res.ok) {
      return {ok: false, statusCode: 404, error: res.error};
    }

    this.escalationEvents = res.events;
    this.deliveries = this.deliveries.map((d) =>
      d.sourceId === input.eventId && d.status !== 'acknowledged'
        ? {
            ...d,
            status: 'acknowledged',
            acknowledgedBy: input.actor.fullName,
            acknowledgedAt: new Date().toISOString(),
          }
        : d,
    );

    this.emitAudit(
      input.actor,
      input.resolve ? 'ESCALATION_RESOLVED' : 'ESCALATION_ACKNOWLEDGED',
      `Event ${input.eventId} by ${input.actor.fullName}`,
    );

    return {ok: true, statusCode: 200, event: res.updated, events: this.escalationEvents};
  }

  async retryDelivery(actor: CareActor, deliveryId: string) {
    const target = this.deliveries.find((d) => d.id === deliveryId);
    if (!target) {
      return {ok: false, statusCode: 404, error: 'Delivery record not found.'};
    }
    if (target.patientId !== actor.patientId) {
      return {ok: false, statusCode: 403, error: 'Cross-patient notification retry forbidden.'};
    }

    target.retryCount += 1;
    target.updatedAt = new Date().toISOString();

    if (target.channel === 'email' && target.recipientEmail) {
      const emailRes = await dispatchCareEmail({
        to: target.recipientEmail,
        subject: target.title,
        text: target.body,
      });
      target.status = emailRes.delivered
        ? 'sent'
        : emailRes.provider === 'none'
          ? 'provider_unconfigured'
          : 'failed';
      target.errorDetail = emailRes.error;
    } else if (target.channel === 'in_app') {
      target.status = 'sent';
    }

    return {ok: true, statusCode: 200, delivery: target};
  }

  /* ================= MODULE 18: FAMILY CARE TASKS ================= */

  createTask(input: {
    actor: CareActor;
    operationId: string;
    title: string;
    description: string;
    category: CareTaskCategory;
    priority: CareTaskPriority;
    assigneeId: string;
    dueAtIso: string;
    internalNotes?: string;
    patientVisibleSummary?: string;
  }) {
    if (deduplicateTaskOperation(this.tasks, input.operationId) || this.processedOperationIds.has(input.operationId)) {
      const existing = this.tasks.find((t) => t.operationId === input.operationId);
      return {ok: true, statusCode: 200, deduplicated: true, task: existing};
    }

    const grants = this.getEffectiveConsentGrants();
    const res = createCareTaskRecord({
      ...input,
      patientId: DEFAULT_PATIENT_ID,
      patientName: DEFAULT_PATIENT_NAME,
      careCircle: this.careCircle,
      grants,
    });

    if (!res.ok || !res.task) {
      return {ok: false, statusCode: res.statusCode, error: res.error};
    }

    this.processedOperationIds.add(input.operationId);
    this.tasks.unshift(res.task);
    this.emitAudit(input.actor, 'CARE_TASK_CREATED', `${res.task.title} -> ${res.task.assignedToName}`);

    // Idempotent assignment notification
    this.addIdempotentDelivery({
      id: `del-task-${Date.now()}`,
      idempotencyKey: `task-assigned:${res.task.id}:${res.task.assignedToId}:${res.task.operationId}`,
      patientId: DEFAULT_PATIENT_ID,
      sourceType: 'task',
      sourceId: res.task.id,
      recipientId: res.task.assignedToId,
      recipientName: res.task.assignedToName,
      channel: 'in_app',
      status: 'sent',
      retryCount: 0,
      title: `New task assigned: ${res.task.title}`,
      body: `Priority: ${res.task.priority} · Due: ${new Date(res.task.dueAtIso).toLocaleString()}`,
      createdAt: res.task.createdAtIso,
      updatedAt: res.task.createdAtIso,
    });

    return {ok: true, statusCode: 201, task: res.task};
  }

  updateTask(input: {
    actor: CareActor;
    taskId: string;
    status?: CareTaskStatus;
    reassignToId?: string;
    reassignNote?: string;
  }) {
    const existing = this.tasks.find((t) => t.id === input.taskId);
    if (!existing) {
      return {ok: false, statusCode: 404, error: 'Task not found.'};
    }

    const grants = this.getEffectiveConsentGrants();
    const res = updateCareTaskRecord({
      task: existing,
      actor: input.actor,
      grants,
      careCircle: this.careCircle,
      patch: {
        status: input.status,
        reassignToId: input.reassignToId,
        reassignNote: input.reassignNote,
      },
    });

    if (!res.ok || !res.task) {
      return {ok: false, statusCode: res.statusCode, error: res.error};
    }

    this.tasks = this.tasks.map((t) => (t.id === res.task!.id ? res.task! : t));
    this.emitAudit(
      input.actor,
      input.status === 'completed' ? 'CARE_TASK_COMPLETED' : 'CARE_TASK_UPDATED',
      `${res.task.title} (${res.task.status})`,
    );

    if (res.reassigned) {
      this.addIdempotentDelivery({
        id: `del-task-re-${Date.now()}`,
        idempotencyKey: `task-reassigned:${res.task.id}:${res.task.assignedToId}:${res.task.assignmentHistory.length}`,
        patientId: DEFAULT_PATIENT_ID,
        sourceType: 'task',
        sourceId: res.task.id,
        recipientId: res.task.assignedToId,
        recipientName: res.task.assignedToName,
        channel: 'in_app',
        status: 'sent',
        retryCount: 0,
        title: `Task reassigned to you: ${res.task.title}`,
        body: `Reassigned by ${input.actor.fullName}`,
        createdAt: res.task.updatedAtIso,
        updatedAt: res.task.updatedAtIso,
      });
    }

    if (input.status === 'completed' && (res.task.priority === 'high' || res.task.priority === 'urgent')) {
      this.addIdempotentDelivery({
        id: `del-task-done-${Date.now()}`,
        idempotencyKey: `task-completed:${res.task.id}`,
        patientId: DEFAULT_PATIENT_ID,
        sourceType: 'task',
        sourceId: res.task.id,
        recipientId: res.task.createdById,
        recipientName: res.task.createdByName,
        channel: 'in_app',
        status: 'sent',
        retryCount: 0,
        title: `Important task completed: ${res.task.title}`,
        body: `Completed by ${input.actor.fullName}`,
        createdAt: res.task.updatedAtIso,
        updatedAt: res.task.updatedAtIso,
      });
    }

    return {ok: true, statusCode: 200, task: res.task};
  }

  /* ================= MODULE 19: PATIENT CONSENT ================= */

  grantOrUpdateConsent(input: {
    actor: CareActor;
    targetPatientId: string;
    targetMemberId: string;
    permissions: ConsentDomainPermissions;
    expiresAtIso?: string | null;
    reason: string;
  }) {
    const res = applyConsentGrantUpdate({
      grants: this.getEffectiveConsentGrants(),
      history: this.consentHistory,
      actor: input.actor,
      targetPatientId: input.targetPatientId,
      targetMemberId: input.targetMemberId,
      nextPermissions: input.permissions,
      expiresAtIso: input.expiresAtIso,
      reason: input.reason,
    });

    if (!res.ok) {
      return {ok: false, statusCode: res.statusCode, error: res.error};
    }

    this.consentGrants = res.grants;
    this.consentHistory = res.history;
    this.emitAudit(
      input.actor,
      'CONSENT_UPDATED',
      `Updated access for ${res.updatedGrant?.memberName ?? input.targetMemberId}`,
    );

    return {
      ok: true,
      statusCode: 200,
      grant: res.updatedGrant,
      grants: this.consentGrants,
      history: this.consentHistory,
    };
  }

  revokeConsent(input: {
    actor: CareActor;
    targetPatientId: string;
    targetMemberId: string;
    reason: string;
  }) {
    const res = revokeConsentGrant({
      grants: this.getEffectiveConsentGrants(),
      history: this.consentHistory,
      actor: input.actor,
      targetPatientId: input.targetPatientId,
      targetMemberId: input.targetMemberId,
      reason: input.reason,
    });

    if (!res.ok) {
      return {ok: false, statusCode: res.statusCode, error: res.error};
    }

    this.consentGrants = res.grants;
    this.consentHistory = res.history;
    this.emitAudit(
      input.actor,
      'CONSENT_REVOKED',
      `Revoked access for ${res.updatedGrant?.memberName ?? input.targetMemberId}`,
    );

    return {
      ok: true,
      statusCode: 200,
      grant: res.updatedGrant,
      grants: this.consentGrants,
      history: this.consentHistory,
    };
  }

  /* ================= MODULE 20: CAREGIVER VISITS ================= */

  scheduleVisit(input: {
    actor: CareActor;
    operationId: string;
    patientId: string;
    caregiverId: string;
    title: string;
    scheduledStartIso: string;
    scheduledEndIso: string;
  }) {
    if (this.processedOperationIds.has(input.operationId)) {
      const existing = this.visits.find((v) => v.operationId === input.operationId);
      if (existing) {
        return {ok: true, statusCode: 200, deduplicated: true, visit: sanitizeVisitForClient(existing)};
      }
    }

    const grants = this.getEffectiveConsentGrants();
    const check = canScheduleCaregiverVisit(input.actor, input.patientId, input.caregiverId, grants);
    if (!check.allowed) {
      return {ok: false, statusCode: 403, error: check.reason};
    }

    const caregiver = this.careCircle.find((c) => c.id === input.caregiverId);
    const nowIso = new Date().toISOString();

    const record: ServerCaregiverVisitRecord = {
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      operationId: input.operationId,
      patientId: input.patientId,
      patientName: DEFAULT_PATIENT_NAME,
      title: input.title.trim() || 'Scheduled Caregiver Visit',
      caregiverId: input.caregiverId,
      caregiverName: caregiver?.name ?? 'Assigned Caregiver',
      scheduledById: input.actor.userId,
      scheduledByName: input.actor.fullName,
      scheduledStartIso: input.scheduledStartIso,
      scheduledEndIso: input.scheduledEndIso,
      status: 'scheduled',
      hasActiveVerificationCode: false,
      verificationAttempts: 0,
      maxVerificationAttempts: 5,
      verificationLocked: false,
      activities: [],
      observations: '',
      locationConsentOptIn: false,
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    };

    this.processedOperationIds.add(input.operationId);
    this.visits.unshift(record);
    this.emitAudit(input.actor, 'VISIT_SCHEDULED', `${record.title} assigned to ${record.caregiverName}`);

    return {ok: true, statusCode: 201, visit: sanitizeVisitForClient(record)};
  }

  issueVisitVerificationCode(input: {
    actor: CareActor;
    visitId: string;
    ttlMinutes?: number;
  }) {
    const visit = this.visits.find((v) => v.id === input.visitId);
    if (!visit) {
      return {ok: false, statusCode: 404, error: 'Visit not found.'};
    }
    if (input.actor.patientId !== visit.patientId) {
      return {ok: false, statusCode: 403, error: 'Cross-patient visit code generation forbidden.'};
    }
    if (input.actor.role === 'caregiver') {
      return {
        ok: false,
        statusCode: 403,
        error: 'Only the patient or authorized family representative can issue visit verification codes.',
      };
    }
    if (visit.status !== 'scheduled') {
      return {ok: false, statusCode: 409, error: 'Verification codes can only be issued for scheduled visits.'};
    }

    // Generate cryptographically random 6-digit PIN + QR token; store ONLY salted SHA-256 hashes
    const pinNumber = crypto.randomInt(100000, 999999);
    const oneTimePin = String(pinNumber);
    const qrSecret = crypto.randomBytes(12).toString('hex').toUpperCase();
    const qrPayload = `ARV-VISIT:${visit.id}:${qrSecret}`;
    const salt = crypto.randomBytes(16).toString('hex');
    const ttl = Math.min(Math.max(input.ttlMinutes ?? 30, 1), 240);
    const expiresAtIso = new Date(Date.now() + ttl * 60 * 1000).toISOString();

    visit.verificationPinSalt = salt;
    visit.verificationPinHash = this.hashSecret(oneTimePin, salt);
    visit.verificationQrHash = this.hashSecret(qrPayload, salt);
    visit.verificationExpiresAtIso = expiresAtIso;
    visit.verificationAttempts = 0;
    visit.verificationLocked = false;
    visit.hasActiveVerificationCode = true;
    visit.updatedAtIso = new Date().toISOString();

    this.emitAudit(input.actor, 'VISIT_CODE_ISSUED', `Verification PIN/QR issued for ${visit.title}`);

    return {
      ok: true,
      statusCode: 200,
      oneTimePin,
      qrPayload,
      expiresAtIso,
      visit: sanitizeVisitForClient(visit),
    };
  }

  checkInVisit(input: {
    actor: CareActor;
    visitId: string;
    method: 'pin' | 'qr';
    code: string;
    locationConsentOptIn?: boolean;
    locationNote?: string;
    nowIso?: string;
  }) {
    const visit = this.visits.find((v) => v.id === input.visitId);
    if (!visit) {
      return {ok: false, statusCode: 404, error: 'Visit not found.'};
    }

    const grants = this.getEffectiveConsentGrants();
    const access = canAccessCaregiverVisit(input.actor, visit, grants);
    if (!access.allowed) {
      return {ok: false, statusCode: 403, error: access.reason};
    }
    if (input.actor.role !== 'caregiver') {
      return {ok: false, statusCode: 403, error: 'Only the assigned caregiver can verify check-in.'};
    }
    if (visit.status === 'ongoing' || visit.checkInAtIso) {
      return {ok: false, statusCode: 409, error: 'Duplicate check-in rejected: visit already checked in.'};
    }
    if (visit.status !== 'scheduled') {
      return {ok: false, statusCode: 409, error: `Cannot check in when visit status is ${visit.status}.`};
    }
    if (visit.verificationLocked || visit.verificationAttempts >= visit.maxVerificationAttempts) {
      return {
        ok: false,
        statusCode: 429,
        error: 'Verification attempt limit reached. Patient or family must issue a fresh code.',
      };
    }
    if (!visit.verificationPinSalt || !visit.verificationExpiresAtIso) {
      return {
        ok: false,
        statusCode: 400,
        error: 'No active patient-approved PIN or QR code has been issued for this visit.',
      };
    }

    const nowMs = input.nowIso ? new Date(input.nowIso).getTime() : Date.now();
    if (new Date(visit.verificationExpiresAtIso).getTime() <= nowMs) {
      visit.hasActiveVerificationCode = false;
      return {
        ok: false,
        statusCode: 410,
        error: 'Verification code has expired. Request a new code from the patient or family.',
      };
    }

    const expectedHash = input.method === 'qr' ? visit.verificationQrHash : visit.verificationPinHash;
    const candidateHash = this.hashSecret(input.code, visit.verificationPinSalt);

    if (!expectedHash || !this.constantTimeCompare(candidateHash, expectedHash)) {
      visit.verificationAttempts += 1;
      if (visit.verificationAttempts >= visit.maxVerificationAttempts) {
        visit.verificationLocked = true;
      }
      visit.updatedAtIso = new Date().toISOString();
      this.emitAudit(
        input.actor,
        'VISIT_CHECKIN_FAILED',
        `Failed ${input.method.toUpperCase()} verification attempt ${visit.verificationAttempts}/${visit.maxVerificationAttempts}`,
      );
      return {
        ok: false,
        statusCode: visit.verificationLocked ? 429 : 401,
        error: visit.verificationLocked
          ? 'Too many incorrect verification attempts. Code is locked.'
          : `Incorrect ${input.method.toUpperCase()} verification code.`,
        attemptsRemaining: Math.max(0, visit.maxVerificationAttempts - visit.verificationAttempts),
      };
    }

    // Verified! Server authoritative timestamp, clear single-use code hashes
    const serverTimestamp = new Date().toISOString();
    visit.status = 'ongoing';
    visit.checkInAtIso = serverTimestamp;
    visit.checkInMethod = input.method;
    visit.hasActiveVerificationCode = false;
    visit.verificationPinHash = undefined;
    visit.verificationQrHash = undefined;
    visit.verificationPinSalt = undefined;
    visit.locationConsentOptIn = Boolean(input.locationConsentOptIn);
    visit.locationNote = input.locationConsentOptIn ? input.locationNote?.trim() || 'Consent-based neighbourhood note logged' : undefined;
    visit.updatedAtIso = serverTimestamp;

    this.emitAudit(
      input.actor,
      'VISIT_CHECKED_IN',
      `Verified ${input.method.toUpperCase()} check-in for ${visit.title}`,
    );

    return {ok: true, statusCode: 200, visit: sanitizeVisitForClient(visit)};
  }

  addVisitActivity(input: {
    actor: CareActor;
    visitId: string;
    activityType: VisitActivityEntry['activityType'];
    note: string;
  }) {
    const visit = this.visits.find((v) => v.id === input.visitId);
    if (!visit) return {ok: false, statusCode: 404, error: 'Visit not found.'};

    const access = canAccessCaregiverVisit(input.actor, visit, this.getEffectiveConsentGrants());
    if (!access.allowed || input.actor.role !== 'caregiver') {
      return {ok: false, statusCode: 403, error: 'Only the assigned caregiver can log visit activities.'};
    }
    if (visit.status !== 'ongoing') {
      return {ok: false, statusCode: 409, error: 'Care activities can only be recorded during an ongoing checked-in visit.'};
    }

    const entry: VisitActivityEntry = {
      id: `va-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      recordedAtIso: new Date().toISOString(),
      recordedByName: input.actor.fullName,
      activityType: input.activityType,
      note: input.note.trim(),
    };

    visit.activities.push(entry);
    visit.updatedAtIso = entry.recordedAtIso;
    return {ok: true, statusCode: 200, visit: sanitizeVisitForClient(visit)};
  }

  checkOutVisit(input: {
    actor: CareActor;
    visitId: string;
    observations: string;
    handoverNote?: string;
    incompleteReason?: string;
  }) {
    const visit = this.visits.find((v) => v.id === input.visitId);
    if (!visit) return {ok: false, statusCode: 404, error: 'Visit not found.'};

    const access = canAccessCaregiverVisit(input.actor, visit, this.getEffectiveConsentGrants());
    if (!access.allowed || input.actor.role !== 'caregiver') {
      return {ok: false, statusCode: 403, error: 'Only the assigned caregiver can complete check-out.'};
    }
    if (visit.status !== 'ongoing') {
      return {ok: false, statusCode: 409, error: 'Visit must be checked in (ongoing) before check-out.'};
    }

    const serverTimestamp = new Date().toISOString();
    visit.status = input.incompleteReason?.trim() ? 'incomplete' : 'completed';
    visit.checkOutAtIso = serverTimestamp;
    visit.observations = input.observations.trim() || 'Visit completed smoothly.';
    visit.handoverNote = input.handoverNote?.trim() || undefined;
    visit.cancelOrIncompleteReason = input.incompleteReason?.trim() || undefined;
    visit.updatedAtIso = serverTimestamp;

    this.emitAudit(actorFrom(input.actor), 'VISIT_CHECKED_OUT', `${visit.title} -> ${visit.status}`);

    // Notify authorized family coordinators
    const grants = this.getEffectiveConsentGrants();
    for (const grant of grants.filter(
      (g) => g.patientId === visit.patientId && g.memberRole === 'family_member' && isConsentGrantEffective(g),
    )) {
      this.addIdempotentDelivery({
        id: `del-visit-${Date.now()}-${grant.memberId}`,
        idempotencyKey: `visit-completed:${visit.id}:${grant.memberId}`,
        patientId: visit.patientId,
        sourceType: 'visit',
        sourceId: visit.id,
        recipientId: grant.memberId,
        recipientName: grant.memberName,
        recipientEmail: grant.memberEmail,
        channel: 'in_app',
        status: 'sent',
        retryCount: 0,
        title: `Caregiver visit ${visit.status}: ${visit.title}`,
        body: `${visit.caregiverName} checked out at ${new Date(serverTimestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}. Observations: ${visit.observations}`,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      });
    }

    return {ok: true, statusCode: 200, visit: sanitizeVisitForClient(visit)};
  }

  cancelVisit(input: {
    actor: CareActor;
    visitId: string;
    reason: string;
    targetStatus?: 'cancelled' | 'missed';
  }) {
    const visit = this.visits.find((v) => v.id === input.visitId);
    if (!visit) return {ok: false, statusCode: 404, error: 'Visit not found.'};

    const access = canAccessCaregiverVisit(input.actor, visit, this.getEffectiveConsentGrants());
    if (!access.allowed || input.actor.role === 'elderly_patient') {
      return {ok: false, statusCode: 403, error: 'Not authorized to cancel this visit.'};
    }
    if (!input.reason.trim()) {
      return {ok: false, statusCode: 400, error: 'A cancellation reason is required.'};
    }

    const nowIso = new Date().toISOString();
    visit.status = input.targetStatus ?? 'cancelled';
    visit.cancelOrIncompleteReason = input.reason.trim();
    visit.hasActiveVerificationCode = false;
    visit.verificationPinHash = undefined;
    visit.verificationQrHash = undefined;
    visit.updatedAtIso = nowIso;

    this.emitAudit(input.actor, 'VISIT_CANCELLED', `${visit.title}: ${visit.cancelOrIncompleteReason}`);
    return {ok: true, statusCode: 200, visit: sanitizeVisitForClient(visit)};
  }
}

function actorFrom(a: CareActor): CareActor {
  return a;
}

export const defaultCareStore = new CareCoordinationStore();
