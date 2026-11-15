import {useState} from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  HeartPulse,
  KeyRound,
  ListTodo,
  Pill,
  ShieldAlert,
  SkipForward,
  UserCheck,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function CaregiverDashboard() {
  const {
    session,
    patientProfile,
    medications,
    overdueMedicationIds,
    logMedicationDose,
    appointments,
    handovers,
    previewModules,
    escalationEvents,
    acknowledgeEscalation,
    careTasks,
    updateCareTaskStatus,
    caregiverVisits,
    setActiveRoute,
  } = useAarvi();
  const {t} = useTranslation();

  const [skipMedId, setSkipMedId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  const dueMeds = medications.filter((m) => m.status === 'pending' || m.status === 'unconfirmed');
  const completedMeds = medications.filter(
    (m) => m.status === 'taken' || m.status === 'late_confirmed',
  );
  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const latestHandover = handovers[0];
  const openEscalations = escalationEvents.filter((ev) => ev.status !== 'resolved');
  const myAssignedTasks = careTasks.filter(
    (tk) =>
      tk.status !== 'completed' &&
      tk.status !== 'cancelled' &&
      (tk.assignedToId === session?.userId || tk.assignedToName === session?.fullName),
  );
  const nextShiftVisit = caregiverVisits.find(
    (v) => v.status === 'scheduled' || v.status === 'ongoing',
  );

  const handleConfirmSkip = (medId: string) => {
    logMedicationDose(medId, 'skipped', skipReason.trim() || t('dashboards.defaultSkipReason'));
    setSkipMedId(null);
    setSkipReason('');
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero" className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('dashboards.caregiverBadge')}</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F5F0E6] mt-1.5 leading-tight">
              {t('dashboards.caregiverTitle', {name: patientProfile.fullName})}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-2">
              {t('dashboards.onDutyLabel', {
                name: session?.fullName ?? '',
                title: session?.relationshipOrTitle ?? '',
                allergies: patientProfile.allergies.join(', '),
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button variant="navyOutline" onClick={() => setActiveRoute('patient_profile')}>
              <UserCheck className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.careNotesBtn')}</span>
            </Button>
            <Button variant="coral" onClick={() => setActiveRoute('handovers')}>
              <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.writeHandoverBtn')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-7 pt-6 border-t border-[#F5F0E6]/15">
          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('dashboards.dosesRemaining')}</p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-1">
              {dueMeds.length}
            </p>
            <p className="text-xs text-[#5EEAD4] mt-0.5 tabular-nums">
              {t('dashboards.administeredCount', {count: completedMeds.length})}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">
              {t('dashboards.mobilityDietaryAlert')}
            </p>
            <p className="font-display text-lg font-bold text-[#F5F0E6] mt-1">
              {t('dashboards.caneOutdoors')}
            </p>
            <p className="text-xs text-[#F5F0E6]/75 mt-0.5">{t('dashboards.lowSodiumVeg')}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('dashboards.nextCareVisit')}</p>
            <p className="font-display text-lg font-bold text-[#F5F0E6] mt-1 truncate">
              {upcomingAppointments[0]?.dateLabel ?? t('common.none')}
            </p>
            <p className="text-xs text-[#F5F0E6]/75 mt-0.5 truncate">
              {upcomingAppointments[0]?.title ?? t('dashboards.noUpcomingShort')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">
              {t('dashboards.prevShiftHandover')}
            </p>
            <p className="font-display text-lg font-bold text-[#F5F0E6] mt-1">
              {latestHandover?.acknowledgedBy
                ? t('dashboards.reviewed')
                : t('dashboards.pendingReview')}
            </p>
            <p className="text-xs text-[#F5F0E6]/75 mt-0.5 truncate">
              {t('dashboards.byAuthor', {name: latestHandover?.authorName ?? ''})}
            </p>
          </div>
        </div>
      </SurfaceCard>

      {openEscalations.length > 0 && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-base text-[#172C40]">
                  {t('escalation.caregiverAlertTitle', {
                    count: openEscalations.length,
                    med: openEscalations[0].medicationName,
                  })}
                </p>
                <p className="text-sm text-[#172C40]/78 mt-0.5">
                  {t('escalation.stageLabel', {stage: openEscalations[0].stage})} ·{' '}
                  {openEscalations[0].scheduledTime}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                size="sm"
                variant="teal"
                onClick={() => void acknowledgeEscalation(openEscalations[0].id, false)}
              >
                <span>{t('dashboards.acknowledge')}</span>
              </Button>
              <Button size="sm" variant="coral" onClick={() => setActiveRoute('escalation')}>
                <span>{t('escalation.openQueueBtn')}</span>
              </Button>
            </div>
          </div>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.medAdminQueue')}
              subtitle={t('dashboards.medAdminSub')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('medications')}>
                  <Pill className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.fullLedger')}</span>
                </Button>
              }
            />

            <div className="divide-y aarvi-divider">
              {medications.map((med) => {
                const overdue = overdueMedicationIds.includes(med.id);
                return (
                  <div key={med.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                          <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                            {med.scheduledTime}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {t('common.daysSupplyLeft', {days: med.refillDaysRemaining})}
                          </span>
                          {overdue && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-semibold text-[#A84433]">
                                {t('missedDose.overdueLabel')}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="font-display text-base font-bold text-[#172C40] mt-0.5">
                          {med.name} — {med.dosage}
                        </p>
                        <p className="text-sm text-[#172C40]/75 mt-0.5">{med.instructions}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {med.status === 'pending' ? (
                          <>
                            <Button
                              size="sm"
                              variant={overdue ? 'coral' : 'teal'}
                              onClick={() => logMedicationDose(med.id, 'taken')}
                            >
                              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                              <span>{t('dashboards.markTaken')}</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => setSkipMedId(skipMedId === med.id ? null : med.id)}
                            >
                              <SkipForward className="w-4 h-4" aria-hidden="true" />
                              <span>{t('dashboards.skip')}</span>
                            </Button>
                          </>
                        ) : med.status === 'taken' ? (
                          <div className="flex items-center gap-2">
                            <StatusIndicator
                              tone="teal"
                              icon="check"
                              label={`${t('dashboards.statusTaken')} · ${med.loggedAt ?? t('common.today')}`}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => logMedicationDose(med.id, 'pending')}
                            >
                              {t('common.reset')}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <StatusIndicator
                              tone="coral"
                              icon="alert"
                              label={t('dashboards.statusSkipped')}
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => logMedicationDose(med.id, 'pending')}
                            >
                              {t('common.reset')}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    {skipMedId === med.id && (
                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <input
                          type="text"
                          value={skipReason}
                          onChange={(e) => setSkipReason(e.target.value)}
                          placeholder={t('dashboards.skipReasonPlaceholder')}
                          aria-label={t('dashboards.skipReasonAria')}
                          className="aarvi-input flex-1"
                        />
                        <Button size="sm" variant="coral" onClick={() => handleConfirmSkip(med.id)}>
                          {t('dashboards.confirmSkip')}
                        </Button>
                      </div>
                    )}

                    {med.status === 'skipped' && med.skipReason && (
                      <p className="text-xs text-[#A84433]">
                        {t('dashboards.skipNotePrefix', {reason: med.skipReason})}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.incomingHandover')}
              subtitle={t('dashboards.incomingHandoverSub')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('handovers')}>
                  <span>{t('dashboards.allNotes')}</span>
                </Button>
              }
            />
            {latestHandover ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-[#176D65]">
                  {latestHandover.shiftLabel} · {latestHandover.authorName}
                </p>
                <p className="text-sm text-[#172C40]/85 leading-relaxed">
                  {latestHandover.summary}
                </p>
                {latestHandover.pendingFollowUps.length > 0 && (
                  <div className="pt-3 border-t aarvi-divider">
                    <p className="text-xs font-semibold text-[#172C40] mb-1.5">
                      {t('dashboards.pendingFollowUps')}
                    </p>
                    <ul className="space-y-1.5 text-sm text-[#172C40]/78 list-disc pl-5">
                      {latestHandover.pendingFollowUps.map((task, idx) => (
                        <li key={idx}>{task}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('dashboards.noHandoverYet')}</p>
            )}
          </SurfaceCard>

          <SurfaceCard tone="inset">
            <SectionHeader
              title={t('nav.daily_companion')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveRoute('daily_companion')}
                >
                  <HeartPulse className="w-4 h-4" aria-hidden="true" />
                  <span>{t('common.open')}</span>
                </Button>
              }
            />
            <p className="text-sm text-[#172C40]/80 tabular-nums">
              {t('modules.glassesLabel', {
                count: previewModules.hydrationGlasses,
                target: previewModules.hydrationTarget,
              })}{' '}
              · {previewModules.lastMealNote}
            </p>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.visitPrepTitle')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('appointments')}>
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.scheduleBtn')}</span>
                </Button>
              }
            />
            {upcomingAppointments[0] ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#176D65] tabular-nums">
                  {upcomingAppointments[0].dateLabel} · {upcomingAppointments[0].timeLabel}
                </p>
                <p className="font-display font-bold text-[#172C40]">
                  {upcomingAppointments[0].title}
                </p>
                <p className="text-sm text-[#172C40]/75">{upcomingAppointments[0].notes}</p>
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('dashboards.noVisitsNeedPrep')}</p>
            )}
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('tasks.myAssignedTitle')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('tasks')}>
                  <ListTodo className="w-4 h-4" aria-hidden="true" />
                  <span>{t('common.open')}</span>
                </Button>
              }
            />
            {myAssignedTasks.length === 0 ? (
              <p className="text-sm text-[#172C40]/72">{t('tasks.emptyTitle')}</p>
            ) : (
              <div className="divide-y aarvi-divider">
                {myAssignedTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#172C40] truncate">{task.title}</p>
                      <p className="text-xs text-[#172C40]/70">
                        {t(`tasks.priorities.${task.priority}`)} · {t(`tasks.statuses.${task.status}`)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="teal"
                      onClick={() =>
                        void updateCareTaskStatus(
                          task.id,
                          task.status === 'todo' ? 'acknowledged' : 'completed',
                        )
                      }
                    >
                      <span>
                        {task.status === 'todo' ? t('dashboards.acknowledge') : t('tasks.completeBtn')}
                      </span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('visits.caregiverCardTitle')}
              action={
                <Button variant="coral" size="sm" onClick={() => setActiveRoute('visits')}>
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>{t('visits.checkInShortcutBtn')}</span>
                </Button>
              }
            />
            {nextShiftVisit ? (
              <div className="text-sm space-y-1">
                <p className="font-semibold text-[#172C40]">{nextShiftVisit.title}</p>
                <p className="text-xs text-[#176D65] font-semibold">
                  {t(`visits.statuses.${nextShiftVisit.status}`)} ·{' '}
                  {new Date(nextShiftVisit.scheduledStartIso).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('visits.emptyDesc')}</p>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
