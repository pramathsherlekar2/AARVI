import type {
  CareCircleContact,
  CareTaskCategory,
  CareTaskItem,
  CareTaskPriority,
  CareTaskStatus,
  ConsentGrant,
  UserRole,
} from '../src/types/aarvi';
import {type CareActor, hasDomainConsent, isConsentGrantEffective} from './permissions';

export function canCreateCareTask(
  actor: CareActor,
  targetPatientId: string,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {allowed: boolean; reason?: string} {
  if (actor.patientId !== targetPatientId) {
    return {allowed: false, reason: 'Cross-patient task access is forbidden.'};
  }
  if (actor.role === 'elderly_patient') {
    return {allowed: false, reason: 'Patients cannot create coordination tasks for care staff directly.'};
  }
  const consent = hasDomainConsent(grants, actor, targetPatientId, 'care_notes', nowMs);
  if (!consent.allowed) {
    return {
      allowed: false,
      reason: `Active care coordination consent is required (status: ${consent.status}).`,
    };
  }
  return {allowed: true};
}

export function isAuthorizedTaskAssignee(
  assigneeId: string,
  targetPatientId: string,
  careCircle: CareCircleContact[],
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {valid: boolean; member?: CareCircleContact; reason?: string} {
  const member = careCircle.find((c) => c.id === assigneeId);
  if (!member) {
    return {valid: false, reason: 'Assignee is not in this patient care circle.'};
  }
  const grant = grants.find(
    (g) => g.patientId === targetPatientId && g.memberId === assigneeId,
  );
  if (grant && !isConsentGrantEffective(grant, nowMs)) {
    return {valid: false, reason: 'Assignee consent has expired or been revoked.'};
  }
  return {valid: true, member};
}

export function canCompleteOrCancelTask(
  actor: CareActor,
  task: CareTaskItem,
  grants: ConsentGrant[],
  nowMs: number = Date.now(),
): {allowed: boolean; reason?: string} {
  if (actor.patientId !== task.patientId) {
    return {allowed: false, reason: 'Cross-patient task modification is forbidden.'};
  }
  if (actor.role === 'elderly_patient') {
    return {allowed: false, reason: 'Elderly patient view is read-only for care coordination tasks.'};
  }
  const consent = hasDomainConsent(grants, actor, task.patientId, 'care_notes', nowMs);
  if (!consent.allowed) {
    return {allowed: false, reason: 'Your care coordination access is inactive or revoked.'};
  }
  if (task.assignedToId === actor.userId || task.assignedToName === actor.fullName) {
    return {allowed: true};
  }
  if (actor.role === 'family_member' && actor.isLegalRepresentative) {
    return {allowed: true};
  }
  const grant = grants.find(
    (g) => g.patientId === task.patientId && g.memberId === actor.userId,
  );
  if (grant?.isLegalRepresentative && isConsentGrantEffective(grant, nowMs)) {
    return {allowed: true};
  }
  return {
    allowed: false,
    reason: 'You cannot complete or cancel another person’s task without coordinator permission.',
  };
}

export function computeEffectiveTaskStatus(
  task: CareTaskItem,
  nowMs: number = Date.now(),
): CareTaskStatus {
  if (task.status === 'completed' || task.status === 'cancelled') {
    return task.status;
  }
  const dueMs = new Date(task.dueAtIso).getTime();
  if (!Number.isNaN(dueMs) && dueMs < nowMs) {
    return 'overdue';
  }
  return task.status;
}

export function detectOverdueCareTasks(
  tasks: CareTaskItem[],
  nowMs: number = Date.now(),
): {tasks: CareTaskItem[]; newlyOverdueIds: string[]} {
  const newlyOverdueIds: string[] = [];
  const nextTasks = tasks.map((task) => {
    const nextStatus = computeEffectiveTaskStatus(task, nowMs);
    if (nextStatus === 'overdue' && task.status !== 'overdue') {
      newlyOverdueIds.push(task.id);
      return {...task, status: 'overdue' as const};
    }
    return task;
  });
  return {tasks: nextTasks, newlyOverdueIds};
}

export function filterTasksForPatient(tasks: CareTaskItem[]): Array<{
  id: string;
  title: string;
  category: CareTaskCategory;
  priority: CareTaskPriority;
  status: CareTaskStatus;
  assignedToName: string;
  dueAtIso: string;
}> {
  return tasks
    .filter((t) => t.status !== 'cancelled')
    .map((t) => ({
      id: t.id,
      title: t.patientVisibleSummary?.trim() || t.title,
      category: t.category,
      priority: t.priority,
      status: t.status,
      assignedToName: t.assignedToName,
      dueAtIso: t.dueAtIso,
      // Explicitly omit internalNotes, description containing private family discussions, and assignmentHistory
    }));
}

export function deduplicateTaskOperation(
  existingTasks: CareTaskItem[],
  operationId: string,
): boolean {
  return existingTasks.some((t) => t.operationId === operationId);
}

export function createCareTaskRecord(input: {
  operationId: string;
  actor: CareActor;
  patientId: string;
  patientName: string;
  title: string;
  description: string;
  category: CareTaskCategory;
  priority: CareTaskPriority;
  assigneeId: string;
  dueAtIso: string;
  internalNotes?: string;
  patientVisibleSummary?: string;
  careCircle: CareCircleContact[];
  grants: ConsentGrant[];
  nowIso?: string;
}): {ok: boolean; statusCode: number; error?: string; task?: CareTaskItem} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  const createPerm = canCreateCareTask(input.actor, input.patientId, input.grants, nowMs);
  if (!createPerm.allowed) {
    return {ok: false, statusCode: 403, error: createPerm.reason};
  }

  const assigneeCheck = isAuthorizedTaskAssignee(
    input.assigneeId,
    input.patientId,
    input.careCircle,
    input.grants,
    nowMs,
  );
  if (!assigneeCheck.valid || !assigneeCheck.member) {
    return {ok: false, statusCode: 403, error: assigneeCheck.reason};
  }

  const assignedRole: UserRole | 'primaryPhysician' =
    assigneeCheck.member.roleLabel.toLowerCase().includes('caregiver')
      ? 'caregiver'
      : assigneeCheck.member.roleLabel.toLowerCase().includes('physician')
        ? 'primaryPhysician'
        : 'family_member';

  const dueMs = new Date(input.dueAtIso).getTime();
  const initialStatus: CareTaskStatus = !Number.isNaN(dueMs) && dueMs < nowMs ? 'overdue' : 'todo';

  const task: CareTaskItem = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    operationId: input.operationId,
    patientId: input.patientId,
    patientName: input.patientName,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority,
    status: initialStatus,
    assignedToId: assigneeCheck.member.id,
    assignedToName: assigneeCheck.member.name,
    assignedToRole: assignedRole,
    createdById: input.actor.userId,
    createdByName: input.actor.fullName,
    createdByRole: input.actor.role,
    dueAtIso: input.dueAtIso,
    createdAtIso: nowIso,
    updatedAtIso: nowIso,
    internalNotes: input.internalNotes?.trim() || undefined,
    patientVisibleSummary: input.patientVisibleSummary?.trim() || undefined,
    syncState: 'synced',
    assignmentHistory: [
      {
        id: `ah-${nowMs}`,
        toAssigneeId: assigneeCheck.member.id,
        toAssigneeName: assigneeCheck.member.name,
        toAssigneeRole: assignedRole,
        assignedByName: input.actor.fullName,
        timestampIso: nowIso,
        note: 'Initial task assignment',
      },
    ],
  };

  return {ok: true, statusCode: 201, task};
}

