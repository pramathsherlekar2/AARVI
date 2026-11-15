import type {
  ConsentGrant,
  DoseStatus,
  EscalationConfig,
  EscalationEvent,
  EscalationResolutionMethod,
  EscalationStage,
  MedicationItem,
  NotificationDeliveryRecord,
  UserRole,
} from '../src/types/aarvi';
import {isConsentGrantEffective} from './permissions';

export function classifyDoseState(med: MedicationItem, nowMinutes: number, configGrace?: number): DoseStatus {
  if (med.status === 'taken') {
    return med.isLateConfirmation ? 'late_confirmed' : 'taken';
  }
  if (med.status === 'late_confirmed' || med.status === 'skipped' || med.status === 'missed') {
    return med.status;
  }
  const grace = configGrace ?? med.gracePeriodMinutes;
  if (nowMinutes > med.scheduledMinutes24h + grace) {
    return 'unconfirmed';
  }
  return 'pending';
}

export function isWithinQuietHours(hour24: number, config: EscalationConfig): boolean {
  if (!config.quietHoursEnabled) return false;
  const start = config.quietStartHour24;
  const end = config.quietEndHour24;
  if (start === end) return false;
  if (start < end) {
    return hour24 >= start && hour24 < end;
  }
  // Overnight quiet hours e.g. 22 -> 07
  return hour24 >= start || hour24 < end;
}

export function determineTargetStage(
  elapsedSinceScheduledMinutes: number,
  config: EscalationConfig,
): 0 | 1 | 2 | 3 {
  const grace = config.gracePeriodMinutes;
  if (elapsedSinceScheduledMinutes <= grace) {
    return 0;
  }
  const afterGrace = elapsedSinceScheduledMinutes - grace;
  if (afterGrace < config.stage1ToStage2Minutes) {
    return 1;
  }
  if (afterGrace < config.stage1ToStage2Minutes + config.stage2ToStage3Minutes) {
    return 2;
  }
  return 3;
}

export interface EscalationEvaluationInput {
  patientId: string;
  patientName: string;
  doseDate: string;
  nowMinutes: number;
  nowIso: string;
  medications: MedicationItem[];
  config: EscalationConfig;
  existingEvents: EscalationEvent[];
  existingDeliveries: NotificationDeliveryRecord[];
  consentGrants: ConsentGrant[];
  membersDirectory: Array<{id: string; name: string; email?: string; role: UserRole}>;
}

export interface EscalationEvaluationOutput {
  events: EscalationEvent[];
  newDeliveries: NotificationDeliveryRecord[];
  newEscalationsCreated: number;
  stagesAdvanced: number;
}

