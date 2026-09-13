import { useState } from 'react';
import { ArrowRight, BookOpenCheck, CalendarDays, Link2, Network, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GraphView } from '../components/GraphView';
import { EmptyState, EntityBadge, LoadingState, PageHeader, Panel, StatusBadge } from '../components/ui';
import { evidence, graphData, timelineEvents } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';

export function PersonPage() {
  const { personId = '' } = useParams(); const [tab, setTab] = useState('Overview');
  const { data: person, loading } = useAsync(() => investigationService.getPerson(personId), [personId]);
  if (loading) return <LoadingState />; if (!person) return <EmptyState title="Person record not found" />;
  const connectedIds = new Set([person.person_id]); graphData.edges.forEach((e) => { if (e.source === person.person_id || e.target === person.person_id) { connectedIds.add(e.source); connectedIds.add(e.target); } });
  const subgraph = { nodes: graphData.nodes.filter((n) => connectedIds.has(n.id)), edges: graphData.edges.filter((e) => connectedIds.has(e.source) && connectedIds.has(e.target)) };
  return <><PageHeader eyebrow="Person record" title={person.name} description={`${person.person_id} · Normalized entity profile`} actions={<><Link to={`/hidden-connections?from=${person.person_id}`} className="button button--secondary"><Link2 size={15} />Find connections</Link><Link to={`/graph?entityId=${person.person_id}`} className="button button--primary"><Network size={15} />View network</Link></>} />
    <div className="profile-summary panel"><div className="avatar-large">{person.name.split(' ').map((n) => n[0]).join('')}</div><div><EntityBadge type="person" /><h2>{person.name}</h2><p>{person.person_id}</p></div><div className="profile-meta"><span>Current role<StatusBadge>{person.role}</StatusBadge></span><span>Related cases<strong>{person.caseIds.length}</strong></span><span>Visible connections<strong>{subgraph.edges.length}</strong></span></div></div>
    <div className="tabs" role="tablist">{['Overview', 'Connections', 'Cases', 'Timeline', 'Evidence'].map((name) => <button role="tab" aria-selected={tab === name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)} key={name}>{name}</button>)}</div>
    {tab === 'Overview' && <div className="two-column"><Panel title="Associated records"><div className="association-grid"><Association title="Phones" values={person.phoneIds} /><Association title="Vehicles" values={person.vehicleIds} /><Association title="Accounts" values={person.accountIds} /><Association title="Locations" values={person.locationIds} /></div></Panel><Panel title="Investigator actions"><div className="action-list"><Link to={`/graph?entityId=${person.person_id}`}><Network />Inspect the entity network<ArrowRight /></Link><Link to={`/timeline?entityId=${person.person_id}`}><CalendarDays />Review chronological activity<ArrowRight /></Link><Link to={`/assistant?entityId=${person.person_id}`}><Sparkles />Ask Investigator Assistant<ArrowRight /></Link></div></Panel></div>}
    {tab === 'Connections' && <Panel title="Immediate network" subtitle="Double-click a node to highlight adjacent entities"><GraphView data={subgraph} compact /></Panel>}
    {tab === 'Cases' && <Panel title="Related cases"><div className="card-grid">{person.caseIds.map((id) => <Link className="record-card" to={`/cases/${id}`} key={id}><EntityBadge type="case" /><h3>{id}</h3><span>Open case record <ArrowRight size={14} /></span></Link>)}</div></Panel>}
    {tab === 'Timeline' && <Panel title="Person timeline"><div className="timeline-list">{timelineEvents.filter((e) => e.person_id === person.person_id).map((e) => <article key={e.event_id}><i /><time>{new Date(e.timestamp).toLocaleDateString('en-IN')}</time><div><strong>{e.event_type}</strong><p>{e.notes}</p><small>{e.case_id} · {e.location}</small></div></article>)}</div></Panel>}
    {tab === 'Evidence' && <Panel title="Supporting evidence"><div className="evidence-grid">{evidence.filter((e) => e.entityA === person.person_id || e.entityB === person.person_id).map((e) => <article className="evidence-card" key={e.evidence_id}><BookOpenCheck /><div><strong>{e.evidence_id}</strong><p>{e.relationship}</p><small>{e.case_id} · {e.provenance.sourceRecordId}</small></div></article>)}</div></Panel>}
  </>;
}
function Association({ title, values }: { title: string; values: string[] }) { return <section><span>{title}</span>{values.length ? values.map((value) => <strong key={value}>{value}</strong>) : <em>None in current scope</em>}</section>; }
