import React, {useState} from 'react';
import {
  Calendar,
  ClipboardList,
  CloudOff,
  Eye,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Pill,
  RefreshCw,
  User,
  X,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {AppRoute, UserRole} from '../../types/aarvi';
import {AarviLogo, Button} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';

const NAV_ITEMS: Array<{
  route: AppRoute;
  labelKey: string;
  icon: React.ComponentType<{className?: string}>;
}> = [
  {route: 'dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard},
  {route: 'patient_profile', labelKey: 'nav.patient_profile', icon: User},
  {route: 'medications', labelKey: 'nav.medications', icon: Pill},
  {route: 'appointments', labelKey: 'nav.appointments', icon: Calendar},
  {route: 'handovers', labelKey: 'nav.handovers', icon: ClipboardList},
  {route: 'offline_sync', labelKey: 'nav.offline_sync', icon: RefreshCw},
  {route: 'modules', labelKey: 'nav.modules', icon: Layers},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const {
    session,
    activeRoute,
    setActiveRoute,
    effectiveOnline,
    pendingQueueCount,
    switchRolePreview,
    signOutLocal,
    preferences,
    updatePreferences,
  } = useAarvi();
  const {t} = useTranslation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!session) return null;

  const activeNav = NAV_ITEMS.find((n) => n.route === activeRoute);

  const handleNavigate = (route: AppRoute) => {
    setActiveRoute(route);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full justify-between p-5">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <AarviLogo size="md" showWordmark />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="lg:hidden p-2 rounded-lg text-[#F7F8FC] hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary Aarvi navigation" className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.route;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => handleNavigate(item.route)}
                aria-current={active ? 'page' : undefined}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all min-h-[44px] cursor-pointer ${
                  active
                    ? 'bg-gradient-to-r from-[#4778B8] to-[#3B67A4] text-white border border-[#8BB8F2]/40 shadow-lg shadow-[#040B18]/40'
                    : 'text-[#DCE5F4] hover:bg-white/10 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{t(item.labelKey)}</span>
                </span>
                {item.route === 'offline_sync' && pendingQueueCount > 0 && (
                  <span
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      active ? 'text-white' : 'text-[#F16B70]'
                    }`}
                  >
                    {pendingQueueCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Role Switcher */}
        <div className="pt-5 border-t border-white/10">
          <p className="text-xs font-semibold text-[#AAB8CE] mb-2">{t('nav.switchRole')}</p>
          <div className="space-y-1">
            {(['elderly_patient', 'family_member', 'caregiver'] as UserRole[]).map((role) => {
              const current = session.role === role;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => {
                    switchRolePreview(role);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer min-h-[38px] ${
                    current
                      ? 'bg-[#4778B8]/25 text-[#8BB8F2] border border-[#8BB8F2]/40'
                      : 'text-[#AAB8CE] hover:bg-white/10 hover:text-[#F7F8FC] border border-transparent'
                  }`}
                >
                  {t(`roles.${role}`)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Accessibility & Session Footer */}
      <div className="pt-5 border-t border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#AAB8CE] flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#8BB8F2]" aria-hidden="true" />
            <span>{t('nav.highContrast')}</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={preferences.highContrast}
            onClick={() => updatePreferences({highContrast: !preferences.highContrast})}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              preferences.highContrast
                ? 'bg-[#4778B8] text-white border border-[#8BB8F2]/50'
                : 'bg-white/10 text-[#DCE5F4] border border-white/10'
            }`}
          >
            {preferences.highContrast ? t('nav.on') : t('nav.off')}
          </button>
        </div>

        <div className="text-xs text-[#AAB8CE]">
          <p className="font-semibold text-[#F7F8FC] truncate">{session.fullName}</p>
          <p className="truncate">{t(`roles.${session.role}`)}</p>
        </div>

        <Button variant="secondary" size="sm" className="w-full" onClick={signOutLocal}>
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>{t('nav.signOut')}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#07152B] text-[#F7F8FC] flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-[268px] shrink-0 bg-[#102341]/75 backdrop-blur-xl border-r border-white/12">
        <div className="sticky top-0 h-screen overflow-y-auto">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#030A17]/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#102341] border-r border-white/15 h-full overflow-y-auto z-10 shadow-2xl">
            {renderSidebarContent()}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Dashboard Header with prominent Language Selector */}
        <header className="sticky top-0 z-30 bg-[#07152B]/80 backdrop-blur-xl border-b border-white/12 px-4 sm:px-8 py-3 flex items-center justify-between gap-3 sm:gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t('nav.openMenu')}
              className="lg:hidden p-2 rounded-xl border border-white/15 bg-white/10 text-[#F7F8FC] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="font-display font-bold text-base text-[#F7F8FC] truncate">
                {activeNav ? t(activeNav.labelKey) : t('nav.dashboard')}
              </p>
              <p className="hidden xl:block text-xs text-[#AAB8CE] truncate">
                {t('nav.workspaceStatus', {role: t(`roles.${session.role}`)})}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <LanguageSelector />

            <button
              type="button"
              onClick={() => setActiveRoute('offline_sync')}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                effectiveOnline
                  ? 'bg-[#2DD4BF]/12 border-[#2DD4BF]/35 text-[#5EEAD4] hover:bg-[#2DD4BF]/20'
                  : 'bg-[#F16B70]/15 border-[#F16B70]/50 text-[#FFB4B7] hover:bg-[#F16B70]/25'
              }`}
            >
              {effectiveOnline ? (
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">
                {effectiveOnline ? t('nav.onlineLocal') : t('nav.offlineMode')}
                {pendingQueueCount > 0 ? ` (${pendingQueueCount})` : ''}
              </span>
              {pendingQueueCount > 0 && (
                <span className="sm:hidden tabular-nums">{pendingQueueCount}</span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
