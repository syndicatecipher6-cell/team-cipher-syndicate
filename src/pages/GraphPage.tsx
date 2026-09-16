import { useMemo, useState } from 'react';
import { Filter, RotateCcw, UploadCloud, Sparkles, Network } from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { EvidenceDrawer, EntityDetailsPanel } from '../components/Drawers';
import { GraphView } from '../components/GraphView';
import { Button, PageHeader, Panel } from '../components/ui';
import { useInvestigation } from '../context/InvestigationContext';
import type { EntityType, GraphEdge, GraphNode } from '../types/domain';

export function GraphPage() {
  const [params, setParams] = useSearchParams();
  const [node, setNode] = useState<GraphNode>();
  const [edge, setEdge] = useState<GraphEdge>();
  const navigate = useNavigate();
  const { dataset, isDataLoaded, loadSampleSIHData } = useInvestigation();

  const caseId = params.get('caseId') ?? '';
  const entityType = params.get('entityType') ?? '';

  const graphData = dataset.graphData;

  const filtered = useMemo(() => {
    let current = graphData;
    if (caseId) {
      const nodeIds = new Set([caseId]);
      current.edges.forEach((e) => {
        if (e.source === caseId || e.target === caseId) {
          nodeIds.add(e.source);
          nodeIds.add(e.target);
        }
      });
      current = {
        nodes: current.nodes.filter((n) => nodeIds.has(n.id)),
        edges: current.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
      };
    }

    if (entityType) {
      current = {
        nodes: current.nodes.filter((n) => n.type === entityType || n.type === 'case'),
        edges: current.edges.filter((e) => {
          const ids = new Set(current.nodes.filter((n) => n.type === entityType || n.type === 'case').map((n) => n.id));
          return ids.has(e.source) && ids.has(e.target);
        }),
      };
    }
    return current;
  }, [graphData, caseId, entityType]);

  const update = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      return next;
    });

  return (
    <>
      <PageHeader
        eyebrow="Dataset-agnostic network"
        title="Knowledge Graph"
        description="Explore normalized relationships and inspect the supporting records behind every visible link."
      />

      {!isDataLoaded || graphData.nodes.length === 0 ? (
        <div className="clean-workspace-card">
          <div className="clean-icon-circle">
            <Network size={36} />
          </div>
          <h2>No Knowledge Graph Generated Yet</h2>
          <p>
            The graph engine is clean and idle. Upload investigation files (CDRs, FIRs, bank statements)
            in <strong>Data Ingestion</strong> to automatically construct the criminal relationship graph.
          </p>
          <div className="clean-actions-row">
            <button className="primary-action-btn" onClick={() => navigate('/ingestion')}>
              <UploadCloud size={16} />
              Go to Data Ingestion
            </button>
            <button className="secondary-action-btn" onClick={() => void loadSampleSIHData()}>
              <Sparkles size={16} />
              Load Sample SIH Dataset
            </button>
          </div>
        </div>
      ) : (
        <Panel
          className="graph-page-panel"
          title="Investigation network"
          subtitle={caseId ? `Single-case scope: ${caseId}` : `Full scope: ${filtered.nodes.length} nodes, ${filtered.edges.length} edges`}
          actions={
            <Button variant="quiet" onClick={() => setParams({})}>
              <RotateCcw size={15} />
              Reset filters
            </Button>
          }
        >
          <div className="graph-filter-bar">
            <Filter size={15} />
            <label>
              Case
              <select value={caseId} onChange={(e) => update('caseId', e.target.value)}>
                <option value="">All cases</option>
                {dataset.cases.map((item) => (
                  <option key={item.case_id} value={item.case_id}>
                    {item.case_id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Entity type
              <select value={entityType} onChange={(e) => update('entityType', e.target.value)}>
                <option value="">All entities</option>
                {(['person', 'phone', 'vehicle', 'account', 'transaction', 'location'] as EntityType[]).map(
                  (item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <GraphView
            data={filtered}
            onNodeSelect={(v) => {
              setEdge(undefined);
              setNode(v);
            }}
            onEdgeSelect={(v) => {
              setNode(undefined);
              setEdge(v);
            }}
          />
        </Panel>
      )}

      <EntityDetailsPanel node={node} onClose={() => setNode(undefined)} />
      <EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
    </>
  );
}
