import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  KeyRound,
  ListTodo,
  Lock,
  Pill,
  RefreshCw,
  ShieldAlert,
  User,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function FamilyMemberDashboard() {
  const {
    session,
    patientProfile,
    medications,
    overdueMedicationIds,
    appointments,
    handovers,
    acknowledgeHandover,
    escalationEvents,
    careTasks,
    caregiverVisits,
    consentGrants,
    effectiveOnline,
    pendingQueueCount,
    setActiveRoute,
  } = useAarvi();
  const {t} = useTranslation();

  const takenCount = medications.filter(
    (m) => m.status === 'taken' || m.status === 'late_confirmed',
  ).length;
  const skippedCount = medications.filter((m) => m.status === 'skipped').length;
  const pendingCount = medications.filter(
    (m) => m.status === 'pending' || m.status === 'unconfirmed',
  ).length;
  const lowRefillMeds = medications.filter(
    (m) => m.refillDaysRemaining <= m.refillThresholdDays,
  );
  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const unacknowledgedHandovers = handovers.filter((h) => !h.acknowledgedBy);
  const openEscalations = escalationEvents.filter((ev) => ev.status !== 'resolved');
  const openTasks = careTasks.filter((tk) => tk.status !== 'completed' && tk.status !== 'cancelled');
  const overdueTasks = careTasks.filter((tk) => tk.status === 'overdue');
  const activeVisit = caregiverVisits.find((v) => v.status === 'ongoing' || v.status === 'scheduled');
  const activeConsentCount = consentGrants.filter(
    (g) => g.accessStatus === 'active' || g.accessStatus === 'temporary',
  ).length;

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero" className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('dashboards.familyBadge')}</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F5F0E6] mt-1.5 leading-tight">
              {t('dashboards.familyTitle', {name: patientProfile.fullName})}
            </h1>
            <p className="text-sm text-[#F5F0E6]/80 mt-2">
              {t('dashboards.signedInAs', {
                name: session?.fullName ?? '',
                relation: session?.relationshipOrTitle ?? '',
              })}{' '}
              · {patientProfile.residenceSummary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button variant="navyOutline" onClick={() => setActiveRoute('patient_profile')}>
              <User className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.patientProfileBtn')}</span>
            </Button>
            <Button variant="coral" onClick={() => setActiveRoute('handovers')}>
              <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.reviewHandoversBtn')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-7 pt-6 border-t border-[#F5F0E6]/15">
          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('dashboards.kpiDosesTaken')}</p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-1">
              {takenCount} / {medications.length}
            </p>
            <p className="text-xs text-[#5EEAD4] mt-0.5 tabular-nums">
              {t('dashboards.kpiPendingSkipped', {pending: pendingCount, skipped: skippedCount})}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">
              {t('dashboards.kpiUpcomingVisits')}
            </p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-1">
              {upcomingAppointments.length}
            </p>
            <p className="text-xs text-[#F5F0E6]/75 mt-0.5 truncate">
              {upcomingAppointments[0]?.dateLabel ?? t('dashboards.kpiNoneScheduled')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">
              {t('dashboards.kpiHandoversAwaiting')}
            </p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-1">
              {unacknowledgedHandovers.length}
            </p>
            <p className="text-xs text-[#E99483] mt-0.5">
              {unacknowledgedHandovers.length > 0
                ? t('dashboards.kpiNeedsReview')
                : t('dashboards.kpiAllAcknowledged')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">
              {t('dashboards.kpiConnectivity')}
            </p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-1">
              {effectiveOnline ? t('common.online') : t('common.offline')}
            </p>
            <p className="text-xs text-[#F5F0E6]/75 mt-0.5 tabular-nums">
              {t('dashboards.kpiQueuedCount', {count: pendingQueueCount})}
            </p>
          </div>
        </div>
      </SurfaceCard>

      {(overdueMedicationIds.length > 0 || openEscalations.length > 0) && (
        <SurfaceCard tone="muted" className="border-[#A84433]/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-base text-[#172C40]">
                  {openEscalations.length > 0
                    ? t('escalation.familyBannerTitle', {count: openEscalations.length})
                    : t('missedDose.alertTitle', {count: overdueMedicationIds.length})}
                </p>
                <p className="text-sm text-[#172C40]/78 mt-0.5">{t('missedDose.alertDesc')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button variant="coral" size="sm" onClick={() => setActiveRoute('escalation')}>
                <ShieldAlert className="w-4 h-4" aria-hidden="true" />
                <span>{t('escalation.openQueueBtn')}</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveRoute('medications')}>
                {t('missedDose.reviewNow')}
              </Button>
            </div>
          </div>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.dailyMedProgress')}
              subtitle={t('dashboards.dailyMedSub')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('medications')}>
                  <Pill className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.manageSchedule')}</span>
                </Button>
              }
            />

            <div className="divide-y aarvi-divider">
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#172C40]/70">
                      <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                        {med.scheduledTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                    </div>
                    <p className="font-semibold text-[#172C40] mt-0.5">
                      {med.name}{' '}
                      <span className="font-normal text-[#172C40]/70">({med.dosage})</span>
                    </p>
                    {med.loggedBy && (
                      <p className="text-xs text-[#172C40]/70 mt-0.5">
                        {t('dashboards.loggedByAt', {
                          name: med.loggedBy,
                          time: med.loggedAt ?? '',
                        })}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {med.status === 'taken' && (
                      <StatusIndicator tone="teal" icon="check" label={t('dashboards.statusTaken')} />
                    )}
                    {med.status === 'pending' && (
                      <StatusIndicator
                        tone="amber"
                        icon="clock"
                        label={t('dashboards.statusScheduled')}
                      />
                    )}
                    {(med.status === 'skipped' || med.status === 'missed') && (
                      <StatusIndicator
                        tone="coral"
                        icon="alert"
                        label={
                          med.status === 'missed'
                            ? t('missedDose.missedStatus')
                            : t('dashboards.statusSkipped')
                        }
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lowRefillMeds.length > 0 && (
              <div className="mt-5 pt-4 border-t aarvi-divider flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-[#A84433] font-medium">
                  {t('dashboards.refillAttention')}{' '}
                  {lowRefillMeds
                    .map((m) => `${m.name} (${t('common.daysShort', {days: m.refillDaysRemaining})})`)
                    .join(', ')}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRoute('refill_tracker')}
                  className="text-sm font-semibold text-[#176D65] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('dashboards.inspectRefills')}
                </button>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.upcomingAndCompanion')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('appointments')}>
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.openVisits')}</span>
                </Button>
              }
            />
            <div className="divide-y aarvi-divider">
              {upcomingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#176D65] tabular-nums">
                      {apt.dateLabel} · {apt.timeLabel} · {apt.specialty}
                    </p>
                    <p className="font-display font-bold text-[#172C40] mt-0.5">{apt.title}</p>
                    <p className="text-sm text-[#172C40]/72 mt-0.5">
                      {apt.clinician} ·{' '}
                      {t('dashboards.companionLabel', {name: apt.companionAssigned})}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setActiveRoute('appointments')}>
                    <span>{t('dashboards.prepChecklist')}</span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('dashboards.latestCareHandovers')}
              subtitle={t('dashboards.ackToConfirm')}
            />
            <div className="space-y-4">
              {handovers.slice(0, 2).map((ho) => (
                <div
                  key={ho.id}
                  className="p-4 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12 space-y-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#176D65]">{ho.shiftLabel}</p>
                    <p className="text-sm font-bold text-[#172C40] mt-0.5">
                      {ho.authorName} · {ho.createdAtLabel}
                    </p>
                  </div>
                  <p className="text-sm text-[#172C40]/82 leading-relaxed">{ho.summary}</p>
                  <div className="text-xs text-[#172C40]/70 flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      {t('handovers.mood')}: {t(`handovers.moodOptions.${ho.checklist.mood}`)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('handovers.appetite')}:{' '}
                      {t(`handovers.appetiteOptions.${ho.checklist.appetite}`)}
                    </span>
                  </div>
                  <div className="pt-2 border-t aarvi-divider flex flex-wrap items-center justify-between gap-3">
                    {ho.acknowledgedBy ? (
                      <StatusIndicator
                        tone="teal"
                        icon="check"
                        label={t('dashboards.acknowledgedBy', {name: ho.acknowledgedBy})}
                      />
                    ) : (
                      <>
                        <StatusIndicator
                          tone="amber"
                          icon="clock"
                          label={t('dashboards.awaitingAck')}
                        />
                        <Button
                          size="sm"
                          variant="teal"
                          onClick={() => acknowledgeHandover(ho.id)}
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>{t('dashboards.acknowledge')}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('tasks.dashboardTitle')}
              subtitle={t('tasks.dashboardSub', {
                open: openTasks.length,
                overdue: overdueTasks.length,
              })}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('tasks')}>
                  <ListTodo className="w-4 h-4" aria-hidden="true" />
                  <span>{t('common.open')}</span>
                </Button>
              }
            />
            <div className="divide-y aarvi-divider">
              {openTasks.slice(0, 3).map((task) => (
                <div key={task.id} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#172C40] truncate">{task.title}</p>
                    <p className="text-xs text-[#172C40]/70 truncate">
                      {task.assignedToName} · {t(`tasks.priorities.${task.priority}`)}
                    </p>
                  </div>
                  <StatusIndicator
                    tone={task.status === 'overdue' ? 'coral' : 'amber'}
                    label={t(`tasks.statuses.${task.status}`)}
                  />
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('visits.dashboardTitle')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('visits')}>
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>{t('common.open')}</span>
                </Button>
              }
            />
            {activeVisit ? (
              <div className="text-sm space-y-1">
                <p className="font-semibold text-[#172C40]">{activeVisit.title}</p>
                <p className="text-xs text-[#176D65]">
                  {activeVisit.caregiverName} · {t(`visits.statuses.${activeVisit.status}`)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('visits.emptyDesc')}</p>
            )}
            <div className="mt-4 pt-3 border-t aarvi-divider flex items-center justify-between gap-3">
              <span className="text-xs text-[#172C40]/75 tabular-nums">
                <Lock className="w-3.5 h-3.5 inline mr-1 text-[#176D65]" aria-hidden="true" />
                {t('consent.activeGrantsSummary', {count: activeConsentCount})}
              </span>
              <button
                type="button"
                onClick={() => setActiveRoute('privacy_consent')}
                className="text-xs font-semibold text-[#176D65] hover:underline cursor-pointer"
              >
                {t('nav.privacy_consent')}
              </button>
            </div>
          </SurfaceCard>

          <SurfaceCard tone="inset">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base text-[#172C40]">
                  {t('nav.ai_assistant')}
                </h3>
                <p className="text-sm text-[#172C40]/72 mt-1">{t('aiAssistant.dashboardPromo')}</p>
              </div>
              <Bot className="w-5 h-5 text-[#269B91] shrink-0" aria-hidden="true" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => setActiveRoute('ai_assistant')}>
                <span>{t('aiAssistant.openAssistant')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveRoute('offline_sync')}>
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('dashboards.inspectQueue')}</span>
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
