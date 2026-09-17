import type {
  AssistantResponse,
  CaseRecord,
  Evidence,
  EvidenceCitation,
  GraphData,
  GraphEdge,
  GraphNode,
  InvestigationFinding,
  Person,
  TimelineEvent,
} from '../types/domain';

interface LocalInvestigationData {
  cases: CaseRecord[];
  persons: Person[];
  evidence: Evidence[];
  graph: GraphData;
  timeline: TimelineEvent[];
}

type Intent =
  | 'shared'
  | 'path'
  | 'timeline'
  | 'trails'
  | 'financial'
  | 'communication'
  | 'anomaly'
  | 'evidence'
  | 'entity'
  | 'case'
  | 'summary';

const hasAny = (text: string, terms: string[]) => terms.some((term) => text.includes(term));
const unique = <T,>(items: T[]) => Array.from(new Set(items));

function detectIntent(question: string, matchedPerson?: Person, matchedCase?: CaseRecord): Intent {
  const q = question.toLowerCase();
  const asksFinancial = hasAny(q, ['money', 'financial', 'transaction', 'account', 'bank', 'transfer', 'payment']);
  const asksCommunication = hasAny(q, ['phone', 'call', 'communication', 'contact', 'cdr', 'message']);
  if (hasAny(q, ['shortest path', 'path between', 'how is', 'how are', 'connect', 'relationship', 'linked'])) return 'path';
  if (hasAny(q, ['common', 'shared', 'overlap', 'across case', 'cross-case'])) return 'shared';
  if (hasAny(q, ['timeline', 'chronolog', 'when ', 'sequence', 'before', 'after'])) return 'timeline';
  if (asksFinancial && asksCommunication) return 'trails';
  if (asksFinancial) return 'financial';
  if (asksCommunication) return 'communication';
  if (hasAny(q, ['anomal', 'suspicious', 'unusual', 'high-risk', 'high risk', 'pattern'])) return 'anomaly';
  if (hasAny(q, ['evidence', 'proof', 'source', 'support', 'record'])) return 'evidence';
  if (matchedPerson) return 'entity';
  if (matchedCase) return 'case';
  return 'summary';
}

function citation(item: Evidence): EvidenceCitation {
  return {
    evidence_id: item.evidence_id,
    source_dataset: item.provenance.sourceDataset,
    source_record_id: item.provenance.sourceRecordId,
    record_type: item.provenance.recordType,
    excerpt: item.supportingData,
  };
}

function verifiedFinding(statement: string, items: Evidence[]): InvestigationFinding {
  return {
    status: items.length ? 'Verified Fact' : 'Unresolved',
    statement,
    confidence: items.length ? 1 : 0,
    citations: items.map(citation),
  };
}

function nodeLabel(nodes: Map<string, GraphNode>, id: string) {
  const node = nodes.get(id);
  return node?.label && node.label !== id ? `${node.label} (${id})` : id;
}

function evidenceForEdges(edges: GraphEdge[], allEvidence: Evidence[]) {
  const ids = new Set(edges.flatMap((edge) => edge.evidenceIds ?? []));
  return allEvidence.filter((item) => ids.has(item.evidence_id));
}

function edgeTouches(edge: GraphEdge, ids: Set<string>) {
  return ids.has(edge.source) || ids.has(edge.target);
}

function mentionedNodes(question: string, graph: GraphData) {
  const q = question.toLowerCase();
  return graph.nodes.filter(
    (node) => q.includes(node.id.toLowerCase()) || Boolean(node.label && q.includes(node.label.toLowerCase())),
  );
}

