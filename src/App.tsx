import { Navigate, Route, Routes } from 'react-router-dom';
import { InvestigationProvider } from './context/InvestigationContext';
import { AppShell } from './layouts/AppShell';
import { AssistantPage } from './pages/AssistantPage';
import { CasePage } from './pages/CasePage';
import { CrossCasePage, HiddenConnectionsPage } from './pages/ConnectionPages';
import { DashboardPage } from './pages/DashboardPage';
import { DataIngestionPage } from './pages/DataIngestionPage';
import { EntitiesIdentitiesPage } from './pages/EntitiesIdentitiesPage';
import { EvidencePage, PriorityLinksPage } from './pages/EvidencePriorityPages';
import { GraphPage } from './pages/GraphPage';
import { LoginPage } from './pages/LoginPage';
import { CasesPage, NotFoundPage } from './pages/OverviewPages';
import { PersonPage } from './pages/PersonPage';
import { RetrievalPage } from './pages/RetrievalPage';
import { SettingsPage } from './pages/SettingsPage';
import { SandboxPage } from './pages/SandboxPage';
import { TimelinePage } from './pages/TimelinePage';
import { hasValidDemoSession } from './security/demoSession';

function ProtectedWorkspace() {
  return hasValidDemoSession() ? <AppShell /> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <InvestigationProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedWorkspace />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/ingestion" element={<DataIngestionPage />} />
          <Route path="/entities" element={<EntitiesIdentitiesPage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/assistant" element={<AssistantPage />} />
          <Route path="/sandbox" element={<SandboxPage />} />
          <Route path="/settings" element={<SettingsPage />} />

          {/* Additional investigative views and detail profiles */}
          <Route path="/fir-analysis" element={<DataIngestionPage />} />
          <Route path="/search" element={<EntitiesIdentitiesPage />} />
          <Route path="/persons/:personId" element={<PersonPage />} />
          <Route path="/cases" element={<CasesPage />} />
          <Route path="/cases/:caseId" element={<CasePage />} />
          <Route path="/hidden-connections" element={<HiddenConnectionsPage />} />
          <Route path="/cross-case" element={<CrossCasePage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/evidence" element={<EvidencePage />} />
          <Route path="/retrieval" element={<RetrievalPage />} />
          <Route path="/priority-links" element={<PriorityLinksPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </InvestigationProvider>
  );
}
