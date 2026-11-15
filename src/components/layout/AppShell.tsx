import React, {useState} from 'react';
import {
  Bell,
  Bot,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  CloudOff,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Layers,
  ListTodo,
  Lock,
  LogOut,
  Menu,
  Package,
  Pill,
  RefreshCw,
  Settings,
  ShieldAlert,
  User,
  Users,
  X,
} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import type {AppRoute, UserRole} from '../../types/aarvi';
import {AarviLogo, Button} from '../ui/AarviPrimitives';
import {LanguageSelector} from '../ui/LanguageSelector';
import {PWAInstallButton} from '../ui/PWAInstallButton';

interface NavConfig {
  route: AppRoute;
  labelKey: string;
  icon: React.ComponentType<{className?: string}>;
  roles: UserRole[];
}

const NAV_ITEMS: NavConfig[] = [
  {
    route: 'dashboard',
    labelKey: 'nav.dashboard',
    icon: LayoutDashboard,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'patient_profile',
    labelKey: 'nav.patient_profile',
    icon: User,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'family_care_team',
    labelKey: 'nav.family_care_team',
    icon: Users,
    roles: ['family_member', 'caregiver'],
  },
  {
    route: 'medications',
    labelKey: 'nav.medications',
    icon: Pill,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'escalation',
    labelKey: 'nav.escalation',
    icon: ShieldAlert,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'tasks',
    labelKey: 'nav.tasks',
    icon: ListTodo,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'visits',
    labelKey: 'nav.visits',
    icon: KeyRound,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'privacy_consent',
    labelKey: 'nav.privacy_consent',
    icon: Lock,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'appointments',
    labelKey: 'nav.appointments',
    icon: Calendar,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'handovers',
    labelKey: 'nav.handovers',
    icon: ClipboardList,
    roles: ['family_member', 'caregiver'],
  },
  {
    route: 'daily_companion',
    labelKey: 'nav.daily_companion',
    icon: HeartPulse,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'refill_tracker',
    labelKey: 'nav.refill_tracker',
    icon: Package,
    roles: ['family_member', 'caregiver'],
  },
  {
    route: 'ai_assistant',
    labelKey: 'nav.ai_assistant',
    icon: Bot,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'notifications',
    labelKey: 'nav.notifications',
    icon: Bell,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'offline_sync',
    labelKey: 'nav.offline_sync',
    icon: RefreshCw,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
  {
    route: 'modules',
    labelKey: 'nav.modules',
    icon: Layers,
    roles: ['family_member', 'caregiver'],
  },
  {
    route: 'settings',
    labelKey: 'nav.settings',
    icon: Settings,
    roles: ['elderly_patient', 'family_member', 'caregiver'],
  },
];

export function AppShell({children}: {children: React.ReactNode}) {
  const {
    session,
    activeRoute,
    setActiveRoute,
    effectiveOnline,
    pendingQueueCount,
    unreadNotificationsCount,
    switchRolePreview,
    signOut,
  } = useAarvi();
  const {t} = useTranslation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  if (!session) return null;

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(session.role));
  const activeNav = NAV_ITEMS.find((n) => n.route === activeRoute);

  const handleNavigate = (route: AppRoute) => {
    setActiveRoute(route);
    setMobileMenuOpen(false);
  };

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full justify-between p-4">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2 px-1">
          <AarviLogo size="md" showWordmark={!collapsed} tone="dark" />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label={t('nav.closeMenu')}
            className="lg:hidden p-2 rounded-lg text-[#F5F0E6] hover:bg-white/10 cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
            className="hidden lg:inline-flex p-2 rounded-lg text-[#F5F0E6]/80 hover:bg-white/10 hover:text-[#F5F0E6] cursor-pointer"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Navigation Links */}
        <nav aria-label="Primary Aarvi navigation" className="space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.route;
            const badgeCount =
              item.route === 'offline_sync'
                ? pendingQueueCount
                : item.route === 'notifications'
                  ? unreadNotificationsCount
                  : 0;

            return (
              <button
                key={item.route}
                type="button"
                title={collapsed ? t(item.labelKey) : undefined}
                onClick={() => handleNavigate(item.route)}
                aria-current={active ? 'page' : undefined}
                data-testid={`nav-${item.route}`}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors min-h-[42px] cursor-pointer ${
                  active
                    ? 'bg-[#F5F0E6] text-[#172C40] font-semibold shadow-sm'
                    : 'text-[#F5F0E6]/85 hover:bg-[#F5F0E6]/10 hover:text-[#F5F0E6]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-[#269B91]' : 'text-[#F5F0E6]/75'}`}
                    aria-hidden="true"
                  />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </span>
                {!collapsed && badgeCount > 0 && (
                  <span
                    className={`font-mono text-xs font-bold tabular-nums ${
                      active ? 'text-[#A84433]' : 'text-[#E99483]'
                    }`}
                  >
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Authorized Role Switcher (Preview Mode only or multi-role convenience) */}
        {!collapsed && session.sessionOrigin === 'preview_workspace' && (
          <div className="pt-4 border-t border-[#F5F0E6]/15">
            <p className="text-xs font-semibold text-[#F5F0E6]/65 mb-2 px-1">
              {t('nav.switchRole')}
            </p>
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
                        ? 'bg-[#269B91]/25 text-[#5EEAD4] border border-[#269B91]/50'
                        : 'text-[#F5F0E6]/70 hover:bg-[#F5F0E6]/10 hover:text-[#F5F0E6] border border-transparent'
                    }`}
                  >
                    {t(`roles.${role}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Session Footer */}
      <div className="pt-4 border-t border-[#F5F0E6]/15 space-y-3">
        {!collapsed && (
          <div className="px-1 text-xs text-[#F5F0E6]/72">
            <p className="font-semibold text-[#F5F0E6] truncate">{session.fullName}</p>
            <p className="truncate">{t(`roles.${session.role}`)}</p>
          </div>
        )}

        <Button
          variant="navyOutline"
          size="sm"
          className="w-full"
          onClick={() => void signOut()}
          title={collapsed ? t('nav.signOut') : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          {!collapsed && <span>{t('nav.signOut')}</span>}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#EAE2D3] text-[#172C40] flex">
      {/* Desktop Left Sidebar — Deep Navy Fluted Shell */}
      <aside
        className={`hidden lg:block shrink-0 aarvi-navy-canvas border-r border-[#172C40]/20 transition-all duration-200 ${
          sidebarCollapsed ? 'w-[84px]' : 'w-[272px]'
        }`}
      >
        <div className="sticky top-0 h-screen overflow-y-auto">
          {renderSidebarContent(sidebarCollapsed)}
        </div>
      </aside>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-[#0F2031]/75 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] aarvi-navy-canvas h-full overflow-y-auto z-10 shadow-2xl">
            {renderSidebarContent(false)}
          </aside>
        </div>
      )}

      {/* Main Content Area on Warm Cream Canvas */}
      <div className="flex-1 min-w-0 flex flex-col bg-[#EDE5D6]">
        {/* Top Bar — Deep Navy architectural bar with logo, page title, role, language selector, status, notifications, profile */}
        <header className="sticky top-0 z-30 bg-[#172C40] text-[#F5F0E6] border-b border-[#F5F0E6]/12 px-4 sm:px-8 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t('nav.openMenu')}
              className="lg:hidden p-2 rounded-xl border border-[#F5F0E6]/20 bg-[#F5F0E6]/10 text-[#F5F0E6] min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
            <div className="lg:hidden shrink-0">
              <AarviLogo size="sm" tone="dark" />
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-base text-[#F5F0E6] truncate">
                {activeNav ? t(activeNav.labelKey) : t('nav.dashboard')}
              </p>
              <p className="hidden sm:block text-xs text-[#F5F0E6]/72 truncate">
                {t(`roles.${session.role}`)} ·{' '}
                {session.sessionOrigin === 'supabase_auth'
                  ? t('nav.authenticatedAccount')
                  : t('nav.previewWorkspace')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <PWAInstallButton variant="header" />
            <LanguageSelector tone="dark" />

            <button
              type="button"
              onClick={() => setActiveRoute('offline_sync')}
              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                effectiveOnline
                  ? 'bg-[#269B91]/20 border-[#269B91]/55 text-[#5EEAD4] hover:bg-[#269B91]/30'
                  : 'bg-[#E99483]/22 border-[#E99483]/60 text-[#F5F0E6] hover:bg-[#E99483]/32'
              }`}
            >
              {effectiveOnline ? (
                <RefreshCw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <CloudOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {effectiveOnline ? t('common.online') : t('nav.offlineMode')}
                {pendingQueueCount > 0 ? ` (${pendingQueueCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveRoute('notifications')}
              aria-label={t('nav.notifications')}
              className="relative min-h-[44px] min-w-[44px] px-2.5 rounded-xl bg-[#F5F0E6]/10 hover:bg-[#F5F0E6]/18 border border-[#F5F0E6]/18 text-[#F5F0E6] inline-flex items-center justify-center cursor-pointer shrink-0"
            >
              <Bell className="w-4 h-4" aria-hidden="true" />
              {unreadNotificationsCount > 0 && (
                <span className="ml-1 font-mono text-xs font-bold text-[#E99483] tabular-nums">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((p) => !p)}
                aria-expanded={profileMenuOpen}
                aria-label={t('nav.userMenu')}
                className="min-h-[44px] px-3 rounded-xl bg-[#F5F0E6]/10 hover:bg-[#F5F0E6]/18 border border-[#F5F0E6]/18 text-[#F5F0E6] inline-flex items-center gap-2 text-xs font-semibold cursor-pointer shrink-0"
              >
                <User className="w-4 h-4 text-[#E99483]" aria-hidden="true" />
                <span className="hidden xl:inline max-w-[120px] truncate">{session.fullName}</span>
              </button>

              {profileMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-[#F5F0E6] text-[#172C40] border border-[#172C40]/20 shadow-2xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-[#172C40]/12">
                    <p className="font-display font-bold text-sm truncate">{session.fullName}</p>
                    <p className="text-xs text-[#172C40]/70 truncate">{session.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoute('settings');
                      setProfileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium hover:bg-[#EBE3D3] mt-1 cursor-pointer flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-[#269B91]" aria-hidden="true" />
                    <span>{t('nav.settings')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      void signOut();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-[#A84433] hover:bg-[#E99483]/20 cursor-pointer flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" />
                    <span>{t('nav.signOut')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
