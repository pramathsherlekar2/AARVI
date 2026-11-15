import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCompleteOrCancelTask,
  detectOverdueCareTasks,
  filterTasksForPatient,
} from '../shared/tasks.ts';
import type {CareActor} from '../shared/permissions.ts';
import {CareCoordinationStore, DEFAULT_PATIENT_ID} from '../server/careStore.ts';

const familyCoordinator: CareActor = {
  userId: 'cc-1',
  fullName: 'Ananya Kulkarni',
  email: 'ananya.kulkarni@example.org',
  role: 'family_member',
  patientId: DEFAULT_PATIENT_ID,
  isLegalRepresentative: true,
};

const caregiverActor: CareActor = {
  userId: 'cc-2',
  fullName: 'Priya Nair, RN',
  email: 'priya.nair@example.org',
  role: 'caregiver',
  patientId: DEFAULT_PATIENT_ID,
};

const secondaryFamilyActor: CareActor = {
  userId: 'cc-3',
  fullName: 'Rohan Kulkarni',
  email: 'rohan.kulkarni@example.org',
  role: 'family_member',
  patientId: DEFAULT_PATIENT_ID,
  isLegalRepresentative: false,
};

const patientActor: CareActor = {
  userId: DEFAULT_PATIENT_ID,
  fullName: 'Meera Kulkarni',
  email: 'meera@example.org',
  role: 'elderly_patient',
  patientId: DEFAULT_PATIENT_ID,
};

test('Module 18: task creation, RBAC assignee validation, and operationId deduplication', () => {
  const store = new CareCoordinationStore();

  // Elderly patient cannot create coordination tasks directly
  const patientAttempt = store.createTask({
    actor: patientActor,
    operationId: 'op-patient-fail',
    title: 'Should fail',
    description: 'Not allowed',
    category: 'supplies',
    priority: 'normal',
    assigneeId: 'cc-2',
    dueAtIso: new Date(Date.now() + 3600_000).toISOString(),
  });
  assert.equal(patientAttempt.ok, false);
  assert.equal(patientAttempt.statusCode, 403);

  // Authorized family member creates a task assigned to caregiver
  const created = store.createTask({
    actor: familyCoordinator,
    operationId: 'op-sync-123',
    title: 'Pick up prescription bandages',
    description: '2 boxes sterile gauze',
    category: 'refill',
    priority: 'high',
    assigneeId: 'cc-2',
    dueAtIso: new Date(Date.now() + 3600_000).toISOString(),
    internalNotes: 'Private billing note for coordinator only',
    patientVisibleSummary: 'Pharmacy pickup scheduled',
  });
  assert.equal(created.ok, true);
  assert.equal(created.statusCode, 201);
  assert.ok(created.task);

  // Offline replay with duplicate operationId must deduplicate cleanly
  const replay = store.createTask({
    actor: familyCoordinator,
    operationId: 'op-sync-123',
    title: 'Pick up prescription bandages',
    description: '2 boxes sterile gauze',
    category: 'refill',
    priority: 'high',
    assigneeId: 'cc-2',
    dueAtIso: new Date(Date.now() + 3600_000).toISOString(),
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.deduplicated, true);
  assert.equal(store.tasks.filter((t) => t.operationId === 'op-sync-123').length, 1);
});

test('Module 18: assignee-only completion RBAC, reassignment audit trail, and cross-patient denial', () => {
  const store = new CareCoordinationStore();
  const created = store.createTask({
    actor: familyCoordinator,
    operationId: 'op-rbac-1',
    title: 'Evening physiotherapy check',
    description: '10-minute gentle stretch',
    category: 'wellbeing',
    priority: 'urgent',
    assigneeId: 'cc-2',
    dueAtIso: new Date(Date.now() + 7200_000).toISOString(),
  });
  const task = created.task!;

  // Secondary non-coordinator family member CANNOT complete caregiver's task
  const unauthorizedComplete = store.updateTask({
    actor: secondaryFamilyActor,
    taskId: task.id,
    status: 'completed',
  });
  assert.equal(unauthorizedComplete.ok, false);
  assert.equal(unauthorizedComplete.statusCode, 403);

  // Cross-patient actor CANNOT access or modify
  const crossPatientRes = canCompleteOrCancelTask(
    {...familyCoordinator, patientId: 'pat-other-99'},
    task,
    store.consentGrants,
  );
  assert.equal(crossPatientRes.allowed, false);

  // Reassign to Rohan -> appends assignmentHistory & creates idempotent delivery
  const reassigned = store.updateTask({
    actor: familyCoordinator,
    taskId: task.id,
    reassignToId: 'cc-3',
    reassignNote: 'Priya off duty early',
  });
  assert.equal(reassigned.ok, true);
  assert.equal(reassigned.task?.assignedToId, 'cc-3');
  assert.equal(reassigned.task?.assignmentHistory.length, 2);

  // Now Rohan (as assignee) CAN complete his own assigned task
  const rohanComplete = store.updateTask({
    actor: secondaryFamilyActor,
    taskId: task.id,
    status: 'completed',
  });
  assert.equal(rohanComplete.ok, true);
  assert.equal(rohanComplete.task?.status, 'completed');
});

test('Module 18: overdue detection and patient-safe filtering strip internalNotes', () => {
  const store = new CareCoordinationStore();
  const pastDue = new Date(Date.now() - 60_000).toISOString();
  const futureDue = new Date(Date.now() + 3600_000).toISOString();

  store.createTask({
    actor: familyCoordinator,
    operationId: 'op-overdue-check',
    title: 'Submit lab sample',
    description: 'Fasting sample',
    category: 'medical_reports',
    priority: 'normal',
    assigneeId: 'cc-2',
    dueAtIso: futureDue,
    internalNotes: 'CONFIDENTIAL_FAMILY_NOTE_DO_NOT_SHOW_PATIENT',
    patientVisibleSummary: 'Morning diagnostic follow-up',
  });

  // Simulate time advancing past due date
  const detected = detectOverdueCareTasks(
    store.tasks.map((t) => (t.operationId === 'op-overdue-check' ? {...t, dueAtIso: pastDue} : t)),
    Date.now(),
  );
  const flagged = detected.tasks.find((t) => t.operationId === 'op-overdue-check');
  assert.equal(flagged?.status, 'overdue');

  // Patient view strips internalNotes and uses patientVisibleSummary
  const patientSafe = filterTasksForPatient(store.tasks);
  const serialized = JSON.stringify(patientSafe);
  assert.equal(serialized.includes('CONFIDENTIAL_FAMILY_NOTE_DO_NOT_SHOW_PATIENT'), false);
  assert.equal(serialized.includes('internalNotes'), false);
  assert.ok(patientSafe.some((t) => t.title === 'Morning diagnostic follow-up'));
});
