import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgeEscalationEvent,
  classifyDoseState,
  determineTargetStage,
  evaluateCareEscalations,
  isWithinQuietHours,
} from '../shared/escalation.ts';
import {CareCoordinationStore, DEFAULT_PATIENT_ID, DEFAULT_PATIENT_NAME} from '../server/careStore.ts';
import type {ConsentGrant, EscalationConfig, MedicationItem} from '../src/types/aarvi.ts';

function makeMed(overrides: Partial<MedicationItem> = {}): MedicationItem {
  return {
    id: 'med-test-1',
    name: 'Amlodipine',
    dosage: '5 mg',
    timeSlot: 'Morning',
    scheduledTime: '08:00 AM',
    scheduledMinutes24h: 8 * 60,
    gracePeriodMinutes: 30,
    instructions: 'After breakfast',
    purpose: 'Blood pressure maintenance',
    remainingUnits: 20,
    unitsPerDose: 1,
    dosesPerDay: 1,
    refillThresholdDays: 5,
    refillDaysRemaining: 20,
    status: 'pending',
    ...overrides,
  };
}

function makeConfig(overrides: Partial<EscalationConfig> = {}): EscalationConfig {
  return {
    patientId: DEFAULT_PATIENT_ID,
    gracePeriodMinutes: 30,
    stage1ToStage2Minutes: 20,
    stage2ToStage3Minutes: 30,
    escalationOrder: ['patient', 'caregiver', 'family'],
    assignedCaregiverId: 'cc-2',
    assignedCaregiverName: 'Priya Nair, RN',
    authorizedFamilyIds: ['cc-1'],
    channels: {inApp: true, email: true, push: false},
    quietHoursEnabled: true,
    quietStartHour24: 22,
    quietEndHour24: 7,
    updatedAt: '2026-11-15T08:00:00.000Z',
    updatedBy: 'Ananya Kulkarni',
    ...overrides,
  };
}

test('classifyDoseState distinguishes pending, unconfirmed, late_confirmed, skipped, and missed', () => {
  const medPending = makeMed({scheduledMinutes24h: 480, gracePeriodMinutes: 30, status: 'pending'});
  assert.equal(classifyDoseState(medPending, 500), 'pending');
  assert.equal(classifyDoseState(medPending, 510), 'pending'); // boundary within grace
  assert.equal(classifyDoseState(medPending, 511), 'unconfirmed'); // past grace, never auto-missed

  const medLateTaken = makeMed({status: 'taken', isLateConfirmation: true});
  assert.equal(classifyDoseState(medLateTaken, 600), 'late_confirmed');

  const medSkipped = makeMed({status: 'skipped'});
  assert.equal(classifyDoseState(medSkipped, 600), 'skipped');

  const medMissed = makeMed({status: 'missed'});
  assert.equal(classifyDoseState(medMissed, 600), 'missed');
});

test('determineTargetStage computes sequential stages based on configurable windows', () => {
  const cfg = makeConfig({gracePeriodMinutes: 30, stage1ToStage2Minutes: 20, stage2ToStage3Minutes: 30});
  assert.equal(determineTargetStage(25, cfg), 0); // within grace
  assert.equal(determineTargetStage(35, cfg), 1); // Stage 1 reminder
  assert.equal(determineTargetStage(50, cfg), 2); // Stage 2 caregiver alert (30 + 20)
  assert.equal(determineTargetStage(85, cfg), 3); // Stage 3 family alert (30 + 20 + 30)
});

test('isWithinQuietHours handles overnight windows correctly', () => {
  const cfg = makeConfig({quietHoursEnabled: true, quietStartHour24: 22, quietEndHour24: 7});
  assert.equal(isWithinQuietHours(23, cfg), true);
  assert.equal(isWithinQuietHours(2, cfg), true);
  assert.equal(isWithinQuietHours(7, cfg), false);
  assert.equal(isWithinQuietHours(14, cfg), false);
});

