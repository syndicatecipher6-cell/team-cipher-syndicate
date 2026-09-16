import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  Inbox,
  Menu,
  Network,
  PanelLeftClose,
  RotateCcw,
  Search,
  Settings,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import type { SearchResult } from '../types/domain';
import { EntityBadge, EmptyState } from '../components/ui';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { dataset, isDataLoaded, clearAllData, searchEntities } = useInvestigation();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (searchOpen && query.trim()) {
      void searchEntities(query).then(setResults);
    } else if (searchOpen) {
      setResults(dataset.searchResults.slice(0, 8));
    }
  }, [query, searchOpen, searchEntities, dataset.searchResults]);

  const goToResult = (result: SearchResult) => {
    setSearchOpen(false);
    setQuery('');
    if (result.type === 'person') navigate(`/persons/${result.id}`);
    else if (result.type === 'case') navigate(`/cases/${result.id}`);
    else navigate(`/graph?entityId=${encodeURIComponent(result.id)}`);
  };

  const closeSidebar = () => setSidebarOpen(false);
  const alertCount = dataset.stats.alerts;

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Network size={23} /></div>
          <div><strong>NEXUSNET</strong><span>INTELLIGENCE</span></div>
          <button className="mobile-only" aria-label="Close navigation" onClick={closeSidebar}>
            <X size={19} />
          </button>
        </div>
        <p className="brand-subtitle">Investigative analysis platform</p>

        <nav aria-label="Primary navigation">
          <NavItem to="/dashboard" icon={BarChart3} label="Dashboard" onClick={closeSidebar} />
          <NavItem to="/ingestion" icon={Inbox} label="Data Ingestion" onClick={closeSidebar} />
          <NavItem to="/entities" icon={Users} label="Entities & Identities" onClick={closeSidebar} />
          <NavItem to="/graph" icon={Network} label="Network Graph" onClick={closeSidebar} />
          <NavItem to="/assistant" icon={Bot} label="Investigation AI" onClick={closeSidebar} />
          <NavItem to="/settings" icon={Settings} label="Settings" onClick={closeSidebar} />
        </nav>

        <div className="sidebar-footer">
          <span className="status-dot" />
          {isDataLoaded ? 'Investigation data loaded' : 'Workspace ready'}
          <strong>{isDataLoaded ? `${dataset.cases.length} case files indexed` : 'Awaiting uploaded records'}</strong>
        </div>
      </aside>

      <div className="app-area">
        <header className="top-header">
          <button className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <button className="global-search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={17} />
            <span>Search entities, FIRs, cases, or locations...</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="header-actions">
            {isDataLoaded && (
              <button aria-label="Reset investigation data" title="Reset to clean state" onClick={clearAllData}>
                <RotateCcw size={18} />
              </button>
            )}
            <button aria-label="Upload investigation files" title="Upload investigation files" onClick={() => navigate('/ingestion')}>
              <Upload size={18} />
            </button>
            <button
              aria-label="Notifications"
              title="Notifications"
              onClick={() => alert(alertCount > 0 ? `${alertCount} high-risk alerts detected in the uploaded dataset.` : 'No alerts in the current workspace.')}
            >
              <Bell size={18} />
              {alertCount > 0 && <i />}
            </button>
            <button className="profile-button" onClick={() => navigate('/settings')}>
              <span>INV</span>
              <div><strong>Investigator</strong><small>Analysis workspace</small></div>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>
        <main><Outlet /></main>
      </div>

      {sidebarOpen && <button className="backdrop" aria-label="Close navigation" onClick={closeSidebar} />}

      {searchOpen && (
        <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}>
          <div className="search-modal" role="dialog" aria-modal="true" aria-label="Global search" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-modal-input">
              <Search size={20} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={isDataLoaded ? 'Search uploaded investigation records...' : 'No records loaded yet. Upload files to begin.'}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="search-modal-results">
              {results.length ? results.slice(0, 8).map((result) => (
                <button key={result.id} onClick={() => goToResult(result)}>
                  <EntityBadge type={result.type} />
                  <div><strong>{result.label}</strong><span>{result.secondary}</span></div>
                  <small>{result.relatedCases.slice(0, 2).join(', ')}</small>
                </button>
              )) : (
                <EmptyState
                  title={isDataLoaded ? 'No matching records' : 'No records loaded'}
                  message={isDataLoaded ? 'Try another name, identifier, or case ID.' : 'Upload FIR or other supported files in Data Ingestion.'}
                />
              )}
            </div>
            <footer>
              {isDataLoaded ? `${dataset.searchResults.length} entities indexed from uploaded records` : 'Clean workspace · No synthetic records loaded'}
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ to, icon: Icon, label, onClick }: { to: string; icon: typeof PanelLeftClose; label: string; onClick: () => void }) {
  return <NavLink to={to} onClick={onClick}><Icon size={17} /><span>{label}</span></NavLink>;
}
