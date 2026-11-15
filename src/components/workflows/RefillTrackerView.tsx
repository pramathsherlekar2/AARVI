import React, {useState} from 'react';
import {AlertTriangle, Package, PlusCircle} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function RefillTrackerView() {
  const {medications, refillHistory, recordMedicationRefill} = useAarvi();
  const {t} = useTranslation();

  const [selectedMedId, setSelectedMedId] = useState<string>(medications[0]?.id ?? '');
  const [unitsToAdd, setUnitsToAdd] = useState<number>(30);
  const [pharmacyNote, setPharmacyNote] = useState('');

  const lowStockMeds = medications.filter((m) => m.refillDaysRemaining <= m.refillThresholdDays);

  const handleLogRefill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedId || unitsToAdd <= 0) return;
    recordMedicationRefill(selectedMedId, unitsToAdd, pharmacyNote);
    setPharmacyNote('');
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('refill.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('refill.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('refill.pageSub')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F0E6] tabular-nums">
            <Package className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />
            <span>{t('refill.lowStockCount', {count: lowStockMeds.length})}</span>
          </div>
        </div>
      </SurfaceCard>

      {lowStockMeds.length > 0 && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-display font-bold text-base text-[#172C40]">
                {t('refill.warningTitle')}
              </p>
              <p className="text-sm text-[#172C40]/80 mt-0.5">
                {lowStockMeds
                  .map(
                    (m) =>
                      `${m.name} (${m.remainingUnits} ${t('refill.units')} · ${t('common.daysShort', {days: m.refillDaysRemaining})})`,
                  )
                  .join(' · ')}
              </p>
            </div>
          </div>
        </SurfaceCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard tone="cream" className="lg:col-span-7">
          <SectionHeader title={t('refill.inventoryTitle')} subtitle={t('refill.inventorySub')} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b aarvi-divider text-xs text-[#172C40]/68">
                  <th className="pb-3 font-semibold">{t('medications.medicineName')}</th>
                  <th className="pb-3 font-semibold text-right">{t('refill.remainingCol')}</th>
                  <th className="pb-3 font-semibold text-right">{t('refill.dailyUseCol')}</th>
                  <th className="pb-3 font-semibold text-right">{t('refill.runOutCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y aarvi-divider">
                {medications.map((med) => {
                  const low = med.refillDaysRemaining <= med.refillThresholdDays;
                  return (
                    <tr key={med.id} className="h-[46px]">
                      <td className="py-3 pr-3 font-medium text-[#172C40]">
                        {med.name}{' '}
                        <span className="text-xs text-[#172C40]/65 font-normal">({med.dosage})</span>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-[#172C40]">
                        {med.remainingUnits}
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-[#172C40]/75">
                        {med.unitsPerDose * med.dosesPerDay}/d
                      </td>
                      <td className="py-3 pl-2 text-right">
                        <StatusIndicator
                          tone={low ? 'coral' : 'teal'}
                          icon={low ? 'alert' : 'check'}
                          label={t('common.daysShort', {days: med.refillDaysRemaining})}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <div className="lg:col-span-5 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('refill.logRefillTitle')}
              subtitle={t('refill.logRefillSub')}
              action={<PlusCircle className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
            />
            <form onSubmit={handleLogRefill} className="space-y-4">
              <div>
                <label htmlFor="rf-med" className="block text-sm font-semibold text-[#172C40] mb-1">
                  {t('medications.medicineName')}
                </label>
                <select
                  id="rf-med"
                  value={selectedMedId}
                  onChange={(e) => setSelectedMedId(e.target.value)}
                  className="aarvi-input"
                >
                  {medications.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.remainingUnits} {t('refill.units')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="rf-units"
                  className="block text-sm font-semibold text-[#172C40] mb-1"
                >
                  {t('refill.unitsAddedLabel')}
                </label>
                <input
                  id="rf-units"
                  type="number"
                  min={1}
                  max={365}
                  value={unitsToAdd}
                  onChange={(e) => setUnitsToAdd(Number(e.target.value))}
                  className="aarvi-input font-mono tabular-nums"
                />
              </div>

              <div>
                <label htmlFor="rf-note" className="block text-sm font-semibold text-[#172C40] mb-1">
                  {t('refill.pharmacyNoteLabel')}
                </label>
                <input
                  id="rf-note"
                  value={pharmacyNote}
                  onChange={(e) => setPharmacyNote(e.target.value)}
                  placeholder={t('refill.pharmacyNotePlaceholder')}
                  className="aarvi-input"
                />
              </div>

              <Button type="submit" variant="teal" className="w-full">
                {t('refill.saveRefillBtn')}
              </Button>
            </form>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader title={t('refill.historyTitle')} />
            <div className="divide-y aarvi-divider">
              {refillHistory.map((rf) => (
                <div key={rf.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#172C40]">{rf.medicationName}</span>
                    <span className="font-mono text-xs font-bold text-[#176D65] tabular-nums">
                      +{rf.unitsAdded} {t('refill.units')}
                    </span>
                  </div>
                  <p className="text-xs text-[#172C40]/70 mt-0.5">
                    {rf.pharmacyNote} · {rf.recordedBy} ({rf.recordedAtLabel})
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
