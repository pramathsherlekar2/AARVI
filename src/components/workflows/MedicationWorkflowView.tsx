import React, {useState} from 'react';
import {AlertTriangle, CheckCircle2, Plus, RotateCcw, SkipForward} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {DoseStatus, TimeSlot} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

const TIME_SLOTS: Array<'All' | TimeSlot> = ['All', 'Morning', 'Afternoon', 'Evening', 'Night'];

export function MedicationWorkflowView() {
  const {
    medications,
    overdueMedicationIds,
    getEffectiveDoseStatus,
    logMedicationDose,
    addMedication,
    setActiveRoute,
  } = useAarvi();
  const {t} = useTranslation();

  const [slotFilter, setSlotFilter] = useState<'All' | TimeSlot>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | DoseStatus>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('');
  const [newSlot, setNewSlot] = useState<TimeSlot>('Morning');
  const [newTime, setNewTime] = useState('08:00 AM');
  const [newInstructions, setNewInstructions] = useState('');
  const [newPurpose, setNewPurpose] = useState('');

  const filtered = medications.filter((med) => {
    const slotMatch = slotFilter === 'All' || med.timeSlot === slotFilter;
    const effective = getEffectiveDoseStatus(med);
    const statusMatch = statusFilter === 'all' || med.status === statusFilter || effective === statusFilter;
    return slotMatch && statusMatch;
  });

  const takenCount = medications.filter(
    (m) => m.status === 'taken' || m.status === 'late_confirmed',
  ).length;
  const adherencePercent =
    medications.length > 0 ? Math.round((takenCount / medications.length) * 100) : 0;

  const handleAddMedication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newDosage.trim()) return;
    addMedication({
      name: newName.trim(),
      dosage: newDosage.trim(),
      timeSlot: newSlot,
      scheduledTime: newTime.trim() || '09:00 AM',
      gracePeriodMinutes: 45,
      instructions: newInstructions.trim() || t('medications.defaultInstruction'),
      purpose: newPurpose.trim() || t('medications.defaultPurpose'),
      remainingUnits: 30,
      unitsPerDose: 1,
      dosesPerDay: 1,
      refillThresholdDays: 7,
    });
    setNewName('');
    setNewDosage('');
    setNewInstructions('');
    setNewPurpose('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('medications.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('medications.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 tabular-nums">
              {t('medications.adherenceSummary', {
                taken: takenCount,
                total: medications.length,
                percent: adherencePercent,
              })}
            </p>
          </div>
          <Button variant="coral" onClick={() => setShowAddForm((prev) => !prev)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showAddForm ? t('medications.closeForm') : t('medications.addMedication')}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      {overdueMedicationIds.length > 0 && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-display font-bold text-base text-[#172C40]">
                  {t('missedDose.alertTitle', {count: overdueMedicationIds.length})}
                </p>
                <p className="text-sm text-[#172C40]/78 mt-0.5">{t('missedDose.safetyNotice')}</p>
              </div>
            </div>
            <Button variant="coral" size="sm" onClick={() => setActiveRoute('escalation')}>
              {t('escalation.openQueueBtn')}
            </Button>
          </div>
        </SurfaceCard>
      )}

      {showAddForm && (
        <SurfaceCard tone="cream">
          <SectionHeader
            title={t('medications.addFormTitle')}
            subtitle={t('medications.addFormSub')}
          />
          <form onSubmit={handleAddMedication} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="med-name" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('medications.medicineName')}
              </label>
              <input
                id="med-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('medications.medicinePlaceholder')}
                className="aarvi-input"
              />
            </div>
            <div>
              <label htmlFor="med-dose" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('medications.dosage')}
              </label>
              <input
                id="med-dose"
                type="text"
                required
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
                placeholder={t('medications.dosagePlaceholder')}
                className="aarvi-input"
              />
            </div>
            <div>
              <label htmlFor="med-slot" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('medications.timeSlot')}
              </label>
              <select
                id="med-slot"
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value as TimeSlot)}
                className="aarvi-input"
              >
                <option value="Morning">{t('timeSlots.Morning')}</option>
                <option value="Afternoon">{t('timeSlots.Afternoon')}</option>
                <option value="Evening">{t('timeSlots.Evening')}</option>
                <option value="Night">{t('timeSlots.Night')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="med-time" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('medications.scheduledTime')}
              </label>
              <input
                id="med-time"
                type="text"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="08:00 AM"
                className="aarvi-input"
              />
            </div>
            <div>
              <label
                htmlFor="med-purpose"
                className="block text-sm font-semibold text-[#172C40] mb-1"
              >
                {t('medications.purpose')}
              </label>
              <input
                id="med-purpose"
                type="text"
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                placeholder={t('medications.purposePlaceholder')}
                className="aarvi-input"
              />
            </div>
            <div>
              <label
                htmlFor="med-instr"
                className="block text-sm font-semibold text-[#172C40] mb-1"
              >
                {t('medications.instructions')}
              </label>
              <input
                id="med-instr"
                type="text"
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder={t('medications.instructionsPlaceholder')}
                className="aarvi-input"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('medications.saveMedication')}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      )}

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0E6] rounded-xl border border-[#172C40]/14">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setSlotFilter(slot)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                slotFilter === slot
                  ? 'bg-[#172C40] text-[#F5F0E6]'
                  : 'text-[#172C40]/75 hover:text-[#172C40] hover:bg-[#EBE3D3]'
              }`}
            >
              {t(`timeSlots.${slot}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0E6] rounded-xl border border-[#172C40]/14 self-start">
          {(
            [
              {id: 'all', label: t('medications.allStatuses')},
              {id: 'pending', label: t('medications.pending')},
              {id: 'unconfirmed', label: t('escalation.doseStates.unconfirmed')},
              {id: 'taken', label: t('medications.taken')},
              {id: 'late_confirmed', label: t('escalation.doseStates.late_confirmed')},
              {id: 'skipped', label: t('medications.skipped')},
              {id: 'missed', label: t('missedDose.missedStatus')},
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-[#269B91] text-[#FAF6EE]'
                  : 'text-[#172C40]/75 hover:text-[#172C40]'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('medications.emptyTitle')}
          description={t('medications.emptyDesc')}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setSlotFilter('All');
                setStatusFilter('all');
              }}
            >
              {t('medications.resetFilters')}
            </Button>
          }
        />
      ) : (
        <SurfaceCard tone="cream">
          <div className="divide-y aarvi-divider">
            {filtered.map((med) => {
              const overdue = overdueMedicationIds.includes(med.id);
              return (
                <div
                  key={med.id}
                  className="py-5 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                      <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                        {med.scheduledTime}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{med.purpose}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          med.refillDaysRemaining <= med.refillThresholdDays
                            ? 'font-semibold text-[#A84433]'
                            : 'text-[#172C40]/70'
                        }
                      >
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
                    <h3 className="font-display text-lg font-bold text-[#172C40] mt-1">
                      {med.name} — {med.dosage}
                    </h3>
                    <p className="text-sm text-[#172C40]/78 mt-0.5">{med.instructions}</p>
                    {med.loggedBy && (
                      <p className="text-xs text-[#176D65] mt-1.5">
                        {t('medications.updatedByAt', {
                          time: med.loggedAt ?? '',
                          name: med.loggedBy,
                        })}
                        {med.isLateConfirmation ? ` · ${t('missedDose.lateLogged')}` : ''}
                        {med.skipReason ? ` · ${t('common.note')}: ${med.skipReason}` : ''}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                    {(med.status === 'pending' || med.status === 'unconfirmed') && (
                      <>
                        <Button
                          variant={overdue ? 'coral' : 'teal'}
                          onClick={() => logMedicationDose(med.id, 'taken')}
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                          <span>{t('dashboards.markTaken')}</span>
                        </Button>
                        {overdue && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              logMedicationDose(med.id, 'missed', t('missedDose.escalatedNote'))
                            }
                          >
                            <span>{t('missedDose.markMissed')}</span>
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() =>
                            logMedicationDose(med.id, 'skipped', t('medications.deferredReason'))
                          }
                        >
                          <SkipForward className="w-4 h-4" aria-hidden="true" />
                          <span>{t('medications.skipDose')}</span>
                        </Button>
                      </>
                    )}
                    {(med.status === 'taken' || med.status === 'late_confirmed') && (
                      <>
                        <StatusIndicator
                          tone="teal"
                          icon="check"
                          label={
                            med.status === 'late_confirmed'
                              ? t('escalation.doseStates.late_confirmed')
                              : t('medications.taken')
                          }
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => logMedicationDose(med.id, 'pending')}
                        >
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                          <span>{t('common.undo')}</span>
                        </Button>
                      </>
                    )}
                    {(med.status === 'skipped' || med.status === 'missed') && (
                      <>
                        <StatusIndicator
                          tone="coral"
                          icon="alert"
                          label={
                            med.status === 'missed'
                              ? t('missedDose.missedStatus')
                              : t('medications.skipped')
                          }
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => logMedicationDose(med.id, 'pending')}
                        >
                          <RotateCcw className="w-4 h-4" aria-hidden="true" />
                          <span>{t('common.reopen')}</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