export function evaluateCareEscalations(input: EscalationEvaluationInput): EscalationEvaluationOutput {
  const nowMs = new Date(input.nowIso).getTime();
  const currentHour24 = Math.floor(input.nowMinutes / 60) % 24;
  const quietNow = isWithinQuietHours(currentHour24, input.config);

  const nextEvents = [...input.existingEvents];
  const newDeliveries: NotificationDeliveryRecord[] = [];
  const seenDeliveryKeys = new Set(input.existingDeliveries.map((d) => d.idempotencyKey));

  let newEscalationsCreated = 0;
  let stagesAdvanced = 0;

  for (const med of input.medications) {
    const isResolvedInMed =
      med.status === 'taken' ||
      med.status === 'late_confirmed' ||
      med.status === 'skipped' ||
      med.status === 'missed';

    const existingIdx = nextEvents.findIndex(
      (ev) =>
        ev.patientId === input.patientId &&
        ev.medicationId === med.id &&
        ev.doseDate === input.doseDate,
    );

    if (isResolvedInMed) {
      if (existingIdx !== -1 && nextEvents[existingIdx].status !== 'resolved') {
        const prev = nextEvents[existingIdx];
        const resolutionMethod: EscalationResolutionMethod =
          med.status === 'skipped'
            ? 'patient_reported_skipped'
            : med.status === 'missed'
              ? 'caregiver_marked_missed'
              : 'patient_confirmed_taken';
        nextEvents[existingIdx] = {
          ...prev,
          stage: 4,
          status: 'resolved',
          doseConfirmationStatus: med.isLateConfirmation ? 'late_confirmed' : med.status,
          resolvedBy: med.loggedBy ?? input.patientName,
          resolvedAt: input.nowIso,
          resolutionMethod,
          updatedAt: input.nowIso,
          timeline: [
            ...prev.timeline,
            {
              id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              stage: 4,
              actorName: med.loggedBy ?? input.patientName,
              action: `Dose resolved (${resolutionMethod.replace(/_/g, ' ')})`,
              timestampIso: input.nowIso,
              timestampLabel: new Date(input.nowIso).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
            },
          ],
        };
      }
      continue;
    }

    const elapsed = input.nowMinutes - med.scheduledMinutes24h;
    const targetStage = determineTargetStage(elapsed, input.config);
    if (targetStage === 0) continue;

    // Respect resolved status — never re-open or re-escalate a resolved event
    if (existingIdx !== -1 && nextEvents[existingIdx].status === 'resolved') {
      continue;
    }

    const currentEvent: EscalationEvent =
      existingIdx !== -1
        ? {...nextEvents[existingIdx]}
        : {
            id: `esc-${med.id}-${input.doseDate}`,
            patientId: input.patientId,
            patientName: input.patientName,
            medicationId: med.id,
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: med.scheduledTime,
            scheduledMinutes24h: med.scheduledMinutes24h,
            doseDate: input.doseDate,
            stage: 1,
            status: 'stage_1_patient_reminder',
            doseConfirmationStatus: 'unconfirmed',
            idempotencyKeys: [],
            createdAt: input.nowIso,
            updatedAt: input.nowIso,
            timeline: [],
          };

    const isNew = existingIdx === -1;
    if (isNew) {
      newEscalationsCreated += 1;
    }

    // Advance sequentially through configured escalation stages (e.g., 1 -> 2 -> 3)
    const desiredStage = Math.max(currentEvent.stage, targetStage) as 1 | 2 | 3;
    const stageOrder = input.config.escalationOrder;

    for (let s = 1; s <= desiredStage; s += 1) {
      const stageNum = s as 1 | 2 | 3;
      const roleForStage = stageOrder[stageNum - 1] ?? (stageNum === 1 ? 'patient' : stageNum === 2 ? 'caregiver' : 'family');
      const stageKey = `esc:${input.patientId}:${med.id}:${input.doseDate}:stage${stageNum}:${roleForStage}`;

      if (currentEvent.idempotencyKeys.includes(stageKey)) {
        continue;
      }

      // Check authorization for Caregiver or Family escalation recipients!
      const recipientCandidates = resolveAuthorizedRecipientsForStage({
        roleTarget: roleForStage,
        patientId: input.patientId,
        patientName: input.patientName,
        config: input.config,
        consentGrants: input.consentGrants,
        membersDirectory: input.membersDirectory,
        nowMs,
      });

      if (recipientCandidates.length === 0 && roleForStage !== 'patient') {
        // Record in timeline that escalation was withheld because no authorized/consented recipient exists
        currentEvent.idempotencyKeys = [...currentEvent.idempotencyKeys, stageKey];
        currentEvent.timeline = [
          ...currentEvent.timeline,
          {
            id: `tl-${s}-${Math.random().toString(36).slice(2, 6)}`,
            stage: stageNum,
            actorName: 'System',
            actorRole: 'system',
            action: `Stage ${stageNum} (${roleForStage}) skipped — no active medication consent`,
            timestampIso: input.nowIso,
            timestampLabel: new Date(input.nowIso).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            }),
          },
        ];
        continue;
      }

      if (!isNew && stageNum > currentEvent.stage) {
        stagesAdvanced += 1;
      }

      currentEvent.stage = stageNum;
      currentEvent.status =
        stageNum === 1
          ? 'stage_1_patient_reminder'
          : stageNum === 2
            ? 'stage_2_caregiver_alert'
            : 'stage_3_family_alert';
      currentEvent.doseConfirmationStatus = 'unconfirmed';
      currentEvent.updatedAt = input.nowIso;
      currentEvent.idempotencyKeys = [...currentEvent.idempotencyKeys, stageKey];
      currentEvent.timeline = [
        ...currentEvent.timeline,
        {
          id: `tl-${s}-${Math.random().toString(36).slice(2, 6)}`,
          stage: stageNum,
          actorName: 'Aarvi Escalation Engine',
          actorRole: 'system',
          action:
            stageNum === 1
              ? `Stage 1 reminder issued for ${med.name} (${med.scheduledTime})`
              : stageNum === 2
                ? `Stage 2 caregiver alert sent to ${recipientCandidates.map((r) => r.name).join(', ')}`
                : `Stage 3 family notification sent to ${recipientCandidates.map((r) => r.name).join(', ')}`,
          note: quietNow ? 'Quiet hours active — external alerts deferred' : undefined,
          timestampIso: input.nowIso,
          timestampLabel: new Date(input.nowIso).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ];

      // Create idempotent in-app and external delivery records
      for (const recipient of recipientCandidates) {
        if (input.config.channels.inApp) {
          const inAppKey = `${stageKey}:in_app:${recipient.id}`;
          if (!seenDeliveryKeys.has(inAppKey)) {
            seenDeliveryKeys.add(inAppKey);
            newDeliveries.push({
              id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              idempotencyKey: inAppKey,
              patientId: input.patientId,
              sourceType: 'escalation',
              sourceId: currentEvent.id,
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              channel: 'in_app',
              status: 'sent',
              retryCount: 0,
              title: `Stage ${stageNum}: ${med.name} (${med.scheduledTime})`,
              body: `${input.patientName} · ${med.dosage} remains unconfirmed (${currentEvent.doseConfirmationStatus}).`,
              createdAt: input.nowIso,
              updatedAt: input.nowIso,
            });
          }
        }

        if (input.config.channels.email && recipient.email && !quietNow && stageNum >= 2) {
          const emailKey = `${stageKey}:email:${recipient.id}`;
          if (!seenDeliveryKeys.has(emailKey)) {
            seenDeliveryKeys.add(emailKey);
            newDeliveries.push({
              id: `del-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              idempotencyKey: emailKey,
              patientId: input.patientId,
              sourceType: 'escalation',
              sourceId: currentEvent.id,
              recipientId: recipient.id,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
              channel: 'email',
              status: 'queued',
              retryCount: 0,
              title: `[Aarvi Escalation Stage ${stageNum}] ${med.name} unconfirmed for ${input.patientName}`,
              body: `Scheduled: ${med.scheduledTime} · Current status: unconfirmed.`,
              createdAt: input.nowIso,
              updatedAt: input.nowIso,
            });
          }
        }
      }
    }

    if (existingIdx !== -1) {
      nextEvents[existingIdx] = currentEvent;
    } else {
      nextEvents.unshift(currentEvent);
    }
  }

  return {
    events: nextEvents,
    newDeliveries,
    newEscalationsCreated,
    stagesAdvanced,
  };
}

function resolveAuthorizedRecipientsForStage(input: {
  roleTarget: 'patient' | 'caregiver' | 'family';
  patientId: string;
  patientName: string;
  config: EscalationConfig;
  consentGrants: ConsentGrant[];
  membersDirectory: Array<{id: string; name: string; email?: string; role: UserRole}>;
  nowMs: number;
}): Array<{id: string; name: string; email?: string}> {
  if (input.roleTarget === 'patient') {
    return [{id: input.patientId, name: input.patientName}];
  }

  if (input.roleTarget === 'caregiver') {
    const grant = input.consentGrants.find(
      (g) =>
        g.patientId === input.patientId &&
        g.memberId === input.config.assignedCaregiverId &&
        g.memberRole === 'caregiver',
    );
    if (!grant || !isConsentGrantEffective(grant, input.nowMs) || !grant.permissions.medications) {
      return [];
    }
    return [
      {
        id: grant.memberId,
        name: grant.memberName,
        email: grant.memberEmail,
      },
    ];
  }

  // Authorized family recipients
  const allowedFamily: Array<{id: string; name: string; email?: string}> = [];
  for (const famId of input.config.authorizedFamilyIds) {
    const grant = input.consentGrants.find(
      (g) =>
        g.patientId === input.patientId &&
        g.memberId === famId &&
        g.memberRole === 'family_member',
    );
    if (grant && isConsentGrantEffective(grant, input.nowMs) && grant.permissions.medications) {
      allowedFamily.push({
        id: grant.memberId,
        name: grant.memberName,
        email: grant.memberEmail,
      });
    }
  }
  return allowedFamily;
}

export function acknowledgeEscalationEvent(input: {
  events: EscalationEvent[];
  eventId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  resolve?: boolean;
  resolutionMethod?: EscalationResolutionMethod;
  nowIso?: string;
}): {ok: boolean; error?: string; events: EscalationEvent[]; updated?: EscalationEvent} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const target = input.events.find((e) => e.id === input.eventId);
  if (!target) {
    return {ok: false, error: 'Escalation event not found.', events: input.events};
  }
  if (target.status === 'resolved') {
    return {ok: true, events: input.events, updated: target};
  }

  const nextStage: EscalationStage = input.resolve ? 4 : target.stage;
  const updated: EscalationEvent = {
    ...target,
    stage: nextStage,
    status: input.resolve ? 'resolved' : target.status,
    acknowledgedBy: input.actorName,
    acknowledgedAt: nowIso,
    resolvedBy: input.resolve ? input.actorName : target.resolvedBy,
    resolvedAt: input.resolve ? nowIso : target.resolvedAt,
    resolutionMethod: input.resolve
      ? input.resolutionMethod ?? 'family_acknowledged_resolved'
      : target.resolutionMethod,
    updatedAt: nowIso,
    timeline: [
      ...target.timeline,
      {
        id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        stage: nextStage,
        actorName: input.actorName,
        actorRole: input.actorRole,
        action: input.resolve
          ? `Resolved by ${input.actorName} (${(input.resolutionMethod ?? 'family_acknowledged_resolved').replace(/_/g, ' ')})`
          : `Acknowledged at Stage ${target.stage} by ${input.actorName}`,
        timestampIso: nowIso,
        timestampLabel: new Date(nowIso).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    ],
  };

  return {
    ok: true,
    events: input.events.map((e) => (e.id === updated.id ? updated : e)),
    updated,
  };
}
