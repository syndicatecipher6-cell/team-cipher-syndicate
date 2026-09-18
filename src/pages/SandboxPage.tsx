import { useMemo, useState } from 'react';
import { FlaskConical, ShieldCheck } from 'lucide-react';
import { SandboxGraphComparison } from '../components/SandboxGraphComparison';
import { Button, PageHeader, Panel } from '../components/ui';
import { useInvestigation } from '../context/InvestigationContext';
import { mockInvestigationService } from '../services/mockInvestigationService';
import type { GraphData, GraphEdge, SandboxModification, SandboxOperation, SandboxSession } from '../types/domain';

const operations: Array<{ value: SandboxOperation; label: string }> = [
  { value: 'IDENTITY_MERGE', label: 'Assume two identities are the same' },
  { value: 'RELATIONSHIP_ADD', label: 'Add a hypothetical relationship' },
  { value: 'RELATIONSHIP_REMOVE', label: 'Remove a relationship' },
  { value: 'EVIDENCE_DISPUTE', label: 'Dispute an evidence item' },
  { value: 'ENTITY_SPLIT', label: 'Split one identity into two' },
  { value: 'TIMELINE_CHANGE', label: 'Change a timeline event' },
];

function scopedGraph(graph: GraphData, baseCaseId: string): GraphData {
  const nodeIds = new Set([baseCaseId]);
  let changed = true;
  while (changed) {
    changed = false;
    graph.edges.forEach((edge) => {
      if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
        if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) changed = true;
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    });
  }
  return {
    nodes: graph.nodes.filter((node) => nodeIds.has(node.id)),
    edges: graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  };
}

