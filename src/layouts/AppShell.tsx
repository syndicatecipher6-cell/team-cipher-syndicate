import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Inbox,
  Users,
  Network,
  Bot,
  Settings,
  Search,
  Bell,
  Plus,
  RotateCcw,
  X,
  Menu,
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

  const alertCount = dataset.stats.alerts;

  return (
    <div className={`nexus-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
      {/* Left Sidebar (Exact match to Screenshots) */}
      <aside className="nexus-sidebar">
        {/* Brand */}
        <div className="nexus-brand">
          <div className="nexus-logo-box">
            <span className="logo-letter">N</span>
          </div>
          <span className="nexus-brand-text">NexusNet</span>
          <button className="mobile-only close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="nexus-nav" aria-label="Main navigation">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <BarChart3 size={19} className="nav-icon" />
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/ingestion"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Inbox size={19} className="nav-icon" />
            <span>Data Ingestion</span>
          </NavLink>

          <NavLink
            to="/entities"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Users size={19} className="nav-icon" />
            <span>Entities & Identities</span>
          </NavLink>

          <NavLink
            to="/graph"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Network size={19} className="nav-icon" />
            <span>Network Graph</span>
          </NavLink>

          <NavLink
            to="/assistant"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Bot size={19} className="nav-icon" />
            <span>Investigation AI</span>
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) => `nexus-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <Settings size={19} className="nav-icon" />
            <span>Settings</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="nexus-user-footer">
          <div className="user-avatar-circle">
            <span>IN</span>
          </div>
          <div className="user-text-meta">
            <strong>Investigator</strong>
            <small>Admin</small>
          </div>
        </div>
      </aside>

      {/* Main App Area */}
      <div className="nexus-main-area">
        {/* Top Header Bar */}
        <header className="nexus-top-bar">
          <button className="menu-toggle-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <div className="nexus-search-trigger" onClick={() => setSearchOpen(true)}>
            <Search size={16} className="search-icon" />
            <span>Search entities, FIRs, or locations...</span>
            <kbd className="ctrl-k-badge">Ctrl K</kbd>
          </div>

          <div className="header-right-actions">
            {isDataLoaded && (
              <button
                className="header-clear-btn"
                onClick={clearAllData}
                title="Wipe current data back to clean state"
              >
                <RotateCcw size={14} />
                <span>Reset to Clean</span>
              </button>
            )}

            <button
              className="icon-action-btn notification-btn"
              title="Alert notifications"
              onClick={() => {
                if (alertCount > 0) alert(`${alertCount} High Risk Alerts detected in the uploaded dataset.`);
                else alert('No alerts. Workspace is clean.');
              }}
            >
              <Bell size={18} />
              {alertCount > 0 && <span className="notification-badge">{alertCount}</span>}
            </button>

            <button
              className="icon-action-btn"
              title="Settings"
              onClick={() => navigate('/settings')}
            >
              <Settings size={18} />
            </button>

            <button
              className="new-investigation-btn"
              onClick={() => navigate('/ingestion')}
            >
              <Plus size={16} />
              <span>New Investigation</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="nexus-content-body">
          <Outlet />
        </main>
      </div>

      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      {/* Global Search Modal */}
      {searchOpen && (
        <div className="search-modal-overlay" onMouseDown={() => setSearchOpen(false)}>
          <div className="search-dialog" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="search-dialog-input-row">
              <Search size={18} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isDataLoaded ? "Search across uploaded cases, suspects, phones, accounts..." : "No data uploaded yet. Type query or upload files."}
              />
              <kbd>Esc</kbd>
            </div>
            <div className="search-dialog-results">
              {results.length > 0 ? (
                results.slice(0, 8).map((result) => (
                  <button key={result.id} className="search-result-row" onClick={() => goToResult(result)}>
                    <EntityBadge type={result.type} />
                    <div className="result-text">
                      <strong>{result.label}</strong>
                      <small>{result.secondary}</small>
                    </div>
                    {result.relatedCases.length > 0 && (
                      <span className="result-case-chip">{result.relatedCases.slice(0, 2).join(', ')}</span>
                    )}
                  </button>
                ))
              ) : (
                <EmptyState
                  title={isDataLoaded ? "No matching records" : "No records loaded"}
                  message={isDataLoaded ? "Try searching by person name, phone number, vehicle plate, or case ID." : "Upload datasets in Data Ingestion to search entities."}
                />
              )}
            </div>
            <footer className="search-dialog-footer">
              <span>{isDataLoaded ? `${dataset.searchResults.length} entities indexed in local knowledge graph` : 'Zero data loaded · Clean workspace'}</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
