import {useState} from 'react';
import {CheckCircle2, CloudOff, Database, RefreshCw, Wifi, WifiOff} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

interface SupabaseHealthSnapshot {
  ok: boolean;
  authReachable: boolean;
  authStatus: string | null;
  detectedTables: string[];
  error: string | null;
}

export function OfflineSyncView() {
  const {
    browserOnline,
    simulateOffline,
    setSimulateOffline,
    effectiveOnline,
    syncQueue,
    pendingQueueCount,
    lastLocalSyncAt,
    flushLocalSyncQueue,
    resetDemoState,
  } = useAarvi();
  const {t} = useTranslation();

  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<SupabaseHealthSnapshot | null>(null);

  const handleCheckSupabaseHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/supabase/health');
      const data = (await res.json()) as SupabaseHealthSnapshot;
      setHealthSnapshot(data);
    } catch (err) {
      setHealthSnapshot({
        ok: false,
        authReachable: false,
        authStatus: null,
        detectedTables: [],
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCheckingHealth(false);
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-[#8BB8F2]">{t('offline.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC] mt-1">
              {t('offline.pageTitle')}
            </h1>
            <p className="text-sm text-[#DCE5F4] mt-1.5 max-w-2xl">{t('offline.pageSub')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant={simulateOffline ? 'coral' : 'secondary'}
              onClick={() => setSimulateOffline(!simulateOffline)}
            >
              {simulateOffline ? (
                <>
                  <Wifi className="w-4 h-4" aria-hidden="true" />
                  <span>{t('offline.endSim')}</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" aria-hidden="true" />
                  <span>{t('offline.startSim')}</span>
                </>
              )}
            </Button>

            <Button
              variant="teal"
              disabled={!effectiveOnline || pendingQueueCount === 0}
              onClick={flushLocalSyncQueue}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>{t('offline.flushQueue', {count: pendingQueueCount})}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-white/15">
          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('offline.browserSignal')}</p>
            <div className="mt-1">
              {browserOnline ? (
                <StatusIndicator tone="teal" icon="check" label={t('offline.browserOnline')} />
              ) : (
                <StatusIndicator tone="coral" icon="offline" label={t('offline.browserOffline')} />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('offline.effectiveMode')}</p>
            <div className="mt-1">
              {effectiveOnline ? (
                <StatusIndicator tone="teal" icon="sync" label={t('offline.onlineActive')} />
              ) : (
                <StatusIndicator
                  tone="coral"
                  icon="offline"
                  label={
                    simulateOffline
                      ? t('offline.simOfflineActive')
                      : t('offline.offlineQueueing')
                  }
                />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#AAB8CE]">{t('offline.lastLocalCheck')}</p>
            <p className="text-sm font-semibold text-[#F7F8FC] mt-1">{lastLocalSyncAt}</p>
          </div>
        </div>
      </SurfaceCard>

      {/* Server-Side Read-Only Supabase Health Check */}
      <SurfaceCard>
        <SectionHeader
          title={t('offline.serverHealthTitle')}
          subtitle={t('offline.serverHealthSub')}
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={checkingHealth}
              onClick={() => void handleCheckSupabaseHealth()}
            >
              <Database className="w-4 h-4" aria-hidden="true" />
              <span>
                {checkingHealth ? t('offline.checkingServer') : t('offline.checkServerBtn')}
              </span>
            </Button>
          }
        />

        {healthSnapshot && (
          <div className="p-4 rounded-xl bg-white/5 border border-white/12 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#F7F8FC]">
                Auth Gateway: {healthSnapshot.authReachable ? 'Reachable' : 'Unreachable'}{' '}
                {healthSnapshot.authStatus ? `(${healthSnapshot.authStatus})` : ''}
              </span>
              <span className="text-xs font-mono text-[#8BB8F2]">
                Tables detected: {healthSnapshot.detectedTables.length}
              </span>
            </div>
            {healthSnapshot.detectedTables.length > 0 && (
              <p className="text-xs text-[#AAB8CE] font-mono">
                {healthSnapshot.detectedTables.join(', ')}
              </p>
            )}
            {healthSnapshot.error && (
              <p className="text-xs text-[#FFB4B7]">{healthSnapshot.error}</p>
            )}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard>
        <SectionHeader
          title={t('offline.recordedQueueTitle')}
          subtitle={t('offline.recordedQueueSub')}
          action={
            <Button variant="ghost" size="sm" onClick={resetDemoState}>
              {t('offline.resetLocalData')}
            </Button>
          }
        />

        {syncQueue.length === 0 ? (
          <EmptyState
            title={t('offline.emptyQueueTitle')}
            description={t('offline.emptyQueueDesc')}
          />
        ) : (
          <div className="divide-y divide-white/10">
            {syncQueue.map((item) => (
              <div
                key={item.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-[#AAB8CE]">
                    <span className="font-mono font-semibold text-[#8BB8F2] tabular-nums">
                      {item.timestampLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.actionType}</span>
                  </div>
                  <p className="text-sm font-medium text-[#F7F8FC] mt-0.5">{item.description}</p>
                </div>

                <div className="shrink-0">
                  {item.syncStatus === 'pending_local_queue' ? (
                    <StatusIndicator
                      tone="amber"
                      icon="offline"
                      label={t('offline.queuedLocally')}
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5EEAD4]">
                      <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                      <span>{t('offline.savedLocally')}</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {!effectiveOnline && (
        <SurfaceCard className="bg-[#F16B70]/15 border-[#F16B70]/50">
          <div className="flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-[#FFB4B7] mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-sm text-[#F7F8FC]">
              <p className="font-semibold text-[#FFB4B7]">{t('offline.offlineBannerTitle')}</p>
              <p className="text-[#DCE5F4] mt-1">{t('offline.offlineBannerBody')}</p>
            </div>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
