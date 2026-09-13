import { assistantDemo, cases, dashboardStats, dataSources, evidence, graphData, persons, searchResults, timelineEvents } from '../data/mockData';
import type { InvestigationService } from './contracts';

const pause = <T,>(value: T, ms = 140) => new Promise<T>((resolve) => window.setTimeout(() => resolve(value), ms));

export const mockInvestigationService: InvestigationService = {
  getDashboardStats: () => pause(dashboardStats),
  getCases: () => pause(cases),
  getCase: (caseId) => pause(cases.find((item) => item.case_id === caseId)),
  getPersons: () => pause(persons),
  getPerson: (personId) => pause(persons.find((item) => item.person_id === personId)),
  searchEntities: (query, type) => {
    const needle = query.trim().toLowerCase();
    const result = searchResults.filter((item) => (!type || type === 'all' || item.type === type) && (!needle || `${item.label} ${item.secondary} ${item.id}`.toLowerCase().includes(needle)));
    return pause(result);
  },
  getGraph: (caseIds) => {
    if (!caseIds?.length) return pause(graphData);
    const nodeIds = new Set(caseIds);
    graphData.edges.forEach((edge) => {
      if (caseIds.includes(edge.source) || caseIds.includes(edge.target)) { nodeIds.add(edge.source); nodeIds.add(edge.target); }
    });
    let changed = true;
    while (changed) {
      changed = false;
      graphData.edges.forEach((edge) => {
        if (nodeIds.has(edge.source) || nodeIds.has(edge.target)) {
          if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) changed = true;
          nodeIds.add(edge.source); nodeIds.add(edge.target);
        }
      });
    }
    return pause({ nodes: graphData.nodes.filter((n) => nodeIds.has(n.id)), edges: graphData.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target)) });
  },
  getEvidence: (filters) => pause(evidence.filter((item) => (!filters?.caseId || item.case_id === filters.caseId) && (!filters?.priority || item.priority === filters.priority))),
  getTimeline: (filters) => pause(timelineEvents.filter((item) => (!filters?.caseId || item.case_id === filters.caseId) && (!filters?.eventType || item.event_type === filters.eventType))),
  getDataSources: () => pause(dataSources),
  findHiddenConnection: (startEntityId, endEntityId) => {
    const threeHop = startEntityId === 'P-0188' && endEntityId === 'AC-0541';
    const nodeIds = threeHop ? [startEntityId, 'AC-0204', 'TX-0204', endEntityId] : [startEntityId, 'PH-0104', endEntityId];
    const edgeIds = threeHop ? ['E-05', 'E-06', 'E-07'] : ['E-02', 'E-03'];
    return pause({ graph: { nodes: graphData.nodes.filter((node) => nodeIds.includes(node.id)), edges: graphData.edges.filter((edge) => edgeIds.includes(edge.id)) }, orderedNodeIds: nodeIds, orderedEdgeIds: edgeIds, hopCount: edgeIds.length, evidenceIds: edgeIds.flatMap((id) => graphData.edges.find((edge) => edge.id === id)?.evidenceIds ?? []), priority: threeHop ? 'Medium' as const : 'High' as const });
  },
  findCrossCaseConnections: async (caseIds) => {
    const graph = await mockInvestigationService.getGraph(caseIds);
    const candidates = [
      { caseIds: ['CASE-001', 'CASE-017'], sharedEntityId: 'VH-0201', sharedEntityType: 'vehicle' as const, relationship: 'Vehicle recorded across case material', supportingRecordIds: ['VEHICLE-LINK-201', 'EVENT-211'], evidenceIds: ['EV-112', 'EV-113'], priority: 'Medium' as const },
      { caseIds: ['CASE-017', 'CASE-024'], sharedEntityId: 'TX-0204', sharedEntityType: 'transaction' as const, relationship: 'Account-to-account transaction path', supportingRecordIds: ['ACCOUNT-LINK-204', 'TXN-0204', 'ACCOUNT-LINK-541'], evidenceIds: ['EV-105', 'EV-106', 'EV-107'], priority: 'High' as const },
      { caseIds: ['CASE-024', 'CASE-031'], sharedEntityId: 'L-11', sharedEntityType: 'location' as const, relationship: 'Location appears in separate event records', supportingRecordIds: ['EVENT-182', 'EVENT-199'], evidenceIds: ['EV-109', 'EV-110'], priority: 'Medium' as const },
    ];
    return pause({ graph, connections: candidates.filter((item) => item.caseIds.every((id) => caseIds.includes(id))) });
  },
  askInvestigator: () => pause(assistantDemo, 500),
};