export function updateCareTaskRecord(input: {
  task: CareTaskItem;
  actor: CareActor;
  grants: ConsentGrant[];
  careCircle: CareCircleContact[];
  patch: {
    status?: CareTaskStatus;
    reassignToId?: string;
    reassignNote?: string;
  };
  nowIso?: string;
}): {ok: boolean; statusCode: number; error?: string; task?: CareTaskItem; reassigned?: boolean} {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = new Date(nowIso).getTime();

  if (input.actor.patientId !== input.task.patientId) {
    return {ok: false, statusCode: 403, error: 'Cross-patient task update is forbidden.'};
  }

  let updated = {...input.task, updatedAtIso: nowIso};
  let reassigned = false;

  if (input.patch.reassignToId && input.patch.reassignToId !== input.task.assignedToId) {
    const perm = canCreateCareTask(input.actor, input.task.patientId, input.grants, nowMs);
    if (!perm.allowed) {
      return {ok: false, statusCode: 403, error: perm.reason};
    }
    const assigneeCheck = isAuthorizedTaskAssignee(
      input.patch.reassignToId,
      input.task.patientId,
      input.careCircle,
      input.grants,
      nowMs,
    );
    if (!assigneeCheck.valid || !assigneeCheck.member) {
      return {ok: false, statusCode: 403, error: assigneeCheck.reason};
    }
    const assignedRole: UserRole | 'primaryPhysician' =
      assigneeCheck.member.roleLabel.toLowerCase().includes('caregiver')
        ? 'caregiver'
        : assigneeCheck.member.roleLabel.toLowerCase().includes('physician')
          ? 'primaryPhysician'
          : 'family_member';

    updated = {
      ...updated,
      assignedToId: assigneeCheck.member.id,
      assignedToName: assigneeCheck.member.name,
      assignedToRole: assignedRole,
      status: updated.status === 'acknowledged' ? 'todo' : updated.status,
      assignmentHistory: [
        ...updated.assignmentHistory,
        {
          id: `ah-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
          fromAssigneeName: input.task.assignedToName,
          toAssigneeId: assigneeCheck.member.id,
          toAssigneeName: assigneeCheck.member.name,
          toAssigneeRole: assignedRole,
          assignedByName: input.actor.fullName,
          timestampIso: nowIso,
          note: input.patch.reassignNote?.trim() || 'Reassigned within care circle',
        },
      ],
    };
    reassigned = true;
  }

  if (input.patch.status) {
    const nextStatus = input.patch.status;
    if (nextStatus === 'completed' || nextStatus === 'cancelled') {
      const compPerm = canCompleteOrCancelTask(input.actor, updated, input.grants, nowMs);
      if (!compPerm.allowed) {
        return {ok: false, statusCode: 403, error: compPerm.reason};
      }
      updated = {
        ...updated,
        status: nextStatus,
        completedAtIso: nextStatus === 'completed' ? nowIso : undefined,
        completedByName: nextStatus === 'completed' ? input.actor.fullName : undefined,
      };
    } else {
      const consent = hasDomainConsent(input.grants, input.actor, updated.patientId, 'care_notes', nowMs);
      const isAssignee =
        updated.assignedToId === input.actor.userId ||
        updated.assignedToName === input.actor.fullName;
      if (!consent.allowed || (!isAssignee && !input.actor.isLegalRepresentative)) {
        return {
          ok: false,
          statusCode: 403,
          error: 'Only the assigned member or an authorized coordinator can update this task status.',
        };
      }
      updated = {
        ...updated,
        status: nextStatus,
        acknowledgedAtIso: nextStatus === 'acknowledged' ? nowIso : updated.acknowledgedAtIso,
      };
    }
  }

  return {ok: true, statusCode: 200, task: updated, reassigned};
}
