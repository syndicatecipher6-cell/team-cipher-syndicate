import { BookOpenCheck, CalendarDays, GitCompareArrows, Network } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { GraphView } from '../components/GraphView';
import { EmptyState, EntityBadge, LoadingState, PageHeader, Panel, StatusBadge } from '../components/ui';
import { evidence, persons, timelineEvents } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';

export function CasePage() {
  const { caseId = '' } = useParams(); const { data: item, loading } = useAsync(() => investigationService.getCase(caseId), [caseId]);
  const { data: graph } = useAsync(() => investigationService.getGraph([caseId]), [caseId]);
  if (loading) return <LoadingState />; if (!item) return <EmptyState title="Case record not found" />;
  return <><PageHeader eyebrow="Case workspace" title={item.case_id} description={`${item.fir_number} · ${item.crime_type}`} actions={<><Link className="button button--secondary" to={`/cross-case?cases=${item.case_id}`}><GitCompareArrows size={15} />Cross-case finder</Link><Link className="button button--primary" to={`/graph?caseId=${item.case_id}`}><Network size={15} />Open graph</Link></>} />
    <Panel className="case-overview"><div className="case-heading"><EntityBadge type="case" /><StatusBadge>{item.status}</StatusBadge></div><dl className="case-metadata"><div><dt>FIR number</dt><dd>{item.fir_number}</dd></div><div><dt>Date filed</dt><dd>{new Date(item.date_filed).toLocaleDateString('en-IN')}</dd></div><div><dt>District</dt><dd>{item.district}</dd></div><div><dt>State</dt><dd>{item.state}</dd></div></dl><div className="summary-block"><span>Case summary</span><p>{item.summary}</p></div></Panel>
    <div className="case-kpis"><article><UsersIcon /><span>People<strong>{persons.filter((p) => p.caseIds.includes(item.case_id)).length}</strong></span></article><article><Network /><span>Connections<strong>{graph?.edges.length ?? 0}</strong></span></article><article><BookOpenCheck /><span>Evidence<strong>{evidence.filter((e) => e.case_id === item.case_id).length}</strong></span></article><article><CalendarDays /><span>Timeline events<strong>{timelineEvents.filter((e) => e.case_id === item.case_id).length}</strong></span></article></div>
    <div className="two-column two-column--wide"><Panel title="Case entity network" subtitle="Records currently connected to this investigation">{graph ? <GraphView data={graph} compact /> : <LoadingState label="Building investigation graph..." />}</Panel><Panel title="Case timeline"><div className="timeline-list">{timelineEvents.filter((e) => e.case_id === item.case_id).map((e) => <article key={e.event_id}><i /><time>{new Date(e.timestamp).toLocaleDateString('en-IN')}</time><div><strong>{e.event_type}</strong><p>{e.notes}</p><small>{e.location}</small></div></article>)}</div><Link className="text-link" to={`/timeline?caseId=${item.case_id}`}>View complete timeline</Link></Panel></div>
  </>;
}
function UsersIcon() { return <span className="case-kpi-person">P</span>; }
