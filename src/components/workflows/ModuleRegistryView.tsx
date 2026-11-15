import React, {useState} from 'react';
import {ArrowRight, Check, Droplets, Layers, Lock, Plus, Send} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {ModuleDomain} from '../../types/aarvi';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

const DOMAINS: Array<{id: 'All' | ModuleDomain; key: string}> = [
  {id: 'All', key: 'modules.domainAll'},
  {id: 'Identity & Access', key: 'modules.domainIdentity'},
  {id: 'Daily Care & Clinical', key: 'modules.domainClinical'},
  {id: 'Family & Operations', key: 'modules.domainFamily'},
  {id: 'Reliability & Governance', key: 'modules.domainGovernance'},
];

export function ModuleRegistryView() {
  const {modules, setActiveRoute, previewModules, updatePreviewModules, session} = useAarvi();
  const {t} = useTranslation();

  const [domainFilter, setDomainFilter] = useState<'All' | ModuleDomain>('All');
  const [noteInput, setNoteInput] = useState('');
  const [errandInput, setErrandInput] = useState('');

  const filteredModules = modules.filter(
    (m) => domainFilter === 'All' || m.domain === domainFilter,
  );

  const activeCount = modules.filter((m) => m.implementationState === 'phase2_ui_active').length;
  const previewCount = modules.filter((m) => m.implementationState === 'phase2_ui_preview').length;

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
          due: 'This week',
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('modules.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('modules.pageTitle')}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1.5 max-w-3xl">
              {t('modules.pageSub', {active: activeCount, preview: previewCount})}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F7F8FC] tabular-nums shrink-0">
            <Layers className="w-5 h-5 text-[#8BB8F2]" aria-hidden="true" />
            <span>{t('modules.registeredCount')}</span>
          </div>
        </div>
      </SurfaceCard>

      <div className="flex flex-wrap items-center gap-1 p-1 bg-white/6 rounded-xl border border-white/12 w-fit">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            type="button"
            onClick={() => setDomainFilter(domain.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              domainFilter === domain.id
                ? 'bg-[#4778B8] text-white'
                : 'text-[#AAB8CE] hover:text-white hover:bg-white/10'
            }`}
          >
            {t(domain.key)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredModules.map((mod) => {
          const isActive = mod.implementationState === 'phase2_ui_active';
          return (
            <SurfaceCard key={mod.id} className="p-5 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#AAB8CE]">
                  <span className="font-mono font-semibold text-[#8BB8F2] tabular-nums">
                    #{String(mod.id).padStart(2, '0')} · {mod.domain}
                  </span>
                  {isActive ? (
                    <StatusIndicator tone="teal" icon="check" label={t('modules.stateActive')} />
                  ) : (
                    <StatusIndicator tone="amber" icon="clock" label={t('modules.statePreview')} />
                  )}
                </div>

                <h3 className="font-display text-lg font-bold text-[#F7F8FC] mt-2">{mod.title}</h3>
                <p className="text-sm text-[#AAB8CE] mt-1 leading-relaxed">{mod.summary}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/12 flex items-center justify-between gap-3">
                <p className="text-xs text-[#AAB8CE]">
                  <span className="font-semibold text-[#F7F8FC]">{t('modules.phase3Api')}</span>{' '}
                  {mod.backendRequirement}
                </p>
                {mod.routeTarget !== 'modules' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveRoute(mod.routeTarget)}
                  >
                    <span>{t('common.open')}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard>
        <SectionHeader title={t('modules.previewsTitle')} subtitle={t('modules.previewsSub')} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-white/5 border border-white/12 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display font-bold text-[#F7F8FC] flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#5EEAD4]" aria-hidden="true" />
                <span>{t('modules.hydrationTitle')}</span>
              </h4>
              <span className="font-mono text-xs font-semibold text-[#5EEAD4] tabular-nums">
                {t('modules.glassesLabel', {
                  count: previewModules.hydrationGlasses,
                  target: previewModules.hydrationTarget,
                })}
              </span>
            </div>
            <p className="text-sm text-[#AAB8CE]">
              {t('modules.latestMeal')} {previewModules.lastMealNote}
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="teal"
                onClick={() =>
                  updatePreviewModules((p) => ({
                    ...p,
                    hydrationGlasses: Math.min(p.hydrationTarget, p.hydrationGlasses + 1),
                  }))
                }
              >
                {t('modules.logGlass')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  updatePreviewModules((p) => ({
                    ...p,
                    hydrationGlasses: Math.max(0, p.hydrationGlasses - 1),
                  }))
                }
              >
                -1
              </Button>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/12 space-y-3">
            <h4 className="font-display font-bold text-[#F7F8FC] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#8BB8F2]" aria-hidden="true" />
              <span>{t('modules.consentTitle')}</span>
            </h4>
            <div className="space-y-2.5 text-sm">
              {(
                [
                  {
                    key: 'shareMedicationLogsWithFamily',
                    label: t('modules.consentMedLogs'),
                  },
                  {
                    key: 'shareShiftNotesWithFamily',
                    label: t('modules.consentShiftNotes'),
                  },
                  {
                    key: 'allowCaregiverAppointmentEdits',
                    label: t('modules.consentAptEdits'),
                  },
                ] as const
              ).map((item) => {
                const enabled = previewModules.consentToggles[item.key];
                return (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-[#AAB8CE]">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={enabled}
                      onClick={() =>
                        updatePreviewModules((p) => ({
                          ...p,
                          consentToggles: {
                            ...p.consentToggles,
                            [item.key]: !enabled,
                          },
                        }))
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                        enabled
                          ? 'bg-[#2DD4BF]/20 text-[#5EEAD4] border border-[#2DD4BF]/40'
                          : 'bg-white/10 text-[#AAB8CE] border border-white/10'
                      }`}
                    >
                      {enabled ? t('modules.allowed') : t('modules.restricted')}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/12 space-y-3">
            <h4 className="font-display font-bold text-[#F7F8FC]">{t('modules.updatesTitle')}</h4>
            <form onSubmit={handleAddCircleNote} className="flex gap-2">
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('modules.updatesPlaceholder')}
                aria-label={t('modules.updatesTitle')}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
              <Button type="submit" size="sm" variant="primary">
                <Send className="w-4 h-4" aria-hidden="true" />
                <span>{t('modules.post')}</span>
              </Button>
            </form>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {previewModules.careCircleNotes.map((n) => (
                <div key={n.id} className="text-xs border-t border-white/10 pt-2">
                  <span className="font-semibold text-[#F7F8FC]">{n.author}</span>{' '}
                  <span className="text-[#AAB8CE]">
                    ({n.role}) · {n.time}
                  </span>
                  <p className="text-[#DCE5F4] mt-0.5">{n.message}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-xl bg-white/5 border border-white/12 space-y-3">
            <h4 className="font-display font-bold text-[#F7F8FC]">{t('modules.errandsTitle')}</h4>
            <form onSubmit={handleAddErrand} className="flex gap-2">
              <input
                type="text"
                value={errandInput}
                onChange={(e) => setErrandInput(e.target.value)}
                placeholder={t('modules.errandsPlaceholder')}
                aria-label={t('modules.errandsTitle')}
                className="flex-1 min-h-[40px] px-3 py-2 rounded-xl border border-white/18 bg-[#07152B]/70 text-sm text-[#F7F8FC] placeholder:text-[#7D90AA]"
              />
              <Button type="submit" size="sm" variant="secondary">
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{t('modules.add')}</span>
              </Button>
            </form>
            <div className="space-y-2">
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
                  className="w-full flex items-center justify-between gap-2 text-left text-xs border-t border-white/10 pt-2 cursor-pointer"
                >
                  <span
                    className={
                      er.done ? 'line-through text-[#AAB8CE]' : 'text-[#F7F8FC] font-medium'
                    }
                  >
                    {er.title} · {er.assignee}
                  </span>
                  <span className="text-[#5EEAD4] font-semibold shrink-0 inline-flex items-center gap-1">
                    {er.done && <Check className="w-3.5 h-3.5" aria-hidden="true" />}
                    {er.done ? t('common.done') : er.due}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
