import React, {useState} from 'react';
import {CheckCircle2, Plus, RotateCcw, SkipForward} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {DoseStatus, TimeSlot} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

const TIME_SLOTS: Array<'All' | TimeSlot> = ['All', 'Morning', 'Afternoon', 'Evening', 'Night'];

export function MedicationWorkflowView() {
  const {medications, logMedicationDose, addMedication} = useAarvi();
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
    const statusMatch = statusFilter === 'all' || med.status === statusFilter;
    return slotMatch && statusMatch;
  });

  const takenCount = medications.filter((m) => m.status === 'taken').length;
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
      instructions: newInstructions.trim() || 'Take as prescribed with water.',
      purpose: newPurpose.trim() || 'Daily care regimen',
      refillDaysRemaining: 30,
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
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('medications.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('medications.pageTitle')}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1 tabular-nums">
              {t('medications.adherenceSummary', {
                taken: takenCount,
                total: medications.length,
                percent: adherencePercent,
              })}
            </p>
          </div>
          <Button variant="teal" onClick={() => setShowAddForm((prev) => !prev)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showAddForm ? t('medications.closeForm') : t('medications.addMedication')}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      {showAddForm && (
        <SurfaceCard>
          <SectionHeader
            title={t('medications.addFormTitle')}
            subtitle={t('medications.addFormSub')}
          />
          <form onSubmit={handleAddMedication} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="med-name" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('medications.medicineName')}
              </label>
              <input
                id="med-name"
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('medications.medicinePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="med-dose" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('medications.dosage')}
              </label>
              <input
                id="med-dose"
                type="text"
                required
                value={newDosage}
                onChange={(e) => setNewDosage(e.target.value)}
                placeholder={t('medications.dosagePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="med-slot" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('medications.timeSlot')}
              </label>
              <select
                id="med-slot"
                value={newSlot}
                onChange={(e) => setNewSlot(e.target.value as TimeSlot)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
              >
                <option value="Morning">{t('timeSlots.Morning')}</option>
                <option value="Afternoon">{t('timeSlots.Afternoon')}</option>
                <option value="Evening">{t('timeSlots.Evening')}</option>
                <option value="Night">{t('timeSlots.Night')}</option>
              </select>
            </div>
            <div>
              <label htmlFor="med-time" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('medications.scheduledTime')}
              </label>
              <input
                id="med-time"
                type="text"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                placeholder="08:00 AM"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC]"
              />
            </div>
            <div>
              <label
                htmlFor="med-purpose"
                className="block text-sm font-semibold text-[#F7F8FC] mb-1"
              >
                {t('medications.purpose')}
              </label>
              <input
                id="med-purpose"
                type="text"
                value={newPurpose}
                onChange={(e) => setNewPurpose(e.target.value)}
                placeholder={t('medications.purposePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label
                htmlFor="med-instr"
                className="block text-sm font-semibold text-[#F7F8FC] mb-1"
              >
                {t('medications.instructions')}
              </label>
              <input
                id="med-instr"
                type="text"
                value={newInstructions}
                onChange={(e) => setNewInstructions(e.target.value)}
                placeholder={t('medications.instructionsPlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
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
        <div className="flex flex-wrap items-center gap-1 p-1 bg-white/6 rounded-xl border border-white/12">
          {TIME_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setSlotFilter(slot)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                slotFilter === slot
                  ? 'bg-[#4778B8] text-white'
                  : 'text-[#AAB8CE] hover:text-white hover:bg-white/10'
              }`}
            >
              {t(`timeSlots.${slot}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-white/6 rounded-xl border border-white/12 self-start">
          {(
            [
              {id: 'all', label: t('medications.allStatuses')},
              {id: 'pending', label: t('medications.pending')},
              {id: 'taken', label: t('medications.taken')},
              {id: 'skipped', label: t('medications.skipped')},
            ] as const
          ).map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === st.id
                  ? 'bg-white/18 text-white'
                  : 'text-[#AAB8CE] hover:text-white'
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
        <div className="space-y-3">
          {filtered.map((med) => (
            <SurfaceCard key={med.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#AAB8CE]">
                    <span className="font-mono font-semibold text-[#8BB8F2] tabular-nums">
                      {med.scheduledTime}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{t(`timeSlots.${med.timeSlot}`)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{med.purpose}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        med.refillDaysRemaining <= 10
                          ? 'font-semibold text-[#FFB4B7]'
                          : 'text-[#AAB8CE]'
                      }
                    >
                      {t('common.daysSupplyLeft', {days: med.refillDaysRemaining})}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-[#F7F8FC] mt-1">
                    {med.name} — {med.dosage}
                  </h3>
                  <p className="text-sm text-[#AAB8CE] mt-0.5">{med.instructions}</p>
                  {med.loggedBy && (
                    <p className="text-xs text-[#5EEAD4] mt-1.5">
                      {t('medications.updatedByAt', {
                        time: med.loggedAt ?? '',
                        name: med.loggedBy,
                      })}
                      {med.skipReason ? ` · ${t('common.note')}: ${med.skipReason}` : ''}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {med.status === 'pending' && (
                    <>
                      <Button variant="teal" onClick={() => logMedicationDose(med.id, 'taken')}>
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>{t('dashboards.markTaken')}</span>
                      </Button>
                      <Button
                        variant="coral"
                        onClick={() =>
                          logMedicationDose(med.id, 'skipped', 'Deferred during schedule review')
                        }
                      >
                        <SkipForward className="w-4 h-4" aria-hidden="true" />
                        <span>{t('medications.skipDose')}</span>
                      </Button>
                    </>
                  )}
                  {med.status === 'taken' && (
                    <>
                      <StatusIndicator tone="teal" icon="check" label={t('medications.taken')} />
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
                  {med.status === 'skipped' && (
                    <>
                      <StatusIndicator tone="coral" icon="alert" label={t('medications.skipped')} />
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
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
