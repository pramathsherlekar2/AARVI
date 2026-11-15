import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyConsentGrantUpdate,
  type CareActor,
  canManagePatientConsent,
  hasDomainConsent,
  resolveEffectiveGrantStatus,
  revokeConsentGrant,
} from '../shared/permissions.ts';
import {CareCoordinationStore, DEFAULT_PATIENT_ID} from '../server/careStore.ts';

const patientActor: CareActor = {
  userId: DEFAULT_PATIENT_ID,
  fullName: 'Meera Kulkarni',
  email: 'meera@example.org',
  role: 'elderly_patient',
  patientId: DEFAULT_PATIENT_ID,
};

const caregiverActor: CareActor = {
  userId: 'cc-2',
  fullName: 'Priya Nair, RN',
  email: 'priya.nair@example.org',
  role: 'caregiver',
  patientId: DEFAULT_PATIENT_ID,
};

const nonRepFamily: CareActor = {
  userId: 'cc-3',
  fullName: 'Rohan Kulkarni',
  email: 'rohan.kulkarni@example.org',
  role: 'family_member',
  patientId: DEFAULT_PATIENT_ID,
  isLegalRepresentative: false,
};

test('Module 19: patient & legal rep consent management, caregiver self-grant rejection, and cross-patient denial', () => {
  const store = new CareCoordinationStore();

  // Caregiver CANNOT grant or alter permissions (403)
  const caregiverAttempt = store.grantOrUpdateConsent({
    actor: caregiverActor,
    targetPatientId: DEFAULT_PATIENT_ID,
    targetMemberId: 'cc-2',
    permissions: {
      medications: true,
      appointments: true,
      medical_documents: true,
      care_notes: true,
      wellbeing: true,
      activity_history: true,
    },
    reason: 'Self grant attempt',
  });
  assert.equal(caregiverAttempt.ok, false);
  assert.equal(caregiverAttempt.statusCode, 403);

  // Non-representative family member CANNOT manage consent
  assert.equal(
    canManagePatientConsent(nonRepFamily, DEFAULT_PATIENT_ID, store.consentGrants).allowed,
    false,
  );

  // Cross-patient consent update MUST be denied
  const crossPatient = applyConsentGrantUpdate({
    grants: store.consentGrants,
    history: store.consentHistory,
    actor: {...patientActor, patientId: 'pat-other-2'},
    targetPatientId: DEFAULT_PATIENT_ID,
    targetMemberId: 'cc-2',
    nextPermissions: {
      medications: false,
      appointments: false,
      medical_documents: false,
      care_notes: false,
      wellbeing: false,
      activity_history: false,
    },
    reason: 'Cross patient attempt',
  });
  assert.equal(crossPatient.ok, false);
  assert.equal(crossPatient.statusCode, 403);
});

test('Module 19: granular domain checks, revocation, temporary expiry, and immutable consentHistory', () => {
  const store = new CareCoordinationStore();

  // Initially Priya has medications=true, medical_documents=false
  assert.equal(
    hasDomainConsent(store.consentGrants, caregiverActor, DEFAULT_PATIENT_ID, 'medications').allowed,
    true,
  );
  assert.equal(
    hasDomainConsent(store.consentGrants, caregiverActor, DEFAULT_PATIENT_ID, 'medical_documents').allowed,
    false,
  );

  // Patient grants temporary 1-hour medical_documents access to Priya
  const futureExpiry = new Date(Date.now() + 3600_000).toISOString();
  const updated = applyConsentGrantUpdate({
    grants: store.consentGrants,
    history: store.consentHistory,
    actor: patientActor,
    targetPatientId: DEFAULT_PATIENT_ID,
    targetMemberId: 'cc-2',
    nextPermissions: {
      medications: true,
      appointments: false,
      medical_documents: true,
      care_notes: true,
      wellbeing: true,
      activity_history: true,
    },
    expiresAtIso: futureExpiry,
    reason: 'Temporary clinic folder review',
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.updatedGrant?.accessStatus, 'temporary');
  assert.equal(updated.history.length, store.consentHistory.length + 1);

  // Before expiry -> allowed; after expiry -> automatically blocked!
  const beforeExpMs = Date.now() + 60_000;
  const afterExpMs = Date.now() + 2 * 3600_000;
  assert.equal(
    hasDomainConsent(updated.grants, caregiverActor, DEFAULT_PATIENT_ID, 'medical_documents', beforeExpMs).allowed,
    true,
  );
  assert.equal(
    hasDomainConsent(updated.grants, caregiverActor, DEFAULT_PATIENT_ID, 'medical_documents', afterExpMs).allowed,
    false,
  );
  assert.equal(resolveEffectiveGrantStatus(updated.updatedGrant!, afterExpMs), 'expired');

  // Patient revokes Priya completely -> status='revoked', all permissions false, history appended
  const revoked = revokeConsentGrant({
    grants: updated.grants,
    history: updated.history,
    actor: patientActor,
    targetPatientId: DEFAULT_PATIENT_ID,
    targetMemberId: 'cc-2',
    reason: 'Shift ended',
  });
  assert.equal(revoked.ok, true);
  assert.equal(revoked.updatedGrant?.accessStatus, 'revoked');
  assert.equal(
    hasDomainConsent(revoked.grants, caregiverActor, DEFAULT_PATIENT_ID, 'medications').allowed,
    false,
  );
  assert.equal(revoked.history[0].action, 'revoked');
  assert.equal(revoked.history.length, updated.history.length + 1);
});
