import React, {useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, CloudOff, RefreshCw} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {UserRole} from '../../types/aarvi';

export function AarviLogo({
  size = 'md',
  showWordmark = false,
  tone = 'dark',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  tone?: 'dark' | 'cream';
  className?: string;
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const {t} = useTranslation();
  const sources = ['/brand/aarvi-logo.png', '/assets/aistudio/aarvi-logo_9f7d1ced.png'];

  const dimensions =
    size === 'sm' ? 'h-9 w-9' : size === 'lg' ? 'h-24 w-24' : 'h-12 w-12';

  const titleColor = tone === 'cream' ? 'text-[#172C40]' : 'text-[#F5F0E6]';
  const tagColor = tone === 'cream' ? 'text-[#176D65]' : 'text-[#E99483]';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {srcIndex < sources.length ? (
        <div className="rounded-xl bg-[#F5F0E6] p-1 border border-[#172C40]/15 shadow-sm shrink-0">
          <img
            src={sources[srcIndex]}
            alt="Aarvi — Care that connects."
            referrerPolicy="no-referrer"
            onError={() => setSrcIndex((prev) => prev + 1)}
            className={`${dimensions} rounded-lg object-contain block`}
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-xl bg-[#172C40] border border-[#F5F0E6]/25 text-[#F5F0E6] font-bold ${dimensions} shrink-0`}
          aria-label="Aarvi"
        >
          <span className="font-display tracking-tight">A</span>
        </div>
      )}

      {showWordmark && (
        <div className="min-w-0">
          <p className={`font-display text-lg font-bold tracking-tight leading-tight ${titleColor}`}>
            {t('brand.name')}
          </p>
          <p className={`text-xs font-medium ${tagColor}`}>{t('brand.tagline')}</p>
        </div>
      )}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'teal' | 'secondary' | 'coral' | 'ghost' | 'navyOutline';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const sizes = {
    sm: 'min-h-[40px] px-3.5 py-2 text-sm',
    md: 'min-h-[44px] px-5 py-2.5 text-sm',
    lg: 'min-h-[50px] px-6 py-3 text-base font-semibold',
  };

  const variants = {
    primary: 'bg-[#172C40] text-[#F5F0E6] hover:bg-[#203A52] border border-[#172C40]',
    teal: 'bg-[#269B91] text-[#FAF6EE] hover:bg-[#1E8279] border border-[#1E8279]',
    secondary:
      'bg-[#EBE3D3] text-[#172C40] border border-[#172C40]/18 hover:bg-[#E1D7C4]',
    coral: 'bg-[#E99483] text-[#172C40] font-semibold hover:bg-[#E0816F] border border-[#D4705E]',
    ghost: 'bg-transparent text-[#172C40] hover:bg-[#172C40]/8',
    navyOutline:
      'bg-[#F5F0E6]/10 text-[#F5F0E6] border border-[#F5F0E6]/25 hover:bg-[#F5F0E6]/18',
  };

  return (
    <button
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function SurfaceCard({
  children,
  className = '',
  tone = 'cream',
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  children: React.ReactNode;
  className?: string;
  tone?: 'cream' | 'inset' | 'hero' | 'muted' | 'dark' | 'glass' | 'white';
}) {
  const toneClass =
    tone === 'hero' || tone === 'dark'
      ? 'aarvi-hero-banner'
      : tone === 'inset'
        ? 'aarvi-cream-inset'
        : tone === 'muted'
          ? 'aarvi-cream-muted'
          : 'aarvi-cream-panel';

  return (
    <section
      className={`rounded-2xl p-6 sm:p-7 transition-colors duration-150 ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
  onDark = false,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  onDark?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h2
          className={`font-display text-xl font-bold tracking-tight ${
            onDark ? 'text-[#F5F0E6]' : 'text-[#172C40]'
          }`}
        >
          {title}
        </h2>
        {subtitle && (
          <p className={`text-sm mt-1 ${onDark ? 'text-[#F5F0E6]/78' : 'text-[#172C40]/72'}`}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusIndicator({
  tone,
  label,
  icon,
  onDark = false,
}: {
  tone: 'teal' | 'coral' | 'amber' | 'navy';
  label: string;
  icon?: 'check' | 'clock' | 'alert' | 'offline' | 'sync';
  onDark?: boolean;
}) {
  const lightColors = {
    teal: 'text-[#176D65]',
    coral: 'text-[#A84433]',
    amber: 'text-[#8F5312]',
    navy: 'text-[#172C40]',
  };

  const darkColors = {
    teal: 'text-[#5EEAD4]',
    coral: 'text-[#E99483]',
    amber: 'text-[#FCD34D]',
    navy: 'text-[#F5F0E6]',
  };

  const renderIcon = () => {
    switch (icon) {
      case 'check':
        return <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'clock':
        return <Clock className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'alert':
        return <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'offline':
        return <CloudOff className="w-4 h-4 shrink-0" aria-hidden="true" />;
      case 'sync':
        return <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />;
      default:
        return null;
    }
  };

  const colorClass = onDark ? darkColors[tone] : lightColors[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${colorClass}`}>
      {renderIcon()}
      <span>{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[#172C40]/22 bg-[#FAF6EE] p-8 text-center">
      <h3 className="font-display text-base font-semibold text-[#172C40]">{title}</h3>
      <p className="text-sm text-[#172C40]/72 mt-1.5 max-w-md mx-auto">{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function formatRoleLabel(role: UserRole): string {
  switch (role) {
    case 'elderly_patient':
      return 'Elderly Patient';
    case 'family_member':
      return 'Family Member';
    case 'caregiver':
      return 'Caregiver';
  }
}
