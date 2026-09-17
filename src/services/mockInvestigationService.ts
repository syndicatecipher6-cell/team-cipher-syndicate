import {
  assistantDemo,
  cases,
  dashboardStats,
  dataSources,
  evidence,
  graphData,
  persons,
  searchResults,
  timelineEvents,
} from '../data/mockData';
import type { InvestigationService } from './contracts';
import type {
  AssistantResponse,
  CrossCaseConnection,
  Priority,
  SandboxModificationInput,
  SandboxSession,
} from '../types/domain';
import { answerLocalInvestigation } from './localInvestigator';

const pause = <T,>(value: T, ms = 120) =>
  new Promise<T>((resolve) => window.setTimeout(() => resolve(value), ms));

const localSandboxes = new Map<string, SandboxSession>();

function localSandboxMetrics() {
  return {
    node_count: graphData.nodes.length,
    relationship_count: graphData.edges.length,
    community_count: graphData.nodes.length ? 1 : 0,
    affected_cases: graphData.nodes.filter((node) => node.type === 'case').map((node) => node.id),
    multi_hop_path_count: graphData.edges.length,
    lpi: {},
    timeline_change_count: 0,
  };
}

function createLocalSandbox(baseCaseId: string): SandboxSession {
  const now = new Date().toISOString();
  const metrics = localSandboxMetrics();
  return {
    sandbox_id: `LOCAL-SBX-${Date.now()}`,
    base_case_id: baseCaseId,
    created_by: 'local-investigator',
    created_at: now,
    updated_at: now,
    status: 'active',
    label: 'HYPOTHETICAL / SANDBOX',
    modifications: [],
    comparison: {
      before: metrics,
      after: metrics,
      added_nodes: [],
      removed_nodes: [],
      added_relationships: [],
      removed_relationships: [],
      impact_summary: ['Local fallback records the hypothetical change without modifying investigation data.'],
    },
  };
}

