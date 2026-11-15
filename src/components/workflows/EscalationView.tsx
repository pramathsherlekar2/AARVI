import React, {useState} from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  Settings2,
  ShieldAlert,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {DoseStatus, EscalationResolutionMethod} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function EscalationView() {
  const {
    session,
    patientProfile,
    medications,
    getEffectiveDoseStatus,
    logMedicationDose,
    escalationConfig,
    escalationEvents,
    notificationDeliveries,
    updateEscalationConfig,
    runEscalationEvaluation,
    acknowledgeEscalation,
    retryNotificationDelivery,
    effectiveOnline,
  } = useAarvi();
  const {t} = useTranslation();

  const canEditConfig = session?.role === 'elderly_patient' || session?.role === 'family_member';

  const [graceMinutes, setGraceMinutes] = useState(String(escalationConfig.gracePeriodMinutes));
  const [stage1To2, setStage1To2] = useState(String(escalationConfig.stage1ToStage2Minutes));
  const [stage2To3, setStage2To3] = useState(String(escalationConfig.stage2ToStage3Minutes));
  const [caregiverId, setCaregiverId] = useState(escalationConfig.assignedCaregiverId);
  const [familyIds, setFamilyIds] = useState<string[]>(escalationConfig.authorizedFamilyIds);
  const [inAppOn, setInAppOn] = useState(escalationConfig.channels.inApp);
  const [emailOn, setEmailOn] = useState(escalationConfig.channels.email);
  const [pushOn, setPushOn] = useState(escalationConfig.channels.push);
  const [quietOn, setQuietOn] = useState(escalationConfig.quietHoursEnabled);
  const [quietStart, setQuietStart] = useState(String(escalationConfig.quietStartHour24));
  const [quietEnd, setQuietEnd] = useState(String(escalationConfig.quietEndHour24));

  const [simTimeInput, setSimTimeInput] = useState('14:45');
  const [feedback, setFeedback] = useState<{ok: boolean; text: string} | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const caregivers = patientProfile.careCircle.filter((c) =>
    c.roleLabel.toLowerCase().includes('caregiver'),
  );
  const familyContacts = patientProfile.careCircle.filter(
    (c) =>
      !c.roleLabel.toLowerCase().includes('caregiver') &&
      !c.roleLabel.toLowerCase().includes('physician'),
  );

  const parseHhMmToMinutes = (hhmm: string): number => {
    const [hh, mm] = hhmm.split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return 14 * 60 + 45;
    return hh * 60 + mm;
  };

  const handleEvaluate = async (useSimulatedTime: boolean) => {
    setBusyId('evaluate');
    const simMinutes = useSimulatedTime ? parseHhMmToMinutes(simTimeInput) : undefined;
    const res = await runEscalationEvaluation(simMinutes);
    setBusyId(null);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('escalation.evalFailed')});
    } else {
      setFeedback({
        ok: true,
        text: t('escalation.evalSuccess', {created: res.created, advanced: res.advanced}),
      });
    }
  };

  const handleAck = async (eventId: string, resolve: boolean, method?: EscalationResolutionMethod) => {
    setBusyId(eventId);
    const res = await acknowledgeEscalation(eventId, resolve, method);
    setBusyId(null);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('escalation.actionFailed')});
    } else {
      setFeedback({
        ok: true,
        text: resolve ? t('escalation.resolvedSuccess') : t('escalation.ackedSuccess'),
      });
    }
  };

  const handleRetryDelivery = async (deliveryId: string) => {
    setBusyId(deliveryId);
    const res = await retryNotificationDelivery(deliveryId);
    setBusyId(null);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('escalation.retryFailed')});
    } else {
      setFeedback({ok: true, text: t('escalation.retryTriggered')});
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const chosenCaregiver = caregivers.find((c) => c.id === caregiverId);
    const res = await updateEscalationConfig({
      gracePeriodMinutes: Math.max(5, Number(graceMinutes) || 30),
      stage1ToStage2Minutes: Math.max(5, Number(stage1To2) || 20),
      stage2ToStage3Minutes: Math.max(5, Number(stage2To3) || 25),
      assignedCaregiverId: caregiverId,
      assignedCaregiverName: chosenCaregiver?.name ?? escalationConfig.assignedCaregiverName,
      authorizedFamilyIds: familyIds,
      channels: {inApp: inAppOn, email: emailOn, push: pushOn},
      quietHoursEnabled: quietOn,
      quietStartHour24: Math.min(23, Math.max(0, Number(quietStart) || 22)),
      quietEndHour24: Math.min(23, Math.max(0, Number(quietEnd) || 7)),
    });
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('escalation.configError')});
    } else {
      setFeedback({ok: true, text: t('escalation.configSaved')});
    }
  };

  const toggleFamilyRecipient = (id: string) => {
    setFamilyIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const doseStatusLabel = (status: DoseStatus) => {
    switch (status) {
      case 'pending':
        return t('escalation.doseStates.pending');
      case 'unconfirmed':
        return t('escalation.doseStates.unconfirmed');
      case 'taken':
        return t('escalation.doseStates.taken');
      case 'late_confirmed':
        return t('escalation.doseStates.late_confirmed');
      case 'skipped':
        return t('escalation.doseStates.skipped');
      case 'missed':
        return t('escalation.doseStates.missed');
    }
  };

  const activeEscalations = escalationEvents.filter((ev) => ev.status !== 'resolved');
  const resolvedEscalations = escalationEvents.filter((ev) => ev.status === 'resolved');

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('escalation.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('escalation.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-2xl">{t('escalation.pageSub')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <Button
              variant="coral"
              disabled={busyId === 'evaluate'}
              onClick={() => void handleEvaluate(false)}
              data-testid="eval-escalation-now"
            >
              <BellRing className="w-4 h-4" aria-hidden="true" />
              <span>{t('escalation.evaluateNow')}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[#F5F0E6]/15">
          <div>
            <p className="text-xs text-[#F5F0E6]/70">{t('escalation.kpiOpen')}</p>
            <p className="font-display text-2xl font-bold text-[#E99483] tabular-nums mt-0.5">
              {activeEscalations.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#F5F0E6]/70">{t('escalation.kpiResolved')}</p>
            <p className="font-display text-2xl font-bold text-[#5EEAD4] tabular-nums mt-0.5">
              {resolvedEscalations.length}
            </p>
          </div>
          <div>
            <p className="text-xs text-[#F5F0E6]/70">{t('escalation.kpiGrace')}</p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-0.5">
              {escalationConfig.gracePeriodMinutes}m
            </p>
          </div>
          <div>
            <p className="text-xs text-[#F5F0E6]/70">{t('escalation.kpiDeliveries')}</p>
            <p className="font-display text-2xl font-bold text-[#F5F0E6] tabular-nums mt-0.5">
              {notificationDeliveries.length}
            </p>
          </div>
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

      {/* Medication 5-State Monitoring & Stage Check */}
      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('escalation.monitoringTitle')}
          subtitle={t('escalation.monitoringSub')}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="sim-clock" className="text-xs font-semibold text-[#172C40]">
                {t('escalation.checkAtTime')}
              </label>
              <input
                id="sim-clock"
                type="time"
                value={simTimeInput}
                onChange={(e) => setSimTimeInput(e.target.value)}
                className="aarvi-input w-32 py-1.5 text-sm font-mono tabular-nums"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={busyId === 'evaluate'}
                onClick={() => void handleEvaluate(true)}
                data-testid="eval-escalation-simulated"
              >
                <Clock className="w-4 h-4" aria-hidden="true" />
                <span>{t('escalation.runTimeCheck')}</span>
              </Button>
            </div>
          }
        />

        <div className="divide-y aarvi-divider">
          {medications.map((med) => {
            const effectiveStatus = getEffectiveDoseStatus(med);
            return (
              <div
                key={med.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                    <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                      {med.scheduledTime}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {t('escalation.graceWindowInfo', {minutes: med.gracePeriodMinutes})}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        effectiveStatus === 'unconfirmed' || effectiveStatus === 'missed'
                          ? 'text-[#A84433]'
                          : effectiveStatus === 'taken' || effectiveStatus === 'late_confirmed'
                            ? 'text-[#176D65]'
                            : 'text-[#8F5312]'
                      }`}
                    >
                      {doseStatusLabel(effectiveStatus)}
                    </span>
                  </div>
                  <p className="font-display font-bold text-base text-[#172C40] mt-0.5">
                    {med.name} — {med.dosage}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {(effectiveStatus === 'pending' || effectiveStatus === 'unconfirmed') && (
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
                        variant="secondary"
                        onClick={() =>
                          logMedicationDose(med.id, 'skipped', t('medications.deferredReason'))
                        }
                      >
                        <span>{t('medications.skipDose')}</span>
                      </Button>
                    </>
                  )}
                  {(effectiveStatus === 'taken' || effectiveStatus === 'late_confirmed') && (
                    <StatusIndicator
                      tone="teal"
                      icon="check"
                      label={doseStatusLabel(effectiveStatus)}
                    />
                  )}
                  {(effectiveStatus === 'skipped' || effectiveStatus === 'missed') && (
                    <StatusIndicator
                      tone="coral"
                      icon="alert"
                      label={doseStatusLabel(effectiveStatus)}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Escalation Events + Chronological Timeline */}
        <div className="lg:col-span-7 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('escalation.eventsTitle')}
              subtitle={t('escalation.eventsSub')}
              action={<ShieldAlert className="w-5 h-5 text-[#A84433]" aria-hidden="true" />}
            />

            {escalationEvents.length === 0 ? (
              <EmptyState
                title={t('escalation.emptyTitle')}
                description={t('escalation.emptyDesc')}
              />
            ) : (
              <div className="space-y-4">
                {escalationEvents.map((ev) => (
                  <article
                    key={ev.id}
                    className="p-4 rounded-xl bg-[#FAF6EE] border border-[#172C40]/14 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#176D65] tabular-nums">
                          {t('escalation.stageLabel', {stage: ev.stage})} · {ev.scheduledTime} ·{' '}
                          {ev.doseDate}
                        </p>
                        <h3 className="font-display font-bold text-base text-[#172C40] mt-0.5">
                          {ev.medicationName} ({ev.dosage})
                        </h3>
                        <p className="text-xs text-[#172C40]/72 mt-0.5">
                          {t(`escalation.eventStatuses.${ev.status}`)}
                          {ev.acknowledgedBy
                            ? ` · ${t('dashboards.acknowledgedBy', {name: ev.acknowledgedBy})}`
                            : ''}
                          {ev.resolvedBy
                            ? ` · ${t('escalation.resolvedBy', {name: ev.resolvedBy})}`
                            : ''}
                        </p>
                      </div>

                      {ev.status !== 'resolved' ? (
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {!ev.acknowledgedBy && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={busyId === ev.id}
                              onClick={() => void handleAck(ev.id, false)}
                            >
                              <span>{t('dashboards.acknowledge')}</span>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="teal"
                            disabled={busyId === ev.id}
                            onClick={() =>
                              void handleAck(
                                ev.id,
                                true,
                                session?.role === 'elderly_patient'
                                  ? 'patient_confirmed_taken'
                                  : session?.role === 'caregiver'
                                    ? 'caregiver_confirmed_taken'
                                    : 'family_acknowledged_resolved',
                              )
                            }
                          >
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span>{t('escalation.resolveBtn')}</span>
                          </Button>
                        </div>
                      ) : (
                        <StatusIndicator
                          tone="teal"
                          icon="check"
                          label={t('escalation.eventStatuses.resolved')}
                        />
                      )}
                    </div>

                    {/* Timeline Steps */}
                    <ol className="space-y-1.5 pt-2 border-t aarvi-divider text-xs">
                      {ev.timeline.map((step) => (
                        <li key={step.id} className="flex items-start justify-between gap-2">
                          <span className="text-[#172C40]/85">
                            <span className="font-semibold text-[#172C40]">{step.actorName}:</span>{' '}
                            {step.action}
                            {step.note ? ` — ${step.note}` : ''}
                          </span>
                          <span className="font-mono text-[#176D65] shrink-0 tabular-nums">
                            {step.timestampLabel}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            )}
          </SurfaceCard>

          {/* Delivery Reliability Ledger */}
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('escalation.deliveriesTitle')}
              subtitle={t('escalation.deliveriesSub')}
            />
            {notificationDeliveries.length === 0 ? (
              <p className="text-sm text-[#172C40]/72">{t('escalation.noDeliveries')}</p>
            ) : (
              <div className="divide-y aarvi-divider">
                {notificationDeliveries.slice(0, 12).map((del) => (
                  <div
                    key={del.id}
                    className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-[#172C40]/70">
                        <span className="font-semibold text-[#172C40]">{del.recipientName}</span> ·{' '}
                        {del.channel.toUpperCase()} ·{' '}
                        <span
                          className={`font-semibold ${
                            del.status === 'sent' || del.status === 'acknowledged'
                              ? 'text-[#176D65]'
                              : del.status === 'queued'
                                ? 'text-[#8F5312]'
                                : 'text-[#A84433]'
                          }`}
                        >
                          {t(`escalation.deliveryStates.${del.status}`)}
                        </span>
                        {del.retryCount > 0 ? ` (${del.retryCount} retries)` : ''}
                      </p>
                      <p className="font-semibold text-[#172C40] mt-0.5 truncate">{del.title}</p>
                      {del.errorDetail && (
                        <p className="text-xs text-[#A84433] mt-0.5">{del.errorDetail}</p>
                      )}
                    </div>

                    {(del.status === 'failed' ||
                      del.status === 'provider_unconfigured' ||
                      del.status === 'queued') && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={!effectiveOnline || busyId === del.id}
                        onClick={() => void handleRetryDelivery(del.id)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t('escalation.retryBtn')}</span>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>

        {/* Escalation Configuration Panel */}
        <SurfaceCard tone="cream" className="lg:col-span-5">
          <SectionHeader
            title={t('escalation.configTitle')}
            subtitle={t('escalation.configSub')}
            action={<Settings2 className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />

          {!canEditConfig && (
            <div className="mb-4 p-3 rounded-xl bg-[#EBE3D3] text-xs font-medium text-[#172C40]">
              <AlertTriangle className="w-4 h-4 inline mr-1.5 text-[#A84433]" aria-hidden="true" />
              {t('escalation.caregiverReadOnlyConfig')}
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="esc-grace" className="block text-xs font-semibold text-[#172C40] mb-1">
                  {t('escalation.graceLabel')}
                </label>
                <input
                  id="esc-grace"
                  type="number"
                  min={5}
                  max={240}
                  disabled={!canEditConfig}
                  value={graceMinutes}
                  onChange={(e) => setGraceMinutes(e.target.value)}
                  className="aarvi-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="esc-s12" className="block text-xs font-semibold text-[#172C40] mb-1">
                  {t('escalation.stage1To2Label')}
                </label>
                <input
                  id="esc-s12"
                  type="number"
                  min={5}
                  max={240}
                  disabled={!canEditConfig}
                  value={stage1To2}
                  onChange={(e) => setStage1To2(e.target.value)}
                  className="aarvi-input font-mono tabular-nums"
                />
              </div>
              <div>
                <label htmlFor="esc-s23" className="block text-xs font-semibold text-[#172C40] mb-1">
                  {t('escalation.stage2To3Label')}
                </label>
                <input
                  id="esc-s23"
                  type="number"
                  min={5}
                  max={240}
                  disabled={!canEditConfig}
                  value={stage2To3}
                  onChange={(e) => setStage2To3(e.target.value)}
                  className="aarvi-input font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label htmlFor="esc-cg" className="block text-xs font-semibold text-[#172C40] mb-1">
                {t('escalation.assignedCaregiver')}
              </label>
              <select
                id="esc-cg"
                disabled={!canEditConfig}
                value={caregiverId}
                onChange={(e) => setCaregiverId(e.target.value)}
                className="aarvi-input"
              >
                {caregivers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.roleLabel})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#172C40] mb-1.5">
                {t('escalation.authorizedFamily')}
              </p>
              <div className="space-y-1.5">
                {familyContacts.map((fam) => {
                  const checked = familyIds.includes(fam.id);
                  return (
                    <label
                      key={fam.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={!canEditConfig}
                        checked={checked}
                        onChange={() => toggleFamilyRecipient(fam.id)}
                        className="w-4 h-4 accent-[#269B91]"
                      />
                      <span className="text-xs font-medium text-[#172C40]">
                        {fam.name} · {fam.relation}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-[#172C40] mb-1.5">
                {t('escalation.channelsLabel')}
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditConfig}
                    checked={inAppOn}
                    onChange={(e) => setInAppOn(e.target.checked)}
                    className="w-4 h-4 accent-[#269B91]"
                  />
                  <span>{t('escalation.channelInApp')}</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditConfig}
                    checked={emailOn}
                    onChange={(e) => setEmailOn(e.target.checked)}
                    className="w-4 h-4 accent-[#269B91]"
                  />
                  <span>{t('escalation.channelEmail')}</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canEditConfig}
                    checked={pushOn}
                    onChange={(e) => setPushOn(e.target.checked)}
                    className="w-4 h-4 accent-[#269B91]"
                  />
                  <span>{t('escalation.channelPush')}</span>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t aarvi-divider space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-[#172C40] cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canEditConfig}
                  checked={quietOn}
                  onChange={(e) => setQuietOn(e.target.checked)}
                  className="w-4 h-4 accent-[#269B91]"
                />
                <span>{t('notifications.quietHours')}</span>
              </label>

              {quietOn && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="qh-start" className="block text-xs text-[#172C40]/75 mb-1">
                      {t('escalation.quietStartHour')}
                    </label>
                    <input
                      id="qh-start"
                      type="number"
                      min={0}
                      max={23}
                      disabled={!canEditConfig}
                      value={quietStart}
                      onChange={(e) => setQuietStart(e.target.value)}
                      className="aarvi-input font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label htmlFor="qh-end" className="block text-xs text-[#172C40]/75 mb-1">
                      {t('escalation.quietEndHour')}
                    </label>
                    <input
                      id="qh-end"
                      type="number"
                      min={0}
                      max={23}
                      disabled={!canEditConfig}
                      value={quietEnd}
                      onChange={(e) => setQuietEnd(e.target.value)}
                      className="aarvi-input font-mono tabular-nums"
                    />
                  </div>
                </div>
              )}
            </div>

            {canEditConfig && (
              <Button type="submit" variant="primary" className="w-full">
                {t('escalation.saveConfigBtn')}
              </Button>
            )}
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
}