function applyHypotheticalChanges(original: GraphData, modifications: SandboxModification[]): GraphData {
  const graph: GraphData = {
    nodes: original.nodes.map((node) => ({ ...node, metadata: { ...node.metadata } })),
    edges: original.edges.map((edge) => ({ ...edge, evidenceIds: [...edge.evidenceIds] })),
  };

  modifications.forEach((modification) => {
    const parameters = modification.parameters;
    if (modification.operation === 'IDENTITY_MERGE') {
      const source = String(parameters.source_entity_id);
      const target = String(parameters.target_entity_id);
      graph.nodes = graph.nodes.filter((node) => node.id !== source);
      graph.edges = graph.edges
        .map((edge) => ({
          ...edge,
          source: edge.source === source ? target : edge.source,
          target: edge.target === source ? target : edge.target,
        }))
        .filter((edge) => edge.source !== edge.target);
      const seen = new Set<string>();
      graph.edges = graph.edges.filter((edge) => {
        const key = `${edge.source}|${edge.relationship}|${edge.target}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } else if (modification.operation === 'RELATIONSHIP_ADD') {
      graph.edges.push({
        id: `SBX-EDGE-${modification.modification_id}`,
        source: String(parameters.source),
        target: String(parameters.target),
        relationship: String(parameters.relationship).toUpperCase(),
        evidenceIds: [...(modification.evidence_ids ?? [])],
        priority: 'Low',
      });
    } else if (modification.operation === 'RELATIONSHIP_REMOVE') {
      graph.edges = graph.edges.filter((edge) => edge.id !== String(parameters.edge_id));
    } else if (modification.operation === 'EVIDENCE_DISPUTE') {
      const evidenceId = String(parameters.evidence_id);
      graph.edges = graph.edges.map((edge) => ({
        ...edge,
        evidenceIds: edge.evidenceIds.filter((id) => id !== evidenceId),
      }));
    } else if (modification.operation === 'ENTITY_SPLIT') {
      const originalNode = graph.nodes.find((node) => node.id === String(parameters.entity_id));
      if (!originalNode) return;
      const newId = String(parameters.new_entity_id);
      graph.nodes.push({
        ...originalNode,
        id: newId,
        label: String(parameters.new_label || `${originalNode.label} (hypothetical split)`),
        metadata: { ...originalNode.metadata, sandboxLabel: 'HYPOTHETICAL / SANDBOX' },
      });
      const selectedEdgeIds = new Set(Array.isArray(parameters.edge_ids) ? parameters.edge_ids.map(String) : []);
      graph.edges = graph.edges.map((edge): GraphEdge => selectedEdgeIds.has(edge.id) ? {
        ...edge,
        source: edge.source === originalNode.id ? newId : edge.source,
        target: edge.target === originalNode.id ? newId : edge.target,
      } : edge);
    }
  });
  return graph;
}

export function SandboxPage() {
  const { dataset, isDataLoaded } = useInvestigation();
  const [baseCaseId, setBaseCaseId] = useState(dataset.cases[0]?.case_id ?? '');
  const [operation, setOperation] = useState<SandboxOperation>('IDENTITY_MERGE');
  const [firstValue, setFirstValue] = useState('');
  const [secondValue, setSecondValue] = useState('');
  const [relationship, setRelationship] = useState('ASSOCIATED_WITH');
  const [rationale, setRationale] = useState('');
  const [session, setSession] = useState<SandboxSession>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const beforeGraph = useMemo(
    () => scopedGraph(dataset.graphData, baseCaseId),
    [dataset.graphData, baseCaseId],
  );
  const entityOptions = useMemo(
    () => beforeGraph.nodes.filter((node) => node.type !== 'case'),
    [beforeGraph.nodes],
  );
  const afterGraph = useMemo(
    () => applyHypotheticalChanges(beforeGraph, session?.modifications ?? []),
    [beforeGraph, session?.modifications],
  );

  const createSession = async () => {
    if (!baseCaseId) return;
    setLoading(true);
    setError('');
    try {
      setSession(await mockInvestigationService.createSandbox(baseCaseId));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not create sandbox.');
    } finally {
      setLoading(false);
    }
  };

  const applyChange = async () => {
    if (!session) return;
    const parameters: Record<string, unknown> = {};
    if (operation === 'IDENTITY_MERGE') {
      parameters.source_entity_id = firstValue;
      parameters.target_entity_id = secondValue;
    } else if (operation === 'RELATIONSHIP_ADD') {
      parameters.source = firstValue;
      parameters.target = secondValue;
      parameters.relationship = relationship;
    } else if (operation === 'RELATIONSHIP_REMOVE') {
      parameters.edge_id = firstValue;
    } else if (operation === 'EVIDENCE_DISPUTE') {
      parameters.evidence_id = firstValue;
    } else if (operation === 'ENTITY_SPLIT') {
      parameters.entity_id = firstValue;
      parameters.new_entity_id = secondValue;
      parameters.new_label = `${secondValue} (hypothetical split)`;
      parameters.edge_ids = [];
    } else {
      parameters.event_id = firstValue;
      parameters.timestamp = secondValue;
    }

    setLoading(true);
    setError('');
    try {
      const updated = await mockInvestigationService.applySandboxModification(session.sandbox_id, {
        operation,
        parameters,
        rationale,
        evidence_ids: operation === 'EVIDENCE_DISPUTE' && firstValue ? [firstValue] : [],
      });
      setSession(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not apply sandbox change.');
    } finally {
      setLoading(false);
    }
  };

  const useEntitySelectors = operation === 'IDENTITY_MERGE' || operation === 'RELATIONSHIP_ADD';

  return (
    <>
      <PageHeader
        eyebrow="HYPOTHETICAL / SANDBOX"
        title="Investigation Sandbox"
        description="Test what-if graph changes in a temporary branch. Production records are never modified."
      />

      {!isDataLoaded ? (
        <div className="clean-workspace-card">
          <FlaskConical size={36} />
          <h2>No investigation graph available</h2>
          <p>Upload an FIR or investigation dataset before creating a hypothetical branch.</p>
        </div>
      ) : (
        <div className="sandbox-layout">
          <Panel title="Sandbox controls" subtitle="Every operation is isolated and audit logged">
            <div className="sandbox-form">
              <label>Base case<select value={baseCaseId} onChange={(event) => setBaseCaseId(event.target.value)} disabled={!!session}>
                {dataset.cases.map((item) => <option key={item.case_id} value={item.case_id}>{item.case_id}</option>)}
              </select></label>
              {!session ? (
                <Button onClick={createSession} disabled={loading || !baseCaseId}>Create temporary branch</Button>
              ) : (
                <>
                  <div className="sandbox-label"><ShieldCheck size={15} />{session.label} · {session.sandbox_id}</div>
                  <label>What-if operation<select value={operation} onChange={(event) => setOperation(event.target.value as SandboxOperation)}>
                    {operations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select></label>

                  {useEntitySelectors ? (
                    <>
                      <label>First entity<select value={firstValue} onChange={(event) => setFirstValue(event.target.value)}><option value="">Select entity</option>{entityOptions.map((node) => <option key={node.id} value={node.id}>{node.label} · {node.id}</option>)}</select></label>
                      <label>Second entity<select value={secondValue} onChange={(event) => setSecondValue(event.target.value)}><option value="">Select entity</option>{entityOptions.map((node) => <option key={node.id} value={node.id}>{node.label} · {node.id}</option>)}</select></label>
                    </>
                  ) : (
                    <>
                      <label>{operation === 'RELATIONSHIP_REMOVE' ? 'Relationship ID' : operation === 'EVIDENCE_DISPUTE' ? 'Evidence ID' : operation === 'ENTITY_SPLIT' ? 'Entity ID' : 'Timeline event ID'}<input value={firstValue} onChange={(event) => setFirstValue(event.target.value)} /></label>
                      {(operation === 'ENTITY_SPLIT' || operation === 'TIMELINE_CHANGE') && <label>{operation === 'ENTITY_SPLIT' ? 'New entity ID' : 'Hypothetical timestamp'}<input value={secondValue} onChange={(event) => setSecondValue(event.target.value)} /></label>}
                    </>
                  )}
                  {operation === 'RELATIONSHIP_ADD' && <label>Relationship label<input value={relationship} onChange={(event) => setRelationship(event.target.value)} /></label>}
                  <label>Investigator rationale<textarea rows={3} value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="Why is this assumption being tested?" /></label>
                  <Button onClick={applyChange} disabled={loading || !firstValue || (useEntitySelectors && !secondValue)}>Apply hypothetical change</Button>
                </>
              )}
              {error && <p className="service-disclaimer">{error}</p>}
            </div>
          </Panel>

          <Panel title="Before vs After" subtitle="Recalculated graph, paths, communities, cases, timeline and LPI">
            {session?.comparison ? (
              <div className="sandbox-comparison">
                <div><span>Metric</span><strong>Before</strong><strong>After</strong></div>
                <div><span>Entities</span><strong>{session.comparison.before.node_count}</strong><strong>{session.comparison.after.node_count}</strong></div>
                <div><span>Relationships</span><strong>{session.comparison.before.relationship_count}</strong><strong>{session.comparison.after.relationship_count}</strong></div>
                <div><span>Multi-hop paths</span><strong>{session.comparison.before.multi_hop_path_count}</strong><strong>{session.comparison.after.multi_hop_path_count}</strong></div>
                <div><span>Communities</span><strong>{session.comparison.before.community_count}</strong><strong>{session.comparison.after.community_count}</strong></div>
                <div><span>Timeline changes</span><strong>{session.comparison.before.timeline_change_count}</strong><strong>{session.comparison.after.timeline_change_count}</strong></div>
                <section>
                  <h3>Impact</h3>
                  {session.comparison.impact_summary.map((item) => <p key={item}>{item}</p>)}
                </section>
                <section>
                  <h3>Modification log</h3>
                  {session.modifications.length ? session.modifications.map((item) => (
                    <p key={item.modification_id}><strong>{item.operation}</strong> · {item.rationale || 'No rationale supplied'}</p>
                  )) : <p>No hypothetical modifications applied yet.</p>}
                </section>
                <SandboxGraphComparison before={beforeGraph} after={afterGraph} modifications={session.modifications} />
              </div>
            ) : <div className="context-placeholder"><FlaskConical /><strong>Create a sandbox session</strong><p>A before-versus-after comparison will appear here.</p></div>}
          </Panel>
        </div>
      )}
    </>
  );
}