export const mockInvestigationService: InvestigationService = {
  getDashboardStats: () => pause(dashboardStats),
  getCases: () => pause(cases),
  getCase: (caseId) => pause(cases.find((item) => item.case_id === caseId)),
  getPersons: () => pause(persons),
  getPerson: (personId) => pause(persons.find((item) => item.person_id === personId)),

  searchEntities: (query, type) => {
    const needle = query.trim().toLowerCase();
    const result = searchResults.filter(
      (item) =>
        (!type || type === 'all' || item.type === type) &&
        (!needle || `${item.label} ${item.secondary} ${item.id}`.toLowerCase().includes(needle))
    );
    return pause(result);
  },

  getGraph: (caseIds) => {
    if (!caseIds?.length) return pause(graphData);
    const nodeIds = new Set(caseIds);
    graphData.edges.forEach((edge) => {
      if (caseIds.includes(edge.source) || caseIds.includes(edge.target)) {
        nodeIds.add(edge.source);
        nodeIds.add(edge.target);
      }
    });
    let changed = true;
    while (changed) {
      changed = false;
      graphData.edges.forEach((edge) => {
        if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
          if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) changed = true;
          nodeIds.add(edge.source);
          nodeIds.add(edge.target);
        }
      });
    }
    return pause({
      nodes: graphData.nodes.filter((n) => nodeIds.has(n.id)),
      edges: graphData.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)),
    });
  },

  getEvidence: (filters) =>
    pause(
      evidence.filter(
        (item) =>
          (!filters?.caseId || item.case_id === filters.caseId) &&
          (!filters?.priority || item.priority === filters.priority)
      )
    ),

  getTimeline: (filters) =>
    pause(
      timelineEvents.filter(
        (item) =>
          (!filters?.caseId || item.case_id === filters.caseId) &&
          (!filters?.eventType || item.event_type === filters.eventType)
      )
    ),

  getDataSources: () => pause(dataSources),

  findHiddenConnection: (startEntityId, endEntityId) => {
    // If no data loaded or invalid query, return clean empty result
    if (
      !startEntityId ||
      !endEntityId ||
      graphData.nodes.length === 0 ||
      startEntityId === endEntityId
    ) {
      return pause({
        graph: { nodes: [], edges: [] },
        orderedNodeIds: [],
        orderedEdgeIds: [],
        hopCount: 0,
        evidenceIds: [],
        priority: 'Low',
      });
    }

    // Build undirected adjacency list from current active graph
    const adj = new Map<
      string,
      Array<{ neighbor: string; edgeId: string; priority: Priority; evidenceIds: string[] }>
    >();
    graphData.nodes.forEach((n) => adj.set(n.id, []));
    graphData.edges.forEach((e) => {
      adj.get(e.source)?.push({
        neighbor: e.target,
        edgeId: e.id,
        priority: e.priority ?? 'Medium',
        evidenceIds: e.evidenceIds ?? [],
      });
      adj.get(e.target)?.push({
        neighbor: e.source,
        edgeId: e.id,
        priority: e.priority ?? 'Medium',
        evidenceIds: e.evidenceIds ?? [],
      });
    });

    // BFS shortest path search
    const queue: string[] = [startEntityId];
    const visited = new Set<string>([startEntityId]);
    const parent = new Map<
      string,
      { node: string; edgeId: string; priority: Priority; evidenceIds: string[] }
    >();

    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === endEntityId) {
        found = true;
        break;
      }
      const neighbors = adj.get(current) || [];
      for (const next of neighbors) {
        if (!visited.has(next.neighbor)) {
          visited.add(next.neighbor);
          parent.set(next.neighbor, {
            node: current,
            edgeId: next.edgeId,
            priority: next.priority,
            evidenceIds: next.evidenceIds,
          });
          queue.push(next.neighbor);
        }
      }
    }

    if (!found) {
      return pause({
        graph: { nodes: [], edges: [] },
        orderedNodeIds: [],
        orderedEdgeIds: [],
        hopCount: 0,
        evidenceIds: [],
        priority: 'Low',
      });
    }

    // Reconstruct path
    const orderedNodeIds: string[] = [];
    const orderedEdgeIds: string[] = [];
    const evidenceIds: string[] = [];
    let hasHigh = false;

    let curr: string | undefined = endEntityId;
    while (curr && curr !== startEntityId) {
      orderedNodeIds.unshift(curr);
      const edgeInfo = parent.get(curr);
      if (!edgeInfo) break;
      orderedEdgeIds.unshift(edgeInfo.edgeId);
      evidenceIds.push(...edgeInfo.evidenceIds);
      if (edgeInfo.priority === 'High') hasHigh = true;
      curr = edgeInfo.node;
    }
    orderedNodeIds.unshift(startEntityId);

    const pathNodes = graphData.nodes.filter((n) => orderedNodeIds.includes(n.id));
    const pathEdges = graphData.edges.filter((e) => orderedEdgeIds.includes(e.id));

    return pause({
      graph: { nodes: pathNodes, edges: pathEdges },
      orderedNodeIds,
      orderedEdgeIds,
      hopCount: orderedEdgeIds.length,
      evidenceIds: Array.from(new Set(evidenceIds)),
      priority: hasHigh ? 'High' : 'Medium',
    });
  },

  findCrossCaseConnections: async (caseIds) => {
    // If no cases or data is clean, return empty
    if (!caseIds || caseIds.length < 2 || cases.length === 0 || graphData.nodes.length === 0) {
      return pause({
        graph: { nodes: [], edges: [] },
        connections: [],
      });
    }

    const graph = await mockInvestigationService.getGraph(caseIds);

    // Map each entity to the cases it connects to
    const entityCaseMap = new Map<
      string,
      { caseIds: Set<string>; edgeIds: string[]; evidenceIds: string[] }
    >();

    graph.edges.forEach((edge) => {
      caseIds.forEach((cId) => {
        let other: string | null = null;
        if (edge.source === cId) other = edge.target;
        else if (edge.target === cId) other = edge.source;

        if (other && !caseIds.includes(other)) {
          if (!entityCaseMap.has(other)) {
            entityCaseMap.set(other, { caseIds: new Set(), edgeIds: [], evidenceIds: [] });
          }
          const entry = entityCaseMap.get(other)!;
          entry.caseIds.add(cId);
          entry.edgeIds.push(edge.id);
          if (edge.evidenceIds) entry.evidenceIds.push(...edge.evidenceIds);
        }
      });
    });

    const connections: CrossCaseConnection[] = [];
    entityCaseMap.forEach((entry, entityId) => {
      if (entry.caseIds.size >= 2) {
        const node = graph.nodes.find((n) => n.id === entityId);
        const entityCases = Array.from(entry.caseIds);
        connections.push({
          caseIds: entityCases,
          sharedEntityId: entityId,
          sharedEntityType: node?.type ?? 'person',
          relationship: `${node?.type ?? 'Entity'} shared across ${entityCases.join(' and ')}`,
          supportingRecordIds: entry.edgeIds,
          evidenceIds: Array.from(new Set(entry.evidenceIds)),
          priority: 'High',
        });
      }
    });

    return pause({ graph, connections });
  },

  askInvestigator: (question) => {
    // If clean initial state (no files uploaded yet)
    if (cases.length === 0 && graphData.nodes.length === 0) {
      return pause(assistantDemo, 400);
    }

    return pause<AssistantResponse>(answerLocalInvestigation(question, {
      cases,
      persons,
      evidence,
      graph: graphData,
      timeline: timelineEvents,
    }), 500);
  },

  getCaseIntelligenceBrief: (caseId) => {
    const caseRecord = cases.find((item) => item.case_id === caseId);
    const caseEvidence = evidence.filter((item) => item.case_id === caseId);
    const caseEntityIds = Array.from(new Set(caseEvidence.flatMap((item) => [item.entityA, item.entityB])))
      .filter((id) => id !== caseId);
    const linkedCases = Array.from(new Set(
      graphData.edges
        .filter((edge) => caseEntityIds.includes(edge.source) || caseEntityIds.includes(edge.target))
        .flatMap((edge) => [edge.source, edge.target])
        .filter((id) => id.startsWith('CASE-') && id !== caseId),
    ));
    return pause({
      case_id: caseId,
      overview: caseRecord
        ? `${caseId} is recorded as ${caseRecord.crime_type} with ${caseEvidence.length} cited evidence item(s).`
        : `${caseId} has no locally available case summary.`,
      key_entities: caseEntityIds,
      relationships: Array.from(new Set(caseEvidence.map((item) => item.relationship))),
      linked_cases: linkedCases,
      evidence: caseEvidence.map((item) => ({
        evidence_id: item.evidence_id,
        source_dataset: item.provenance.sourceDataset,
        source_record_id: item.provenance.sourceRecordId,
        record_type: item.provenance.recordType,
        excerpt: item.supportingData,
      })),
      timeline: timelineEvents
        .filter((item) => item.case_id === caseId)
        .map((item) => `${item.timestamp}: ${item.event_type} — ${item.notes}`),
      contradictions: [],
      gaps: caseEvidence.length ? [] : ['No evidence records are currently linked to this case.'],
      hypotheses: [],
      priorities: ['Verify all inferred links against the cited source records.'],
      generated_by: 'local grounded analysis',
      warnings: ['This brief is analytical support and does not establish guilt.'],
    });
  },

  createSandbox: (baseCaseId) => {
    const session = createLocalSandbox(baseCaseId);
    localSandboxes.set(session.sandbox_id, session);
    return pause(session);
  },

  getSandbox: (sandboxId) => {
    const session = localSandboxes.get(sandboxId);
    if (!session) return Promise.reject(new Error('Sandbox session not found.'));
    return pause(session);
  },

  applySandboxModification: (sandboxId, change: SandboxModificationInput) => {
    const session = localSandboxes.get(sandboxId);
    if (!session) return Promise.reject(new Error('Sandbox session not found.'));
    const modificationId = `LOCAL-MOD-${Date.now()}`;
    const currentComparison = session.comparison!;
    const after = {
      ...currentComparison.after,
      affected_cases: [...currentComparison.after.affected_cases],
      lpi: { ...currentComparison.after.lpi },
    };
    const addedNodes = [...currentComparison.added_nodes];
    const removedNodes = [...currentComparison.removed_nodes];
    const addedRelationships = [...currentComparison.added_relationships];
    const removedRelationships = [...currentComparison.removed_relationships];

    if (change.operation === 'IDENTITY_MERGE') {
      after.node_count = Math.max(0, after.node_count - 1);
      removedNodes.push(String(change.parameters.source_entity_id));
    } else if (change.operation === 'RELATIONSHIP_ADD') {
      after.relationship_count += 1;
      after.multi_hop_path_count += 1;
      addedRelationships.push(`LOCAL-EDGE-${modificationId}`);
    } else if (change.operation === 'RELATIONSHIP_REMOVE') {
      after.relationship_count = Math.max(0, after.relationship_count - 1);
      after.multi_hop_path_count = Math.max(0, after.multi_hop_path_count - 1);
      removedRelationships.push(String(change.parameters.edge_id));
    } else if (change.operation === 'ENTITY_SPLIT') {
      after.node_count += 1;
      addedNodes.push(String(change.parameters.new_entity_id));
    } else if (change.operation === 'TIMELINE_CHANGE') {
      after.timeline_change_count += 1;
    }

    const updated: SandboxSession = {
      ...session,
      updated_at: new Date().toISOString(),
      modifications: [
        ...session.modifications,
        {
          ...change,
          rationale: change.rationale ?? '',
          evidence_ids: change.evidence_ids ?? [],
          modification_id: modificationId,
          created_at: new Date().toISOString(),
          created_by: 'local-investigator',
        },
      ],
      comparison: {
        ...currentComparison,
        after,
        added_nodes: addedNodes,
        removed_nodes: removedNodes,
        added_relationships: addedRelationships,
        removed_relationships: removedRelationships,
        impact_summary: [
          `${change.operation} recalculated in the local hypothetical branch.`,
          'Production investigation data was not modified.',
        ],
      },
    };
    localSandboxes.set(sandboxId, updated);
    return pause(updated);
  },
};
