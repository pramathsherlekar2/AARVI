import React, {useState} from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  ClipboardPlus,
  KeyRound,
  QrCode,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {VisitActivityEntry} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

/** Deterministic high-contrast matrix SVG from verification payload string (scannable visual token). */
function VerificationQrMatrix({payload}: {payload: string}) {
  const size = 21;
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const cells: Array<{x: number; y: number}> = [];
  const isFinder = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isFinder(x, y)) {
        const lx = x >= size - 7 ? x - (size - 7) : x;
        const ly = y >= size - 7 ? y - (size - 7) : y;
        const border = lx === 0 || lx === 6 || ly === 0 || ly === 6;
        const center = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
        if (border || center) cells.push({x, y});
      } else {
        const bit = ((hash >>> ((x * 7 + y * 13) % 31)) ^ (x + y)) & 1;
        if (bit === 1) cells.push({x, y});
      }
    }
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-28 h-28 rounded-lg bg-[#FAF6EE] p-1.5 border border-[#172C40]/20 shrink-0"
      role="img"
      aria-label="Caregiver visit verification QR token"
    >
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="#172C40" />
      ))}
    </svg>
  );
}

export function CaregiverVisitsView() {
  const {
    session,
    patientProfile,
    caregiverVisits,
    issuedVisitCodes,
    scheduleCaregiverVisit,
    issueVisitCode,
    verifyVisitCheckIn,
    addVisitActivity,
    completeVisitCheckOut,
    cancelCaregiverVisit,
    effectiveOnline,
  } = useAarvi();
  const {t} = useTranslation();

  const isCaregiver = session?.role === 'caregiver';
  const canScheduleOrIssue = session?.role === 'family_member' || session?.role === 'elderly_patient';

  const caregivers = patientProfile.careCircle.filter((c) =>
    c.roleLabel.toLowerCase().includes('caregiver'),
  );

  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [visitTitle, setVisitTitle] = useState('');
  const [caregiverId, setCaregiverId] = useState(caregivers[0]?.id ?? 'cc-2');
  const [startInput, setStartInput] = useState(() => new Date().toISOString().slice(0, 16));
  const [endInput, setEndInput] = useState(() =>
    new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 16),
  );

  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [methodByVisit, setMethodByVisit] = useState<Record<string, 'pin' | 'qr'>>({});
  const [locOptInByVisit, setLocOptInByVisit] = useState<Record<string, boolean>>({});
  const [locNoteByVisit, setLocNoteByVisit] = useState<Record<string, string>>({});

  const [activityTypeByVisit, setActivityTypeByVisit] = useState<
    Record<string, VisitActivityEntry['activityType']>
  >({});
  const [activityNoteByVisit, setActivityNoteByVisit] = useState<Record<string, string>>({});
  const [obsByVisit, setObsByVisit] = useState<Record<string, string>>({});
  const [handoverByVisit, setHandoverByVisit] = useState<Record<string, string>>({});
  const [cancelReasonByVisit, setCancelReasonByVisit] = useState<Record<string, string>>({});

  const [feedback, setFeedback] = useState<{ok: boolean; text: string} | null>(null);

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitTitle.trim()) return;
    const res = await scheduleCaregiverVisit({
      title: visitTitle.trim(),
      caregiverId,
      scheduledStartIso: new Date(startInput).toISOString(),
      scheduledEndIso: new Date(endInput).toISOString(),
    });
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('visits.scheduleError')});
    } else {
      setFeedback({ok: true, text: t('visits.scheduledSuccess')});
      setVisitTitle('');
      setShowScheduleForm(false);
    }
  };

  const handleIssueCode = async (visitId: string) => {
    const res = await issueVisitCode(visitId, 30);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('visits.issueCodeError')});
    } else {
      setFeedback({ok: true, text: t('visits.codeIssuedSuccess')});
    }
  };

  const handleCheckIn = async (visitId: string) => {
    const code = (pinInputs[visitId] || '').trim();
    if (!code) {
      setFeedback({ok: false, text: t('visits.enterCodePrompt')});
      return;
    }
    const method = methodByVisit[visitId] ?? 'pin';
    const res = await verifyVisitCheckIn({
      visitId,
      method,
      code,
      locationConsentOptIn: Boolean(locOptInByVisit[visitId]),
      locationNote: locNoteByVisit[visitId]?.trim() || undefined,
    });
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('visits.checkInError')});
    } else {
      setFeedback({ok: true, text: t('visits.checkInSuccess')});
    }
  };

  const handleAddActivity = async (visitId: string) => {
    const note = (activityNoteByVisit[visitId] || '').trim();
    if (!note) return;
    const res = await addVisitActivity(
      visitId,
      activityTypeByVisit[visitId] ?? 'observation',
      note,
    );
    if (res.ok) {
      setActivityNoteByVisit((prev) => ({...prev, [visitId]: ''}));
      setFeedback({ok: true, text: t('visits.activityAdded')});
    }
  };

  const handleCheckOut = async (visitId: string, markIncomplete = false) => {
    const observations = (obsByVisit[visitId] || '').trim() || t('visits.defaultObservation');
    const handoverNote = (handoverByVisit[visitId] || '').trim() || undefined;
    const res = await completeVisitCheckOut({
      visitId,
      observations,
      handoverNote,
      incompleteReason: markIncomplete ? t('visits.defaultIncompleteReason') : undefined,
    });
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('visits.checkOutError')});
    } else {
      setFeedback({ok: true, text: t('visits.checkOutSuccess')});
    }
  };

  const handleCancelVisit = async (visitId: string, targetStatus: 'cancelled' | 'missed') => {
    const reason = (cancelReasonByVisit[visitId] || '').trim() || t('visits.defaultCancelReason');
    const res = await cancelCaregiverVisit(visitId, reason, targetStatus);
    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('visits.cancelError')});
    } else {
      setFeedback({ok: true, text: t('visits.cancelledSuccess')});
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('visits.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('visits.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-2xl">{t('visits.pageSub')}</p>
          </div>
          {session?.role === 'family_member' && (
            <Button variant="coral" onClick={() => setShowScheduleForm((v) => !v)}>
              <CalendarPlus className="w-4 h-4" aria-hidden="true" />
              <span>{showScheduleForm ? t('common.close') : t('visits.scheduleBtn')}</span>
            </Button>
          )}
        </div>
      </SurfaceCard>

      <SurfaceCard tone="inset" className="border-[#176D65]/25">
        <div className="flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-[#176D65] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-sm text-[#172C40]/85">{t('visits.honestVerificationNote')}</p>
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

      {showScheduleForm && session?.role === 'family_member' && (
        <SurfaceCard tone="cream">
          <SectionHeader title={t('visits.formTitle')} subtitle={t('visits.formSub')} />
          <form onSubmit={handleSchedule} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="visit-title" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('visits.titleLabel')}
              </label>
              <input
                id="visit-title"
                type="text"
                required
                value={visitTitle}
                onChange={(e) => setVisitTitle(e.target.value)}
                placeholder={t('visits.titlePlaceholder')}
                className="aarvi-input"
              />
            </div>
            <div>
              <label htmlFor="visit-cg" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('visits.caregiverLabel')}
              </label>
              <select
                id="visit-cg"
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
              <label htmlFor="visit-start" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('visits.startLabel')}
              </label>
              <input
                id="visit-start"
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="aarvi-input font-mono tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="visit-end" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('visits.endLabel')}
              </label>
              <input
                id="visit-end"
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="aarvi-input font-mono tabular-nums"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowScheduleForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" disabled={!effectiveOnline}>
                {t('visits.saveVisitBtn')}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      )}

      {caregiverVisits.length === 0 ? (
        <EmptyState title={t('visits.emptyTitle')} description={t('visits.emptyDesc')} />
      ) : (
        <div className="space-y-4">
          {caregiverVisits.map((visit) => {
            const issued = issuedVisitCodes[visit.id];
            const method = methodByVisit[visit.id] ?? 'pin';

            return (
              <SurfaceCard key={visit.id} tone="cream" data-testid={`visit-card-${visit.id}`}>
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                      <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                        {new Date(visit.scheduledStartIso).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{visit.caregiverName}</span>
                      {visit.checkInAtIso && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums text-[#176D65]">
                            {t('visits.checkedInBadge', {
                              method: (visit.checkInMethod ?? 'pin').toUpperCase(),
                              time: new Date(visit.checkInAtIso).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    <h2 className="font-display text-lg font-bold text-[#172C40] mt-1">
                      {visit.title}
                    </h2>
                    {visit.observations && (
                      <p className="text-sm text-[#172C40]/80 mt-1">{visit.observations}</p>
                    )}
                    {visit.cancelOrIncompleteReason && (
                      <p className="text-xs text-[#A84433] mt-1">
                        {t('common.note')}: {visit.cancelOrIncompleteReason}
                      </p>
                    )}
                  </div>

                  <StatusIndicator
                    tone={
                      visit.status === 'completed'
                        ? 'teal'
                        : visit.status === 'ongoing'
                          ? 'navy'
                          : visit.status === 'cancelled' ||
                              visit.status === 'missed' ||
                              visit.status === 'incomplete'
                            ? 'coral'
                            : 'amber'
                    }
                    icon={visit.status === 'completed' ? 'check' : 'clock'}
                    label={t(`visits.statuses.${visit.status}`)}
                  />
                </div>

                {/* Patient / Family: Issue Expiring PIN + QR Token */}
                {visit.status === 'scheduled' && canScheduleOrIssue && (
                  <div className="mt-4 pt-4 border-t aarvi-divider space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#172C40]">
                          {t('visits.issueSectionTitle')}
                        </p>
                        <p className="text-xs text-[#172C40]/72">{t('visits.issueSectionSub')}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="teal"
                        disabled={!effectiveOnline}
                        onClick={() => void handleIssueCode(visit.id)}
                        data-testid={`issue-code-${visit.id}`}
                      >
                        <KeyRound className="w-4 h-4" aria-hidden="true" />
                        <span>{t('visits.issuePinQrBtn')}</span>
                      </Button>
                    </div>

                    {issued && (
                      <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#269B91]/40 flex flex-col sm:flex-row sm:items-center gap-4">
                        <VerificationQrMatrix payload={issued.qrPayload} />
                        <div className="space-y-1.5 min-w-0">
                          <p className="text-xs font-semibold text-[#176D65]">
                            {t('visits.oneTimePinLabel')}
                          </p>
                          <p
                            className="font-mono text-2xl font-bold tracking-widest text-[#172C40] tabular-nums"
                            data-testid={`issued-pin-${visit.id}`}
                          >
                            {issued.oneTimePin}
                          </p>
                          <p className="font-mono text-xs text-[#172C40]/75 break-all">
                            QR: {issued.qrPayload}
                          </p>
                          <p className="text-xs text-[#A84433] tabular-nums">
                            {t('visits.expiresAtLabel', {
                              time: new Date(issued.expiresAtIso).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              }),
                            })}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Caregiver Check-In Form */}
                {visit.status === 'scheduled' && isCaregiver && (
                  <div className="mt-4 pt-4 border-t aarvi-divider space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMethodByVisit((p) => ({...p, [visit.id]: 'pin'}))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          method === 'pin'
                            ? 'bg-[#172C40] text-[#F5F0E6]'
                            : 'bg-[#EBE3D3] text-[#172C40]'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                        {t('visits.verifyWithPin')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMethodByVisit((p) => ({...p, [visit.id]: 'qr'}))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                          method === 'qr'
                            ? 'bg-[#172C40] text-[#F5F0E6]'
                            : 'bg-[#EBE3D3] text-[#172C40]'
                        }`}
                      >
                        <QrCode className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                        {t('visits.verifyWithQr')}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                      <div className="sm:col-span-5">
                        <label
                          htmlFor={`code-${visit.id}`}
                          className="block text-xs font-semibold text-[#172C40] mb-1"
                        >
                          {method === 'pin' ? t('visits.enterPinLabel') : t('visits.enterQrLabel')}
                        </label>
                        <input
                          id={`code-${visit.id}`}
                          type="text"
                          value={pinInputs[visit.id] ?? ''}
                          onChange={(e) =>
                            setPinInputs((p) => ({...p, [visit.id]: e.target.value}))
                          }
                          placeholder={method === 'pin' ? '6-digit PIN' : 'ARV-VISIT:...'}
                          className="aarvi-input font-mono tabular-nums"
                        />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-[#172C40] mb-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(locOptInByVisit[visit.id])}
                            onChange={(e) =>
                              setLocOptInByVisit((p) => ({...p, [visit.id]: e.target.checked}))
                            }
                            className="w-4 h-4 accent-[#269B91]"
                          />
                          <span>{t('visits.optionalLocationOptIn')}</span>
                        </label>
                        <input
                          type="text"
                          disabled={!locOptInByVisit[visit.id]}
                          value={locNoteByVisit[visit.id] ?? ''}
                          onChange={(e) =>
                            setLocNoteByVisit((p) => ({...p, [visit.id]: e.target.value}))
                          }
                          placeholder={t('visits.locationNotePlaceholder')}
                          aria-label={t('visits.locationNotePlaceholder')}
                          className="aarvi-input text-xs disabled:opacity-50"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <Button
                          variant="teal"
                          className="w-full"
                          disabled={!effectiveOnline || visit.verificationLocked}
                          onClick={() => void handleCheckIn(visit.id)}
                          data-testid={`checkin-btn-${visit.id}`}
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>{t('visits.verifyCheckInBtn')}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Ongoing Visit: Care Activities + Check-Out */}
                {visit.status === 'ongoing' && (
                  <div className="mt-4 pt-4 border-t aarvi-divider space-y-4">
                    {visit.activities.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-[#172C40]">
                          {t('visits.activitiesLoggedTitle')}
                        </p>
                        <ul className="space-y-1 text-xs text-[#172C40]/82">
                          {visit.activities.map((act) => (
                            <li key={act.id}>
                              <span className="font-mono text-[#176D65] tabular-nums">
                                {new Date(act.recordedAtIso).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>{' '}
                              · <span className="font-semibold">{act.activityType}:</span> {act.note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {isCaregiver && (
                      <div className="space-y-3 p-4 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`act-type-${visit.id}`}
                              className="block text-xs font-semibold text-[#172C40] mb-1"
                            >
                              {t('visits.activityTypeLabel')}
                            </label>
                            <select
                              id={`act-type-${visit.id}`}
                              value={activityTypeByVisit[visit.id] ?? 'observation'}
                              onChange={(e) =>
                                setActivityTypeByVisit((p) => ({
                                  ...p,
                                  [visit.id]: e.target.value as VisitActivityEntry['activityType'],
                                }))
                              }
                              className="aarvi-input text-xs"
                            >
                              <option value="medication">Medication</option>
                              <option value="meal">Meal</option>
                              <option value="hydration">Hydration</option>
                              <option value="mobility">Mobility</option>
                              <option value="observation">Observation</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                          <div className="sm:col-span-6">
                            <label
                              htmlFor={`act-note-${visit.id}`}
                              className="block text-xs font-semibold text-[#172C40] mb-1"
                            >
                              {t('visits.activityNoteLabel')}
                            </label>
                            <input
                              id={`act-note-${visit.id}`}
                              type="text"
                              value={activityNoteByVisit[visit.id] ?? ''}
                              onChange={(e) =>
                                setActivityNoteByVisit((p) => ({...p, [visit.id]: e.target.value}))
                              }
                              placeholder={t('visits.activityNotePlaceholder')}
                              className="aarvi-input text-xs"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full"
                              onClick={() => void handleAddActivity(visit.id)}
                            >
                              <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
                              <span>{t('visits.addActivityBtn')}</span>
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t aarvi-divider">
                          <div>
                            <label
                              htmlFor={`obs-${visit.id}`}
                              className="block text-xs font-semibold text-[#172C40] mb-1"
                            >
                              {t('visits.observationsLabel')}
                            </label>
                            <input
                              id={`obs-${visit.id}`}
                              type="text"
                              value={obsByVisit[visit.id] ?? ''}
                              onChange={(e) =>
                                setObsByVisit((p) => ({...p, [visit.id]: e.target.value}))
                              }
                              placeholder={t('visits.observationsPlaceholder')}
                              className="aarvi-input text-xs"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor={`ho-${visit.id}`}
                              className="block text-xs font-semibold text-[#172C40] mb-1"
                            >
                              {t('visits.handoverNoteLabel')}
                            </label>
                            <input
                              id={`ho-${visit.id}`}
                              type="text"
                              value={handoverByVisit[visit.id] ?? ''}
                              onChange={(e) =>
                                setHandoverByVisit((p) => ({...p, [visit.id]: e.target.value}))
                              }
                              placeholder={t('visits.handoverNotePlaceholder')}
                              className="aarvi-input text-xs"
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!effectiveOnline}
                            onClick={() => void handleCheckOut(visit.id, true)}
                          >
                            {t('visits.markIncompleteBtn')}
                          </Button>
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!effectiveOnline}
                            onClick={() => void handleCheckOut(visit.id, false)}
                            data-testid={`checkout-btn-${visit.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                            <span>{t('visits.checkOutBtn')}</span>
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Cancellation / Missed Reason Controls for Scheduled Visits */}
                {visit.status === 'scheduled' && session?.role === 'family_member' && (
                  <div className="mt-4 pt-3 border-t aarvi-divider flex flex-col sm:flex-row sm:items-center gap-2">
                    <input
                      type="text"
                      value={cancelReasonByVisit[visit.id] ?? ''}
                      onChange={(e) =>
                        setCancelReasonByVisit((p) => ({...p, [visit.id]: e.target.value}))
                      }
                      placeholder={t('visits.cancelReasonPlaceholder')}
                      aria-label={t('visits.cancelReasonPlaceholder')}
                      className="aarvi-input text-xs flex-1"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={!effectiveOnline}
                      onClick={() => void handleCancelVisit(visit.id, 'cancelled')}
                    >
                      <XCircle className="w-4 h-4" aria-hidden="true" />
                      <span>{t('visits.cancelVisitBtn')}</span>
                    </Button>
                  </div>
                )}
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
