import {useState} from 'react';
import {AlertTriangle, CheckCircle2, History, Lock, ShieldCheck, ShieldOff} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {ALL_CONSENT_DOMAINS, resolveEffectiveGrantStatus} from '../../../shared/permissions';
import {useAarvi} from '../../context/AarviContext';
import type {ConsentDomain, ConsentDomainPermissions, ConsentGrant} from '../../types/aarvi';
import {Button, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

export function PrivacyConsentView() {
  const {
    session,
    consentGrants,
    consentHistory,
    updateMemberConsent,
    revokeMemberConsent,
  } = useAarvi();
  const {t} = useTranslation();

  const canManage = session?.role === 'elderly_patient' || session?.role === 'family_member';

  const [pendingConfirmation, setPendingConfirmation] = useState<{
    type: 'update' | 'revoke';
    grant: ConsentGrant;
    permissions: ConsentDomainPermissions;
    expiresAtIso?: string | null;
    reason: string;
  } | null>(null);

  const [draftExpiryByMember, setDraftExpiryByMember] = useState<Record<string, string>>({});
  const [draftReasonByMember, setDraftReasonByMember] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ok: boolean; text: string} | null>(null);

  const requestToggleDomain = (grant: ConsentGrant, domain: ConsentDomain) => {
    if (!canManage) return;
    const nextPerms: ConsentDomainPermissions = {
      ...grant.permissions,
      [domain]: !grant.permissions[domain],
    };
    const expDraft = draftExpiryByMember[grant.memberId];
    const expiresAtIso = expDraft ? new Date(expDraft).toISOString() : grant.expiresAtIso ?? null;
    const reason =
      draftReasonByMember[grant.memberId]?.trim() ||
      `${nextPerms[domain] ? 'Enabled' : 'Restricted'} ${domain} access`;

    setPendingConfirmation({
      type: 'update',
      grant,
      permissions: nextPerms,
      expiresAtIso,
      reason,
    });
  };

  const requestTempAccessApply = (grant: ConsentGrant) => {
    if (!canManage) return;
    const expDraft = draftExpiryByMember[grant.memberId];
    const expiresAtIso = expDraft ? new Date(expDraft).toISOString() : null;
    const reason =
      draftReasonByMember[grant.memberId]?.trim() ||
      (expiresAtIso ? 'Temporary time-bounded access updated' : 'Standard active access applied');

    setPendingConfirmation({
      type: 'update',
      grant,
      permissions: {...grant.permissions},
      expiresAtIso,
      reason,
    });
  };

  const requestRevoke = (grant: ConsentGrant) => {
    if (!canManage) return;
    const reason =
      draftReasonByMember[grant.memberId]?.trim() ||
      'Access revoked by patient/authorized representative';
    setPendingConfirmation({
      type: 'revoke',
      grant,
      permissions: {
        medications: false,
        appointments: false,
        medical_documents: false,
        care_notes: false,
        wellbeing: false,
        activity_history: false,
      },
      reason,
    });
  };

  const handleConfirmPending = async () => {
    if (!pendingConfirmation) return;
    const {type, grant, permissions, expiresAtIso, reason} = pendingConfirmation;
    setPendingConfirmation(null);

    const res =
      type === 'revoke'
        ? await revokeMemberConsent(grant.memberId, reason)
        : await updateMemberConsent({
            memberId: grant.memberId,
            permissions,
            expiresAtIso,
            reason,
          });

    if (!res.ok) {
      setFeedback({ok: false, text: res.error || t('consent.updateFailed')});
    } else {
      setFeedback({
        ok: true,
        text: type === 'revoke' ? t('consent.revokedSuccess') : t('consent.updatedSuccess'),
      });
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('consent.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('consent.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1.5 max-w-2xl">{t('consent.pageSub')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#5EEAD4]">
            <ShieldCheck className="w-5 h-5" aria-hidden="true" />
            <span>{canManage ? t('consent.ownerControlsActive') : t('consent.readOnlyRole')}</span>
          </div>
        </div>
      </SurfaceCard>

      {!canManage && (
        <SurfaceCard tone="muted" className="border-[#A84433]/35">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-display font-bold text-base text-[#172C40]">
                {t('consent.caregiverBlockedTitle')}
              </p>
              <p className="text-sm text-[#172C40]/80 mt-0.5">{t('consent.caregiverBlockedDesc')}</p>
            </div>
          </div>
        </SurfaceCard>
      )}

      {feedback && (
        <SurfaceCard
          tone={feedback.ok ? 'inset' : 'muted'}
          className={feedback.ok ? 'border-[#269B91]/40' : 'border-[#A84433]/40'}
        >
          <p className={`text-sm font-semibold ${feedback.ok ? 'text-[#176D65]' : 'text-[#A84433]'}`}>
            {feedback.text}
          </p>
        </SurfaceCard>
      )}

      {/* Confirmation prompt before sensitive permission changes */}
      {pendingConfirmation && (
        <SurfaceCard
          tone="muted"
          className="border-[#A84433]/50"
          data-testid="consent-confirm-dialog"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#A84433] shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <h2 className="font-display font-bold text-base text-[#172C40]">
                  {pendingConfirmation.type === 'revoke'
                    ? t('consent.confirmRevokeTitle', {name: pendingConfirmation.grant.memberName})
                    : t('consent.confirmChangeTitle', {name: pendingConfirmation.grant.memberName})}
                </h2>
                <p className="text-sm text-[#172C40]/80 mt-0.5">
                  {t('consent.confirmReasonPreview', {reason: pendingConfirmation.reason})}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPendingConfirmation(null)}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="sm"
                variant={pendingConfirmation.type === 'revoke' ? 'coral' : 'primary'}
                onClick={() => void handleConfirmPending()}
                data-testid="confirm-consent-change"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>{t('consent.confirmProceedBtn')}</span>
              </Button>
            </div>
          </div>
        </SurfaceCard>
      )}

      <div className="space-y-4">
        {consentGrants.map((grant) => {
          const effectiveStatus = resolveEffectiveGrantStatus(grant);
          return (
            <SurfaceCard key={grant.id} tone="cream" data-testid={`consent-card-${grant.memberId}`}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b aarvi-divider">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#172C40]/70">
                    <span className="font-semibold text-[#176D65]">
                      {t(`roles.${grant.memberRole}`)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{grant.relationship}</span>
                    {grant.expiresAtIso && effectiveStatus !== 'revoked' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {t('consent.expiresAt', {
                            time: new Date(grant.expiresAtIso).toLocaleString([], {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            }),
                          })}
                        </span>
                      </>
                    )}
                  </div>
                  <h2 className="font-display text-lg font-bold text-[#172C40] mt-0.5">
                    {grant.memberName}
                  </h2>
                  <p className="text-xs text-[#172C40]/72">{grant.memberEmail}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <StatusIndicator
                    tone={
                      effectiveStatus === 'active'
                        ? 'teal'
                        : effectiveStatus === 'temporary'
                          ? 'amber'
                          : 'coral'
                    }
                    icon={effectiveStatus === 'revoked' || effectiveStatus === 'expired' ? 'alert' : 'check'}
                    label={t(`consent.statuses.${effectiveStatus}`)}
                  />
                  {canManage && effectiveStatus !== 'revoked' && (
                    <Button
                      size="sm"
                      variant="coral"
                      onClick={() => requestRevoke(grant)}
                      data-testid={`revoke-consent-${grant.memberId}`}
                    >
                      <ShieldOff className="w-4 h-4" aria-hidden="true" />
                      <span>{t('consent.revokeAllBtn')}</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Granular 6-Domain Permissions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
                {ALL_CONSENT_DOMAINS.map((domain) => {
                  const granted = grant.permissions[domain] && effectiveStatus !== 'revoked' && effectiveStatus !== 'expired';
                  return (
                    <div
                      key={domain}
                      className="p-3 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12 flex items-center justify-between gap-2"
                    >
                      <span className="text-sm font-medium text-[#172C40]">
                        {t(`consent.domains.${domain}`)}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={granted}
                        disabled={!canManage}
                        onClick={() => requestToggleDomain(grant, domain)}
                        data-testid={`toggle-${grant.memberId}-${domain}`}
                        className={`min-h-[38px] px-3 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                          granted
                            ? 'bg-[#269B91] text-[#FAF6EE]'
                            : 'bg-[#EBE3D3] text-[#172C40]/80'
                        }`}
                      >
                        {granted ? t('modules.allowed') : t('modules.restricted')}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Temporary Access Expiry + Reason Controls */}
              {canManage && (
                <div className="mt-4 pt-4 border-t aarvi-divider grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label
                      htmlFor={`exp-${grant.memberId}`}
                      className="block text-xs font-semibold text-[#172C40] mb-1"
                    >
                      {t('consent.tempExpiryLabel')}
                    </label>
                    <input
                      id={`exp-${grant.memberId}`}
                      type="datetime-local"
                      value={draftExpiryByMember[grant.memberId] ?? ''}
                      onChange={(e) =>
                        setDraftExpiryByMember((prev) => ({
                          ...prev,
                          [grant.memberId]: e.target.value,
                        }))
                      }
                      className="aarvi-input text-xs font-mono tabular-nums"
                    />
                  </div>
                  <div className="md:col-span-5">
                    <label
                      htmlFor={`reason-${grant.memberId}`}
                      className="block text-xs font-semibold text-[#172C40] mb-1"
                    >
                      {t('consent.reasonLabel')}
                    </label>
                    <input
                      id={`reason-${grant.memberId}`}
                      type="text"
                      value={draftReasonByMember[grant.memberId] ?? ''}
                      onChange={(e) =>
                        setDraftReasonByMember((prev) => ({
                          ...prev,
                          [grant.memberId]: e.target.value,
                        }))
                      }
                      placeholder={t('consent.reasonPlaceholder')}
                      className="aarvi-input text-xs"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      onClick={() => requestTempAccessApply(grant)}
                    >
                      {t('consent.applyWindowBtn')}
                    </Button>
                  </div>
                </div>
              )}
            </SurfaceCard>
          );
        })}
      </div>

      {/* Immutable Consent History */}
      <SurfaceCard tone="cream">
        <SectionHeader
          title={t('consent.historyTitle')}
          subtitle={t('consent.historySub')}
          action={<History className="w-5 h-5 text-[#176D65]" aria-hidden="true" />}
        />
        <div className="divide-y aarvi-divider">
          {consentHistory.map((entry) => (
            <div key={entry.id} className="py-3 first:pt-0 last:pb-0 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[#172C40]">
                  {entry.actorName} · {t(`consent.actions.${entry.action}`)} · {entry.memberName}
                </p>
                <span className="font-mono text-xs text-[#176D65] tabular-nums">
                  {new Date(entry.timestampIso).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
              <p className="text-xs text-[#172C40]/75 mt-0.5">{entry.reason}</p>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}