function shortestPath(graph: GraphData, start: string, end: string) {
  const adjacency = new Map<string, Array<{ id: string; edge: GraphEdge }>>();
  graph.nodes.forEach((node) => adjacency.set(node.id, []));
  graph.edges.forEach((edge) => {
    adjacency.get(edge.source)?.push({ id: edge.target, edge });
    adjacency.get(edge.target)?.push({ id: edge.source, edge });
  });
  const queue = [start];
  const visited = new Set([start]);
  const parent = new Map<string, { previous: string; edge: GraphEdge }>();
  while (queue.length) {
    const current = queue.shift()!;
    if (current === end) break;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next.id)) continue;
      visited.add(next.id);
      parent.set(next.id, { previous: current, edge: next.edge });
      queue.push(next.id);
    }
  }
  if (!visited.has(end)) return undefined;
  const nodeIds = [end];
  const edges: GraphEdge[] = [];
  let current = end;
  while (current !== start) {
    const step = parent.get(current);
    if (!step) return undefined;
    edges.unshift(step.edge);
    current = step.previous;
    nodeIds.unshift(current);
  }
  return { nodeIds, edges };
}

function baseResponse(
  answer: string,
  entities: string[],
  caseIds: string[],
  evidenceItems: Evidence[],
  findings: InvestigationFinding[],
  queryPlan: string[],
  suggestions: string[],
): AssistantResponse {
  return {
    answer,
    recordCount: evidenceItems.length,
    entities: unique(entities).slice(0, 20),
    cases: unique(caseIds).slice(0, 20),
    evidenceIds: unique(evidenceItems.map((item) => item.evidence_id)),
    suggestedQuestions: suggestions,
    findings,
    queryPlan,
    provider: 'local-grounded',
    model: 'deterministic graph analysis',
    warnings: [
      'This response is generated only from the currently uploaded records.',
      'Analytical leads do not establish guilt and require investigator verification.',
    ],
  };
}

