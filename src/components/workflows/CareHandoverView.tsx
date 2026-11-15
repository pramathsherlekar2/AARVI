import React, {useState} from 'react';
import {CheckCircle2, ClipboardPlus} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {HandoverChecklist} from '../../types/aarvi';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function CareHandoverView() {
  const {handovers, createHandover, acknowledgeHandover} = useAarvi();
  const {t} = useTranslation();

  const [showComposer, setShowComposer] = useState(false);
  const [shiftLabel, setShiftLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [checklist, setChecklist] = useState<HandoverChecklist>({
    mood: 'calm',
    appetite: 'ate_well',
    hydration: 'on_track',
    sleepQuality: 'restful',
    mobility: 'steady',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    createHandover({
      shiftLabel: shiftLabel.trim() || t('handovers.defaultShiftWindow'),
      summary: summary.trim(),
      checklist,
      pendingFollowUps: followUp
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
    setShiftLabel('');
    setSummary('');
    setFollowUp('');
    setShowComposer(false);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('handovers.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('handovers.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1">{t('handovers.pageSub')}</p>
          </div>
          <Button variant="coral" onClick={() => setShowComposer((prev) => !prev)}>
            <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showComposer ? t('handovers.closeComposer') : t('handovers.newHandover')}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      {showComposer && (
        <SurfaceCard tone="cream">
          <SectionHeader
            title={t('handovers.composeTitle')}
            subtitle={t('handovers.composeSub')}
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ho-shift" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('handovers.shiftWindow')}
              </label>
              <input
                id="ho-shift"
                value={shiftLabel}
                onChange={(e) => setShiftLabel(e.target.value)}
                placeholder={t('handovers.defaultShiftWindow')}
                className="aarvi-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="ho-mood" className="block text-xs font-semibold text-[#172C40] mb-1">
                  {t('handovers.mood')}
                </label>
                <select
                  id="ho-mood"
                  value={checklist.mood}
                  onChange={(e) =>
                    setChecklist((c) => ({
                      ...c,
                      mood: e.target.value as HandoverChecklist['mood'],
                    }))
                  }
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
                  htmlFor="ho-appetite"
                  className="block text-xs font-semibold text-[#172C40] mb-1"
                >
                  {t('handovers.appetite')}
                </label>
                <select
                  id="ho-appetite"
                  value={checklist.appetite}
                  onChange={(e) =>
                    setChecklist((c) => ({
                      ...c,
                      appetite: e.target.value as HandoverChecklist['appetite'],
                    }))
                  }
                  className="aarvi-input"
                >
                  <option value="ate_well">{t('handovers.appetiteOptions.ate_well')}</option>
                  <option value="light_intake">
                    {t('handovers.appetiteOptions.light_intake')}
                  </option>
                  <option value="low_appetite">
                    {t('handovers.appetiteOptions.low_appetite')}
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-hydration"
                  className="block text-xs font-semibold text-[#172C40] mb-1"
                >
                  {t('handovers.hydration')}
                </label>
                <select
                  id="ho-hydration"
                  value={checklist.hydration}
                  onChange={(e) =>
                    setChecklist((c) => ({
                      ...c,
                      hydration: e.target.value as HandoverChecklist['hydration'],
                    }))
                  }
                  className="aarvi-input"
                >
                  <option value="on_track">{t('handovers.hydrationOptions.on_track')}</option>
                  <option value="needs_prompting">
                    {t('handovers.hydrationOptions.needs_prompting')}
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-sleep"
                  className="block text-xs font-semibold text-[#172C40] mb-1"
                >
                  {t('handovers.sleep')}
                </label>
                <select
                  id="ho-sleep"
                  value={checklist.sleepQuality}
                  onChange={(e) =>
                    setChecklist((c) => ({
                      ...c,
                      sleepQuality: e.target.value as HandoverChecklist['sleepQuality'],
                    }))
                  }
                  className="aarvi-input"
                >
                  <option value="restful">{t('handovers.sleepOptions.restful')}</option>
                  <option value="interrupted">{t('handovers.sleepOptions.interrupted')}</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-mobility"
                  className="block text-xs font-semibold text-[#172C40] mb-1"
                >
                  {t('handovers.mobility')}
                </label>
                <select
                  id="ho-mobility"
                  value={checklist.mobility}
                  onChange={(e) =>
                    setChecklist((c) => ({
                      ...c,
                      mobility: e.target.value as HandoverChecklist['mobility'],
                    }))
                  }
                  className="aarvi-input"
                >
                  <option value="steady">{t('handovers.mobilityOptions.steady')}</option>
                  <option value="extra_assistance">
                    {t('handovers.mobilityOptions.extra_assistance')}
                  </option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ho-summary"
                className="block text-sm font-semibold text-[#172C40] mb-1"
              >
                {t('handovers.shiftSummary')}
              </label>
              <textarea
                id="ho-summary"
                required
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t('handovers.shiftSummaryPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label
                htmlFor="ho-followups"
                className="block text-sm font-semibold text-[#172C40] mb-1"
              >
                {t('handovers.pendingFollowUps')}
              </label>
              <textarea
                id="ho-followups"
                rows={2}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder={t('handovers.pendingFollowUpsPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setShowComposer(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="teal">
                {t('handovers.publishHandover')}
              </Button>
            </div>
          </form>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {handovers.map((ho) => (
          <SurfaceCard key={ho.id} tone="cream">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b aarvi-divider pb-4">
              <div>
                <p className="text-xs font-semibold text-[#176D65]">{ho.shiftLabel}</p>
                <h3 className="font-display text-lg font-bold text-[#172C40] mt-0.5">
                  {ho.authorName} · {t(`roles.${ho.authorRole}`)}
                </h3>
                <p className="text-xs text-[#172C40]/68 mt-0.5">{ho.createdAtLabel}</p>
              </div>
              <div className="shrink-0">
                {ho.acknowledgedBy ? (
                  <StatusIndicator
                    tone="teal"
                    icon="check"
                    label={`${t('dashboards.acknowledgedBy', {name: ho.acknowledgedBy})} (${ho.acknowledgedAtLabel ?? ''})`}
                  />
                ) : (
                  <Button variant="teal" size="sm" onClick={() => acknowledgeHandover(ho.id)}>
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    <span>{t('handovers.ackHandover')}</span>
                  </Button>
                )}
              </div>
            </div>

            <p className="text-sm text-[#172C40]/85 mt-4 leading-relaxed">{ho.summary}</p>

            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t aarvi-divider text-xs">
              <div>
                <dt className="text-[#172C40]/68">{t('handovers.mood')}</dt>
                <dd className="font-semibold text-[#172C40] mt-0.5">
                  {t(`handovers.moodOptions.${ho.checklist.mood}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[#172C40]/68">{t('handovers.appetite')}</dt>
                <dd className="font-semibold text-[#172C40] mt-0.5">
                  {t(`handovers.appetiteOptions.${ho.checklist.appetite}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[#172C40]/68">{t('handovers.hydration')}</dt>
                <dd className="font-semibold text-[#172C40] mt-0.5">
                  {t(`handovers.hydrationOptions.${ho.checklist.hydration}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[#172C40]/68">{t('handovers.sleep')}</dt>
                <dd className="font-semibold text-[#172C40] mt-0.5">
                  {t(`handovers.sleepOptions.${ho.checklist.sleepQuality}`)}
                </dd>
              </div>
              <div>
                <dt className="text-[#172C40]/68">{t('handovers.mobility')}</dt>
                <dd className="font-semibold text-[#172C40] mt-0.5">
                  {t(`handovers.mobilityOptions.${ho.checklist.mobility}`)}
                </dd>
              </div>
            </dl>

            {ho.pendingFollowUps.length > 0 && (
              <div className="mt-4 pt-4 border-t aarvi-divider">
                <p className="text-xs font-semibold text-[#172C40] mb-1.5">
                  {t('dashboards.pendingFollowUps')}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-[#172C40]/78">
                  {ho.pendingFollowUps.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
