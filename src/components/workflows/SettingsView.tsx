import {Eye, Globe, Lock, Smartphone, Type, Volume2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {TextScale} from '../../types/aarvi';
import {Button, SectionHeader, SurfaceCard} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';
import {PWAInstallButton} from '../ui/PWAInstallButton';

export function SettingsView() {
  const {
    session,
    preferences,
    updatePreferences,
    previewModules,
    updatePreviewModules,
    signOut,
  } = useAarvi();
  const {t} = useTranslation();

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('settings.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('settings.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('settings.pageSub')}</p>
          </div>
          <Button variant="navyOutline" onClick={() => void signOut()}>
            {t('nav.signOut')}
          </Button>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard tone="cream" className="lg:col-span-6 space-y-6">
          <SectionHeader
            title={t('settings.accessibilityTitle')}
            subtitle={t('settings.accessibilitySub')}
            action={<Type className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />

          <div>
            <p className="text-sm font-semibold text-[#172C40] mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4 text-[#176D65]" aria-hidden="true" />
              <span>{t('language.label')}</span>
            </p>
            <LanguageSelector tone="cream" />
          </div>

          <div className="pt-4 border-t aarvi-divider">
            <p className="text-sm font-semibold text-[#172C40] mb-2.5">
              {t('onboarding.preferredTextSize')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {id: 'standard', label: t('onboarding.sizeStandard')},
                  {id: 'large', label: t('onboarding.sizeLarge')},
                  {id: 'xlarge', label: t('onboarding.sizeXlarge')},
                ] as Array<{id: TextScale; label: string}>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updatePreferences({textScale: opt.id})}
                  aria-pressed={preferences.textScale === opt.id}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    preferences.textScale === opt.id
                      ? 'bg-[#172C40] text-[#F5F0E6] border-[#172C40]'
                      : 'bg-[#FAF6EE] text-[#172C40] border-[#172C40]/16 hover:bg-[#EBE3D3]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t aarvi-divider flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Eye className="w-4 h-4 text-[#176D65] mt-1 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-[#172C40]">
                  {t('onboarding.highContrastTitle')}
                </p>
                <p className="text-xs text-[#172C40]/70">{t('onboarding.highContrastDesc')}</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={preferences.highContrast}
              onClick={() => updatePreferences({highContrast: !preferences.highContrast})}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                preferences.highContrast
                  ? 'bg-[#172C40] text-[#F5F0E6]'
                  : 'bg-[#EBE3D3] text-[#172C40]'
              }`}
            >
              {preferences.highContrast ? t('nav.on') : t('nav.off')}
            </button>
          </div>

          <div className="pt-4 border-t aarvi-divider flex items-center justify-between gap-4">
            <div className="flex items-start gap-2.5">
              <Volume2 className="w-4 h-4 text-[#176D65] mt-1 shrink-0" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-[#172C40]">
                  {t('onboarding.reminderStyleTitle')}
                </p>
                <p className="text-xs text-[#172C40]/70">
                  {preferences.reminderTone === 'gentle'
                    ? t('onboarding.gentleDesc')
                    : t('onboarding.persistentDesc')}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                updatePreferences({
                  reminderTone: preferences.reminderTone === 'gentle' ? 'persistent' : 'gentle',
                })
              }
            >
              {preferences.reminderTone === 'gentle'
                ? t('onboarding.gentleTitle')
                : t('onboarding.persistentTitle')}
            </Button>
          </div>
        </SurfaceCard>

        <div className="lg:col-span-6 space-y-6">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('modules.consentTitle')}
              subtitle={t('settings.consentSub')}
              action={<Lock className="w-5 h-5 text-[#172C40]" aria-hidden="true" />}
            />
            <div className="divide-y aarvi-divider text-sm">
              {(
                [
                  {key: 'shareMedicationLogsWithFamily', label: t('modules.consentMedLogs')},
                  {key: 'shareShiftNotesWithFamily', label: t('modules.consentShiftNotes')},
                  {key: 'allowCaregiverAppointmentEdits', label: t('modules.consentAptEdits')},
                ] as const
              ).map((item) => {
                const enabled = previewModules.consentToggles[item.key];
                return (
                  <div
                    key={item.key}
                    className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                  >
                    <span className="text-[#172C40]/85">{item.label}</span>
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
                          ? 'bg-[#269B91] text-[#FAF6EE]'
                          : 'bg-[#EBE3D3] text-[#172C40]/75'
                      }`}
                    >
                      {enabled ? t('modules.allowed') : t('modules.restricted')}
                    </button>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('settings.pwaTitle')}
              subtitle={t('settings.pwaSub')}
              action={<Smartphone className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[#172C40]/78">{t('settings.pwaDesc')}</p>
              <PWAInstallButton variant="settings" />
            </div>
          </SurfaceCard>

          {session && (
            <SurfaceCard tone="inset">
              <p className="text-xs font-semibold text-[#176D65]">{t('settings.sessionTitle')}</p>
              <p className="font-display font-bold text-base text-[#172C40] mt-1">
                {session.fullName} · {t(`roles.${session.role}`)}
              </p>
              <p className="text-xs text-[#172C40]/72 mt-0.5">
                {session.email} · {session.signedInAt}
              </p>
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}
