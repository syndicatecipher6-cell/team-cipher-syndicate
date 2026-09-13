import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EntityBadge, PageHeader, Panel, StatusBadge } from '../components/ui';
import { cases } from '../data/mockData';

export function CasesPage() { return <><PageHeader eyebrow="Investigation registry" title="FIRs & Cases" description="Open an investigation workspace or compare records across cases." /><Panel title={`${cases.length} demonstration cases`} subtitle="Dashboard totals are service-provided demo statistics"><div className="case-list">{cases.map((item) => <Link to={`/cases/${item.case_id}`} key={item.case_id}><BriefcaseBusiness /><div><EntityBadge type="case" /><h3>{item.case_id}</h3><p>{item.summary}</p><span>{item.fir_number} · {item.district}, {item.state}</span></div><StatusBadge>{item.status}</StatusBadge><ArrowRight /></Link>)}</div></Panel></>; }

export function NotFoundPage() { return <div className="state page-not-found"><Network /><strong>Page not found</strong><span>The requested investigation view does not exist.</span><Link className="button button--primary" to="/dashboard">Return to dashboard</Link></div>; }
function Network() { return <BriefcaseBusiness size={24} />; }
