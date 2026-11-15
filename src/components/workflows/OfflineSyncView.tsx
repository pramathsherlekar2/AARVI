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
    session,
    browserOnline,
    simulateOffline,
    setSimulateOffline,
    effectiveOnline,
    syncQueue,
    pendingQueueCount,
    lastLocalSyncAt,
    flushSyncQueue,
    retrySyncItem,
    resetWorkspaceData,
  } = useAarvi();
  const {t} = useTranslation();

  const [checkingHealth, setCheckingHealth] = useState(false);
  const [healthSnapshot, setHealthSnapshot] = useState<SupabaseHealthSnapshot | null>(null);
  const [flushSummary, setFlushSummary] = useState<string>('');

  const handleCheckSupabaseHealth = async () => {
    setCheckingHealth(true);
    try {
      const res = await fetch('/api/supabase/health', {
        headers: session?.accessToken
          ? {Authorization: `Bearer ${session.accessToken}`}
          : undefined,
      });
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

  const handleFlush = async () => {
    const res = await flushSyncQueue();
    setFlushSummary(res.databaseStatus);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('offline.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('offline.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-2xl">{t('offline.pageSub')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Button
              variant={simulateOffline ? 'coral' : 'navyOutline'}
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
              onClick={() => void handleFlush()}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              <span>{t('offline.flushQueue', {count: pendingQueueCount})}</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-6 border-t border-[#F5F0E6]/15">
          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('offline.browserSignal')}</p>
            <div className="mt-1">
              {browserOnline ? (
                <StatusIndicator
                  onDark
                  tone="teal"
                  icon="check"
                  label={t('offline.browserOnline')}
                />
              ) : (
                <StatusIndicator
                  onDark
                  tone="coral"
                  icon="offline"
                  label={t('offline.browserOffline')}
                />
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('offline.effectiveMode')}</p>
            <div className="mt-1">
              {effectiveOnline ? (
                <StatusIndicator
                  onDark
                  tone="teal"
                  icon="sync"
                  label={t('offline.onlineActive')}
                />
              ) : (
                <StatusIndicator
                  onDark
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
            <p className="text-xs font-medium text-[#F5F0E6]/70">{t('offline.lastLocalCheck')}</p>
            <p className="text-sm font-semibold text-[#F5F0E6] mt-1">{lastLocalSyncAt}</p>
          </div>
        </div>
      </SurfaceCard>

      {flushSummary && (
        <SurfaceCard tone="inset">
          <p className="text-sm font-medium text-[#176D65]">{flushSummary}</p>
        </SurfaceCard>
      )}

      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('offline.serverHealthTitle')}
          subtitle={t('offline.serverHealthSub')}
          action={
            <Button
              variant="secondary"
              size="sm"
              disabled={checkingHealth || !effectiveOnline}
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
          <div className="p-4 rounded-xl bg-[#FAF6EE] border border-[#172C40]/14 space-y-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-[#172C40]">
                {t('offline.authGatewayLabel')}{' '}
                {healthSnapshot.authReachable ? t('offline.reachable') : t('offline.unreachable')}{' '}
                {healthSnapshot.authStatus ? `(${healthSnapshot.authStatus})` : ''}
              </span>
              <span className="text-xs font-mono text-[#176D65] tabular-nums">
                {t('offline.tablesDetected', {count: healthSnapshot.detectedTables.length})}
              </span>
            </div>
            {healthSnapshot.detectedTables.length > 0 && (
              <p className="text-xs text-[#172C40]/72 font-mono">
                {healthSnapshot.detectedTables.join(', ')}
              </p>
            )}
            {healthSnapshot.error && (
              <p className="text-xs text-[#A84433]">{healthSnapshot.error}</p>
            )}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('offline.recordedQueueTitle')}
          subtitle={t('offline.recordedQueueSub')}
          action={
            <Button variant="ghost" size="sm" onClick={() => void resetWorkspaceData()}>
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
          <div className="divide-y aarvi-divider">
            {syncQueue.map((item) => (
              <div
                key={item.id}
                className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/68">
                    <span className="font-mono font-semibold text-[#176D65] tabular-nums">
                      {item.timestampLabel}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{item.actionType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[#172C40]/55">
                      ID: {item.operationId.slice(0, 8)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-[#172C40] mt-0.5">{item.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.syncStatus === 'pending' ? (
                    <>
                      <StatusIndicator
                        tone="amber"
                        icon="offline"
                        label={t('offline.queuedLocally')}
                      />
                      {effectiveOnline && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => retrySyncItem(item.operationId)}
                        >
                          {t('offline.retryItem')}
                        </Button>
                      )}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#176D65]">
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
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex items-start gap-3">
            <CloudOff className="w-5 h-5 text-[#A84433] mt-0.5 shrink-0" aria-hidden="true" />
            <div className="text-sm text-[#172C40]">
              <p className="font-semibold text-[#A84433]">{t('offline.offlineBannerTitle')}</p>
              <p className="text-[#172C40]/80 mt-1">{t('offline.offlineBannerBody')}</p>
            </div>
          </div>
        </SurfaceCard>
      )}
    </div>
  );
}
