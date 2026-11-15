import React, {useState} from 'react';
import {AlertCircle, CheckCircle2, Clock, CloudOff, RefreshCw} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import type {UserRole} from '../../types/aarvi';

export function AarviLogo({
  size = 'md',
  showWordmark = false,
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}) {
  const [srcIndex, setSrcIndex] = useState(0);
  const {t} = useTranslation();
  const sources = ['/brand/aarvi-logo.png', '/assets/aistudio/aarvi-logo_9f7d1ced.png'];

  const dimensions =
    size === 'sm' ? 'h-10 w-10' : size === 'lg' ? 'h-28 w-28' : 'h-14 w-14';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {srcIndex < sources.length ? (
        <div className="rounded-2xl bg-[#F5F0E6] p-1 border border-white/25 shadow-md shrink-0">
          <img
            src={sources[srcIndex]}
            alt="Aarvi — Care that connects."
            referrerPolicy="no-referrer"
            onError={() => setSrcIndex((prev) => prev + 1)}
            className={`${dimensions} rounded-xl object-contain block`}
          />
        </div>
      ) : (
        <div
          className={`flex items-center justify-center rounded-2xl bg-[#102341] border border-white/20 text-[#F7F8FC] font-bold ${dimensions} shrink-0`}
          aria-label="Aarvi"
        >
          <span className="font-display tracking-tight">A</span>
        </div>
      )}

      {showWordmark && (
        <div className="min-w-0">
          <p className="font-display text-lg font-bold tracking-tight text-[#F7F8FC] leading-tight">
            {t('brand.name')}
          </p>
          <p className="text-xs text-[#8BB8F2] font-medium">Care that connects.</p>
        </div>
      )}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'teal' | 'secondary' | 'coral' | 'ghost';
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
    lg: 'min-h-[52px] px-6 py-3 text-base font-semibold',
  };

  const variants = {
    primary:
      'bg-[#4778B8] text-white hover:bg-[#5789CA] border border-[#8BB8F2]/30 shadow-lg shadow-[#040B18]/40',
    teal:
      'bg-gradient-to-r from-[#4778B8] to-[#269B91] text-white hover:brightness-110 border border-white/20 shadow-lg shadow-[#040B18]/40',
    secondary:
      'bg-white/10 text-[#F7F8FC] border border-white/15 hover:bg-white/15 hover:border-white/25',
    coral:
      'bg-[#F16B70]/15 text-[#FFB4B7] border border-[#F16B70]/50 hover:bg-[#F16B70]/25',
    ghost: 'bg-transparent text-[#DCE5F4] hover:bg-white/10',
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
  tone = 'glass',
}: {
  children: React.ReactNode;
  className?: string;
  tone?: 'glass' | 'hero' | 'dark' | 'white' | 'cream';
}) {
  const toneClass =
    tone === 'hero' || tone === 'cream'
      ? 'aarvi-glass-elevated aarvi-hero-glow'
      : tone === 'dark'
        ? 'bg-[#102341]/90 border border-white/15 shadow-xl'
        : 'aarvi-glass';

  return (
    <section
      className={`aarvi-surface rounded-2xl p-6 transition-colors duration-150 ${toneClass} ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h2 className="font-display text-xl font-bold text-[#F7F8FC] tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-sm text-[#AAB8CE] mt-1">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatusIndicator({
  tone,
  label,
  icon,
}: {
  tone: 'teal' | 'coral' | 'amber' | 'navy';
  label: string;
  icon?: 'check' | 'clock' | 'alert' | 'offline' | 'sync';
}) {
  const textColors = {
    teal: 'text-[#5EEAD4]',
    coral: 'text-[#FF9DA1]',
    amber: 'text-[#FCD34D]',
    navy: 'text-[#8BB8F2]',
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

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${textColors[tone]}`}>
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
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-8 text-center">
      <h3 className="font-display text-base font-semibold text-[#F7F8FC]">{title}</h3>
      <p className="text-sm text-[#AAB8CE] mt-1.5 max-w-md mx-auto">{description}</p>
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
