import { useCallback, useMemo, useState } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EvidenceDrawer, EntityDetailsPanel } from '../components/Drawers';
import { GraphView } from '../components/GraphView';
import { Button, ErrorState, LoadingState, PageHeader, Panel } from '../components/ui';
import { cases } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';
import type { EntityType, GraphEdge, GraphNode } from '../types/domain';

export function GraphPage() {
  const [params, setParams] = useSearchParams(); const [node, setNode] = useState<GraphNode>(); const [edge, setEdge] = useState<GraphEdge>();
  const caseId = params.get('caseId') ?? ''; const entityType = params.get('entityType') ?? '';
  const loader = useCallback(() => investigationService.getGraph(caseId ? [caseId] : undefined), [caseId]);
  const { data, loading, error, retry } = useAsync(loader, [loader]);
  const filtered = useMemo(() => !data || !entityType ? data : { nodes: data.nodes.filter((n) => n.type === entityType || n.type === 'case'), edges: data.edges.filter((e) => { const ids = new Set(data.nodes.filter((n) => n.type === entityType || n.type === 'case').map((n) => n.id)); return ids.has(e.source) && ids.has(e.target); }) }, [data, entityType]);
  const update = (key: string, value: string) => setParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; });
  return <><PageHeader eyebrow="Dataset-agnostic network" title="Knowledge Graph" description="Explore normalized relationships and inspect the supporting records behind every visible link." />
    <Panel className="graph-page-panel" title="Investigation network" subtitle={caseId ? `Single-case scope: ${caseId}` : 'Multi-case scope: all demonstration cases'} actions={<Button variant="quiet" onClick={() => setParams({})}><RotateCcw size={15} />Reset filters</Button>}><div className="graph-filter-bar"><Filter size={15} /><label>Case<select value={caseId} onChange={(e) => update('caseId', e.target.value)}><option value="">All cases</option>{cases.map((item) => <option key={item.case_id}>{item.case_id}</option>)}</select></label><label>Entity type<select value={entityType} onChange={(e) => update('entityType', e.target.value)}><option value="">All entities</option>{(['person', 'phone', 'vehicle', 'account', 'transaction', 'location'] as EntityType[]).map((item) => <option key={item}>{item}</option>)}</select></label><label>Date from<input type="date" onChange={(e) => update('dateFrom', e.target.value)} /></label><label>Source<select><option>Synthetic NexusNet Data</option></select></label></div>{loading ? <LoadingState label="Building investigation graph..." /> : error || !filtered ? <ErrorState message={error} retry={() => void retry()} /> : <GraphView data={filtered} onNodeSelect={(v) => { setEdge(undefined); setNode(v); }} onEdgeSelect={(v) => { setNode(undefined); setEdge(v); }} />}</Panel>
    <EntityDetailsPanel node={node} onClose={() => setNode(undefined)} /><EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
  </>;
}
