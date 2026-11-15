import assert from 'node:assert/strict';
import type {AddressInfo} from 'node:net';
import test from 'node:test';
import {createAarviExpressApp} from '../server.ts';
import {CareCoordinationStore, DEFAULT_PATIENT_ID} from '../server/careStore.ts';

async function withTestServer(fn: (baseUrl: string) => Promise<void>) {
  const store = new CareCoordinationStore();
  const app = createAarviExpressApp(store);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

const FAMILY_HEADERS = {
  'Content-Type': 'application/json',
  'x-aarvi-actor-id': 'cc-1',
  'x-aarvi-actor-role': 'family_member',
  'x-aarvi-actor-name': 'Ananya Kulkarni',
  'x-aarvi-actor-email': 'ananya.kulkarni@example.org',
  'x-aarvi-patient-id': DEFAULT_PATIENT_ID,
};

const PATIENT_HEADERS = {
  'Content-Type': 'application/json',
  'x-aarvi-actor-id': DEFAULT_PATIENT_ID,
  'x-aarvi-actor-role': 'elderly_patient',
  'x-aarvi-actor-name': 'Meera Kulkarni',
  'x-aarvi-actor-email': 'meera@example.org',
  'x-aarvi-patient-id': DEFAULT_PATIENT_ID,
};

const CAREGIVER_HEADERS = {
  'Content-Type': 'application/json',
  'x-aarvi-actor-id': 'cc-2',
  'x-aarvi-actor-role': 'caregiver',
  'x-aarvi-actor-name': 'Priya Nair, RN',
  'x-aarvi-actor-email': 'priya.nair@example.org',
  'x-aarvi-patient-id': DEFAULT_PATIENT_ID,
};

test('HTTP API integration: authentication guard, cross-patient 403, and honest capabilities/email status', async () => {
  await withTestServer(async (baseUrl) => {
    // Unauthenticated call -> 401
    const unauth = await fetch(`${baseUrl}/api/care/coordination`);
    assert.equal(unauth.status, 401);

    // Cross-patient request -> 403
    const cross = await fetch(`${baseUrl}/api/care/coordination?patientId=pat-other-99`, {
      headers: FAMILY_HEADERS,
    });
    assert.equal(cross.status, 403);

    // Capabilities endpoint never exposes secret values
    const capsRes = await fetch(`${baseUrl}/api/system/capabilities`);
    assert.equal(capsRes.status, 200);
    const capsText = await capsRes.text();
    assert.equal(capsText.includes('AIza'), false);
    assert.equal(capsText.includes('re_'), false);

    // Email endpoint honestly reports 503 when RESEND_API_KEY is absent
    if (!process.env.RESEND_API_KEY) {
      const emailRes = await fetch(`${baseUrl}/api/notifications/email`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          to: 'test@example.org',
          subject: 'Test',
          text: 'Test body',
        }),
      });
      assert.equal(emailRes.status, 503);
      const emailJson = (await emailRes.json()) as {delivered: boolean; provider: string};
      assert.equal(emailJson.delivered, false);
      assert.equal(emailJson.provider, 'none');
    }
  });
});

