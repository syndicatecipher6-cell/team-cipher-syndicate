import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './layouts/AppShell';
import { AssistantPage } from './pages/AssistantPage';
import { CasePage } from './pages/CasePage';
import { CrossCasePage, HiddenConnectionsPage } from './pages/ConnectionPages';
import { DashboardPage } from './pages/DashboardPage';
import { EvidencePage, PriorityLinksPage } from './pages/EvidencePriorityPages';
import { FirAnalysisPage } from './pages/FirAnalysisPage';
import { GraphPage } from './pages/GraphPage';
import { LoginPage } from './pages/LoginPage';
import { CasesPage, NotFoundPage } from './pages/OverviewPages';
import { PersonPage } from './pages/PersonPage';
import { RetrievalPage } from './pages/RetrievalPage';
import { SearchPage } from './pages/SearchPage';
import { SettingsPage } from './pages/SettingsPage';
import { TimelinePage } from './pages/TimelinePage';

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<AppShell />}>
      <Route index element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/fir-analysis" element={<FirAnalysisPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/persons/:personId" element={<PersonPage />} />
      <Route path="/cases" element={<CasesPage />} />
      <Route path="/cases/:caseId" element={<CasePage />} />
      <Route path="/graph" element={<GraphPage />} />
      <Route path="/hidden-connections" element={<HiddenConnectionsPage />} />
      <Route path="/cross-case" element={<CrossCasePage />} />
      <Route path="/timeline" element={<TimelinePage />} />
      <Route path="/evidence" element={<EvidencePage />} />
      <Route path="/retrieval" element={<RetrievalPage />} />
      <Route path="/priority-links" element={<PriorityLinksPage />} />
      <Route path="/assistant" element={<AssistantPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>;
}
