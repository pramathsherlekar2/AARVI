import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Pill,
  RefreshCw,
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
    appointments,
    handovers,
    acknowledgeHandover,
    effectiveOnline,
    pendingQueueCount,
    setActiveRoute,
  } = useAarvi();
  const {t} = useTranslation();

  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const skippedCount = medications.filter((m) => m.status === 'skipped').length;
  const pendingCount = medications.filter((m) => m.status === 'pending').length;
  const lowRefillMeds = medications.filter((m) => m.refillDaysRemaining <= 10);
  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const unacknowledgedHandovers = handovers.filter((h) => !h.acknowledgedBy);

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('dashboards.familyBadge')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('dashboards.familyTitle', {name: patientProfile.fullName})}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1.5">
              {t('dashboards.signedInAs', {
                name: session?.fullName ?? '',
                relation: session?.relationshipOrTitle ?? '',
              })}{' '}
              · {patientProfile.residenceSummary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button variant="secondary" onClick={() => setActiveRoute('patient_profile')}>
              <User className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.patientProfileBtn')}</span>
            </Button>
            <Button variant="teal" onClick={() => setActiveRoute('handovers')}>
              <ClipboardCheck className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.reviewHandoversBtn')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/15">
          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('dashboards.kpiDosesTaken')}</p>
            <p className="font-display text-2xl font-bold text-[#F7F8FC] tabular-nums mt-1">
              {takenCount} / {medications.length}
            </p>
            <p className="text-xs text-[#5EEAD4] mt-0.5 tabular-nums">
              {t('dashboards.kpiPendingSkipped', {pending: pendingCount, skipped: skippedCount})}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('dashboards.kpiUpcomingVisits')}</p>
            <p className="font-display text-2xl font-bold text-[#F7F8FC] tabular-nums mt-1">
              {upcomingAppointments.length}
            </p>
            <p className="text-xs text-[#AAB8CE] mt-0.5 truncate">
              {upcomingAppointments[0]?.dateLabel ?? t('dashboards.kpiNoneScheduled')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">
              {t('dashboards.kpiHandoversAwaiting')}
            </p>
            <p className="font-display text-2xl font-bold text-[#F7F8FC] tabular-nums mt-1">
              {unacknowledgedHandovers.length}
            </p>
            <p className="text-xs text-[#F16B70] mt-0.5">
              {unacknowledgedHandovers.length > 0
                ? t('dashboards.kpiNeedsReview')
                : t('dashboards.kpiAllAcknowledged')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('dashboards.kpiConnectivity')}</p>
            <p className="font-display text-2xl font-bold text-[#F7F8FC] tabular-nums mt-1">
              {effectiveOnline ? t('common.online') : t('common.offline')}
            </p>
            <p className="text-xs text-[#AAB8CE] mt-0.5 tabular-nums">
              {t('dashboards.kpiQueuedCount', {count: pendingQueueCount})}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <SurfaceCard>
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

            <div className="divide-y divide-white/10">
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-[#AAB8CE]">
                      <span className="font-mono font-semibold text-[#8BB8F2] tabular-nums">
                        {med.scheduledTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                    </div>
                    <p className="font-semibold text-[#F7F8FC] mt-0.5">
                      {med.name}{' '}
                      <span className="font-normal text-[#AAB8CE]">({med.dosage})</span>
                    </p>
                    {med.loggedBy && (
                      <p className="text-xs text-[#AAB8CE] mt-0.5">
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
                    {med.status === 'skipped' && (
                      <StatusIndicator
                        tone="coral"
                        icon="alert"
                        label={t('dashboards.statusSkipped')}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lowRefillMeds.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/12 flex flex-wrap items-center justify-between gap-4">
                <div className="text-sm text-[#FFB4B7] font-medium">
                  {t('dashboards.refillAttention')}{' '}
                  {lowRefillMeds
                    .map((m) => `${m.name} (${t('common.daysShort', {days: m.refillDaysRemaining})})`)
                    .join(', ')}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveRoute('medications')}
                  className="text-sm font-semibold text-[#8BB8F2] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t('dashboards.inspectRefills')}
                </button>
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard>
            <SectionHeader
              title={t('dashboards.upcomingAndCompanion')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('appointments')}>
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.openVisits')}</span>
                </Button>
              }
            />
            <div className="space-y-3">
              {upcomingAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#8BB8F2] tabular-nums">
                      {apt.dateLabel} · {apt.timeLabel} · {apt.specialty}
                    </p>
                    <p className="font-display font-bold text-[#F7F8FC] mt-0.5">{apt.title}</p>
                    <p className="text-sm text-[#AAB8CE] mt-0.5">
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
          <SurfaceCard>
            <SectionHeader
              title={t('dashboards.latestCareHandovers')}
              subtitle={t('dashboards.ackToConfirm')}
            />
            <div className="space-y-4">
              {handovers.slice(0, 2).map((ho) => (
                <div
                  key={ho.id}
                  className="p-4 rounded-xl bg-white/5 border border-white/12 space-y-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#8BB8F2]">{ho.shiftLabel}</p>
                    <p className="text-sm font-bold text-[#F7F8FC] mt-0.5">
                      {ho.authorName} · {ho.createdAtLabel}
                    </p>
                  </div>
                  <p className="text-sm text-[#DCE5F4] leading-relaxed">{ho.summary}</p>
                  <div className="text-xs text-[#AAB8CE] flex flex-wrap gap-x-3 gap-y-1">
                    <span>
                      {t('handovers.mood')}: {ho.checklist.mood}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('handovers.appetite')}: {ho.checklist.appetite}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('handovers.mobility')}: {ho.checklist.mobility}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
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

          <SurfaceCard tone="dark">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display font-bold text-base text-[#F7F8FC]">
                  {t('dashboards.offlineSyncCardTitle')}
                </h3>
                <p className="text-sm text-[#AAB8CE] mt-1">{t('dashboards.offlineSyncCardDesc')}</p>
              </div>
              <RefreshCw className="w-5 h-5 text-[#5EEAD4] shrink-0" aria-hidden="true" />
            </div>
            <div className="mt-4">
              <Button variant="secondary" size="sm" onClick={() => setActiveRoute('offline_sync')}>
                <span>{t('dashboards.inspectQueue')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
