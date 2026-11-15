import React, {useState} from 'react';
import {Edit3, Phone, Save, ShieldAlert, Stethoscope, Users, X} from 'lucide-react';
import {useTranslation} from 'react-i18next';
import {useAarvi} from '../../context/AarviContext';
import {Button, SectionHeader, SurfaceCard} from '../ui/AarviPrimitives';

export function PatientProfileView() {
  const {patientProfile, updatePatientProfile, session} = useAarvi();
  const {t} = useTranslation();
  const [editing, setEditing] = useState(false);
  const [dietaryGuidance, setDietaryGuidance] = useState(patientProfile.dietaryGuidance);
  const [mobilityNotes, setMobilityNotes] = useState(patientProfile.mobilityNotes);
  const [comfortPreferences, setComfortPreferences] = useState(patientProfile.comfortPreferences);

  const canEdit = Boolean(session);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updatePatientProfile({
      dietaryGuidance: dietaryGuidance.trim(),
      mobilityNotes: mobilityNotes.trim(),
      comfortPreferences: comfortPreferences.trim(),
    });
    setEditing(false);
  };

  return (
    <div className="space-y-6">
      <SurfaceCard tone="hero">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#E99483]">{t('profile.moduleKicker')}</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#F5F0E6] mt-1">
              {patientProfile.fullName}
            </h1>
            <p className="text-sm text-[#F5F0E6]/82 mt-1 tabular-nums">
              {t('profile.metaLine', {
                preferred: patientProfile.preferredName,
                age: patientProfile.age,
                blood: patientProfile.bloodGroup,
                languages: patientProfile.primaryLanguage,
              })}
            </p>
          </div>
          {canEdit && (
            <Button
              variant={editing ? 'navyOutline' : 'coral'}
              onClick={() => {
                if (editing) {
                  setDietaryGuidance(patientProfile.dietaryGuidance);
                  setMobilityNotes(patientProfile.mobilityNotes);
                  setComfortPreferences(patientProfile.comfortPreferences);
                }
                setEditing(!editing);
              }}
            >
              {editing ? (
                <>
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.cancelEdit')}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.editCareNotes')}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('profile.clinicalSectionTitle')}
              subtitle={t('profile.clinicalSectionSub')}
            />

            {editing ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label
                    htmlFor="profile-diet"
                    className="block text-sm font-semibold text-[#172C40] mb-1.5"
                  >
                    {t('profile.dietaryLabel')}
                  </label>
                  <textarea
                    id="profile-diet"
                    rows={2}
                    value={dietaryGuidance}
                    onChange={(e) => setDietaryGuidance(e.target.value)}
                    className="aarvi-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-mobility"
                    className="block text-sm font-semibold text-[#172C40] mb-1.5"
                  >
                    {t('profile.mobilityLabel')}
                  </label>
                  <textarea
                    id="profile-mobility"
                    rows={2}
                    value={mobilityNotes}
                    onChange={(e) => setMobilityNotes(e.target.value)}
                    className="aarvi-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor="profile-comfort"
                    className="block text-sm font-semibold text-[#172C40] mb-1.5"
                  >
                    {t('profile.comfortLabel')}
                  </label>
                  <textarea
                    id="profile-comfort"
                    rows={2}
                    value={comfortPreferences}
                    onChange={(e) => setComfortPreferences(e.target.value)}
                    className="aarvi-input"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="teal">
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>{t('common.save')}</span>
                  </Button>
                </div>
              </form>
            ) : (
              <dl className="divide-y aarvi-divider text-sm">
                <div className="py-3.5 first:pt-0">
                  <dt className="font-semibold text-[#172C40] flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#A84433]" aria-hidden="true" />
                    <span>{t('profile.allergiesLabel')}</span>
                  </dt>
                  <dd className="text-[#A84433] font-medium mt-1">
                    {patientProfile.allergies.join(' · ')}
                  </dd>
                </div>
                <div className="py-3.5">
                  <dt className="font-semibold text-[#172C40] flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-[#176D65]" aria-hidden="true" />
                    <span>{t('profile.physicianLabel')}</span>
                  </dt>
                  <dd className="text-[#172C40]/78 mt-1">
                    {patientProfile.primaryPhysician} · {patientProfile.clinicName}
                  </dd>
                </div>
                <div className="py-3.5">
                  <dt className="font-semibold text-[#172C40]">{t('profile.dietaryLabel')}</dt>
                  <dd className="text-[#172C40]/78 mt-1">{patientProfile.dietaryGuidance}</dd>
                </div>
                <div className="py-3.5">
                  <dt className="font-semibold text-[#172C40]">{t('profile.mobilityLabel')}</dt>
                  <dd className="text-[#172C40]/78 mt-1">{patientProfile.mobilityNotes}</dd>
                </div>
                <div className="py-3.5 last:pb-0">
                  <dt className="font-semibold text-[#172C40]">{t('profile.comfortLabel')}</dt>
                  <dd className="text-[#172C40]/78 mt-1">{patientProfile.comfortPreferences}</dd>
                </div>
              </dl>
            )}
          </SurfaceCard>
        </div>

        <div className="lg:col-span-5">
          <SurfaceCard tone="cream">
            <SectionHeader
              title={t('profile.careCircleTitle')}
              subtitle={t('profile.careCircleSub')}
              action={<Users className="w-5 h-5 text-[#269B91]" aria-hidden="true" />}
            />
            <div className="divide-y aarvi-divider">
              {patientProfile.careCircle.map((member) => (
                <div key={member.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display font-bold text-[#172C40]">{member.name}</p>
                      <p className="text-xs font-medium text-[#176D65] mt-0.5">
                        {member.roleLabel} · {member.relation}
                      </p>
                      <p className="text-xs text-[#172C40]/70 mt-1">{member.availability}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#172C40] tabular-nums shrink-0">
                      <Phone className="w-3.5 h-3.5 text-[#269B91]" aria-hidden="true" />
                      <span>{member.phone}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}
