import {
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  HeartHandshake,
  KeyRound,
  Lock,
  Phone,
  Pill,
  ShieldAlert,
  User,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {filterTasksForPatient} from '../../../shared/tasks';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function ElderlyPatientDashboard() {
  const {
    patientProfile,
    medications,
    overdueMedicationIds,
    logMedicationDose,
    appointments,
    handovers,
    escalationEvents,
    careTasks,
    caregiverVisits,
    setActiveRoute,
    preferences,
    updatePreferences,
  } = useAarvi();
  const {t} = useTranslation();

  const pendingMeds = medications.filter((m) => m.status === 'pending' || m.status === 'unconfirmed');
  const takenCount = medications.filter(
    (m) => m.status === 'taken' || m.status === 'late_confirmed',
  ).length;
  const nextAppointment = appointments.find((a) => a.status === 'upcoming');
  const latestHandover = handovers[0];
  const primaryContacts = patientProfile.careCircle.filter((c) => c.isPrimary);
  const openEscalations = escalationEvents.filter((ev) => ev.status !== 'resolved');
  const safeActivities = filterTasksForPatient(careTasks).slice(0, 3);
  const nextScheduledVisit = caregiverVisits.find(
    (v) => v.status === 'scheduled' || v.status === 'ongoing',
  );

  return (
    <div className="space-y-6">
      {/* Tidewell-inspired Deep Navy Hero Banner */}
      <SurfaceCard tone="hero" className="p-6 sm:p-9">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-[#E99483]">{t('dashboards.patientBadge')}</p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F5F0E6] mt-2 leading-tight">
              {t('dashboards.patientGreeting', {name: patientProfile.preferredName})}
            </h1>
            <p className="text-base text-[#F5F0E6]/82 mt-3 leading-relaxed tabular-nums">
              {t('dashboards.patientSummary', {
                pending: pendingMeds.length,
                taken: takenCount,
                total: medications.length,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-[#F5F0E6]/75 mr-1">
              {t('dashboards.textSizeLabel')}
            </span>
            {(['standard', 'large', 'xlarge'] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => updatePreferences({textScale: scale})}
                aria-pressed={preferences.textScale === scale}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  preferences.textScale === scale
                    ? 'bg-[#F5F0E6] text-[#172C40] border-[#F5F0E6]'
                    : 'bg-[#F5F0E6]/10 text-[#F5F0E6] border-[#F5F0E6]/20 hover:bg-[#F5F0E6]/18'
                }`}
              >
                {scale === 'standard'
                  ? t('onboarding.sizeStandard')
                  : scale === 'large'
                    ? t('onboarding.sizeLarge')
                    : t('onboarding.sizeXlarge')}
              </button>
            ))}
          </div>
        </div>
      </SurfaceCard>

      {/* Calm Stage-1 Dose Follow-Up Prompt (Module 17) */}
      {openEscalations.length > 0 && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-base text-[#172C40]">
                  {t('escalation.patientReminderTitle', {
                    med: openEscalations[0].medicationName,
                    time: openEscalations[0].scheduledTime,
                  })}
                </p>
                <p className="text-sm text-[#172C40]/78 mt-0.5">
                  {t('escalation.patientReminderSub')}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="teal"
                size="sm"
                onClick={() => logMedicationDose(openEscalations[0].medicationId, 'taken')}
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{t('dashboards.markTaken')}</span>
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setActiveRoute('escalation')}>
                <span>{t('escalation.openQueueBtn')}</span>
              </Button>
            </div>
          </div>
        </SurfaceCard>
      )}

      {/* Main Focal Anchor: Today's Medicines on Warm Cream */}
      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('dashboards.yourMedicinesToday')}
          subtitle={t('dashboards.yourMedicinesSubtitle')}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setActiveRoute('ai_assistant')}>
                <Bot className="w-4 h-4" aria-hidden="true" />
                <span>{t('nav.ai_assistant')}</span>
              </Button>
              <Button variant="primary" onClick={() => setActiveRoute('medications')}>
                <Pill className="w-4 h-4" aria-hidden="true" />
                <span>{t('dashboards.fullSchedule')}</span>
              </Button>
            </div>
          }
        />

        <div className="divide-y aarvi-divider">
          {medications.map((med) => {
            const overdue = overdueMedicationIds.includes(med.id);
            return (
              <div
                key={med.id}
                className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#172C40]/70">
                    <span className="font-mono tabular-nums text-[#176D65] font-semibold">
                      {med.scheduledTime}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{med.purpose}</span>
                    {overdue && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#A84433]">
                          {t('missedDose.overdueLabel')}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="font-display text-lg font-bold text-[#172C40] mt-1">
                    {med.name} — {med.dosage}
                  </p>
                  <p className="text-sm text-[#172C40]/75 mt-0.5">{med.instructions}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {med.status === 'taken' ? (
                    <StatusIndicator
                      tone="teal"
                      icon="check"
                      label={t('dashboards.takenAt', {time: med.loggedAt ?? t('common.today')})}
                    />
                  ) : med.status === 'skipped' ? (
                    <div className="flex items-center gap-3">
                      <StatusIndicator tone="coral" icon="alert" label={t('dashboards.skipped')} />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => logMedicationDose(med.id, 'pending')}
                      >
                        {t('common.undo')}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="lg"
                      variant={overdue ? 'coral' : 'teal'}
                      onClick={() => logMedicationDose(med.id, 'taken')}
                    >
                      <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                      <span>{t('dashboards.markTaken')}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SurfaceCard tone="cream" className="flex flex-col justify-between">
          <div>
            <SectionHeader
              title={t('dashboards.nextAppointment')}
              subtitle={t('dashboards.nextAppointmentSub')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('appointments')}>
                  <Calendar className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.allVisits')}</span>
                </Button>
              }
            />
            {nextAppointment ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold text-[#176D65] tabular-nums">
                  {nextAppointment.dateLabel} · {nextAppointment.timeLabel}
                </div>
                <h3 className="font-display text-xl font-bold text-[#172C40]">
                  {nextAppointment.title}
                </h3>
                <p className="text-sm text-[#172C40]/75">
                  {t('dashboards.withClinician', {
                    clinician: nextAppointment.clinician,
                    facility: nextAppointment.facility,
                  })}
                </p>
                <p className="text-sm text-[#172C40] pt-3 border-t aarvi-divider">
                  <span className="font-semibold text-[#176D65]">
                    {t('dashboards.accompanyingYou')}
                  </span>{' '}
                  {nextAppointment.companionAssigned}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('dashboards.noUpcomingVisits')}</p>
            )}
          </div>

          {latestHandover && (
            <div className="mt-6 pt-4 border-t aarvi-divider">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#A84433]">
                <HeartHandshake className="w-4 h-4" aria-hidden="true" />
                <span>
                  {t('dashboards.latestCaregiverNote', {time: latestHandover.createdAtLabel})}
                </span>
              </div>
              <p className="text-sm text-[#172C40]/85 mt-1.5 leading-relaxed">
                {latestHandover.summary}
              </p>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard tone="cream" className="flex flex-col justify-between">
          <div>
            <SectionHeader
              title={t('dashboards.whoSupportingYou')}
              subtitle={t('dashboards.whoSupportingSub')}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveRoute('patient_profile')}
                >
                  <User className="w-4 h-4" aria-hidden="true" />
                  <span>{t('dashboards.myProfile')}</span>
                </Button>
              }
            />

            <div className="divide-y aarvi-divider">
              {primaryContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base text-[#172C40]">
                      {contact.name}
                    </p>
                    <p className="text-sm text-[#172C40]/72">
                      {contact.roleLabel} · {contact.relation}
                    </p>
                    <p className="text-xs text-[#176D65] mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{contact.availability}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-[#172C40] tabular-nums">
                      <Phone className="w-4 h-4 text-[#269B91]" aria-hidden="true" />
                      <span>{contact.phone}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t aarvi-divider text-sm text-[#172C40]/78">
            <span className="font-semibold text-[#172C40]">{t('dashboards.comfortNote')}</span>{' '}
            {patientProfile.comfortPreferences}
          </div>
        </SurfaceCard>
      </div>

      {/* Modules 18, 19 & 20 Patient-Safe Coordination Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SurfaceCard tone="cream" className="flex flex-col justify-between">
          <div>
            <SectionHeader
              title={t('tasks.patientListTitle')}
              subtitle={t('tasks.patientPrivacyNote')}
              action={
                <Button variant="secondary" size="sm" onClick={() => setActiveRoute('tasks')}>
                  <span>{t('common.open')}</span>
                </Button>
              }
            />
            {safeActivities.length === 0 ? (
              <p className="text-sm text-[#172C40]/72">{t('tasks.patientEmptyDesc')}</p>
            ) : (
              <div className="divide-y aarvi-divider">
                {safeActivities.map((act) => (
                  <div
                    key={act.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-[#172C40] truncate">{act.title}</p>
                      <p className="text-xs text-[#172C40]/70">
                        {t('tasks.handledBy', {name: act.assignedToName})}
                      </p>
                    </div>
                    <StatusIndicator
                      tone={act.status === 'completed' ? 'teal' : 'navy'}
                      label={t(`tasks.statuses.${act.status}`)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard tone="cream" className="flex flex-col justify-between space-y-4">
          <div>
            <SectionHeader
              title={t('visits.patientCardTitle')}
              subtitle={t('visits.patientCardSub')}
              action={
                <Button variant="teal" size="sm" onClick={() => setActiveRoute('visits')}>
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>{t('visits.showCodeBtn')}</span>
                </Button>
              }
            />
            {nextScheduledVisit ? (
              <div className="text-sm space-y-1">
                <p className="font-display font-bold text-[#172C40]">{nextScheduledVisit.title}</p>
                <p className="text-xs text-[#176D65] font-semibold tabular-nums">
                  {nextScheduledVisit.caregiverName} ·{' '}
                  {new Date(nextScheduledVisit.scheduledStartIso).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#172C40]/72">{t('visits.emptyDesc')}</p>
            )}
          </div>

          <div className="pt-4 border-t aarvi-divider flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[#172C40]/80">
              <Lock className="w-4 h-4 text-[#176D65]" aria-hidden="true" />
              <span>{t('consent.patientShortcutHint')}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => setActiveRoute('privacy_consent')}>
              <span>{t('nav.privacy_consent')}</span>
            </Button>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
