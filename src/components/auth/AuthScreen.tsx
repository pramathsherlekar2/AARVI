import React, {useState} from 'react';
import {
  ArrowRight,
  Eye,
  EyeOff,
  HeartHandshake,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {UserRole} from '../../types/aarvi';
import {AarviLogo, Button, SurfaceCard} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';
import {PWAInstallButton} from '../ui/PWAInstallButton';

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
    icon: <UserCheck className="w-5 h-5 text-[#176D65]" aria-hidden="true" />,
  },
  {
    role: 'family_member',
    descKey: 'auth.roleDescFamily',
    defaultRelation: 'Daughter · Primary Coordinator',
    icon: <Users className="w-5 h-5 text-[#172C40]" aria-hidden="true" />,
  },
  {
    role: 'caregiver',
    descKey: 'auth.roleDescCaregiver',
    defaultRelation: 'Day Shift Caregiver',
    icon: <HeartHandshake className="w-5 h-5 text-[#A84433]" aria-hidden="true" />,
  },
];

export function AuthScreen() {
  const {
    capabilities,
    signInWithSupabaseAuth,
    registerWithSupabaseAuth,
    signInPreviewRole,
  } = useAarvi();
  const {t} = useTranslation();

  const [mode, setMode] = useState<'login' | 'register' | 'recover' | 'invite'>('login');
  const [selectedRole, setSelectedRole] = useState<UserRole>('family_member');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [relationship, setRelationship] = useState('');
  const [invitePasscode, setInvitePasscode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(t('auth.errInvalidEmail'));
      return;
    }

    if (mode === 'recover') {
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/recover', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email.trim()}),
        });
        const data = (await res.json()) as {ok: boolean; error?: string};
        if (data.ok) {
          setInfoMsg(t('auth.recoverSent'));
        } else {
          setErrorMsg(data.error || t('auth.recoverFailed'));
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'invite') {
      if (!invitePasscode.trim()) {
        setErrorMsg(t('auth.errMissingPasscode'));
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/invitations/accept', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({email: email.trim(), passcode: invitePasscode.trim()}),
        });
        const data = (await res.json()) as {
          ok: boolean;
          invitation?: {role: UserRole; recipientName: string};
          error?: string;
        };
        if (data.ok && data.invitation) {
          setInfoMsg(t('auth.inviteVerified', {name: data.invitation.recipientName}));
          setSelectedRole(data.invitation.role);
          setFullName(data.invitation.recipientName);
          setMode('register');
        } else {
          setErrorMsg(data.error || t('auth.inviteInvalid'));
        }
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
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

    setSubmitting(true);
    try {
      if (mode === 'login') {
        const res = await signInWithSupabaseAuth({email: email.trim(), password});
        if (!res.ok) {
          setErrorMsg(res.error || t('auth.authFailed'));
        }
      } else {
        const roleMeta = ROLE_CARDS.find((r) => r.role === selectedRole);
        const res = await registerWithSupabaseAuth({
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          role: selectedRole,
          relationshipOrTitle:
            relationship.trim() || roleMeta?.defaultRelation || 'Care Coordinator',
        });
        if (!res.ok) {
          setErrorMsg(res.error || t('auth.authFailed'));
        } else if (res.confirmationRequired) {
          setInfoMsg(t('auth.confirmEmailNotice'));
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen aarvi-navy-canvas flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-6 py-5 flex items-center justify-between gap-4 border-b border-[#F5F0E6]/12">
        <AarviLogo size="md" showWordmark tone="dark" />
        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton variant="header" />
          <LanguageSelector tone="dark" />
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        {/* Left: Tidewell-inspired Deep Navy Hero with Original Aarvi Logo */}
        <div className="lg:col-span-5 flex flex-col justify-between py-2">
          <div>
            <div className="inline-flex mb-6">
              <AarviLogo size="lg" tone="dark" />
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#F5F0E6] leading-[1.1] tracking-tight">
              {t('auth.heroTitle')}
            </h1>
            <p className="text-[#F5F0E6]/82 mt-5 text-base leading-relaxed max-w-md">
              {t('auth.heroSubtitle')}
            </p>

            <div className="mt-8 pt-6 border-t border-[#F5F0E6]/15 space-y-2 text-sm text-[#F5F0E6]/75">
              <p className="font-semibold text-[#F5F0E6] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#5EEAD4]" aria-hidden="true" />
                <span>{t('auth.scopeTitle')}</span>
              </p>
              <p className="leading-relaxed">
                {capabilities.supabaseConfigured
                  ? t('auth.supabaseConnectedNote')
                  : t('auth.scopeBody')}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#F5F0E6]/15">
            <p className="text-sm font-semibold text-[#E99483] mb-3">
              {t('auth.quickLaunchTitle')}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2.5">
              {ROLE_CARDS.map((card) => (
                <button
                  key={card.role}
                  type="button"
                  data-testid={`preview-role-${card.role}`}
                  onClick={() => signInPreviewRole(card.role)}
                  className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#F5F0E6]/10 hover:bg-[#F5F0E6]/18 border border-[#F5F0E6]/18 px-4 py-3 text-left transition-colors cursor-pointer min-h-[44px]"
                >
                  <span className="font-medium text-sm text-[#F5F0E6]">
                    {t('auth.roleDashboardSuffix', {role: t(`roles.${card.role}`)})}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#E99483] shrink-0" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Warm Cream (#F5F0E6) Editorial Authentication Card */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <SurfaceCard tone="cream" className="p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b aarvi-divider pb-5 mb-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#172C40]">
                  {mode === 'login'
                    ? t('auth.signInTitle')
                    : mode === 'register'
                      ? t('auth.registerTitle')
                      : mode === 'recover'
                        ? t('auth.recoverTitle')
                        : t('auth.inviteTitle')}
                </h2>
                <p className="text-sm text-[#172C40]/72 mt-1">{t('auth.authSubtitle')}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1 p-1 bg-[#EBE3D3] rounded-xl border border-[#172C40]/12 shrink-0 self-start">
                {(
                  [
                    {id: 'login', label: t('auth.signInTab')},
                    {id: 'register', label: t('auth.registerTab')},
                    {id: 'invite', label: t('auth.inviteTab')},
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setMode(tab.id);
                      setErrorMsg('');
                      setInfoMsg('');
                    }}
                    className={`px-3 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      mode === tab.id
                        ? 'bg-[#172C40] text-[#F5F0E6]'
                        : 'text-[#172C40]/75 hover:text-[#172C40]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5" noValidate>
              {mode === 'register' && (
                <>
                  <fieldset>
                    <legend className="text-sm font-semibold text-[#172C40] mb-2.5">
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
                                ? 'bg-[#FAF6EE] border-[#269B91] ring-2 ring-[#269B91]/30'
                                : 'bg-[#FAF6EE]/60 border-[#172C40]/14 hover:border-[#172C40]/30'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              {card.icon}
                              <span className="text-xs font-semibold text-[#176D65]">
                                {active ? t('auth.selected') : t('auth.select')}
                              </span>
                            </div>
                            <p className="font-display font-bold text-sm text-[#172C40]">
                              {t(`roles.${card.role}`)}
                            </p>
                            <p className="text-xs text-[#172C40]/70 mt-1 leading-relaxed">
                              {t(card.descKey)}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="aarvi-fullname"
                        className="block text-sm font-semibold text-[#172C40] mb-1.5"
                      >
                        {t('auth.fullName')}
                      </label>
                      <input
                        id="aarvi-fullname"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={t('auth.fullNamePlaceholder')}
                        className="aarvi-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="aarvi-relationship"
                        className="block text-sm font-semibold text-[#172C40] mb-1.5"
                      >
                        {t('auth.relationshipTitle')}
                      </label>
                      <input
                        id="aarvi-relationship"
                        type="text"
                        value={relationship}
                        onChange={(e) => setRelationship(e.target.value)}
                        placeholder={t(`roles.${selectedRole}`)}
                        className="aarvi-input"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label
                  htmlFor="aarvi-email"
                  className="block text-sm font-semibold text-[#172C40] mb-1.5"
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
                  className="aarvi-input"
                />
              </div>

              {mode === 'invite' && (
                <div>
                  <label
                    htmlFor="aarvi-passcode"
                    className="block text-sm font-semibold text-[#172C40] mb-1.5"
                  >
                    {t('auth.passcodeLabel')}
                  </label>
                  <div className="relative">
                    <input
                      id="aarvi-passcode"
                      type="text"
                      value={invitePasscode}
                      onChange={(e) => setInvitePasscode(e.target.value)}
                      placeholder="ARV-XXX-XXX"
                      className="aarvi-input font-mono uppercase"
                    />
                    <KeyRound
                      className="w-4 h-4 text-[#176D65] absolute right-3.5 top-1/2 -translate-y-1/2"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {(mode === 'login' || mode === 'register') && (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor="aarvi-password"
                      className="block text-sm font-semibold text-[#172C40]"
                    >
                      {t('auth.passwordLabel')}
                    </label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('recover');
                          setErrorMsg('');
                          setInfoMsg('');
                        }}
                        className="text-xs font-semibold text-[#176D65] hover:underline cursor-pointer"
                      >
                        {t('auth.forgotPassword')}
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      id="aarvi-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('auth.passwordPlaceholder')}
                      className="aarvi-input pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-[#172C40]/70 hover:text-[#172C40] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-5 h-5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              )}

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#A84433]/40 bg-[#E99483]/22 px-4 py-3 text-sm font-medium text-[#7C2B1D]"
                >
                  {errorMsg}
                </div>
              )}

              {infoMsg && (
                <div
                  role="status"
                  className="rounded-xl border border-[#269B91]/45 bg-[#269B91]/15 px-4 py-3 text-sm font-medium text-[#176D65]"
                >
                  {infoMsg}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-xs text-[#172C40]/70">{t('auth.supabaseAuthNotice')}</p>
                <div className="flex items-center gap-2 shrink-0">
                  {mode === 'recover' && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setMode('login')}
                    >
                      {t('onboarding.back')}
                    </Button>
                  )}
                  <Button type="submit" variant="teal" size="lg" disabled={submitting}>
                    <span>
                      {mode === 'login'
                        ? t('auth.signInTab')
                        : mode === 'register'
                          ? t('auth.createAndOnboard')
                          : mode === 'recover'
                            ? t('auth.sendRecovery')
                            : t('auth.verifyPasscode')}
                    </span>
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </form>
          </SurfaceCard>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-6 py-5 text-xs text-[#F5F0E6]/70 flex flex-wrap items-center justify-between gap-4 border-t border-[#F5F0E6]/12">
        <span>{t('auth.footerLeft')}</span>
        <span>{t('auth.footerRight')}</span>
      </footer>
    </div>
  );
}
