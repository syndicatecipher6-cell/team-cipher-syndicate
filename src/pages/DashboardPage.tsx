import { useCallback, useState } from 'react';
import { Activity, BriefcaseBusiness, Download, Network, Phone, RefreshCw, Users, WalletCards } from 'lucide-react';
import { GraphView } from '../components/GraphView';
import { EntityDetailsPanel, EvidenceDrawer } from '../components/Drawers';
import { Button, ErrorState, LoadingState, PageHeader, Panel, StatCard } from '../components/ui';
import { cases, timelineEvents } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';
import type { GraphEdge, GraphNode } from '../types/domain';

export function DashboardPage() {
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [node, setNode] = useState<GraphNode>(); const [edge, setEdge] = useState<GraphEdge>();
  const loader = useCallback(() => Promise.all([investigationService.getDashboardStats(), investigationService.getGraph(selectedCases)]), [selectedCases]);
  const { data, loading, error, retry } = useAsync(loader, [loader]);
  const exportReport = () => window.alert('Report export is ready for backend integration. No report was generated in mock mode.');
  return <>
    <PageHeader eyebrow="Investigation workspace" title="Good Morning, Investigator" description="Review investigations, connections and emerging leads." actions={<><Button variant="secondary" onClick={exportReport}><Download size={16} />Export report</Button><Button onClick={() => void retry()}><RefreshCw size={16} />Refresh</Button></>} />
    {loading ? <LoadingState label="Building investigation graph..." /> : error || !data ? <ErrorState message={error} retry={() => void retry()} /> : <>
      <div className="stats-grid"><StatCard label="Total cases" value={data[0].cases.toLocaleString('en-IN')} detail="Across configured sources" icon={<BriefcaseBusiness />} /><StatCard label="Persons" value={data[0].persons.toLocaleString('en-IN')} detail="Normalized entities" icon={<Users />} /><StatCard label="Phones" value={data[0].phones.toLocaleString('en-IN')} detail={`${data[0].cdrRecords.toLocaleString('en-IN')} CDR records`} icon={<Phone />} /><StatCard label="Transactions" value={data[0].transactions.toLocaleString('en-IN')} detail="Evidence-linked records" icon={<WalletCards />} /></div>
      <Panel title="Multi-case knowledge graph" subtitle="Connections across four demonstration investigations" actions={<div className="filter-row"><select value={selectedCases.length === 1 ? selectedCases[0] : ''} onChange={(e) => setSelectedCases(e.target.value ? [e.target.value] : [])} aria-label="Case scope"><option value="">All cases</option>{cases.map((item) => <option key={item.case_id}>{item.case_id}</option>)}</select><Button variant="quiet" onClick={() => setSelectedCases([])}><Network size={15} />Reset scope</Button></div>}><GraphView data={data[1]} onNodeSelect={(item) => { setEdge(undefined); setNode(item); }} onEdgeSelect={(item) => { setNode(undefined); setEdge(item); }} /></Panel>
      <div className="dashboard-bottom"><Panel title="Recent investigation activity"><div className="activity-list">{timelineEvents.slice(0, 4).map((event) => <article key={event.event_id}><span className="activity-icon"><Activity size={15} /></span><div><strong>{event.event_type}</strong><p>{event.notes}</p><small>{event.case_id} · {new Date(event.timestamp).toLocaleDateString('en-IN')}</small></div></article>)}</div></Panel><Panel title="Top investigative leads" subtitle="Prioritized by mock service response"><div className="insight-list"><article><i className="high" /><div><strong>Shared vehicle across cases</strong><p>VH-0201 connects CASE-001 and CASE-017 through two supporting records.</p><span>High priority · Verify evidence</span></div></article><article><i className="medium" /><div><strong>Multi-hop financial path</strong><p>Two accounts connect CASE-017 and CASE-024 through TX-0204.</p><span>Medium priority · 3 hops</span></div></article><article><i className="medium" /><div><strong>Location overlap</strong><p>L-11 appears in distinct event records for two people.</p><span>Medium priority · Human review</span></div></article></div></Panel></div>
    </>}
    <EntityDetailsPanel node={node} onClose={() => setNode(undefined)} /><EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
  </>;
}