export function answerLocalInvestigation(
  question: string,
  { cases, persons, evidence, graph, timeline }: LocalInvestigationData,
): AssistantResponse {
  const q = question.trim().toLowerCase();
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const matchedPerson = persons.find(
    (person) => q.includes(person.person_id.toLowerCase()) || q.includes(person.name.toLowerCase()),
  );
  const matchedCase = cases.find(
    (item) => q.includes(item.case_id.toLowerCase()) || q.includes(item.fir_number.toLowerCase()),
  );
  const intent = detectIntent(question, matchedPerson, matchedCase);
  const scopeIds = new Set([
    ...(matchedPerson ? [matchedPerson.person_id] : []),
    ...(matchedCase ? [matchedCase.case_id] : []),
  ]);

  if (intent === 'shared') {
    const activeCaseIds = new Set(cases.map((item) => item.case_id));
    const entityCases = new Map<string, Set<string>>();
    graph.edges.forEach((edge) => {
      const caseId = activeCaseIds.has(edge.source) ? edge.source : activeCaseIds.has(edge.target) ? edge.target : undefined;
      const entityId = caseId === edge.source ? edge.target : caseId === edge.target ? edge.source : undefined;
      if (!caseId || !entityId || activeCaseIds.has(entityId)) return;
      if (!entityCases.has(entityId)) entityCases.set(entityId, new Set());
      entityCases.get(entityId)!.add(caseId);
    });
    const shared = [...entityCases.entries()].filter(([, ids]) => ids.size > 1);
    const sharedIds = new Set(shared.map(([id]) => id));
    const relatedEdges = graph.edges.filter((edge) => sharedIds.has(edge.source) || sharedIds.has(edge.target));
    const relatedEvidence = evidenceForEdges(relatedEdges, evidence);
    const details = shared.map(([id, ids]) => `${nodeLabel(nodes, id)} is present in ${[...ids].join(', ')}`);
    const answer = details.length
      ? `Shared entities found across the uploaded cases:\n${details.map((item) => `• ${item}`).join('\n')}`
      : 'No entity is currently linked to two or more uploaded cases. This result reflects only the extracted graph.';
    return baseResponse(
      answer,
      [...sharedIds],
      unique(shared.flatMap(([, ids]) => [...ids])),
      relatedEvidence,
      [verifiedFinding(details.length ? details.join('; ') : 'No cross-case entity overlap was found in the extracted graph.', relatedEvidence)],
      ['Map each extracted entity to its linked cases', 'Keep entities referenced by at least two cases', 'Attach supporting uploaded records'],
      ['Show evidence for the shared entities.', 'Which shared entity has the most links?', 'Show the timeline for a linked case.'],
    );
  }

  if (intent === 'path') {
    const mentioned = mentionedNodes(question, graph);
    const endpoints = unique([
      ...mentioned.map((node) => node.id),
      ...(matchedPerson ? [matchedPerson.person_id] : []),
      ...(matchedCase ? [matchedCase.case_id] : []),
    ]);
    if (endpoints.length < 2) {
      return baseResponse(
        'A path query needs two identifiable cases or entities. Please include both names or IDs in the question.',
        endpoints,
        endpoints.filter((id) => nodes.get(id)?.type === 'case'),
        [],
        [verifiedFinding('The requested path endpoints could not both be resolved in the uploaded graph.', [])],
        ['Resolve two endpoint identifiers from the question'],
        ['Show the shortest path between two case IDs.', 'Which entities are shared across cases?'],
      );
    }
    const path = shortestPath(graph, endpoints[0], endpoints[1]);
    const pathEvidence = path ? evidenceForEdges(path.edges, evidence) : [];
    const labels = path?.nodeIds.map((id) => nodeLabel(nodes, id)) ?? [];
    const answer = path
      ? `Shortest extracted path (${path.edges.length} link${path.edges.length === 1 ? '' : 's'}):\n${labels.join(' → ')}`
      : `No path was found between ${nodeLabel(nodes, endpoints[0])} and ${nodeLabel(nodes, endpoints[1])} in the uploaded graph.`;
    return baseResponse(
      answer,
      path?.nodeIds.filter((id) => nodes.get(id)?.type !== 'case') ?? endpoints,
      path?.nodeIds.filter((id) => nodes.get(id)?.type === 'case') ?? [],
      pathEvidence,
      [verifiedFinding(path ? `The extracted graph contains the path ${labels.join(' → ')}.` : answer, pathEvidence)],
      ['Resolve path endpoints', 'Run an undirected breadth-first search', 'Attach evidence for every traversed link'],
      ['Show evidence supporting this path.', 'Are any path links high priority?', 'Show the timeline for these entities.'],
    );
  }

  if (intent === 'timeline') {
    const events = timeline
      .filter((event) => !scopeIds.size || scopeIds.has(event.case_id) || Boolean(event.person_id && scopeIds.has(event.person_id)))
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const answer = events.length
      ? `Chronological events from uploaded records:\n${events.slice(0, 12).map((event) => `• ${event.timestamp || 'Time not recorded'} — ${event.event_type} (${event.case_id}): ${event.notes}`).join('\n')}`
      : 'No structured timeline event matching this question was extracted from the uploaded records.';
    const eventEvidence = evidence.filter((item) => events.some((event) => event.case_id === item.case_id));
    return baseResponse(
      answer,
      unique(events.flatMap((event) => event.person_id ? [event.person_id] : [])),
      unique(events.map((event) => event.case_id)),
      eventEvidence,
      [verifiedFinding(events.length ? `${events.length} matching timeline event(s) were found.` : answer, eventEvidence)],
      ['Resolve the requested case or entity scope', 'Sort extracted events by recorded timestamp'],
      ['What evidence supports these events?', 'Are there gaps in this timeline?', 'Show linked entities for this case.'],
    );
  }

  const financialTerms = ['money', 'financial', 'transaction', 'account', 'bank', 'transfer', 'payment', 'sent', 'received'];
  const communicationTerms = ['phone', 'call', 'communication', 'contact', 'cdr', 'message', 'communicated'];
  if (intent === 'financial' || intent === 'communication' || intent === 'trails') {
    const terms = intent === 'financial' ? financialTerms : intent === 'communication' ? communicationTerms : [...financialTerms, ...communicationTerms];
    const typeTerms = intent === 'financial' ? ['account', 'transaction'] : intent === 'communication' ? ['phone'] : ['account', 'transaction', 'phone'];
    const matchingNodeIds = new Set(graph.nodes.filter((node) => typeTerms.includes(node.type)).map((node) => node.id));
    const relatedEdges = graph.edges.filter((edge) => {
      const text = `${edge.relationship} ${edge.source} ${edge.target}`.toLowerCase();
      return matchingNodeIds.has(edge.source) || matchingNodeIds.has(edge.target) || hasAny(text, terms);
    });
    const relatedEvidence = evidence.filter((item) => {
      const text = `${item.relationship} ${item.evidenceType} ${item.supportingData}`.toLowerCase();
      return relatedEdges.some((edge) => edge.evidenceIds.includes(item.evidence_id)) || hasAny(text, terms);
    });
    const title = intent === 'financial' ? 'Financial trails' : intent === 'communication' ? 'Communication links' : 'Communication and financial trails';
    const edgeLines = relatedEdges.slice(0, 12).map(
      (edge) => `${nodeLabel(nodes, edge.source)} — ${edge.relationship} → ${nodeLabel(nodes, edge.target)}`,
    );
    const evidenceLines = relatedEvidence
      .filter((item) => !relatedEdges.some((edge) => edge.evidenceIds.includes(item.evidence_id)))
      .slice(0, Math.max(0, 12 - edgeLines.length))
      .map((item) => `${item.evidence_id}: ${item.supportingData}`);
    const lines = [...edgeLines, ...evidenceLines];
    const answer = lines.length
      ? `${title} found in the uploaded records:\n${lines.map((line) => `• ${line}`).join('\n')}`
      : `No ${title.toLowerCase()} were extracted from the currently uploaded records.`;
    return baseResponse(
      answer,
      unique(relatedEdges.flatMap((edge) => [edge.source, edge.target]).filter((id) => nodes.get(id)?.type !== 'case')),
      unique(relatedEvidence.map((item) => item.case_id)),
      relatedEvidence,
      [verifiedFinding(lines.length ? `${lines.length} matching record(s) were found.` : answer, lines.length ? relatedEvidence : [])],
      [`Filter graph links and evidence for ${intent} indicators`, 'Attach original record references'],
      ['Show the evidence records for these links.', 'Which cases share these entities?', 'Show their chronological order.'],
    );
  }

  if (intent === 'anomaly') {
    const degree = new Map<string, number>();
    graph.edges.forEach((edge) => {
      degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
      degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
    });
    const highPriority = graph.edges.filter((edge) => edge.priority === 'High');
    const repeatPersons = persons.filter((person) => person.caseIds.length > 1);
    const hubs = [...degree.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const anomalyEvidence = evidenceForEdges(highPriority, evidence);
    const lines = [
      ...repeatPersons.map((person) => `${person.name} appears in ${person.caseIds.length} cases (${person.caseIds.join(', ')})`),
      ...hubs.map(([id, count]) => `${nodeLabel(nodes, id)} has ${count} direct graph links`),
      ...(highPriority.length ? [`${highPriority.length} relationship(s) are marked high priority in the extracted records`] : []),
    ];
    const answer = lines.length
      ? `Potential review leads (not findings of guilt):\n${unique(lines).map((line) => `• ${line}`).join('\n')}`
      : 'No unusual multi-case, high-priority, or high-connectivity pattern was found in the extracted graph.';
    return baseResponse(
      answer,
      unique([...repeatPersons.map((person) => person.person_id), ...hubs.map(([id]) => id)]),
      unique([...repeatPersons.flatMap((person) => person.caseIds), ...anomalyEvidence.map((item) => item.case_id)]),
      anomalyEvidence,
      [{ status: lines.length ? 'Inferred' : 'Unresolved', statement: answer, confidence: lines.length ? 0.5 : 0, citations: anomalyEvidence.map(citation) }],
      ['Check repeated cross-case entities', 'Rank direct graph connectivity', 'Collect links already marked high priority'],
      ['What evidence supports these leads?', 'Which cases share the repeated entities?', 'Show the relevant timeline.'],
    );
  }

  if (intent === 'evidence') {
    const scopedEdges = scopeIds.size ? graph.edges.filter((edge) => edgeTouches(edge, scopeIds)) : graph.edges;
    let scopedEvidence = evidenceForEdges(scopedEdges, evidence);
    if (!scopedEvidence.length) {
      scopedEvidence = evidence.filter((item) => !scopeIds.size || scopeIds.has(item.entityA) || scopeIds.has(item.entityB) || scopeIds.has(item.case_id));
    }
    const answer = scopedEvidence.length
      ? `Supporting records matching the question:\n${scopedEvidence.slice(0, 12).map((item) => `• ${item.evidence_id} [${item.provenance.sourceDataset}]: ${item.supportingData}`).join('\n')}`
      : 'No supporting evidence record matching this question is available in the uploaded data.';
    return baseResponse(
      answer,
      unique(scopedEvidence.flatMap((item) => [item.entityA, item.entityB]).filter((id) => !id.startsWith('CASE-'))),
      unique(scopedEvidence.map((item) => item.case_id)),
      scopedEvidence,
      scopedEvidence.slice(0, 5).map((item) => verifiedFinding(item.supportingData, [item])),
      ['Resolve mentioned entities and cases', 'Retrieve graph-linked evidence', 'Return original provenance'],
      ['Which cases share these entities?', 'Show the shortest supported path.', 'Show the relevant timeline.'],
    );
  }

  if (matchedPerson) {
    const relatedEdges = graph.edges.filter((edge) => edgeTouches(edge, new Set([matchedPerson.person_id])));
    const relatedEvidence = evidenceForEdges(relatedEdges, evidence);
    const linked = relatedEdges.map((edge) => nodeLabel(nodes, edge.source === matchedPerson.person_id ? edge.target : edge.source));
    const answer = `${matchedPerson.name} (${matchedPerson.person_id}) is recorded as ${matchedPerson.role}. Linked cases: ${matchedPerson.caseIds.join(', ') || 'none extracted'}. Direct extracted links: ${linked.join(', ') || 'none'}.`;
    return baseResponse(answer, [matchedPerson.person_id], matchedPerson.caseIds, relatedEvidence, [verifiedFinding(answer, relatedEvidence)], ['Resolve the named entity', 'Collect direct graph links and supporting records'], [`Show the timeline for ${matchedPerson.name}.`, `What evidence mentions ${matchedPerson.name}?`, `Find paths from ${matchedPerson.name} to another entity.`]);
  }

  if (matchedCase) {
    const casePeople = persons.filter((person) => person.caseIds.includes(matchedCase.case_id));
    const caseEvidence = evidence.filter((item) => item.case_id === matchedCase.case_id);
    const answer = `${matchedCase.case_id} (${matchedCase.fir_number}) is recorded as ${matchedCase.crime_type} in ${matchedCase.district}, ${matchedCase.state}. Extracted people: ${casePeople.map((person) => person.name).join(', ') || 'none'}. Supporting records: ${caseEvidence.length}.`;
    return baseResponse(answer, casePeople.map((person) => person.person_id), [matchedCase.case_id], caseEvidence, [verifiedFinding(answer, caseEvidence)], ['Resolve the requested case', 'Summarize extracted entities and supporting records'], [`Which entities are shared with ${matchedCase.case_id}?`, `Show evidence for ${matchedCase.case_id}.`, `Show the timeline for ${matchedCase.case_id}.`]);
  }

  const answer = `Uploaded investigation overview: ${cases.length} case(s), ${persons.length} person(s), ${graph.edges.length} relationship(s), ${evidence.length} evidence record(s), and ${timeline.length} timeline event(s). Ask about a named case/entity, shared entities, a path, evidence, communications, financial trails, anomalies, or a timeline for a targeted answer.`;
  return baseResponse(answer, persons.slice(0, 5).map((person) => person.person_id), cases.map((item) => item.case_id), evidence.slice(0, 5), [verifiedFinding(answer, evidence.slice(0, 5))], ['Count active extracted records', 'Offer supported investigation query types'], ['Which entities are common across cases?', 'What evidence supports the communication links?', 'Show the shortest path between two case IDs.']);
}
