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
} from '../types/domain';

const pause = <T,>(value: T, ms = 120) =>
  new Promise<T>((resolve) => window.setTimeout(() => resolve(value), ms));

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

    const q = question.toLowerCase();

    // Contextual query matching
    const matchedPerson = persons.find(
      (p) => q.includes(p.name.toLowerCase()) || q.includes(p.person_id.toLowerCase())
    );
    const matchedCase = cases.find(
      (c) => q.includes(c.case_id.toLowerCase()) || q.includes(c.crime_type.toLowerCase())
    );

    if (matchedPerson) {
      const relatedCases = matchedPerson.caseIds.join(', ');
      const relEdges = graphData.edges.filter(
        (e) => e.source === matchedPerson.person_id || e.target === matchedPerson.person_id
      );
      const evIds = Array.from(new Set(relEdges.flatMap((e) => e.evidenceIds || [])));

      return pause<AssistantResponse>(
        {
          answer: `Identified profile for ${matchedPerson.name} (${matchedPerson.person_id}) with current status '${matchedPerson.role}'. Connected to case(s): ${relatedCases}. Discovered ${relEdges.length} verified network links across ingested records.`,
          recordCount: relEdges.length,
          entities: [matchedPerson.person_id],
          cases: matchedPerson.caseIds,
          evidenceIds: evIds,
          suggestedQuestions: [
            `What accounts or phones are associated with ${matchedPerson.name}?`,
            `Show timeline events for ${matchedPerson.person_id}`,
            `Are there hidden connections to other suspects?`,
          ],
        },
        500
      );
    }

    if (matchedCase) {
      const casePersons = persons.filter((p) => p.caseIds.includes(matchedCase.case_id));
      const caseEvs = evidence.filter((e) => e.case_id === matchedCase.case_id);

      return pause<AssistantResponse>(
        {
          answer: `Investigation workspace for ${matchedCase.case_id} (${matchedCase.fir_number}). Crime type: ${matchedCase.crime_type} registered in ${matchedCase.district}, ${matchedCase.state}. Active suspects/witnesses: ${casePersons.map((p) => p.name).join(', ') || 'None registered'}. Total supporting evidence items: ${caseEvs.length}.`,
          recordCount: caseEvs.length,
          entities: casePersons.map((p) => p.person_id),
          cases: [matchedCase.case_id],
          evidenceIds: caseEvs.map((e) => e.evidence_id),
          suggestedQuestions: [
            `Find cross-case overlaps for ${matchedCase.case_id}`,
            `Trace communication logs in ${matchedCase.district}`,
            `Generate chronological timeline for ${matchedCase.case_id}`,
          ],
        },
        500
      );
    }

    // General query response based on ingested files
    const topEntities = persons.slice(0, 3).map((p) => p.name);
    return pause<AssistantResponse>(
      {
        answer: `NexusNet analysis of active ingested records: Tracking ${cases.length} case(s), ${persons.length} person(s), and ${graphData.edges.length} graph relationships across jurisdictions. Key entities under observation: ${topEntities.join(', ') || 'None'}. All findings are linked to original source records.`,
        recordCount: graphData.edges.length,
        entities: persons.slice(0, 3).map((p) => p.person_id),
        cases: cases.map((c) => c.case_id),
        evidenceIds: evidence.slice(0, 3).map((e) => e.evidence_id),
        suggestedQuestions: [
          `Find cross-case connections between active cases`,
          `Show highest priority evidence links`,
          `Analyze hidden financial transactions`,
        ],
      },
      500
    );
  },
};
