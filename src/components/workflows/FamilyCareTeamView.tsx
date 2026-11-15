import React, {useEffect, useState} from 'react';
import {KeyRound, Shield, Trash2, UserPlus, Users} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, EmptyState, SectionHeader, StatusIndicator, SurfaceCard} from '../ui/AarviPrimitives';

interface ServerInvitation {
  id: string;
  recipientName: string;
  recipientEmail: string;
  role: 'family_member' | 'caregiver';
  relationshipOrTitle: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
}

export function FamilyCareTeamView() {
  const {
    session,
    patientProfile,
    addCareCircleMember,
    removeCareCircleMember,
    updateMemberPermissions,
    effectiveOnline,
  } = useAarvi();
  const {t} = useTranslation();

  const [invitations, setInvitations] = useState<ServerInvitation[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'family_member' | 'caregiver'>('caregiver');
  const [relationship, setRelationship] = useState('');
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInvitations = async () => {
    if (!effectiveOnline) return;
    try {
      const res = await fetch('/api/invitations');
      if (res.ok) {
        const data = (await res.json()) as {invitations: ServerInvitation[]};
        setInvitations(data.invitations ?? []);
      }
    } catch {
      // Ignore network issues
    }
  };

  useEffect(() => {
    void loadInvitations();
  }, [effectiveOnline]);

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIssuedCode(null);
    if (!recipientName.trim() || !recipientEmail.trim()) {
      setErrorMsg(t('familyTeam.errMissingFields'));
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/invitations/create', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          recipientName: recipientName.trim(),
          recipientEmail: recipientEmail.trim(),
          role: inviteRole,
          relationshipOrTitle: relationship.trim() || t(`roles.${inviteRole}`),
          createdBy: session?.fullName ?? 'Primary Coordinator',
          expiresInHours: 48,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        oneTimePasscode?: string;
        invitation?: ServerInvitation;
        error?: string;
      };
      if (!data.ok || !data.oneTimePasscode) {
        setErrorMsg(data.error || t('familyTeam.errCreateFailed'));
        return;
      }
      setIssuedCode(data.oneTimePasscode);
      addCareCircleMember({
        name: recipientName.trim(),
        roleLabel: t(`roles.${inviteRole}`),
        relation: relationship.trim() || t(`roles.${inviteRole}`),
        phone: '+91 —',
        email: recipientEmail.trim(),
        availability: t('familyTeam.invitedAvailability'),
        isPrimary: false,
        permissions: {
          canEditMedications: inviteRole === 'caregiver',
          canEditAppointments: inviteRole === 'family_member',
          canWriteHandovers: true,
          canManageTeam: false,
        },
      });
      setRecipientName('');
      setRecipientEmail('');
      setRelationship('');
      await loadInvitations();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`/api/invitations/${id}`, {method: 'DELETE'});
      await loadInvitations();
    } catch {
      // Ignore error
    }
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('familyTeam.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {t('familyTeam.pageTitle')}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 max-w-2xl">{t('familyTeam.pageSub')}</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-[#F5F0E6] tabular-nums">
            <Users className="w-5 h-5 text-[#5EEAD4]" aria-hidden="true" />
            <span>
              {t('familyTeam.memberCount', {count: patientProfile.careCircle.length})}
            </span>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <SurfaceCard tone="cream" className="lg:col-span-5">
          <SectionHeader
            title={t('familyTeam.inviteTitle')}
            subtitle={t('familyTeam.inviteSub')}
            action={<UserPlus className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
          />

          <form onSubmit={(e) => void handleCreateInvitation(e)} className="space-y-4">
            <div>
              <label htmlFor="inv-name" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('familyTeam.recipientName')}
              </label>
              <input
                id="inv-name"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder={t('auth.fullNamePlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div>
              <label htmlFor="inv-email" className="block text-sm font-semibold text-[#172C40] mb-1">
                {t('auth.emailLabel')}
              </label>
              <input
                id="inv-email"
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                className="aarvi-input"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="inv-role" className="block text-sm font-semibold text-[#172C40] mb-1">
                  {t('familyTeam.roleLabel')}
                </label>
                <select
                  id="inv-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'family_member' | 'caregiver')}
                  className="aarvi-input"
                >
                  <option value="caregiver">{t('roles.caregiver')}</option>
                  <option value="family_member">{t('roles.family_member')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="inv-rel" className="block text-sm font-semibold text-[#172C40] mb-1">
                  {t('auth.relationshipTitle')}
                </label>
                <input
                  id="inv-rel"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder={t('familyTeam.relationPlaceholder')}
                  className="aarvi-input"
                />
              </div>
            </div>

            {errorMsg && (
              <p className="text-sm font-medium text-[#A84433]" role="alert">
                {errorMsg}
              </p>
            )}

            {issuedCode && (
              <div className="rounded-xl border border-[#269B91]/45 bg-[#269B91]/12 p-4 space-y-1">
                <p className="text-xs font-semibold text-[#176D65] flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4" aria-hidden="true" />
                  <span>{t('familyTeam.passcodeGenerated')}</span>
                </p>
                <p className="font-mono text-lg font-bold text-[#172C40]">{issuedCode}</p>
                <p className="text-xs text-[#172C40]/72">{t('familyTeam.passcodeHint')}</p>
              </div>
            )}

            <Button type="submit" variant="teal" className="w-full" disabled={submitting || !effectiveOnline}>
              {t('familyTeam.createInviteBtn')}
            </Button>
          </form>

          {invitations.length > 0 && (
            <div className="mt-6 pt-5 border-t aarvi-divider space-y-3">
              <p className="text-xs font-semibold text-[#172C40]">{t('familyTeam.recentInvites')}</p>
              <div className="space-y-2.5">
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-[#FAF6EE] border border-[#172C40]/12 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[#172C40] truncate">{inv.recipientName}</p>
                      <p className="text-[#172C40]/70 truncate">
                        {inv.recipientEmail} · {inv.status}
                      </p>
                    </div>
                    {inv.status === 'pending' && (
                      <Button size="sm" variant="ghost" onClick={() => void handleRevoke(inv.id)}>
                        {t('familyTeam.revoke')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard tone="cream" className="lg:col-span-7">
          <SectionHeader
            title={t('familyTeam.activeMembersTitle')}
            subtitle={t('familyTeam.activeMembersSub')}
            action={<Shield className="w-5 h-5 text-[#172C40]" aria-hidden="true" />}
          />

          {patientProfile.careCircle.length === 0 ? (
            <EmptyState title={t('familyTeam.emptyTitle')} description={t('familyTeam.emptyDesc')} />
          ) : (
            <div className="divide-y aarvi-divider">
              {patientProfile.careCircle.map((member) => (
                <div key={member.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-display font-bold text-base text-[#172C40]">
                        {member.name}
                      </p>
                      <p className="text-xs text-[#176D65] font-medium">
                        {member.roleLabel} · {member.relation}
                      </p>
                      <p className="text-xs text-[#172C40]/70 mt-0.5">
                        {member.availability} · {member.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {member.isPrimary && (
                        <StatusIndicator
                          tone="teal"
                          icon="check"
                          label={t('familyTeam.primaryBadge')}
                        />
                      )}
                      {!member.isPrimary && member.permissions && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCareCircleMember(member.id)}
                          aria-label={`${t('familyTeam.revoke')} ${member.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-[#A84433]" aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {member.permissions && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {(
                        [
                          {key: 'canEditMedications', label: t('familyTeam.permMeds')},
                          {key: 'canEditAppointments', label: t('familyTeam.permVisits')},
                          {key: 'canWriteHandovers', label: t('familyTeam.permHandovers')},
                        ] as const
                      ).map((perm) => {
                        const granted = member.permissions![perm.key];
                        return (
                          <button
                            key={perm.key}
                            type="button"
                            onClick={() =>
                              updateMemberPermissions(member.id, {
                                ...member.permissions!,
                                [perm.key]: !granted,
                              })
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors ${
                              granted
                                ? 'bg-[#269B91]/16 border-[#269B91]/45 text-[#176D65]'
                                : 'bg-[#EBE3D3] border-[#172C40]/14 text-[#172C40]/65'
                            }`}
                          >
                            {perm.label}: {granted ? t('modules.allowed') : t('modules.restricted')}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
