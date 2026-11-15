import assert from 'node:assert/strict';
import test from 'node:test';
import type {CareActor} from '../shared/permissions.ts';
import {CareCoordinationStore, DEFAULT_PATIENT_ID} from '../server/careStore.ts';

const familyActor: CareActor = {
  userId: 'cc-1',
  fullName: 'Ananya Kulkarni',
  email: 'ananya.kulkarni@example.org',
  role: 'family_member',
  patientId: DEFAULT_PATIENT_ID,
  isLegalRepresentative: true,
};

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

test('Module 20: schedule visit, issue PIN/QR without leaking hashes, verify check-in, reject duplicate, log activities & check out', () => {
  const store = new CareCoordinationStore();
  const startIso = new Date(Date.now() + 900_000).toISOString();
  const endIso = new Date(Date.now() + 7200_000).toISOString();

  // Caregiver cannot self-schedule
  const cgSchedule = store.scheduleVisit({
    actor: caregiverActor,
    operationId: 'op-visit-cg-deny',
    patientId: DEFAULT_PATIENT_ID,
    caregiverId: 'cc-2',
    title: 'Unauthorized shift',
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
  });
  assert.equal(cgSchedule.ok, false);
  assert.equal(cgSchedule.statusCode, 403);

  // Authorized family schedules visit
  const scheduled = store.scheduleVisit({
    actor: familyActor,
    operationId: 'op-visit-test-1',
    patientId: DEFAULT_PATIENT_ID,
    caregiverId: 'cc-2',
    title: 'Afternoon Medication & Meal Support',
    scheduledStartIso: startIso,
    scheduledEndIso: endIso,
  });
  assert.equal(scheduled.ok, true);
  assert.equal(scheduled.statusCode, 201);
  const visitId = scheduled.visit!.id;

  // Patient issues PIN + QR code
  const issued = store.issueVisitVerificationCode({
    actor: patientActor,
    visitId,
    ttlMinutes: 30,
  });
  assert.equal(issued.ok, true);
  assert.match(issued.oneTimePin!, /^\d{6}$/);
  assert.ok(issued.qrPayload!.startsWith(`ARV-VISIT:${visitId}:`));

  // Snapshot MUST sanitize hashes & plaintext secrets
  const snapshot = store.getWorkspaceSnapshot(caregiverActor, DEFAULT_PATIENT_ID);
  assert.equal(snapshot.ok, true);
  const rawVisitJson = JSON.stringify(snapshot.data!.visits);
  assert.equal(rawVisitJson.includes('verificationPinHash'), false);
  assert.equal(rawVisitJson.includes('verificationQrHash'), false);
  assert.equal(rawVisitJson.includes(issued.oneTimePin!), false);

  // Caregiver checks in with QR payload
  const checkedIn = store.checkInVisit({
    actor: caregiverActor,
    visitId,
    method: 'qr',
    code: issued.qrPayload!,
    locationConsentOptIn: true,
    locationNote: 'Indiranagar residence gate',
  });
  assert.equal(checkedIn.ok, true);
  assert.equal(checkedIn.visit?.status, 'ongoing');
  assert.ok(checkedIn.visit?.checkInAtIso);
  assert.equal(checkedIn.visit?.checkInMethod, 'qr');

  // Duplicate check-in must be rejected (409)
  const dupCheckIn = store.checkInVisit({
    actor: caregiverActor,
    visitId,
    method: 'pin',
    code: issued.oneTimePin!,
  });
  assert.equal(dupCheckIn.ok, false);
  assert.equal(dupCheckIn.statusCode, 409);

  // Log activity during ongoing visit
  const act = store.addVisitActivity({
    actor: caregiverActor,
    visitId,
    activityType: 'meal',
    note: 'Warm vegetable soup and afternoon fluids completed.',
  });
  assert.equal(act.ok, true);
  assert.equal(act.visit?.activities.length, 1);

  // Check out & notify family
  const checkedOut = store.checkOutVisit({
    actor: caregiverActor,
    visitId,
    observations: 'Alert and comfortable throughout afternoon visit.',
    handoverNote: 'Ready for evening dinner medicine.',
  });
  assert.equal(checkedOut.ok, true);
  assert.equal(checkedOut.visit?.status, 'completed');
  assert.ok(checkedOut.visit?.checkOutAtIso);
  assert.ok(
    store.deliveries.some((d) => d.sourceType === 'visit' && d.sourceId === visitId && d.recipientId === 'cc-1'),
  );
});

test('Module 20: wrong PIN lockout after 5 attempts (429), expired code rejection (410), and cancellation reason validation', () => {
  const store = new CareCoordinationStore();
  const visitId = 'visit-seed-upcoming';

  const issued = store.issueVisitVerificationCode({
    actor: patientActor,
    visitId,
    ttlMinutes: 15,
  });
  assert.equal(issued.ok, true);

  // Expired timestamp simulation -> 410
  const expiredAttempt = store.checkInVisit({
    actor: caregiverActor,
    visitId,
    method: 'pin',
    code: issued.oneTimePin!,
    nowIso: new Date(Date.now() + 2 * 3600_000).toISOString(),
  });
  assert.equal(expiredAttempt.ok, false);
  assert.equal(expiredAttempt.statusCode, 410);

  // 5 consecutive wrong PIN attempts -> locked (429)
  for (let i = 1; i <= 5; i += 1) {
    const res = store.checkInVisit({
      actor: caregiverActor,
      visitId,
      method: 'pin',
      code: '000000',
    });
    assert.equal(res.ok, false);
    assert.equal(res.statusCode, i === 5 ? 429 : 401);
  }

  // Even the valid PIN is rejected while locked
  const lockedRes = store.checkInVisit({
    actor: caregiverActor,
    visitId,
    method: 'pin',
    code: issued.oneTimePin!,
  });
  assert.equal(lockedRes.ok, false);
  assert.equal(lockedRes.statusCode, 429);

  // Cancellation requires non-empty reason
  const missingReason = store.cancelVisit({
    actor: familyActor,
    visitId,
    reason: '   ',
  });
  assert.equal(missingReason.ok, false);
  assert.equal(missingReason.statusCode, 400);

  const cancelled = store.cancelVisit({
    actor: familyActor,
    visitId,
    reason: 'Family visiting in person today',
  });
  assert.equal(cancelled.ok, true);
  assert.equal(cancelled.visit?.status, 'cancelled');
});
