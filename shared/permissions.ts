import type {
  ConsentAccessStatus,
  ConsentDomain,
  ConsentDomainPermissions,
  ConsentGrant,
  ConsentHistoryEntry,
  UserRole,
} from '../src/types/aarvi';

export interface CareActor {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
  patientId: string;
  isLegalRepresentative?: boolean;
}

export const ALL_CONSENT_DOMAINS: ConsentDomain[] = [
  'medications',
  'appointments',
  'medical_documents',
  'care_notes',
  'wellbeing',
  'activity_history',
];

export const EMPTY_PERMISSIONS: ConsentDomainPermissions = {
  medications: false,
  appointments: false,
  medical_documents: false,
  care_notes: false,
  wellbeing: false,
  activity_history: false,
};

export function resolveEffectiveGrantStatus(
  grant: ConsentGrant,
  nowMs: number = Date.now(),
): ConsentAccessStatus {
  if (grant.accessStatus === 'revoked') return 'revoked';
  if (grant.expiresAtIso) {
    const expMs = new Date(grant.expiresAtIso).getTime();
    if (!Number.isNaN(expMs) && expMs <= nowMs) {
      return 'expired';
    }
    return 'temporary';
  }
  return grant.accessStatus === 'expired' ? 'expired' : 'active';
}

export function isConsentGrantEffective(grant: ConsentGrant, nowMs: number = Date.now()): boolean {
  const effective = resolveEffectiveGrantStatus(grant, nowMs);
  return effective === 'active' || effective === 'temporary';
}

export function findMemberGrant(
  grants: ConsentGrant[],
  actor: Pick<CareActor, 'userId' | 'email' | 'patientId'>,
  targetPatientId: string,
): ConsentGrant | undefined {
  if (actor.patientId !== targetPatientId) return undefined;
  const emailLower = actor.email.trim().toLowerCase();
  return grants.find(
    (g) =>
      g.patientId === targetPatientId &&
      (g.memberId === actor.userId || g.memberEmail.trim().toLowerCase() === emailLower),
  );
}

