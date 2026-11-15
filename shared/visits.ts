import type {CaregiverVisit, ConsentGrant} from '../src/types/aarvi';
import {type CareActor, hasDomainConsent} from './permissions';

export interface ServerCaregiverVisitRecord extends CaregiverVisit {
  verificationPinHash?: string;
  verificationPinSalt?: string;
  verificationQrHash?: string;
}

export function canScheduleCaregiverVisit(
  actor: CareActor,
  patientId: string,
  caregiverId: string,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {allowed: boolean; reason?: string} {
  if (actor.patientId !== patientId) {
    return {allowed: false, reason: 'Cross-patient visit scheduling is forbidden.'};
  }
  if (actor.role === 'caregiver') {
    return {allowed: false, reason: 'Only authorized family coordinators or administrators can schedule visits.'};
  }
  if (actor.role === 'family_member') {
    const consent = hasDomainConsent(grants, actor, patientId, 'appointments', nowMs);
    if (!consent.allowed) {
      return {allowed: false, reason: 'Appointment coordination consent is required to schedule visits.'};
    }
  }

  const caregiverGrant = grants.find(
    (g) => g.patientId === patientId && g.memberId === caregiverId && g.memberRole === 'caregiver',
  );
  if (!caregiverGrant) {
    return {allowed: false, reason: 'Selected caregiver is not authorized for this patient.'};
  }
  if (caregiverGrant.accessStatus === 'revoked' || caregiverGrant.accessStatus === 'expired') {
    return {allowed: false, reason: 'Selected caregiver consent is revoked or expired.'};
  }
  if (caregiverGrant.expiresAtIso && new Date(caregiverGrant.expiresAtIso).getTime() <= nowMs) {
    return {allowed: false, reason: 'Selected caregiver temporary consent has expired.'};
  }

  return {allowed: true};
}

export function canAccessCaregiverVisit(
  actor: CareActor,
  visit: CaregiverVisit,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {allowed: boolean; reason?: string} {
  if (actor.patientId !== visit.patientId) {
    return {allowed: false, reason: 'Cross-patient visit access is forbidden.'};
  }
  if (actor.role === 'elderly_patient') {
    return {allowed: true};
  }
  if (actor.role === 'caregiver') {
    if (visit.caregiverId !== actor.userId && visit.caregiverName !== actor.fullName) {
      return {allowed: false, reason: 'Caregivers can only access visits assigned to them.'};
    }
    const consent = hasDomainConsent(grants, actor, visit.patientId, 'care_notes', nowMs);
    if (!consent.allowed) {
      return {allowed: false, reason: 'Caregiver access has been revoked or expired.'};
    }
    return {allowed: true};
  }
  const consent = hasDomainConsent(grants, actor, visit.patientId, 'appointments', nowMs);
  if (!consent.allowed) {
    return {allowed: false, reason: 'Family member appointment consent is required.'};
  }
  return {allowed: true};
}

export function sanitizeVisitForClient(record: ServerCaregiverVisitRecord): CaregiverVisit {
  const {
    verificationPinHash: _ph,
    verificationPinSalt: _ps,
    verificationQrHash: _qh,
    ...publicVisit
  } = record;
  return publicVisit;
}
