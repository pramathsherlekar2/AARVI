import React, {useState} from 'react';
import {Check, Droplets, HeartPulse, Plus, Send} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {HandoverChecklist} from '../../types/aarvi';
import {Button, SectionHeader, SurfaceCard} from '../ui/AarviPrimitives';

export function DailyCompanionView() {
  const {session, previewModules, updatePreviewModules, addDailyCheckIn} = useAarvi();
  const {t} = useTranslation();

  const [mood, setMood] = useState<HandoverChecklist['mood']>('calm');
  const [activityNote, setActivityNote] = useState('');
  const [mealNote, setMealNote] = useState('');
  const [sleepHours, setSleepHours] = useState('7.5 hrs');
  const [noteInput, setNoteInput] = useState('');
  const [errandInput, setErrandInput] = useState('');

  const handleLogCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityNote.trim() && !mealNote.trim()) return;
    addDailyCheckIn({
      mood,
      activityNote: activityNote.trim() || t('companion.defaultActivity'),
      mealNote: mealNote.trim() || previewModules.lastMealNote,
      sleepHours: sleepHours.trim() || '7 hrs',
      hydrationCount: previewModules.hydrationGlasses,
    });
    setActivityNote('');
    setMealNote('');
  };

  const handleAddCircleNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    updatePreviewModules((prev) => ({
      ...prev,
      careCircleNotes: [
        {
          id: `cn-${Date.now()}`,
          author: session?.fullName ?? 'Care Coordinator',
          role: session?.relationshipOrTitle ?? 'Care Team',
          time: new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
          message: noteInput.trim(),
        },
        ...prev.careCircleNotes,
      ],
    }));
    setNoteInput('');
  };

  const handleAddErrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!errandInput.trim()) return;
    updatePreviewModules((prev) => ({
      ...prev,
      errands: [
        {
          id: `er-${Date.now()}`,
          title: errandInput.trim(),
          assignee: session?.fullName ?? 'Family Member',
          due: t('common.today'),
          done: false,
        },
        ...prev.errands,
      ],
    }));
    setErrandInput('');
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('companion.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('companion.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('companion.pageSub')}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-[#F5F0E6]/70">{t('companion.hydrationProgress')}</p>
              <p className="font-display text-xl font-bold text-[#5EEAD4] tabular-nums">
                {t('modules.glassesLabel', {
                  count: previewModules.hydrationGlasses,
                  target: previewModules.hydrationTarget,
                })}
              </p>
            </div>
            <Button
              variant="teal"
              onClick={() =>
                updatePreviewModules((p) => ({
                  ...p,
                  hydrationGlasses: Math.min(p.hydrationTarget, p.hydrationGlasses + 1),
                }))
              }
            >
              <Droplets className="w-4 h-4" aria-hidden="true" />
              <span>{t('modules.logGlass')}</span>
            </Button>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard tone="cream" className="lg:col-span-6">
          <SectionHeader
            title={t('companion.checkInFormTitle')}
            subtitle={t('companion.nonDiagnosticNote')}
            action={<HeartPulse className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />

          <form onSubmit={handleLogCheckIn} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="dc-mood" className="block text-xs font-semibold text-[#172C40] mb-1">
                  {t('handovers.mood')}
                </label>
                <select
                  id="dc-mood"
                  value={mood}
                  onChange={(e) => setMood(e.target.value as HandoverChecklist['mood'])}
                  className="aarvi-input"
                >
                  <option value="calm">{t('handovers.moodOptions.calm')}</option>
                  <option value="quiet">{t('handovers.moodOptions.quiet')}</option>
                  <option value="anxious">{t('handovers.moodOptions.anxious')}</option>
                  <option value="irritable">{t('handovers.moodOptions.irritable')}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="dc-sleep"
                  className="block text-xs font-semibold text-[#172C40] mb-1"
                >
                  {t('companion.sleepDuration')}
                </label>
                <input
                  id="dc-sleep"
                  value={sleepHours}
                  onChange={(e) => setSleepHours(e.target.value)}
                  className="aarvi-input"
                />
              </div>
            </div>

            <div>
              <label htmlFor="dc-meal" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('companion.mealLabel')}
              </label>
              <input
                id="dc-meal"
                value={mealNote}
                onChange={(e) => setMealNote(e.target.value)}
                placeholder={t('companion.mealPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label
                htmlFor="dc-activity"
                className="block text-sm font-semibold text-[#172C40] mb-1"
              >
                {t('companion.activityLabel')}
              </label>
              <textarea
                id="dc-activity"
                rows={2}
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder={t('companion.activityPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="primary">
                {t('companion.saveCheckIn')}
              </Button>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t aarvi-divider space-y-3">
            <h3 className="font-display text-sm font-bold text-[#172C40]">
              {t('companion.recentCheckIns')}
            </h3>
            <div className="divide-y aarvi-divider">
              {previewModules.dailyCheckIns.map((dc) => (
                <div key={dc.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#172C40]/68">
                    <span className="font-semibold text-[#176D65]">
                      {dc.authorName} · {dc.timeLabel}
                    </span>
                    <span className="tabular-nums">
                      {t(`handovers.moodOptions.${dc.mood}`)} · {dc.sleepHours}
                    </span>
                  </div>
                  <p className="text-[#172C40] mt-1">{dc.activityNote}</p>
                  <p className="text-xs text-[#172C40]/72 mt-0.5">{dc.mealNote}</p>
                </div>
              ))}
            </div>
          </div>
        </SurfaceCard>

        <div className="lg:col-span-6 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader title={t('modules.updatesTitle')} subtitle={t('companion.updatesSub')} />
            <form onSubmit={handleAddCircleNote} className="flex gap-2 mb-4">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('modules.updatesPlaceholder')}
                aria-label={t('modules.updatesTitle')}
                className="aarvi-input flex-1"
              />
              <Button type="submit" variant="teal">
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{t('modules.post')}</span>
              </Button>
            </form>
            <div className="divide-y aarvi-divider max-h-60 overflow-y-auto">
              {previewModules.careCircleNotes.map((n) => (
                <div key={n.id} className="py-3 first:pt-0 last:pb-0 text-sm">
                  <div className="text-xs text-[#172C40]/68">
                    <span className="font-semibold text-[#172C40]">{n.author}</span> ({n.role}) ·{' '}
                    {n.time}
                  </div>
                  <p className="text-[#172C40]/85 mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader title={t('modules.errandsTitle')} subtitle={t('companion.errandsSub')} />
            <form onSubmit={handleAddErrand} className="flex gap-2 mb-4">
              <input
                type="text"
                value={errandInput}
                onChange={(e) => setErrandInput(e.target.value)}
                placeholder={t('modules.errandsPlaceholder')}
                aria-label={t('modules.errandsTitle')}
                className="aarvi-input flex-1"
              />
              <Button type="submit" variant="secondary">
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{t('modules.add')}</span>
              </Button>
            </form>
            <div className="divide-y aarvi-divider">
              {previewModules.errands.map((er) => (
                <button
                  key={er.id}
                  type="button"
                  onClick={() =>
                    updatePreviewModules((p) => ({
                      ...p,
                      errands: p.errands.map((item) =>
                        item.id === er.id ? {...item, done: !item.done} : item,
                      ),
                    }))
                  }
                  className="w-full py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-left text-sm cursor-pointer"
                >
                  <span
                    className={
                      er.done ? 'line-through text-[#172C40]/55' : 'text-[#172C40] font-medium'
                    }
                  >
                    {er.title} · {er.assignee}
                  </span>
                  <span className="text-xs font-semibold text-[#176D65] shrink-0 inline-flex items-center gap-1">
                    {er.done && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    {er.done ? t('common.done') : er.due}
                  </span>
                </button>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
