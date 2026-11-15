import React, {useState} from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Lock,
  Plus,
  UserCheck,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {filterTasksForPatient} from '../../../shared/tasks';
import {useAarvi} from '../../context/AarviContext';
import type {
  CareTaskCategory,
  CareTaskPriority,
  CareTaskStatus,
} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

const TASK_CATEGORIES: CareTaskCategory[] = [
  'refill',
  'transport',
  'appointment_companion',
  'supplies',
  'handover',
  'wellbeing',
  'medical_reports',
];

const TASK_PRIORITIES: CareTaskPriority[] = ['low', 'normal', 'high', 'urgent'];

export function CareTasksView() {
  const {
    session,
    patientProfile,
    careTasks,
    createCareTask,
    updateCareTaskStatus,
    reassignCareTask,
    effectiveOnline,
  } = useAarvi();
  const {t} = useTranslation();

  const isPatient = session?.role === 'elderly_patient';
  const [statusFilter, setStatusFilter] = useState<'all' | CareTaskStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | CareTaskPriority>('all');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CareTaskCategory>('refill');
  const [priority, setPriority] = useState<CareTaskPriority>('normal');
  const [assigneeId, setAssigneeId] = useState(patientProfile.careCircle[0]?.id ?? 'cc-1');
  const [dueAtInput, setDueAtInput] = useState(() => {
    const d = new Date(Date.now() + 24 * 3600_000);
    return d.toISOString().slice(0, 16);
  });
  const [internalNotes, setInternalNotes] = useState('');
  const [patientSummary, setPatientSummary] = useState('');
  const [feedback, setFeedback] = useState<{ok: boolean; text: string} | null>(null);

  if (isPatient) {
    const safeActivities = filterTasksForPatient(careTasks);
    return (
      <div className="space-y-6">
        <SurfaceCard tone="hero">
          <p className="text-sm font-medium text-[#E99483]">{t('tasks.patientKicker')}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
            {t('tasks.patientTitle')}
          </h1>
          <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-2xl">{t('tasks.patientSub')}</p>
        </SurfaceCard>

        <SurfaceCard tone="cream">
          <SectionHeader
            title={t('tasks.patientListTitle')}
            subtitle={t('tasks.patientPrivacyNote')}
            action={<Lock className="w-4 h-4 text-[#176D65]" aria-hidden="true" />}
          />
          {safeActivities.length === 0 ? (
            <EmptyState
              title={t('tasks.emptyTitle')}
              description={t('tasks.patientEmptyDesc')}
            />
          ) : (
            <div className="divide-y aarvi-divider">
              {safeActivities.map((item) => (
                <div
                  key={item.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#176D65] tabular-nums">
                      {t(`tasks.categories.${item.category}`)} ·{' '}
                      {new Date(item.dueAtIso).toLocaleDateString()}
                    </p>
                    <p className="font-display font-bold text-base text-[#172C40] mt-0.5">
                      {item.title}
                    </p>
                    <p className="text-sm text-[#172C40]/75 mt-0.5">
                      {t('tasks.handledBy', {name: item.assignedToName})}
                    </p>
                  </div>
                  <StatusIndicator
                    tone={
                      item.status === 'completed'
                        ? 'teal'
                        : item.status === 'overdue'
                          ? 'coral'
                          : 'navy'
                    }
                    icon={item.status === 'completed' ? 'check' : 'clock'}
                    label={t(`tasks.statuses.${item.status}`)}
                  />
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    );
  }

  const filteredTasks = careTasks.filter((task) => {
    const stOk = statusFilter === 'all' || task.status === statusFilter;
    const prOk = priorityFilter === 'all' || task.priority === priorityFilter;
    return stOk && prOk;
  });

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const dueIso = dueAtInput ? new Date(dueAtInput).toISOString() : new Date().toISOString();
    const res = await createCareTask({
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      priority,
      assigneeId,
      dueAtIso: dueIso,
      internalNotes: internalNotes.trim() || undefined,
      patientVisibleSummary: patientSummary.trim() || undefined,
    });
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('tasks.createError')});
      return;
    }
    setFeedback({
      ok: true,
      text: effectiveOnline ? t('tasks.createdOnline') : t('tasks.createdOffline'),
    });
    setTitle('');
    setDescription('');
    setInternalNotes('');
    setPatientSummary('');
    setShowCreateForm(false);
  };

  const handleStatusChange = async (taskId: string, nextStatus: CareTaskStatus) => {
    const res = await updateCareTaskStatus(taskId, nextStatus);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('tasks.updateError')});
    } else {
      setFeedback({ok: true, text: t('tasks.statusUpdated')});
    }
  };

  const handleReassign = async (taskId: string, nextAssigneeId: string) => {
    const res = await reassignCareTask(taskId, nextAssigneeId, 'Reassigned from task manager');
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('tasks.reassignError')});
    } else {
      setFeedback({ok: true, text: t('tasks.reassignedSuccess')});
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('tasks.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('tasks.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('tasks.pageSub')}</p>
          </div>
          <Button
            variant="coral"
            onClick={() => setShowCreateForm((v) => !v)}
            data-testid="toggle-create-task"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{showCreateForm ? t('common.close') : t('tasks.createTaskBtn')}</span>
          </Button>
        </div>
      </SurfaceCard>

      {feedback && (
        <SurfaceCard
          tone={feedback.ok ? 'inset' : 'muted'}
          className={feedback.ok ? 'border-[#269B91]/40' : 'border-[#A84433]/40'}
        >
          <p className={`text-sm font-semibold ${feedback.ok ? 'text-[#176D65]' : 'text-[#A84433]'}`}>
            {feedback.text}
          </p>
        </SurfaceCard>
      )}

      {showCreateForm && (
        <SurfaceCard tone="cream">
          <SectionHeader title={t('tasks.formTitle')} subtitle={t('tasks.formSub')} />
          <form onSubmit={handleCreateTask} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label htmlFor="task-title" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.titleLabel')}
              </label>
              <input
                id="task-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('tasks.titlePlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label htmlFor="task-cat" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.categoryLabel')}
              </label>
              <select
                id="task-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as CareTaskCategory)}
                className="aarvi-input"
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {t(`tasks.categories.${cat}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-prio" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.priorityLabel')}
              </label>
              <select
                id="task-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value as CareTaskPriority)}
                className="aarvi-input"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`tasks.priorities.${p}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-assignee" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.assigneeLabel')}
              </label>
              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="aarvi-input"
              >
                {patientProfile.careCircle.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.roleLabel}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="task-due" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.dueAtLabel')}
              </label>
              <input
                id="task-due"
                type="datetime-local"
                value={dueAtInput}
                onChange={(e) => setDueAtInput(e.target.value)}
                className="aarvi-input font-mono tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="task-desc" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.descriptionLabel')}
              </label>
              <textarea
                id="task-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('tasks.descriptionPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label htmlFor="task-patient-sum" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.patientSummaryLabel')}
              </label>
              <input
                id="task-patient-sum"
                type="text"
                value={patientSummary}
                onChange={(e) => setPatientSummary(e.target.value)}
                placeholder={t('tasks.patientSummaryPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label htmlFor="task-internal" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('tasks.internalNotesLabel')}
              </label>
              <input
                id="task-internal"
                type="text"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder={t('tasks.internalNotesPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('tasks.saveTaskBtn')}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0E6] rounded-xl border border-[#172C40]/14">
          {(['all', 'todo', 'acknowledged', 'in_progress', 'overdue', 'completed', 'cancelled'] as const).map(
            (st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === st
                    ? 'bg-[#172C40] text-[#F5F0E6]'
                    : 'text-[#172C40]/75 hover:text-[#172C40]'
                }`}
              >
                {st === 'all' ? t('common.all') : t(`tasks.statuses.${st}`)}
              </button>
            ),
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0E6] rounded-xl border border-[#172C40]/14 self-start">
          {(['all', 'urgent', 'high', 'normal', 'low'] as const).map((pr) => (
            <button
              key={pr}
              type="button"
              onClick={() => setPriorityFilter(pr)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                priorityFilter === pr
                  ? 'bg-[#269B91] text-[#FAF6EE]'
                  : 'text-[#172C40]/75 hover:text-[#172C40]'
              }`}
            >
              {pr === 'all' ? t('tasks.allPriorities') : t(`tasks.priorities.${pr}`)}
            </button>
          ))}
        </div>
      </div>

      {filteredTasks.length === 0 ? (
        <EmptyState
          title={t('tasks.emptyTitle')}
          description={t('tasks.emptyDesc')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
            >
              {t('medications.resetFilters')}
            </Button>
          }
        />
      ) : (
        <SurfaceCard tone="cream">
          <div className="divide-y aarvi-divider">
            {filteredTasks.map((task) => {
              const isAssignee =
                task.assignedToId === session?.userId || task.assignedToName === session?.fullName;
              const isFamilyCoordinator = session?.role === 'family_member';
              const canComplete = isAssignee || isFamilyCoordinator;

              return (
                <article key={task.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                        <span className="font-semibold text-[#176D65]">
                          {t(`tasks.categories.${task.category}`)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={`font-semibold ${
                            task.priority === 'urgent' || task.priority === 'high'
                              ? 'text-[#A84433]'
                              : 'text-[#172C40]'
                          }`}
                        >
                          {t(`tasks.priorities.${task.priority}`)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {new Date(task.dueAtIso).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        {task.syncState === 'queued_offline' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#8F5312]">
                              {t('offline.queuedLocally')}
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-lg font-bold text-[#172C40] mt-1">
                        {task.title}
                      </h3>
                      <p className="text-sm text-[#172C40]/80 mt-0.5">{task.description}</p>
                      <p className="text-xs text-[#172C40]/70 mt-1.5">
                        <UserCheck className="w-3.5 h-3.5 inline mr-1 text-[#176D65]" aria-hidden="true" />
                        {t('tasks.assignedTo', {
                          name: task.assignedToName,
                          creator: task.createdByName,
                        })}
                      </p>
                      {task.internalNotes && (
                        <p className="text-xs text-[#172C40]/72 mt-1 italic">
                          {t('tasks.internalTag')}: {task.internalNotes}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <StatusIndicator
                        tone={
                          task.status === 'completed'
                            ? 'teal'
                            : task.status === 'overdue' || task.status === 'cancelled'
                              ? 'coral'
                              : 'amber'
                        }
                        icon={task.status === 'completed' ? 'check' : 'clock'}
                        label={t(`tasks.statuses.${task.status}`)}
                      />

                      {task.status === 'todo' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleStatusChange(task.id, 'acknowledged')}
                        >
                          <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
                          <span>{t('dashboards.acknowledge')}</span>
                        </Button>
                      )}

                      {(task.status === 'acknowledged' || task.status === 'todo') && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleStatusChange(task.id, 'in_progress')}
                        >
                          <Clock className="w-4 h-4" aria-hidden="true" />
                          <span>{t('tasks.startBtn')}</span>
                        </Button>
                      )}

                      {task.status !== 'completed' &&
                        task.status !== 'cancelled' &&
                        canComplete && (
                          <Button
                            size="sm"
                            variant="teal"
                            onClick={() => void handleStatusChange(task.id, 'completed')}
                          >
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span>{t('tasks.completeBtn')}</span>
                          </Button>
                        )}
                    </div>
                  </div>

                  {task.status !== 'completed' &&
                    task.status !== 'cancelled' &&
                    isFamilyCoordinator && (
                      <div className="pt-2 border-t aarvi-divider flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <label htmlFor={`reassign-${task.id}`} className="font-semibold text-[#172C40]">
                            {t('tasks.reassignLabel')}
                          </label>
                          <select
                            id={`reassign-${task.id}`}
                            value={task.assignedToId}
                            onChange={(e) => void handleReassign(task.id, e.target.value)}
                            className="aarvi-input py-1.5 text-xs w-auto min-h-[38px]"
                          >
                            {patientProfile.careCircle.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {task.assignmentHistory.length > 0 && (
                          <span className="text-[#172C40]/68">
                            {t('tasks.historyCount', {count: task.assignmentHistory.length})}
                          </span>
                        )}
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
