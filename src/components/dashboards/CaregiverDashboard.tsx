import {useState} from 'react';
import {
  Calendar,
  CheckCircle2,
  ClipboardPlus,
  Pill,
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
    logMedicationDose,
    appointments,
    handovers,
    setActiveRoute,
  } = useAarvi();
  const {t} = useTranslation();

  const [skipMedId, setSkipMedId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('Patient resting / deferred with family note');

  const dueMeds = medications.filter((m) => m.status === 'pending');
  const completedMeds = medications.filter((m) => m.status === 'taken');
  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const latestHandover = handovers[0];

  const handleConfirmSkip = (medId: string) => {
    logMedicationDose(medId, 'skipped', skipReason);
    setSkipMedId(null);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-[#F16B70]">{t('dashboards.caregiverBadge')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('dashboards.caregiverTitle', {name: patientProfile.fullName})}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1.5">
              {t('dashboards.onDutyLabel', {
                name: session?.fullName ?? '',
                title: session?.relationshipOrTitle ?? '',
                allergies: patientProfile.allergies.join(', '),
              })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button variant="secondary" onClick={() => setActiveRoute('patient_profile')}>
              <UserCheck className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.careNotesBtn')}</span>
            </Button>
            <Button variant="primary" onClick={() => setActiveRoute('handovers')}>
              <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
              <span>{t('dashboards.writeHandoverBtn')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/15">
          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('dashboards.dosesRemaining')}</p>
            <p className="font-display text-2xl font-bold text-[#F7F8FC] tabular-nums mt-1">
              {dueMeds.length}
            </p>
            <p className="text-xs text-[#5EEAD4] mt-0.5 tabular-nums">
              {t('dashboards.administeredCount', {count: completedMeds.length})}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">
              {t('dashboards.mobilityDietaryAlert')}
            </p>
            <p className="font-display text-lg font-bold text-[#F7F8FC] mt-1">
              {t('dashboards.caneOutdoors')}
            </p>
            <p className="text-xs text-[#AAB8CE] mt-0.5">{t('dashboards.lowSodiumVeg')}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('dashboards.nextCareVisit')}</p>
            <p className="font-display text-lg font-bold text-[#F7F8FC] mt-1 truncate">
              {upcomingAppointments[0]?.dateLabel ?? t('common.none')}
            </p>
            <p className="text-xs text-[#AAB8CE] mt-0.5 truncate">
              {upcomingAppointments[0]?.title ?? t('dashboards.noUpcomingShort')}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">
              {t('dashboards.prevShiftHandover')}
            </p>
            <p className="font-display text-lg font-bold text-[#F7F8FC] mt-1">
              {latestHandover?.acknowledgedBy
                ? t('dashboards.reviewed')
                : t('dashboards.pendingReview')}
            </p>
            <p className="text-xs text-[#AAB8CE] mt-0.5 truncate">
              {t('dashboards.byAuthor', {name: latestHandover?.authorName ?? ''})}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <SurfaceCard>
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

            <div className="space-y-3">
              {medications.map((med) => (
                <div
                  key={med.id}
                  className="p-4 rounded-xl border border-white/12 bg-white/5 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#AAB8CE]">
                        <span className="font-mono font-semibold text-[#8BB8F2] tabular-nums">
                          {med.scheduledTime}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t('common.daysSupplyLeft', {days: med.refillDaysRemaining})}</span>
                      </div>
                      <p className="font-display text-base font-bold text-[#F7F8FC] mt-0.5">
                        {med.name} — {med.dosage}
                      </p>
                      <p className="text-sm text-[#AAB8CE] mt-0.5">{med.instructions}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {med.status === 'pending' ? (
                        <>
                          <Button
                            size="sm"
                            variant="teal"
                            onClick={() => logMedicationDose(med.id, 'taken')}
                          >
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span>{t('dashboards.markTaken')}</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="coral"
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
                    <div className="pt-3 border-t border-white/12 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={skipReason}
                        onChange={(e) => setSkipReason(e.target.value)}
                        aria-label={t('dashboards.skipReasonAria')}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC]"
                      />
                      <Button size="sm" variant="coral" onClick={() => handleConfirmSkip(med.id)}>
                        {t('dashboards.confirmSkip')}
                      </Button>
                    </div>
                  )}

                  {med.status === 'skipped' && med.skipReason && (
                    <p className="text-xs text-[#FFB4B7]">
                      {t('dashboards.skipNotePrefix', {reason: med.skipReason})}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <SurfaceCard>
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
                <p className="text-xs font-semibold text-[#8BB8F2]">
                  {latestHandover.shiftLabel} · {latestHandover.authorName}
                </p>
                <p className="text-sm text-[#DCE5F4] leading-relaxed">{latestHandover.summary}</p>
                {latestHandover.pendingFollowUps.length > 0 && (
                  <div className="pt-3 border-t border-white/12">
                    <p className="text-xs font-semibold text-[#F7F8FC] mb-1.5">
                      {t('dashboards.pendingFollowUps')}
                    </p>
                    <ul className="space-y-1.5 text-sm text-[#AAB8CE] list-disc pl-5">
                      {latestHandover.pendingFollowUps.map((task, idx) => (
                        <li key={idx}>{task}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#AAB8CE]">{t('dashboards.noHandoverYet')}</p>
            )}
          </SurfaceCard>

          <SurfaceCard>
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
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-[#8BB8F2] tabular-nums">
                  {upcomingAppointments[0].dateLabel} · {upcomingAppointments[0].timeLabel}
                </p>
                <p className="font-display font-bold text-[#F7F8FC]">
                  {upcomingAppointments[0].title}
                </p>
                <p className="text-sm text-[#AAB8CE]">{upcomingAppointments[0].notes}</p>
              </div>
            ) : (
              <p className="text-sm text-[#AAB8CE]">{t('dashboards.noVisitsNeedPrep')}</p>
            )}
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
