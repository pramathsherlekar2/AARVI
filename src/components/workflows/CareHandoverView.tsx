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
  const [shiftLabel, setShiftLabel] = useState('Evening Shift · 04:00 PM – 10:00 PM');
  const [summary, setSummary] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [checklist, setChecklist] = useState<HandoverChecklist>({
    mood: 'Calm & cheerful',
    appetite: 'Ate well',
    hydration: 'On track',
    sleepQuality: 'Restful',
    mobility: 'Steady with support',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!summary.trim()) return;
    createHandover({
      shiftLabel: shiftLabel.trim(),
      summary: summary.trim(),
      checklist,
      pendingFollowUps: followUp
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    });
    setSummary('');
    setFollowUp('');
    setShowComposer(false);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('handovers.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('handovers.pageTitle')}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1">{t('handovers.pageSub')}</p>
          </div>
          <Button variant="primary" onClick={() => setShowComposer((prev) => !prev)}>
            <ClipboardPlus className="w-4 h-4" aria-hidden="true" />
            <span>
              {showComposer ? t('handovers.closeComposer') : t('handovers.newHandover')}
            </span>
          </Button>
        </div>
      </SurfaceCard>

      {showComposer && (
        <SurfaceCard>
          <SectionHeader
            title={t('handovers.composeTitle')}
            subtitle={t('handovers.composeSub')}
          />
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ho-shift" className="block text-sm font-semibold text-[#F7F8FC] mb-1">
                {t('handovers.shiftWindow')}
              </label>
              <input
                id="ho-shift"
                value={shiftLabel}
                onChange={(e) => setShiftLabel(e.target.value)}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="ho-mood" className="block text-xs font-semibold text-[#F7F8FC] mb-1">
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
                >
                  <option value="Calm & cheerful">Calm & cheerful</option>
                  <option value="Quiet / tired">Quiet / tired</option>
                  <option value="Anxious">Anxious</option>
                  <option value="Irritable">Irritable</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-appetite"
                  className="block text-xs font-semibold text-[#F7F8FC] mb-1"
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
                >
                  <option value="Ate well">Ate well</option>
                  <option value="Light intake">Light intake</option>
                  <option value="Low appetite">Low appetite</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-hydration"
                  className="block text-xs font-semibold text-[#F7F8FC] mb-1"
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
                >
                  <option value="On track">On track</option>
                  <option value="Needs gentle prompting">Needs gentle prompting</option>
                </select>
              </div>

              <div>
                <label htmlFor="ho-sleep" className="block text-xs font-semibold text-[#F7F8FC] mb-1">
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
                >
                  <option value="Restful">Restful</option>
                  <option value="Interrupted">Interrupted</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ho-mobility"
                  className="block text-xs font-semibold text-[#F7F8FC] mb-1"
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-white/18 bg-[#102341] text-sm text-[#F7F8FC]"
                >
                  <option value="Steady with support">Steady with support</option>
                  <option value="Needed extra assistance">Needed extra assistance</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="ho-summary"
                className="block text-sm font-semibold text-[#F7F8FC] mb-1"
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
                className="w-full px-4 py-2.5 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
            </div>

            <div>
              <label
                htmlFor="ho-followups"
                className="block text-sm font-semibold text-[#F7F8FC] mb-1"
              >
                {t('handovers.pendingFollowUps')}
              </label>
              <textarea
                id="ho-followups"
                rows={2}
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                placeholder={t('handovers.pendingFollowUpsPlaceholder')}
                className="w-full px-4 py-2.5 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
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
          <SurfaceCard key={ho.id}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-white/12 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#8BB8F2]">{ho.shiftLabel}</p>
                <h3 className="font-display text-lg font-bold text-[#F7F8FC] mt-0.5">
                  {ho.authorName} · {t(`roles.${ho.authorRole}`)}
                </h3>
                <p className="text-xs text-[#AAB8CE] mt-0.5">{ho.createdAtLabel}</p>
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

            <p className="text-sm text-[#DCE5F4] mt-4 leading-relaxed">{ho.summary}</p>

            <dl className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-white/12 text-xs">
              <div>
                <dt className="text-[#AAB8CE]">{t('handovers.mood')}</dt>
                <dd className="font-semibold text-[#F7F8FC] mt-0.5">{ho.checklist.mood}</dd>
              </div>
              <div>
                <dt className="text-[#AAB8CE]">{t('handovers.appetite')}</dt>
                <dd className="font-semibold text-[#F7F8FC] mt-0.5">{ho.checklist.appetite}</dd>
              </div>
              <div>
                <dt className="text-[#AAB8CE]">{t('handovers.hydration')}</dt>
                <dd className="font-semibold text-[#F7F8FC] mt-0.5">{ho.checklist.hydration}</dd>
              </div>
              <div>
                <dt className="text-[#AAB8CE]">{t('handovers.sleep')}</dt>
                <dd className="font-semibold text-[#F7F8FC] mt-0.5">{ho.checklist.sleepQuality}</dd>
              </div>
              <div>
                <dt className="text-[#AAB8CE]">{t('handovers.mobility')}</dt>
                <dd className="font-semibold text-[#F7F8FC] mt-0.5">{ho.checklist.mobility}</dd>
              </div>
            </dl>

            {ho.pendingFollowUps.length > 0 && (
              <div className="mt-4 pt-4 border-t border-white/12">
                <p className="text-xs font-semibold text-[#F7F8FC] mb-1.5">
                  {t('dashboards.pendingFollowUps')}
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm text-[#AAB8CE]">
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
