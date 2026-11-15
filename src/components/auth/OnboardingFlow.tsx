import {useState} from 'react';
import {ArrowLeft, ArrowRight, Check, Eye, Type, Volume2} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {TextScale} from '../../types/aarvi';
import {AarviLogo, Button, SurfaceCard} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';

export function OnboardingFlow() {
  const {session, preferences, updatePreferences, patientProfile, completeOnboarding} = useAarvi();
  const {t} = useTranslation();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  if (!session) return null;

  const totalSteps = 3;
  const roleLabel = t(`roles.${session.role}`);

  return (
    <div className="min-h-screen bg-[#07152B] text-[#F7F8FC] py-8 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <AarviLogo size="md" showWordmark />
          <div className="flex items-center gap-3">
            <LanguageSelector compact />
            <div className="text-sm font-medium text-[#AAB8CE] tabular-nums">
              {t('onboarding.stepOf', {step, total: totalSteps, role: roleLabel})}
            </div>
          </div>
        </div>

        {/* Accessible step progress bar */}
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-6" aria-hidden="true">
          <div
            className="h-full bg-gradient-to-r from-[#4778B8] to-[#F16B70] transition-all duration-200"
            style={{width: `${(step / totalSteps) * 100}%`}}
          />
        </div>

        <SurfaceCard tone="hero" className="p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC]">
                  {t('onboarding.welcomeTitle', {name: session.fullName})}
                </h1>
                <p className="text-base text-[#DCE5F4] mt-2">
                  {t('onboarding.welcomeBody', {role: roleLabel})}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F7F8FC] mb-3">
                  <Type className="w-4 h-4 text-[#8BB8F2]" aria-hidden="true" />
                  <span>{t('onboarding.preferredTextSize')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      {
                        id: 'standard',
                        label: t('onboarding.sizeStandard'),
                        sample: t('onboarding.sizeStandardDesc'),
                      },
                      {
                        id: 'large',
                        label: t('onboarding.sizeLarge'),
                        sample: t('onboarding.sizeLargeDesc'),
                      },
                      {
                        id: 'xlarge',
                        label: t('onboarding.sizeXlarge'),
                        sample: t('onboarding.sizeXlargeDesc'),
                      },
                    ] as Array<{id: TextScale; label: string; sample: string}>
                  ).map((opt) => {
                    const active = preferences.textScale === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePreferences({textScale: opt.id})}
                        aria-pressed={active}
                        className={`p-4 rounded-xl border text-left transition-all cursor-pointer min-h-[44px] ${
                          active
                            ? 'bg-[#4778B8]/25 border-[#8BB8F2] ring-2 ring-[#4778B8]/40'
                            : 'bg-white/5 border-white/14 hover:border-white/30'
                        }`}
                      >
                        <p className="font-semibold text-[#F7F8FC] text-sm">{opt.label}</p>
                        <p className="text-xs text-[#AAB8CE] mt-1">{opt.sample}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white/5 border border-white/14">
                <div className="flex items-start gap-3">
                  <Eye className="w-5 h-5 text-[#8BB8F2] mt-0.5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-semibold text-sm text-[#F7F8FC]">
                      {t('onboarding.highContrastTitle')}
                    </p>
                    <p className="text-xs text-[#AAB8CE] mt-0.5">
                      {t('onboarding.highContrastDesc')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={preferences.highContrast}
                  onClick={() => updatePreferences({highContrast: !preferences.highContrast})}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold min-h-[44px] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    preferences.highContrast
                      ? 'bg-[#4778B8] text-white'
                      : 'bg-white/10 text-[#F7F8FC]'
                  }`}
                >
                  {preferences.highContrast ? t('onboarding.enabled') : t('onboarding.standard')}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC]">
                  {t('onboarding.confirmCircleTitle')}
                </h1>
                <p className="text-base text-[#DCE5F4] mt-2">{t('onboarding.confirmCircleBody')}</p>
              </div>

              <div className="rounded-xl bg-white/6 border border-white/14 p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-[#8BB8F2]">
                      {t('onboarding.linkedPatient')}
                    </p>
                    <p className="font-display text-lg font-bold text-[#F7F8FC]">
                      {patientProfile.fullName} (
                      {t('onboarding.yearsOld', {age: patientProfile.age})})
                    </p>
                  </div>
                  <span className="text-sm text-[#AAB8CE]">{patientProfile.primaryPhysician}</span>
                </div>
                <p className="text-sm text-[#AAB8CE]">{patientProfile.residenceSummary}</p>
                <div className="pt-3 border-t border-white/12 text-sm text-[#F7F8FC]">
                  <span className="font-semibold text-[#F16B70]">
                    {t('onboarding.allergiesOnRecord')}
                  </span>{' '}
                  {patientProfile.allergies.join(', ')}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-[#F7F8FC] mb-3">
                  <Volume2 className="w-4 h-4 text-[#8BB8F2]" aria-hidden="true" />
                  <span>{t('onboarding.reminderStyleTitle')}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => updatePreferences({reminderTone: 'gentle'})}
                    aria-pressed={preferences.reminderTone === 'gentle'}
                    className={`p-4 rounded-xl border text-left cursor-pointer min-h-[44px] transition-all ${
                      preferences.reminderTone === 'gentle'
                        ? 'bg-[#4778B8]/25 border-[#8BB8F2] ring-2 ring-[#4778B8]/40'
                        : 'bg-white/5 border-white/14'
                    }`}
                  >
                    <p className="font-semibold text-sm text-[#F7F8FC]">
                      {t('onboarding.gentleTitle')}
                    </p>
                    <p className="text-xs text-[#AAB8CE] mt-1">{t('onboarding.gentleDesc')}</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => updatePreferences({reminderTone: 'persistent'})}
                    aria-pressed={preferences.reminderTone === 'persistent'}
                    className={`p-4 rounded-xl border text-left cursor-pointer min-h-[44px] transition-all ${
                      preferences.reminderTone === 'persistent'
                        ? 'bg-[#4778B8]/25 border-[#8BB8F2] ring-2 ring-[#4778B8]/40'
                        : 'bg-white/5 border-white/14'
                    }`}
                  >
                    <p className="font-semibold text-sm text-[#F7F8FC]">
                      {t('onboarding.persistentTitle')}
                    </p>
                    <p className="text-xs text-[#AAB8CE] mt-1">{t('onboarding.persistentDesc')}</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F7F8FC]">
                  {t('onboarding.readyTitle', {role: roleLabel})}
                </h1>
                <p className="text-base text-[#DCE5F4] mt-2">{t('onboarding.readyBody')}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-[#2DD4BF]/12 border border-[#2DD4BF]/35">
                  <Check className="w-5 h-5 text-[#5EEAD4] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="text-sm text-[#F7F8FC]">
                    <p className="font-semibold">{t('onboarding.readyCoreTitle')}</p>
                    <p className="text-[#DCE5F4] mt-0.5">{t('onboarding.readyCoreBody')}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/14">
                  <Check className="w-5 h-5 text-[#8BB8F2] mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="text-sm text-[#F7F8FC]">
                    <p className="font-semibold">{t('onboarding.readyModulesTitle')}</p>
                    <p className="text-[#AAB8CE] mt-0.5">{t('onboarding.readyModulesBody')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-white/12 flex items-center justify-between gap-4">
            {step > 1 ? (
              <Button variant="secondary" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                <span>{t('onboarding.back')}</span>
              </Button>
            ) : (
              <Button variant="ghost" onClick={completeOnboarding}>
                <span>{t('onboarding.skipSetup')}</span>
              </Button>
            )}

            {step < 3 ? (
              <Button variant="teal" onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}>
                <span>{t('onboarding.continue')}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button variant="primary" size="lg" onClick={completeOnboarding}>
                <span>{t('onboarding.enterDashboard', {role: roleLabel})}</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