test('HTTP API integration: end-to-end tasks, consent revocation, escalation evaluation, and PIN visit verification', async () => {
  await withTestServer(async (baseUrl) => {
    // 1. Create a care task with idempotency operationId
    const taskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: FAMILY_HEADERS,
      body: JSON.stringify({
        operationId: 'http-op-task-1',
        title: 'Refill Metformin tablets',
        description: 'Collect 30-day supply',
        category: 'refill',
        priority: 'high',
        assigneeId: 'cc-2',
        dueAtIso: new Date(Date.now() + 7200_000).toISOString(),
        internalNotes: 'HIDDEN_FROM_PATIENT',
        patientVisibleSummary: 'Pharmacy pickup scheduled',
      }),
    });
    assert.equal(taskRes.status, 201);

    // Duplicate offline replay returns 200 deduplicated
    const dupTaskRes = await fetch(`${baseUrl}/api/tasks`, {
      method: 'POST',
      headers: FAMILY_HEADERS,
      body: JSON.stringify({
        operationId: 'http-op-task-1',
        title: 'Refill Metformin tablets',
        category: 'refill',
        priority: 'high',
        assigneeId: 'cc-2',
        dueAtIso: new Date(Date.now() + 7200_000).toISOString(),
      }),
    });
    assert.equal(dupTaskRes.status, 200);

    // Patient coordination view must NOT contain internalNotes
    const patientSnap = await fetch(`${baseUrl}/api/care/coordination`, {headers: PATIENT_HEADERS});
    assert.equal(patientSnap.status, 200);
    const patientJson = await patientSnap.text();
    assert.equal(patientJson.includes('HIDDEN_FROM_PATIENT'), false);

    // 2. Caregiver cannot self-grant consent (403)
    const cgConsent = await fetch(`${baseUrl}/api/consent/grant`, {
      method: 'POST',
      headers: CAREGIVER_HEADERS,
      body: JSON.stringify({
        memberId: 'cc-2',
        permissions: {
          medications: true,
          appointments: true,
          medical_documents: true,
          care_notes: true,
          wellbeing: true,
          activity_history: true,
        },
        reason: 'Self elevate',
      }),
    });
    assert.equal(cgConsent.status, 403);

    // 3. Issue PIN for upcoming seed visit & verify check-in + duplicate rejection
    const issueRes = await fetch(`${baseUrl}/api/visits/visit-seed-upcoming/issue-code`, {
      method: 'POST',
      headers: PATIENT_HEADERS,
      body: JSON.stringify({ttlMinutes: 30}),
    });
    assert.equal(issueRes.status, 200);
    const issuedJson = (await issueRes.json()) as {oneTimePin: string};
    assert.match(issuedJson.oneTimePin, /^\d{6}$/);

    // Verify GET snapshot never leaks PIN
    const cgSnap = await fetch(`${baseUrl}/api/care/coordination`, {headers: CAREGIVER_HEADERS});
    const cgSnapText = await cgSnap.text();
    assert.equal(cgSnapText.includes(issuedJson.oneTimePin), false);
    assert.equal(cgSnapText.includes('verificationPinHash'), false);

    // Caregiver check-in with valid PIN -> 200
    const checkInRes = await fetch(`${baseUrl}/api/visits/visit-seed-upcoming/check-in`, {
      method: 'POST',
      headers: CAREGIVER_HEADERS,
      body: JSON.stringify({method: 'pin', code: issuedJson.oneTimePin}),
    });
    assert.equal(checkInRes.status, 200);

    // Duplicate check-in -> 409
    const dupCheckInRes = await fetch(`${baseUrl}/api/visits/visit-seed-upcoming/check-in`, {
      method: 'POST',
      headers: CAREGIVER_HEADERS,
      body: JSON.stringify({method: 'pin', code: issuedJson.oneTimePin}),
    });
    assert.equal(dupCheckInRes.status, 409);

    // 4. Escalation evaluate & acknowledge
    const escRes = await fetch(`${baseUrl}/api/escalation/evaluate`, {
      method: 'POST',
      headers: FAMILY_HEADERS,
      body: JSON.stringify({
        nowMinutes: 600,
        doseDate: '2026-11-15',
        medications: [
          {
            id: 'med-http-1',
            name: 'Metformin',
            dosage: '500 mg',
            scheduleLabel: 'Morning',
            scheduledTime: '08:00 AM',
            scheduledMinutes24h: 480,
            gracePeriodMinutes: 30,
            instructions: 'With breakfast',
            status: 'pending',
            stockCount: 15,
            lowStockThreshold: 5,
            dosesPerDay: 1,
            prescribedBy: 'Dr. Deshmukh',
          },
        ],
      }),
    });
    assert.equal(escRes.status, 200);
    const escJson = (await escRes.json()) as {events: Array<{id: string; stage: number}>};
    assert.equal(escJson.events.length, 1);
    assert.equal(escJson.events[0].stage, 3);

    const ackRes = await fetch(`${baseUrl}/api/escalation/${escJson.events[0].id}/acknowledge`, {
      method: 'POST',
      headers: FAMILY_HEADERS,
      body: JSON.stringify({resolve: true, resolutionMethod: 'family_acknowledged_resolved'}),
    });
    assert.equal(ackRes.status, 200);
  });
});
