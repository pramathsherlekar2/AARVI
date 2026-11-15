import {Calendar, CheckCircle2, Clock, HeartHandshake, Phone, Pill, User} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function ElderlyPatientDashboard() {
  const {
    patientProfile,
    medications,
    logMedicationDose,
    appointments,
    handovers,
    setActiveRoute,
    preferences,
    updatePreferences,
  } = useAarvi();
  const {t} = useTranslation();

  const pendingMeds = medications.filter((m) => m.status === 'pending');
  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const nextAppointment = appointments.find((a) => a.status === 'upcoming');
  const latestHandover = handovers[0];
  const primaryContacts = patientProfile.careCircle.filter((c) => c.isPrimary);

  return (
    <div className="space-y-6">
      {/* Hero Greeting with Blue-to-Coral Atmospheric Glow */}
      <SurfaceCard tone="hero" className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('dashboards.patientBadge')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('dashboards.patientGreeting', {name: patientProfile.preferredName})}
            </h1>
            <p className="text-base text-[#DCE5F4] mt-2 leading-relaxed tabular-nums">
              {t('dashboards.patientSummary', {
                pending: pendingMeds.length,
                taken: takenCount,
                total: medications.length,
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-[#AAB8CE] mr-1">
              {t('dashboards.textSizeLabel')}
            </span>
            {(['standard', 'large', 'xlarge'] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                onClick={() => updatePreferences({textScale: scale})}
                aria-pressed={preferences.textScale === scale}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-sm font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  preferences.textScale === scale
                    ? 'bg-[#4778B8] text-white border-[#8BB8F2]/60'
                    : 'bg-white/10 text-[#F7F8FC] border-white/15 hover:bg-white/15'
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

      {/* Main Focal Anchor: Today's Medicines */}
      <SurfaceCard>
        <SectionHeader
          title={t('dashboards.yourMedicinesToday')}
          subtitle={t('dashboards.yourMedicinesSubtitle')}
          action={
            <Button variant="secondary" onClick={() => setActiveRoute('medications')}>
              <Pill className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.fullSchedule')}</span>
            </Button>
          }
        />

        <div className="space-y-3">
          {medications.map((med) => (
            <div
              key={med.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-white/12 bg-white/5 hover:bg-white/8 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#AAB8CE]">
                  <span className="font-mono tabular-nums text-[#8BB8F2] font-semibold">
                    {med.scheduledTime}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{med.purpose}</span>
                </div>
                <p className="font-display text-lg font-bold text-[#F7F8FC] mt-1">
                  {med.name} — {med.dosage}
                </p>
                <p className="text-sm text-[#AAB8CE] mt-0.5">{med.instructions}</p>
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
                    variant="teal"
                    onClick={() => logMedicationDose(med.id, 'taken')}
                  >
                    <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                    <span>{t('dashboards.markTaken')}</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <SurfaceCard className="flex flex-col justify-between">
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
                <div className="text-sm font-semibold text-[#8BB8F2] tabular-nums">
                  {nextAppointment.dateLabel} · {nextAppointment.timeLabel}
                </div>
                <h3 className="font-display text-xl font-bold text-[#F7F8FC]">
                  {nextAppointment.title}
                </h3>
                <p className="text-sm text-[#AAB8CE]">
                  {t('dashboards.withClinician', {
                    clinician: nextAppointment.clinician,
                    facility: nextAppointment.facility,
                  })}
                </p>
                <p className="text-sm text-[#F7F8FC] pt-3 border-t border-white/12">
                  <span className="font-semibold text-[#8BB8F2]">
                    {t('dashboards.accompanyingYou')}
                  </span>{' '}
                  {nextAppointment.companionAssigned}
                </p>
              </div>
            ) : (
              <p className="text-sm text-[#AAB8CE]">{t('dashboards.noUpcomingVisits')}</p>
            )}
          </div>

          {latestHandover && (
            <div className="mt-6 pt-4 border-t border-white/12">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#AAB8CE]">
                <HeartHandshake className="w-4 h-4 text-[#F16B70]" aria-hidden="true" />
                <span>
                  {t('dashboards.latestCaregiverNote', {time: latestHandover.createdAtLabel})}
                </span>
              </div>
              <p className="text-sm text-[#DCE5F4] mt-1.5 leading-relaxed">
                {latestHandover.summary}
              </p>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="flex flex-col justify-between">
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

            <div className="divide-y divide-white/10">
              {primaryContacts.map((contact) => (
                <div
                  key={contact.id}
                  className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-display font-bold text-base text-[#F7F8FC]">
                      {contact.name}
                    </p>
                    <p className="text-sm text-[#AAB8CE]">
                      {contact.roleLabel} · {contact.relation}
                    </p>
                    <p className="text-xs text-[#5EEAD4] mt-0.5 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{contact.availability}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-[#F7F8FC] tabular-nums">
                      <Phone className="w-4 h-4 text-[#8BB8F2]" aria-hidden="true" />
                      <span>{contact.phone}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/12 text-sm text-[#AAB8CE]">
            <span className="font-semibold text-[#F7F8FC]">{t('dashboards.comfortNote')}</span>{' '}
            {patientProfile.comfortPreferences}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
