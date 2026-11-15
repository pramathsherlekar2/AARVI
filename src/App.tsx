import {AarviProvider, useAarvi} from './context/AarviContext';
import {AuthScreen} from './components/auth/AuthScreen';
import {OnboardingFlow} from './components/auth/OnboardingFlow';
import {AppShell} from './components/layout/AppShell';
import {ElderlyPatientDashboard} from './components/dashboards/ElderlyPatientDashboard';
import {FamilyMemberDashboard} from './components/dashboards/FamilyMemberDashboard';
import {CaregiverDashboard} from './components/dashboards/CaregiverDashboard';
import {PatientProfileView} from './components/workflows/PatientProfileView';
import {FamilyCareTeamView} from './components/workflows/FamilyCareTeamView';
import {MedicationWorkflowView} from './components/workflows/MedicationWorkflowView';
import {AppointmentsView} from './components/workflows/AppointmentsView';
import {CareHandoverView} from './components/workflows/CareHandoverView';
import {DailyCompanionView} from './components/workflows/DailyCompanionView';
import {RefillTrackerView} from './components/workflows/RefillTrackerView';
import {AiAssistantView} from './components/workflows/AiAssistantView';
import {NotificationsView} from './components/workflows/NotificationsView';
import {OfflineSyncView} from './components/workflows/OfflineSyncView';
import {ModuleRegistryView} from './components/workflows/ModuleRegistryView';
import {SettingsView} from './components/workflows/SettingsView';
import {EscalationView} from './components/workflows/EscalationView';
import {CareTasksView} from './components/workflows/CareTasksView';
import {PrivacyConsentView} from './components/workflows/PrivacyConsentView';
import {CaregiverVisitsView} from './components/workflows/CaregiverVisitsView';

function AarviWorkspaceRouter() {
  const {session, activeRoute} = useAarvi();

  if (!session) {
    return <AuthScreen />;
  }

  if (!session.onboardingCompleted) {
    return <OnboardingFlow />;
  }

  const renderActiveView = () => {
    switch (activeRoute) {
      case 'patient_profile':
        return <PatientProfileView />;
      case 'family_care_team':
        return <FamilyCareTeamView />;
      case 'medications':
        return <MedicationWorkflowView />;
      case 'escalation':
        return <EscalationView />;
      case 'tasks':
        return <CareTasksView />;
      case 'visits':
        return <CaregiverVisitsView />;
      case 'privacy_consent':
        return <PrivacyConsentView />;
      case 'appointments':
        return <AppointmentsView />;
      case 'handovers':
        return <CareHandoverView />;
      case 'daily_companion':
        return <DailyCompanionView />;
      case 'refill_tracker':
        return <RefillTrackerView />;
      case 'ai_assistant':
        return <AiAssistantView />;
      case 'notifications':
        return <NotificationsView />;
      case 'offline_sync':
        return <OfflineSyncView />;
      case 'modules':
        return <ModuleRegistryView />;
      case 'settings':
        return <SettingsView />;
      case 'dashboard':
      default:
        if (session.role === 'elderly_patient') {
          return <ElderlyPatientDashboard />;
        }
        if (session.role === 'caregiver') {
          return <CaregiverDashboard />;
        }
        return <FamilyMemberDashboard />;
    }
  };

  return <AppShell>{renderActiveView()}</AppShell>;
}

export default function App() {
  return (
    <AarviProvider>
      <AarviWorkspaceRouter />
    </AarviProvider>
  );
}
