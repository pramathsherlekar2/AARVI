import {AarviProvider, useAarvi} from './context/AarviContext';
import {AuthScreen} from './components/auth/AuthScreen';
import {OnboardingFlow} from './components/auth/OnboardingFlow';
import {AppShell} from './components/layout/AppShell';
import {ElderlyPatientDashboard} from './components/dashboards/ElderlyPatientDashboard';
import {FamilyMemberDashboard} from './components/dashboards/FamilyMemberDashboard';
import {CaregiverDashboard} from './components/dashboards/CaregiverDashboard';
import {PatientProfileView} from './components/workflows/PatientProfileView';
import {MedicationWorkflowView} from './components/workflows/MedicationWorkflowView';
import {AppointmentsView} from './components/workflows/AppointmentsView';
import {CareHandoverView} from './components/workflows/CareHandoverView';
import {OfflineSyncView} from './components/workflows/OfflineSyncView';
import {ModuleRegistryView} from './components/workflows/ModuleRegistryView';

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
      case 'medications':
        return <MedicationWorkflowView />;
      case 'appointments':
        return <AppointmentsView />;
      case 'handovers':
        return <CareHandoverView />;
      case 'offline_sync':
        return <OfflineSyncView />;
      case 'modules':
        return <ModuleRegistryView />;
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
