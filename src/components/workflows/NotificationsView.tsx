import {useState} from 'react';
import {Bell, CheckCheck, Mail} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function NotificationsView() {
  const {
    session,
    capabilities,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    sendNotificationEmail,
    preferences,
    updatePreferences,
    effectiveOnline,
  } = useAarvi();
  const {t} = useTranslation();

  const [recipientEmail, setRecipientEmail] = useState(session?.email ?? '');
  const [sendingId, setSendingId] = useState<string | null>(null);

  const handleSendEmail = async (id: string) => {
    if (!recipientEmail.trim()) return;
    setSendingId(id);
    await sendNotificationEmail(id, recipientEmail.trim());
    setSendingId(null);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('notifications.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('notifications.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('notifications.pageSub')}</p>
          </div>
          <Button variant="navyOutline" onClick={markAllNotificationsRead}>
            <CheckCheck className="w-4 h-4" aria-hidden="true" />
            <span>{t('notifications.markAllRead')}</span>
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard tone="cream" className="lg:col-span-8">
          <SectionHeader
            title={t('notifications.feedTitle')}
            subtitle={t('notifications.feedSub')}
            action={<Bell className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />

          {notifications.length === 0 ? (
            <EmptyState
              title={t('notifications.emptyTitle')}
              description={t('notifications.emptyDesc')}
            />
          ) : (
            <div className="divide-y aarvi-divider">
              {notifications.map((item) => (
                <div key={item.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/68">
                        <span className="font-semibold text-[#176D65]">
                          {t(`notifications.categories.${item.category}`)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.timeLabel}</span>
                        {!item.read && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#A84433]">
                              {t('notifications.unread')}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="font-display font-bold text-base text-[#172C40] mt-0.5">
                        {item.title}
                      </h3>
                      <p className="text-sm text-[#172C40]/78 mt-0.5">{item.body}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {!item.read && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => markNotificationRead(item.id)}
                        >
                          {t('notifications.markRead')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!effectiveOnline || sendingId === item.id || !recipientEmail.trim()}
                        onClick={() => void handleSendEmail(item.id)}
                      >
                        <Mail className="w-4 h-4" aria-hidden="true" />
                        <span>{t('notifications.sendEmailBtn')}</span>
                      </Button>
                    </div>
                  </div>

                  {item.emailStatus !== 'not_sent' && (
                    <p
                      className={`text-xs ${
                        item.emailStatus === 'sent' ? 'text-[#176D65]' : 'text-[#A84433]'
                      }`}
                    >
                      {item.emailDetail}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard tone="cream" className="lg:col-span-4 space-y-5">
          <SectionHeader
            title={t('notifications.preferencesTitle')}
            subtitle={t('notifications.preferencesSub')}
          />

          <div className="space-y-4 text-sm">
            <div>
              <label htmlFor="nt-email" className="block text-xs font-semibold text-[#172C40] mb-1">
                {t('notifications.targetEmailLabel')}
              </label>
              <input
                id="nt-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div className="pt-2 border-t aarvi-divider flex items-center justify-between gap-3">
              <span className="text-[#172C40]/85">{t('notifications.quietHours')}</span>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.quietHoursEnabled}
                onClick={() =>
                  updatePreferences({quietHoursEnabled: !preferences.quietHoursEnabled})
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  preferences.quietHoursEnabled
                    ? 'bg-[#172C40] text-[#F5F0E6]'
                    : 'bg-[#EBE3D3] text-[#172C40]'
                }`}
              >
                {preferences.quietHoursEnabled ? t('nav.on') : t('nav.off')}
              </button>
            </div>

            <div className="pt-2 border-t aarvi-divider space-y-1">
              <p className="text-xs font-semibold text-[#172C40]">
                {t('notifications.emailProviderStatus')}
              </p>
              {capabilities.emailProviderConfigured ? (
                <StatusIndicator
                  tone="teal"
                  icon="check"
                  label={t('notifications.providerReady')}
                />
              ) : (
                <StatusIndicator
                  tone="amber"
                  icon="alert"
                  label={t('notifications.providerMissing')}
                />
              )}
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
