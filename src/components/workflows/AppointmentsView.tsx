import React, {useState} from 'react';
import {Calendar, CheckCircle2, MapPin, Plus, UserCheck} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {AppointmentStatus} from '../../types/aarvi';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function AppointmentsView() {
  const {appointments, updateAppointmentStatus, addAppointment} = useAarvi();
  const {t} = useTranslation();

  const [filter, setFilter] = useState<'all' | AppointmentStatus>('all');
  const [showCreate, setShowCreate] = useState(false);

  const [title, setTitle] = useState('');
  const [clinician, setClinician] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [facility, setFacility] = useState('');
  const [dateLabel, setDateLabel] = useState('');
  const [timeLabel, setTimeLabel] = useState('');
  const [companionAssigned, setCompanionAssigned] = useState('Ananya Kulkarni (Daughter)');
  const [prepQuestion, setPrepQuestion] = useState('');

  const filtered = appointments.filter((a) => filter === 'all' || a.status === filter);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clinician.trim()) return;
    addAppointment({
      title: title.trim(),
      clinician: clinician.trim(),
      specialty: specialty.trim() || 'General Review',
      facility: facility.trim() || 'Sankalp Senior Care Clinic',
      dateLabel: dateLabel.trim() || 'Next Tue',
      timeLabel: timeLabel.trim() || '11:00 AM',
      companionAssigned: companionAssigned.trim() || 'Family Coordinator',
      prepQuestions: prepQuestion.trim() ? [prepQuestion.trim()] : ['Review current prescriptions'],
      notes: 'Scheduled via local UI workflow.',
    });
    setTitle('');
    setClinician('');
    setSpecialty('');
    setFacility('');
    setDateLabel('');
    setTimeLabel('');
    setPrepQuestion('');
    setShowCreate(false);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#8BB8F2]">
              {t('appointments.moduleKicker')}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('appointments.pageTitle')}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1">{t('appointments.pageSub')}</p>
          </div>
          <Button variant="teal" onClick={() => setShowCreate((prev) => !prev)}>
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showCreate ? t('appointments.closeForm') : t('appointments.scheduleVisit')}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      {showCreate && (
        <SurfaceCard>
          <SectionHeader title={t('appointments.addTitle')} />
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="apt-title" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.visitTitle')}
              </label>
              <input
                id="apt-title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('appointments.visitTitlePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-doc" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.clinician')}
              </label>
              <input
                id="apt-doc"
                required
                value={clinician}
                onChange={(e) => setClinician(e.target.value)}
                placeholder={t('appointments.clinicianPlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-spec" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.specialty')}
              </label>
              <input
                id="apt-spec"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder={t('appointments.specialtyPlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-fac" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.facility')}
              </label>
              <input
                id="apt-fac"
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder={t('appointments.facilityPlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-date" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.date')}
              </label>
              <input
                id="apt-date"
                value={dateLabel}
                onChange={(e) => setDateLabel(e.target.value)}
                placeholder={t('appointments.datePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-time" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.time')}
              </label>
              <input
                id="apt-time"
                value={timeLabel}
                onChange={(e) => setTimeLabel(e.target.value)}
                placeholder={t('appointments.timePlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div>
              <label htmlFor="apt-comp" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.companion')}
              </label>
              <input
                id="apt-comp"
                value={companionAssigned}
                onChange={(e) => setCompanionAssigned(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC]"
              />
            </div>
            <div>
              <label htmlFor="apt-q" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('appointments.prepQuestion')}
              </label>
              <input
                id="apt-q"
                value={prepQuestion}
                onChange={(e) => setPrepQuestion(e.target.value)}
                placeholder={t('appointments.prepQuestionPlaceholder')}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>
            <div className="sm:col-span-2 flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary">
                {t('appointments.saveAppointment')}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      )}

      <div className="flex flex-wrap items-center gap-1 p-1 bg-white/6 rounded-xl border border-white/12 w-fit">
        {(
          [
            {id: 'all', label: t('appointments.filterAll')},
            {id: 'upcoming', label: t('appointments.filterUpcoming')},
            {id: 'completed', label: t('appointments.filterCompleted')},
            {id: 'reschedule_requested', label: t('appointments.filterReschedule')},
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === tab.id
                ? 'bg-[#4778B8] text-white'
                : 'text-[#AAB8CE] hover:text-white hover:bg-white/10'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('appointments.emptyTitle')} description={t('appointments.emptyDesc')} />
      ) : (
        <div className="space-y-4">
          {filtered.map((apt) => (
            <SurfaceCard key={apt.id}>
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#8BB8F2] tabular-nums">
                    <Calendar className="w-4 h-4" aria-hidden="true" />
                    <span>
                      {apt.dateLabel} · {apt.timeLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{apt.specialty}</span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-[#F7F8FC]">{apt.title}</h3>
                  <p className="text-sm text-[#AAB8CE] flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>{apt.clinician}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#5EEAD4]" aria-hidden="true" />
                      {apt.facility}
                    </span>
                  </p>
                  <p className="text-sm text-[#F7F8FC] flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-[#5EEAD4]" aria-hidden="true" />
                    <span>{t('dashboards.companionLabel', {name: apt.companionAssigned})}</span>
                  </p>

                  {apt.prepQuestions.length > 0 && (
                    <div className="pt-3 mt-3 border-t border-white/12">
                      <p className="text-xs font-semibold text-[#F7F8FC] mb-1.5">
                        {t('appointments.prepQuestionsTitle')}
                      </p>
                      <ul className="list-disc pl-5 space-y-1 text-sm text-[#AAB8CE]">
                        {apt.prepQuestions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {apt.notes && (
                    <p className="text-xs text-[#AAB8CE] pt-1">
                      {t('common.note')}: {apt.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-start lg:items-end gap-3 shrink-0">
                  {apt.status === 'upcoming' && (
                    <StatusIndicator
                      tone="amber"
                      icon="clock"
                      label={t('appointments.filterUpcoming')}
                    />
                  )}
                  {apt.status === 'completed' && (
                    <StatusIndicator
                      tone="teal"
                      icon="check"
                      label={t('appointments.filterCompleted')}
                    />
                  )}
                  {apt.status === 'reschedule_requested' && (
                    <StatusIndicator
                      tone="coral"
                      icon="alert"
                      label={t('appointments.filterReschedule')}
                    />
                  )}

                  <div className="flex flex-wrap gap-2">
                    {apt.status !== 'completed' && (
                      <Button
                        size="sm"
                        variant="teal"
                        onClick={() => updateAppointmentStatus(apt.id, 'completed')}
                      >
                        <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        <span>{t('appointments.markCompleted')}</span>
                      </Button>
                    )}
                    {apt.status === 'upcoming' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateAppointmentStatus(apt.id, 'reschedule_requested')}
                      >
                        {t('appointments.requestReschedule')}
                      </Button>
                    )}
                    {apt.status !== 'upcoming' && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => updateAppointmentStatus(apt.id, 'upcoming')}
                      >
                        {t('appointments.restoreUpcoming')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
