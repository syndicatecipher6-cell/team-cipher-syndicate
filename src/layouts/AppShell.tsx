import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  BookOpenCheck,
  Bot,
  ChevronDown,
  FlaskConical,
  Inbox,
  LogOut,
  Menu,
  Network,
  PanelLeftClose,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  User,
  Users,
  X,
} from 'lucide-react';
import { useInvestigation } from '../context/InvestigationContext';
import { clearDemoSession, getWorkspaceSession } from '../security/demoSession';
import type { SearchResult } from '../types/domain';
import { EntityBadge, EmptyState } from '../components/ui';

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const { dataset, isDataLoaded, clearAllData, searchEntities } = useInvestigation();
  const workspaceSession = getWorkspaceSession();

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
    if (searchOpen) {
      void searchEntities(query).then(setResults);
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

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [profileMenuOpen]);

  const handleSignOut = () => {
    setProfileMenuOpen(false);
    clearDemoSession();
    navigate('/login');
  };

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><img className="brand-logo-image" src="/nexusnet-logo.png" alt="NexusNet" /></div>
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
          <NavItem to="/evidence" icon={BookOpenCheck} label="Evidence Explorer" onClick={closeSidebar} />
          <NavItem to="/sandbox" icon={FlaskConical} label="Investigation Sandbox" onClick={closeSidebar} />
        </nav>

        <div className="sidebar-footer">
          <div
            className="security-baseline-badge"
            title="Upload validation, request limits, restricted CORS, trusted hosts, and security headers"
            aria-label="OWASP-aligned backend security controls"
          >
            <ShieldCheck size={14} />
            <span><b>OWASP-aligned API</b><small>Backend security baseline</small></span>
          </div>
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
            <div className="profile-menu-container" ref={profileMenuRef}>
              <button
                className="profile-button"
                aria-expanded={profileMenuOpen}
                aria-haspopup="true"
                onClick={() => setProfileMenuOpen((prev) => !prev)}
              >
                <span>{workspaceSession?.stationName.split(/\s+/).map((word) => word[0]).join('').slice(0, 3).toUpperCase() || 'INV'}</span>
                <div><strong>{workspaceSession?.stationName || 'Investigator'}</strong><small>{workspaceSession?.mode === 'supabase' ? 'Shared station workspace' : 'Analysis workspace'}</small></div>
                <ChevronDown
                  size={14}
                  style={{
                    transform: profileMenuOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.15s ease',
                  }}
                />
              </button>

              {profileMenuOpen && (
                <div className="profile-dropdown" role="menu">
                  <div className="profile-dropdown-item profile-info-item">
                    <User size={15} />
                    <div className="profile-info-text">
                      <span className="profile-info-sub">Profile name</span>
                      <strong className="profile-info-title">{workspaceSession?.stationName || 'Admin'}</strong>
                    </div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button
                    type="button"
                    className="profile-dropdown-item profile-logout-btn"
                    role="menuitem"
                    onClick={handleSignOut}
                  >
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
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
                placeholder={workspaceSession?.mode === 'supabase' || isDataLoaded
                  ? 'Search uploaded investigation records...'
                  : 'No records loaded yet. Upload files to begin.'}
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
              {workspaceSession?.mode === 'supabase'
                ? `${results.length} authorised local and shared records shown`
                : isDataLoaded
                  ? `${dataset.searchResults.length} entities indexed from uploaded records`
                  : 'Clean workspace · No synthetic records loaded'}
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
