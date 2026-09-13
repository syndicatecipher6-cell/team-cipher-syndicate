import { useState } from 'react';
import { Bell, Database, Monitor, PlugZap, Save, ShieldCheck, UserRound } from 'lucide-react';
import { apiConfig } from '../config/api';
import { dataSources } from '../data/mockData';
import { Button, PageHeader, Panel, StatusBadge } from '../components/ui';

export function SettingsPage() {
  const [tab, setTab] = useState('Data Sources'); const [saved, setSaved] = useState(false);
  const tabs = [['Profile', UserRound], ['Appearance', Monitor], ['Data Sources', Database], ['API Status', PlugZap], ['Access', ShieldCheck], ['Notifications', Bell]] as const;
  return <><PageHeader eyebrow="Workspace configuration" title="Settings" description="Review local preferences, data-source availability and backend integration status." />
    <div className="settings-layout"><aside className="settings-nav">{tabs.map(([name, Icon]) => <button className={tab === name ? 'active' : ''} key={name} onClick={() => setTab(name)}><Icon size={16} />{name}</button>)}</aside><Panel title={tab}>
      {tab === 'Data Sources' && <div className="source-registry"><p>Operational sources are populated by the service layer. Benchmark-only datasets are intentionally excluded from investigator navigation.</p>{dataSources.map((source) => <article key={source.id}><Database size={17} /><div><strong>{source.name}</strong><span>{source.category}</span></div><StatusBadge>{source.status}</StatusBadge></article>)}</div>}
      {tab === 'API Status' && <div className="api-status"><article><span className={`connection-indicator ${apiConfig.useMockData ? 'mock' : 'real'}`} /><div><strong>{apiConfig.useMockData ? 'Mock data mode' : 'API mode'}</strong><p>{apiConfig.useMockData ? 'The frontend is running independently with coherent demonstration data.' : 'The frontend is configured to request data from the backend.'}</p></div></article><dl className="metadata"><div><dt>API base URL</dt><dd>{apiConfig.baseUrl || 'Not configured'}</dd></div><div><dt>Environment variable</dt><dd>VITE_API_BASE_URL</dd></div><div><dt>Mock mode variable</dt><dd>VITE_USE_MOCK_DATA</dd></div></dl><p className="verification-note">Backend integration is not claimed until the API contract is confirmed and successfully tested.</p></div>}
      {tab === 'Profile' && <SettingsForm fields={['Display name', 'Officer / analyst ID', 'Unit or department']} onSave={() => setSaved(true)} />}
      {tab === 'Appearance' && <div className="appearance-setting"><span>Interface theme</span><div><button className="selected"><i />Professional light</button><button disabled><i />Additional themes require configuration</button></div></div>}
      {tab === 'Access' && <div className="placeholder-setting"><ShieldCheck /><h3>Access and role information</h3><p>Role-based access must be provided by the backend identity service. No permissions are inferred in mock mode.</p></div>}
      {tab === 'Notifications' && <SettingsForm fields={['Case activity alerts', 'Evidence review reminders', 'Connection review updates']} toggles onSave={() => setSaved(true)} />}
      {saved && <div className="saved-toast"><Save size={14} />Local display preference saved</div>}
    </Panel></div>
  </>;
}
function SettingsForm({ fields, toggles, onSave }: { fields: string[]; toggles?: boolean; onSave: () => void }) { return <form className="settings-form" onSubmit={(e) => { e.preventDefault(); onSave(); }}>{fields.map((field) => toggles ? <label className="toggle-row" key={field}><span>{field}<small>Display a local interface notification when available.</small></span><input type="checkbox" defaultChecked /><i /></label> : <label key={field}><span>{field}</span><input placeholder="Not provided by backend" /></label>)}<Button><Save size={15} />Save preferences</Button></form>; }
