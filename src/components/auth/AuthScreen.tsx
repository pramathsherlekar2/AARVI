import React, {useState} from 'react';
import {ArrowRight, Eye, EyeOff, HeartHandshake, ShieldCheck, UserCheck, Users} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {UserRole} from '../../types/aarvi';
import {AarviLogo, Button, SurfaceCard} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';

const ROLE_CARDS: Array<{
  role: UserRole;
  descKey: string;
  defaultRelation: string;
  icon: React.ReactNode;
}> = [
  {
    role: 'elderly_patient',
    descKey: 'auth.roleDescPatient',
    defaultRelation: 'Primary Care Recipient',
    icon: <UserCheck className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />,
  },
  {
    role: 'family_member',
    descKey: 'auth.roleDescFamily',
    defaultRelation: 'Daughter · Primary Coordinator',
    icon: <Users className="w-5 h-5 text-[#8BB8F2]" aria-hidden="true" />,
  },
  {
    role: 'caregiver',
    descKey: 'auth.roleDescCaregiver',
    defaultRelation: 'Day Shift Caregiver',
    icon: <HeartHandshake className="w-5 h-5 text-[#F16B70]" aria-hidden="true" />,
  },
];

export function AuthScreen() {
  const {signInLocal, switchRolePreview} = useAarvi();
  const {t} = useTranslation();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('family_member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [relationship, setRelationship] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(t('auth.errInvalidEmail'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('auth.errShortPassword'));
      return;
    }
    if (mode === 'register' && !fullName.trim()) {
      setErrorMsg(t('auth.errMissingName'));
      return;
    }

    const roleMeta = ROLE_CARDS.find((r) => r.role === selectedRole);
    const derivedName =
      fullName.trim() ||
      (selectedRole === 'elderly_patient'
        ? 'Meera Kulkarni'
        : selectedRole === 'caregiver'
          ? 'Priya Nair, RN'
          : 'Ananya Kulkarni');

    signInLocal({
      fullName: derivedName,
      email: email.trim(),
      role: selectedRole,
      relationshipOrTitle: relationship.trim() || roleMeta?.defaultRelation || 'Care Member',
      skipOnboarding: false,
    });
  };

  return (
    <div className="min-h-screen bg-[#07152B] text-[#F7F8FC] flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4 border-b border-white/10">
        <AarviLogo size="md" showWordmark />
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden md:flex text-xs text-[#AAB8CE] items-center gap-2 whitespace-nowrap">
            <ShieldCheck className="w-4 h-4 text-[#5EEAD4]" aria-hidden="true" />
            <span>{t('brand.phaseBadge')}</span>
          </div>
          <LanguageSelector />
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Atmospheric Blue-Indigo-Coral Hero Card with Original Aarvi Logo */}
        <div className="lg:col-span-5 flex flex-col justify-between aarvi-glass-elevated aarvi-hero-glow rounded-3xl p-8">
          <div>
            <div className="inline-flex mb-6">
              <AarviLogo size="lg" />
            </div>

            <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F7F8FC] leading-tight">
              {t('auth.heroTitle')}
            </h1>
            <p className="text-[#DCE5F4] mt-4 text-base leading-relaxed">
              {t('auth.heroSubtitle')}
            </p>

            <div className="mt-8 pt-6 border-t border-white/15 space-y-2 text-sm text-[#AAB8CE]">
              <p className="font-semibold text-[#F7F8FC]">{t('auth.scopeTitle')}</p>
              <p className="leading-relaxed">{t('auth.scopeBody')}</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-white/15">
            <p className="text-sm font-semibold text-[#F16B70] mb-3">
              {t('auth.quickLaunchTitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  onClick={() => switchRolePreview(card.role)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/10 hover:bg-white/18 border border-white/15 px-4 py-3 text-left transition-all cursor-pointer min-h-[44px]"
                >
                  <span className="font-medium text-sm text-[#F7F8FC]">
                    {t('auth.roleDashboardSuffix', {role: t(`roles.${card.role}`)})}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#F16B70] shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Registration & Login Glass Card */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/12 pb-5 mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#F7F8FC]">
                  {mode === 'login' ? t('auth.signInTitle') : t('auth.registerTitle')}
                </h2>
                <p className="text-sm text-[#AAB8CE] mt-1">{t('auth.authSubtitle')}</p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-[#07152B]/70 rounded-xl border border-white/12 shrink-0 self-start">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                  }}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#4778B8] text-white'
                      : 'text-[#AAB8CE] hover:text-white'
                  }`}
                >
                  {t('auth.signInTab')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setErrorMsg('');
                  }}
                  className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#4778B8] text-white'
                      : 'text-[#AAB8CE] hover:text-white'
                  }`}
                >
                  {t('auth.registerTab')}
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <fieldset>
                <legend className="text-sm font-semibold text-[#F7F8FC] mb-2.5">
                  {t('auth.chooseRole')}
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ROLE_CARDS.map((card) => {
                    const active = selectedRole === card.role;
                    return (
                      <button
                        key={card.role}
                        type="button"
                        onClick={() => setSelectedRole(card.role)}
                        aria-pressed={active}
                        className={`text-left rounded-xl p-4 border transition-all cursor-pointer min-h-[44px] ${
                          active
                            ? 'bg-[#4778B8]/25 border-[#8BB8F2] ring-2 ring-[#4778B8]/40'
                            : 'bg-white/5 border-white/12 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          {card.icon}
                          <span className="text-xs font-semibold text-[#8BB8F2]">
                            {active ? t('auth.selected') : t('auth.select')}
                          </span>
                        </div>
                        <p className="font-display font-bold text-sm text-[#F7F8FC]">
                          {t(`roles.${card.role}`)}
                        </p>
                        <p className="text-xs text-[#AAB8CE] mt-1 leading-relaxed">
                          {t(card.descKey)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {mode === 'register' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="aarvi-fullname"
                      className="block text-sm font-semibold text-[#F7F8FC] mb-1.5"
                    >
                      {t('auth.fullName')}
                    </label>
                    <input
                      id="aarvi-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={t('auth.fullNamePlaceholder')}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/18 bg-[#07152B]/70 text-[#F7F8FC] placeholder:text-[#7D90AA]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="aarvi-relationship"
                      className="block text-sm font-semibold text-[#F7F8FC] mb-1.5"
                    >
                      {t('auth.relationshipTitle')}
                    </label>
                    <input
                      id="aarvi-relationship"
                      type="text"
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      placeholder={t(`roles.${selectedRole}`)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/18 bg-[#07152B]/70 text-[#F7F8FC] placeholder:text-[#7D90AA]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="aarvi-email"
                  className="block text-sm font-semibold text-[#F7F8FC] mb-1.5"
                >
                  {t('auth.emailLabel')}
                </label>
                <input
                  id="aarvi-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-white/18 bg-[#07152B]/70 text-[#F7F8FC] placeholder:text-[#7D90AA]"
                />
              </div>

              <div>
                <label
                  htmlFor="aarvi-password"
                  className="block text-sm font-semibold text-[#F7F8FC] mb-1.5"
                >
                  {t('auth.passwordLabel')}
                </label>
                <div className="relative">
                  <input
                    id="aarvi-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordPlaceholder')}
                    className="w-full min-h-[44px] px-4 py-2.5 pr-12 rounded-xl border border-white/18 bg-[#07152B]/70 text-[#F7F8FC] placeholder:text-[#7D90AA]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#AAB8CE] hover:text-white cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" aria-hidden="true" />
                    ) : (
                      <Eye className="w-5 h-5" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#F16B70]/60 bg-[#F16B70]/15 px-4 py-3 text-sm font-medium text-[#FFB4B7]"
                >
                  {errorMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-xs text-[#AAB8CE]">{t('auth.localNotice')}</p>
                <Button type="submit" variant="teal" size="lg">
                  <span>
                    {mode === 'login' ? t('auth.continueOnboarding') : t('auth.createAndOnboard')}
                  </span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            </form>
          </SurfaceCard>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 text-xs text-[#AAB8CE] flex flex-wrap items-center justify-between gap-4 border-t border-white/10">
        <span>{t('auth.footerLeft')}</span>
        <span>{t('auth.footerRight')}</span>
      </footer>
    </div>
  );
}