test('evaluateCareEscalations advances stages sequentially, enforces idempotency & consent, and stops at Stage 4 resolution', () => {
  const store = new CareCoordinationStore();
  const med = makeMed({scheduledMinutes24h: 8 * 60});
  const baseConfig = makeConfig();

  // Stage 1 at 08:40 (elapsed 40m > 30m grace)
  const stage1Out = evaluateCareEscalations({
    patientId: DEFAULT_PATIENT_ID,
    patientName: DEFAULT_PATIENT_NAME,
    doseDate: '2026-11-15',
    nowMinutes: 8 * 60 + 40,
    nowIso: '2026-11-15T08:40:00.000Z',
    medications: [med],
    config: baseConfig,
    existingEvents: [],
    existingDeliveries: [],
    consentGrants: store.consentGrants,
    membersDirectory: [
      {id: 'cc-1', name: 'Ananya Kulkarni', email: 'ananya.kulkarni@example.org', role: 'family_member'},
      {id: 'cc-2', name: 'Priya Nair, RN', email: 'priya.nair@example.org', role: 'caregiver'},
    ],
  });

  assert.equal(stage1Out.newEscalationsCreated, 1);
  assert.equal(stage1Out.events[0].stage, 1);
  assert.equal(stage1Out.events[0].status, 'stage_1_patient_reminder');
  assert.equal(stage1Out.newDeliveries.length, 1);

  // Re-evaluating at same minute must produce ZERO duplicate deliveries
  const dupOut = evaluateCareEscalations({
    patientId: DEFAULT_PATIENT_ID,
    patientName: DEFAULT_PATIENT_NAME,
    doseDate: '2026-11-15',
    nowMinutes: 8 * 60 + 40,
    nowIso: '2026-11-15T08:40:00.000Z',
    medications: [med],
    config: baseConfig,
    existingEvents: stage1Out.events,
    existingDeliveries: stage1Out.newDeliveries,
    consentGrants: store.consentGrants,
    membersDirectory: [
      {id: 'cc-1', name: 'Ananya Kulkarni', email: 'ananya.kulkarni@example.org', role: 'family_member'},
      {id: 'cc-2', name: 'Priya Nair, RN', email: 'priya.nair@example.org', role: 'caregiver'},
    ],
  });
  assert.equal(dupOut.newDeliveries.length, 0);

  // Stage 2 at 08:55 (elapsed 55m >= 30 + 20)
  const stage2Out = evaluateCareEscalations({
    patientId: DEFAULT_PATIENT_ID,
    patientName: DEFAULT_PATIENT_NAME,
    doseDate: '2026-11-15',
    nowMinutes: 8 * 60 + 55,
    nowIso: '2026-11-15T08:55:00.000Z',
    medications: [med],
    config: baseConfig,
    existingEvents: stage1Out.events,
    existingDeliveries: stage1Out.newDeliveries,
    consentGrants: store.consentGrants,
    membersDirectory: [
      {id: 'cc-1', name: 'Ananya Kulkarni', email: 'ananya.kulkarni@example.org', role: 'family_member'},
      {id: 'cc-2', name: 'Priya Nair, RN', email: 'priya.nair@example.org', role: 'caregiver'},
    ],
  });
  assert.equal(stage2Out.events[0].stage, 2);
  assert.equal(stage2Out.events[0].status, 'stage_2_caregiver_alert');
  assert.ok(stage2Out.newDeliveries.some((d) => d.recipientId === 'cc-2' && d.channel === 'in_app'));
  assert.ok(stage2Out.newDeliveries.some((d) => d.recipientId === 'cc-2' && d.channel === 'email'));

  // Resolve at Stage 4 -> subsequent evaluation at 10:00 must NOT re-escalate to Stage 3
  const ackRes = acknowledgeEscalationEvent({
    events: stage2Out.events,
    eventId: stage2Out.events[0].id,
    actorId: 'cc-2',
    actorName: 'Priya Nair, RN',
    actorRole: 'caregiver',
    resolve: true,
    resolutionMethod: 'caregiver_confirmed_taken',
    nowIso: '2026-11-15T09:00:00.000Z',
  });
  assert.equal(ackRes.ok, true);
  assert.equal(ackRes.events[0].stage, 4);
  assert.equal(ackRes.events[0].status, 'resolved');

  const afterResolvedOut = evaluateCareEscalations({
    patientId: DEFAULT_PATIENT_ID,
    patientName: DEFAULT_PATIENT_NAME,
    doseDate: '2026-11-15',
    nowMinutes: 10 * 60,
    nowIso: '2026-11-15T10:00:00.000Z',
    medications: [med],
    config: baseConfig,
    existingEvents: ackRes.events,
    existingDeliveries: [...stage1Out.newDeliveries, ...stage2Out.newDeliveries],
    consentGrants: store.consentGrants,
    membersDirectory: [
      {id: 'cc-1', name: 'Ananya Kulkarni', email: 'ananya.kulkarni@example.org', role: 'family_member'},
      {id: 'cc-2', name: 'Priya Nair, RN', email: 'priya.nair@example.org', role: 'caregiver'},
    ],
  });
  assert.equal(afterResolvedOut.newDeliveries.length, 0);
  assert.equal(afterResolvedOut.events[0].status, 'resolved');
});

test('evaluateCareEscalations skips family Stage 3 notification if medication consent is revoked', () => {
  const store = new CareCoordinationStore();
  const revokedGrants: ConsentGrant[] = store.consentGrants.map((g) =>
    g.memberId === 'cc-1' ? {...g, accessStatus: 'revoked', permissions: {...g.permissions, medications: false}} : g,
  );
  const med = makeMed({scheduledMinutes24h: 8 * 60});
  const out = evaluateCareEscalations({
    patientId: DEFAULT_PATIENT_ID,
    patientName: DEFAULT_PATIENT_NAME,
    doseDate: '2026-11-15',
    nowMinutes: 10 * 60,
    nowIso: '2026-11-15T10:00:00.000Z',
    medications: [med],
    config: makeConfig(),
    existingEvents: [],
    existingDeliveries: [],
    consentGrants: revokedGrants,
    membersDirectory: [
      {id: 'cc-1', name: 'Ananya Kulkarni', email: 'ananya.kulkarni@example.org', role: 'family_member'},
      {id: 'cc-2', name: 'Priya Nair, RN', email: 'priya.nair@example.org', role: 'caregiver'},
    ],
  });

  // Family member cc-1 must NOT receive any delivery
  assert.equal(out.newDeliveries.some((d) => d.recipientId === 'cc-1'), false);
  // Caregiver cc-2 still gets Stage 2
  assert.equal(out.newDeliveries.some((d) => d.recipientId === 'cc-2'), true);
});