export function canManagePatientConsent(
  actor: CareActor,
  targetPatientId: string,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {allowed: boolean; reason?: string} {
  if (actor.patientId !== targetPatientId) {
    return {allowed: false, reason: 'Cross-patient consent access is forbidden.'};
  }
  if (actor.role === 'caregiver') {
    return {allowed: false, reason: 'Caregivers cannot grant or modify their own or others consent permissions.'};
  }
  if (actor.role === 'elderly_patient') {
    return {allowed: true};
  }
  // Family member must be an active legal representative / authorized representative
  if (actor.isLegalRepresentative) {
    return {allowed: true};
  }
  const grant = findMemberGrant(grants, actor, targetPatientId);
  if (grant && grant.isLegalRepresentative && isConsentGrantEffective(grant, nowMs)) {
    return {allowed: true};
  }
  return {
    allowed: false,
    reason: 'Only the patient or a legally authorized family representative can manage consent.',
  };
}

export function hasDomainConsent(
  grants: ConsentGrant[],
  actor: CareActor,
  targetPatientId: string,
  domain: ConsentDomain,
  nowMs: number = Date.now(),
): {allowed: boolean; status: ConsentAccessStatus | 'patient_self' | 'cross_patient_denied' | 'no_grant'} {
  if (actor.patientId !== targetPatientId) {
    return {allowed: false, status: 'cross_patient_denied'};
  }
  if (actor.role === 'elderly_patient') {
    return {allowed: true, status: 'patient_self'};
  }
  const grant = findMemberGrant(grants, actor, targetPatientId);
  if (!grant) {
    return {allowed: false, status: 'no_grant'};
  }
  const effectiveStatus = resolveEffectiveGrantStatus(grant, nowMs);
  if (effectiveStatus === 'revoked' || effectiveStatus === 'expired') {
    return {allowed: false, status: effectiveStatus};
  }
  return {
    allowed: Boolean(grant.permissions[domain]),
    status: effectiveStatus,
  };
}

export function applyConsentGrantUpdate(input: {
  grants: ConsentGrant[];
  history: ConsentHistoryEntry[];
  actor: CareActor;
  targetPatientId: string;
  targetMemberId: string;
  nextPermissions: ConsentDomainPermissions;
  expiresAtIso?: string | null;
  reason: string;
  nowIso?: string;
}): {
  ok: boolean;
  statusCode: number;
  error?: string;
  grants: ConsentGrant[];
  history: ConsentHistoryEntry[];
  updatedGrant?: ConsentGrant;
} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  const authCheck = canManagePatientConsent(input.actor, input.targetPatientId, input.grants, nowMs);
  if (!authCheck.allowed) {
    return {
      ok: false,
      statusCode: 403,
      error: authCheck.reason,
      grants: input.grants,
      history: input.history,
    };
  }

  // Explicitly forbid anyone (even representatives if matching memberId) from caregiver self-grant
  const targetGrant = input.grants.find(
    (g) => g.patientId === input.targetPatientId && g.memberId === input.targetMemberId,
  );
  if (!targetGrant) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Care circle member consent record not found for this patient.',
      grants: input.grants,
      history: input.history,
    };
  }

  if (input.actor.userId === targetGrant.memberId && targetGrant.memberRole === 'caregiver') {
    return {
      ok: false,
      statusCode: 403,
      error: 'Caregivers are prohibited from granting themselves access.',
      grants: input.grants,
      history: input.history,
    };
  }

  if (input.expiresAtIso) {
    const expMs = new Date(input.expiresAtIso).getTime();
    if (Number.isNaN(expMs) || expMs <= nowMs) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Temporary access expiry must be a valid future timestamp.',
        grants: input.grants,
        history: input.history,
      };
    }
  }

  const nextStatus: ConsentAccessStatus = input.expiresAtIso ? 'temporary' : 'active';
  const updatedGrant: ConsentGrant = {
    ...targetGrant,
    accessStatus: nextStatus,
    permissions: {...input.nextPermissions},
    expiresAtIso: input.expiresAtIso ?? null,
    grantedById: input.actor.userId,
    grantedByName: input.actor.fullName,
    updatedAtIso: nowIso,
    reason: input.reason.trim() || 'Consent updated by authorized reviewer',
  };

  const historyEntry: ConsentHistoryEntry = {
    id: `ch-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    patientId: input.targetPatientId,
    grantId: targetGrant.id,
    memberId: targetGrant.memberId,
    memberName: targetGrant.memberName,
    actorId: input.actor.userId,
    actorName: input.actor.fullName,
    actorRole: input.actor.role,
    action: targetGrant.accessStatus === 'revoked' ? 'granted' : 'updated',
    previousPermissions: {...targetGrant.permissions},
    nextPermissions: {...input.nextPermissions},
    expiresAtIso: input.expiresAtIso ?? null,
    reason: updatedGrant.reason ?? 'Consent updated',
    timestampIso: nowIso,
  };

  return {
    ok: true,
    statusCode: 200,
    grants: input.grants.map((g) => (g.id === updatedGrant.id ? updatedGrant : g)),
    history: [historyEntry, ...input.history],
    updatedGrant,
  };
}

export function revokeConsentGrant(input: {
  grants: ConsentGrant[];
  history: ConsentHistoryEntry[];
  actor: CareActor;
  targetPatientId: string;
  targetMemberId: string;
  reason: string;
  nowIso?: string;
}): {
  ok: boolean;
  statusCode: number;
  error?: string;
  grants: ConsentGrant[];
  history: ConsentHistoryEntry[];
  updatedGrant?: ConsentGrant;
} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  const authCheck = canManagePatientConsent(input.actor, input.targetPatientId, input.grants, nowMs);
  if (!authCheck.allowed) {
    return {
      ok: false,
      statusCode: 403,
      error: authCheck.reason,
      grants: input.grants,
      history: input.history,
    };
  }

  const targetGrant = input.grants.find(
    (g) => g.patientId === input.targetPatientId && g.memberId === input.targetMemberId,
  );
  if (!targetGrant) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Care circle member consent record not found.',
      grants: input.grants,
      history: input.history,
    };
  }

  const revokedGrant: ConsentGrant = {
    ...targetGrant,
    accessStatus: 'revoked',
    permissions: {...EMPTY_PERMISSIONS},
    expiresAtIso: null,
    grantedById: input.actor.userId,
    grantedByName: input.actor.fullName,
    updatedAtIso: nowIso,
    reason: input.reason.trim() || 'Access revoked by patient/representative',
  };

  const historyEntry: ConsentHistoryEntry = {
    id: `ch-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
    patientId: input.targetPatientId,
    grantId: targetGrant.id,
    memberId: targetGrant.memberId,
    memberName: targetGrant.memberName,
    actorId: input.actor.userId,
    actorName: input.actor.fullName,
    actorRole: input.actor.role,
    action: 'revoked',
    previousPermissions: {...targetGrant.permissions},
    nextPermissions: {...EMPTY_PERMISSIONS},
    expiresAtIso: null,
    reason: revokedGrant.reason ?? 'Access revoked',
    timestampIso: nowIso,
  };

  return {
    ok: true,
    statusCode: 200,
    grants: input.grants.map((g) => (g.id === revokedGrant.id ? revokedGrant : g)),
    history: [historyEntry, ...input.history],
    updatedGrant: revokedGrant,
  };
}
