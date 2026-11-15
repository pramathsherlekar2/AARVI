import {useState} from 'react';
import {ArrowRight, BarChart3, Layers, Shield} from 'lucide-react';
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
  const {modules, setActiveRoute, medications, appointments, auditLogs, refillHistory} = useAarvi();
  const {t} = useTranslation();

  const [domainFilter, setDomainFilter] = useState<'All' | ModuleDomain>('All');

  const filteredModules = modules.filter(
    (m) => domainFilter === 'All' || m.domain === domainFilter,
  );

  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const adherenceRate =
    medications.length > 0 ? Math.round((takenCount / medications.length) * 100) : 0;
  const completedVisits = appointments.filter((a) => a.status === 'completed').length;

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('modules.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('modules.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-3xl">{t('modules.pageSub')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F0E6] tabular-nums shrink-0">
            <Layers className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />
            <span>{t('modules.registeredCount', {count: modules.length})}</span>
          </div>
        </div>
      </SurfaceCard>

      {/* Module 14: Analytics & Audit Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <SurfaceCard tone="cream" className="lg:col-span-5">
          <SectionHeader
            title={t('analytics.title')}
            subtitle={t('analytics.subtitle')}
            action={<BarChart3 className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />
          <dl className="divide-y aarvi-divider text-sm">
            <div className="py-3 first:pt-0 flex items-center justify-between">
              <dt className="text-[#172C40]/75">{t('analytics.adherenceRate')}</dt>
              <dd className="font-mono font-bold text-[#176D65] tabular-nums">{adherenceRate}%</dd>
            </div>
            <div className="py-3 flex items-center justify-between">
              <dt className="text-[#172C40]/75">{t('analytics.completedVisits')}</dt>
              <dd className="font-mono font-bold text-[#172C40] tabular-nums">{completedVisits}</dd>
            </div>
            <div className="py-3 flex items-center justify-between">
              <dt className="text-[#172C40]/75">{t('analytics.refillsLogged')}</dt>
              <dd className="font-mono font-bold text-[#172C40] tabular-nums">
                {refillHistory.length}
              </dd>
            </div>
            <div className="py-3 last:pb-0 flex items-center justify-between">
              <dt className="text-[#172C40]/75">{t('analytics.auditEvents')}</dt>
              <dd className="font-mono font-bold text-[#172C40] tabular-nums">
                {auditLogs.length}
              </dd>
            </div>
          </dl>
        </SurfaceCard>

        <SurfaceCard tone="cream" className="lg:col-span-7">
          <SectionHeader
            title={t('analytics.auditTitle')}
            subtitle={t('analytics.auditSubtitle')}
            action={<Shield className="w-5 h-5 text-[#172C40]" aria-hidden="true" />}
          />
          <div className="divide-y aarvi-divider max-h-60 overflow-y-auto">
            {auditLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="py-2.5 first:pt-0 last:pb-0 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-[#172C40]">
                    {log.actorName} · {log.action}
                  </span>
                  <span className="font-mono text-[#176D65] tabular-nums">
                    {log.timestampLabel}
                  </span>
                </div>
                <p className="text-[#172C40]/75 mt-0.5">{log.detail}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>

      {/* 16-Module Registry */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-[#F5F0E6] rounded-xl border border-[#172C40]/14 w-fit">
        {DOMAINS.map((domain) => (
          <button
            key={domain.id}
            type="button"
            onClick={() => setDomainFilter(domain.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              domainFilter === domain.id
                ? 'bg-[#172C40] text-[#F5F0E6]'
                : 'text-[#172C40]/75 hover:text-[#172C40] hover:bg-[#EBE3D3]'
            }`}
          >
            {t(domain.key)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredModules.map((mod) => (
          <SurfaceCard key={mod.id} tone="cream" className="p-5 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#172C40]/70">
                <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                  #{String(mod.id).padStart(2, '0')} · {mod.domain}
                </span>
                {mod.implementationState === 'active_synced' ? (
                  <StatusIndicator tone="teal" icon="check" label={t('modules.stateSynced')} />
                ) : mod.implementationState === 'active_local_queue' ? (
                  <StatusIndicator tone="navy" icon="sync" label={t('modules.stateActive')} />
                ) : (
                  <StatusIndicator
                    tone="amber"
                    icon="clock"
                    label={t('modules.stateConfigReq')}
                  />
                )}
              </div>

              <h3 className="font-display text-lg font-bold text-[#172C40] mt-2">
                {t(mod.titleKey)}
              </h3>
              <p className="text-sm text-[#172C40]/78 mt-1 leading-relaxed">{t(mod.summaryKey)}</p>
            </div>

            <div className="mt-4 pt-3 border-t aarvi-divider flex items-center justify-between gap-3">
              <p className="text-xs text-[#172C40]/70">
                <span className="font-semibold text-[#172C40]">{t('modules.phase3Api')}</span>{' '}
                {mod.backendRequirement}
              </p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setActiveRoute(mod.routeTarget)}
              >
                <span>{t('common.open')}</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Button>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}
