import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Banknote, Bell, BookOpenCheck, BriefcaseBusiness, Building2, CalendarClock, ChevronDown, CircleUserRound, FileSearch, Fingerprint, Gauge, GitCompareArrows, Landmark, Link2, LocateFixed, Menu, Network, PanelLeftClose, Search, Settings, ShieldCheck, Sparkles, Upload, Users, X } from 'lucide-react';
import { investigationService } from '../services';
import type { SearchResult } from '../types/domain';
import { EntityBadge, EmptyState } from '../components/ui';

const investigations = [
  ['FIR Analysis', '/fir-analysis', FileSearch], ['Entity Search', '/search', Search], ['Knowledge Graph', '/graph', Network], ['Hidden Connections', '/hidden-connections', Link2], ['Cross-Case Finder', '/cross-case', GitCompareArrows], ['Timeline', '/timeline', CalendarClock], ['Evidence Explorer', '/evidence', BookOpenCheck], ['Retrieval', '/retrieval', Fingerprint], ['Priority Links', '/priority-links', Gauge], ['Investigator Assistant', '/assistant', Sparkles],
] as const;
const sources = [['FIRs', '/cases', BriefcaseBusiness], ['Persons', '/search?type=person', Users], ['Phones / CDRs', '/search?type=phone', CircleUserRound], ['Vehicles', '/search?type=vehicle', LocateFixed], ['Bank Accounts', '/search?type=account', Landmark], ['Transactions', '/search?type=transaction', Banknote], ['Locations', '/search?type=location', Building2], ['Evidence', '/evidence', ShieldCheck]] as const;

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setSearchOpen(true); } if (event.key === 'Escape') setSearchOpen(false); };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  useEffect(() => { if (searchOpen) void investigationService.searchEntities(query).then(setResults); }, [query, searchOpen]);
  const goToResult = (result: SearchResult) => { setSearchOpen(false); setQuery(''); navigate(result.type === 'person' ? `/persons/${result.id}` : result.type === 'case' ? `/cases/${result.id}` : `/search?q=${encodeURIComponent(result.id)}`); };

  return <div className={`app-shell ${sidebarOpen ? 'sidebar-open' : ''}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Network size={23} /></div><div><strong>NEXUSNET</strong><span>INTELLIGENCE</span></div><button className="mobile-only" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={19} /></button></div>
      <p className="brand-subtitle">Investigative analysis platform</p>
      <nav aria-label="Primary navigation">
        <NavItem to="/dashboard" icon={Gauge} label="Dashboard" onClick={() => setSidebarOpen(false)} />
        <NavGroup label="Investigations" items={investigations} onNavigate={() => setSidebarOpen(false)} />
        <NavGroup label="Data sources" items={sources} onNavigate={() => setSidebarOpen(false)} />
        <span className="nav-label">Settings</span><NavItem to="/settings" icon={Settings} label="Settings" onClick={() => setSidebarOpen(false)} />
      </nav>
      <div className="sidebar-footer"><span className="status-dot" />Mock data mode<strong>Backend not connected</strong></div>
    </aside>
    <div className="app-area">
      <header className="top-header"><button className="menu-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu /></button><button className="global-search-trigger" onClick={() => setSearchOpen(true)}><Search size={17} /><span>Search name, phone, vehicle, case ID, location, transaction...</span><kbd>Ctrl K</kbd></button><div className="header-actions"><button aria-label="Upload FIR" title="Upload FIR" onClick={() => navigate('/fir-analysis')}><Upload size={18} /></button><button aria-label="Notifications" title="Notifications"><Bell size={18} /><i /></button><button className="profile-button"><span>INV</span><div><strong>Investigator</strong><small>Analysis workspace</small></div><ChevronDown size={14} /></button></div></header>
      <main><Outlet /></main>
    </div>
    {sidebarOpen && <button className="backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    {searchOpen && <div className="modal-backdrop" onMouseDown={() => setSearchOpen(false)}><div className="search-modal" role="dialog" aria-modal="true" aria-label="Global search" onMouseDown={(e) => e.stopPropagation()}><div className="search-modal-input"><Search size={20} /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search all investigation records..."/><kbd>Esc</kbd></div><div className="search-modal-results">{results.length ? results.slice(0, 8).map((result) => <button key={result.id} onClick={() => goToResult(result)}><EntityBadge type={result.type} /><div><strong>{result.label}</strong><span>{result.secondary}</span></div><small>{result.relatedCases.slice(0, 2).join(', ')}</small></button>) : <EmptyState title="No matching records" />}</div><footer>Demo search uses coherent synthetic investigation records.</footer></div></div>}
  </div>;
}

function NavItem({ to, icon: Icon, label, onClick }: { to: string; icon: typeof PanelLeftClose; label: string; onClick: () => void }) { return <NavLink to={to} onClick={onClick}><Icon size={17} /><span>{label}</span></NavLink>; }
function NavGroup({ label, items, onNavigate }: { label: string; items: ReadonlyArray<readonly [string, string, typeof PanelLeftClose]>; onNavigate: () => void }) { return <><span className="nav-label">{label}</span>{items.map(([name, path, Icon]) => <NavItem key={`${name}-${path}`} to={path} icon={Icon} label={name} onClick={onNavigate} />)}</>; }
