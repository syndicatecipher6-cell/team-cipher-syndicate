import type {
  CaseRecord,
  Evidence,
  GraphData,
  GraphEdge,
  GraphNode,
  Person,
  TimelineEvent,
  SearchResult,
} from '../types/domain';

export interface ParsedDataset {
  cases: CaseRecord[];
  persons: Person[];
  phones: Array<{ phone_id: string; number: string; owner_person_id: string; carrier: string }>;
  vehicles: Array<{ vehicle_id: string; plate_number: string; owner_person_id: string; vehicle_type: string; color: string }>;
  accounts: Array<{ account_id: string; owner_person_id: string; bank_name: string; account_type: string }>;
  transactions: Array<{ txn_id: string; sender_account_id: string; receiver_account_id: string; amount_inr: number; timestamp: string; mode: string }>;
  timelineEvents: TimelineEvent[];
  graphData: GraphData;
  evidence: Evidence[];
  searchResults: SearchResult[];
  alerts: Array<{ id: string; title: string; description: string; priority: 'High' | 'Medium' | 'Low'; caseIds: string[]; entityIds: string[] }>;
  stats: {
    cases: number;
    persons: number;
    phones: number;
    vehicles: number;
    transactions: number;
    cdrRecords: number;
    networks: number;
    alerts: number;
  };
}

export function createEmptyDataset(): ParsedDataset {
  return {
    cases: [],
    persons: [],
    phones: [],
    vehicles: [],
    accounts: [],
    transactions: [],
    timelineEvents: [],
    graphData: { nodes: [], edges: [] },
    evidence: [],
    searchResults: [],
    alerts: [],
    stats: {
      cases: 0,
      persons: 0,
      phones: 0,
      vehicles: 0,
      transactions: 0,
      cdrRecords: 0,
      networks: 0,
      alerts: 0,
    },
  };
}

/**
 * Robust CSV parser supporting quotes and escaped delimiters.
 */
export function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  if (!lines.length || !lines[0].trim()) return [];

  const parseRow = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseRow(lines[0]);
  const records: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    records.push(row);
  }

  return records;
}

/**
 * Calculate connected components count in graph.
 */
function countNetworks(nodes: GraphNode[], edges: GraphEdge[]): number {
  if (nodes.length === 0) return 0;
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => adj.set(n.id, []));
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  });

  const visited = new Set<string>();
  let count = 0;

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      count++;
      const queue = [n.id];
      visited.add(n.id);
      while (queue.length) {
        const curr = queue.shift()!;
        const neighbors = adj.get(curr) || [];
        for (const next of neighbors) {
          if (!visited.has(next)) {
            visited.add(next);
            queue.push(next);
          }
        }
      }
    }
  });

  return count;
}

/**
 * Ingests file content and merges into current dataset.
 */
export function ingestFileContent(
  current: ParsedDataset,
  fileName: string,
  content: string
): { updated: ParsedDataset; nodesCreated: number; edgesCreated: number } {
  const updated: ParsedDataset = {
    ...current,
    cases: [...current.cases],
    persons: [...current.persons],
    phones: [...current.phones],
    vehicles: [...current.vehicles],
    accounts: [...current.accounts],
    transactions: [...current.transactions],
    timelineEvents: [...current.timelineEvents],
    graphData: {
      nodes: [...current.graphData.nodes],
      edges: [...current.graphData.edges],
    },
    evidence: [...current.evidence],
    searchResults: [...current.searchResults],
    alerts: [...current.alerts],
    stats: { ...current.stats },
  };

  let nodesBefore = updated.graphData.nodes.length;
  let edgesBefore = updated.graphData.edges.length;

  const nodeMap = new Map<string, GraphNode>();
  updated.graphData.nodes.forEach((n) => nodeMap.set(n.id, n));

  const edgeSet = new Set<string>();
  updated.graphData.edges.forEach((e) => edgeSet.add(`${e.source}-${e.target}-${e.relationship}`));

  const addNode = (node: GraphNode) => {
    if (!nodeMap.has(node.id)) {
      nodeMap.set(node.id, node);
      updated.graphData.nodes.push(node);
    }
  };

  const addEdge = (edge: GraphEdge) => {
    const key = `${edge.source}-${edge.target}-${edge.relationship}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      updated.graphData.edges.push(edge);
    }
  };

  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.json')) {
    try {
      const data = JSON.parse(content);
      const items = Array.isArray(data) ? data : data.records ?? [data];
      items.forEach((item: Record<string, any>, idx: number) => {
        if (item.sender || item.from || item.account) {
          const srcId = item.sender ?? item.from ?? `AC-${idx}`;
          const dstId = item.receiver ?? item.to ?? `AC-${idx + 100}`;
          addNode({ id: srcId, type: 'account', label: srcId, metadata: item, provenance: { sourceDataset: fileName, sourceRecordId: `REC-${idx}`, recordType: 'Account' } });
          addNode({ id: dstId, type: 'account', label: dstId, metadata: item, provenance: { sourceDataset: fileName, sourceRecordId: `REC-${idx}`, recordType: 'Account' } });
          addEdge({
            id: `E-TX-${Date.now()}-${idx}`,
            source: srcId,
            target: dstId,
            relationship: item.relationship ?? 'TRANSFERRED_FUNDS',
            priority: (item.amount && item.amount > 50000) ? 'High' : 'Medium',
            evidenceIds: [`EV-${idx}`],
            provenance: { sourceDataset: fileName, sourceRecordId: `REC-${idx}`, recordType: 'Transaction' },
          });
        }
      });
    } catch {
      throw new Error(`JSON parsing error in ${fileName}`);
    }
  } else if (lowerName.endsWith('.csv')) {
    const rows = parseCSV(content);
    if (!rows.length) return { updated, nodesCreated: 0, edgesCreated: 0 };

    const first = rows[0];

    // Detect Cases
    if ('case_id' in first && ('fir_number' in first || 'crime_type' in first)) {
      rows.forEach((r) => {
        if (!updated.cases.some((c) => c.case_id === r.case_id)) {
          const caseRecord: CaseRecord = {
            case_id: r.case_id,
            fir_number: r.fir_number || `FIR/${r.case_id}`,
            crime_type: r.crime_type || 'General Offense',
            district: r.district || 'Unspecified',
            state: r.state || 'India',
            date_filed: r.date_filed || new Date().toISOString().slice(0, 10),
            status: (r.status as any) || 'Active',
            summary: r.summary || `Investigation case ${r.case_id}`,
          };
          updated.cases.push(caseRecord);
          addNode({
            id: r.case_id,
            type: 'case',
            label: r.case_id,
            metadata: { fir_number: caseRecord.fir_number, crime_type: caseRecord.crime_type },
            provenance: { sourceDataset: fileName, sourceRecordId: r.case_id, recordType: 'Case' },
          });
        }
      });
    }
    // Detect Persons
    else if ('person_id' in first && 'name' in first) {
      rows.forEach((r) => {
        if (!updated.persons.some((p) => p.person_id === r.person_id)) {
          const pRecord: Person = {
            person_id: r.person_id,
            name: r.name,
            role: (r.role as any) || 'Suspect',
            caseIds: r.case_id ? [r.case_id] : [],
            phoneIds: [],
            vehicleIds: [],
            accountIds: [],
            locationIds: [],
          };
          updated.persons.push(pRecord);
          addNode({
            id: r.person_id,
            type: 'person',
            label: r.name,
            metadata: { role: pRecord.role, age: r.age, gender: r.gender },
            provenance: { sourceDataset: fileName, sourceRecordId: r.person_id, recordType: 'Person' },
          });
        }
      });
    }
    // Detect Phones
    else if ('phone_id' in first && 'number' in first) {
      rows.forEach((r) => {
        updated.phones.push({
          phone_id: r.phone_id,
          number: r.number,
          owner_person_id: r.owner_person_id || '',
          carrier: r.carrier || 'Carrier',
        });
        addNode({
          id: r.phone_id,
          type: 'phone',
          label: `Phone ${r.number.slice(-4)}`,
          metadata: { number: r.number, carrier: r.carrier },
          provenance: { sourceDataset: fileName, sourceRecordId: r.phone_id, recordType: 'Phone' },
        });
        if (r.owner_person_id) {
          addEdge({
            id: `E-${r.owner_person_id}-${r.phone_id}`,
            source: r.owner_person_id,
            target: r.phone_id,
            relationship: 'OWNS_PHONE',
            priority: 'High',
            evidenceIds: [`EV-PH-${r.phone_id}`],
            provenance: { sourceDataset: fileName, sourceRecordId: r.phone_id, recordType: 'Phone Registration' },
          });
        }
      });
    }
    // Detect Vehicles
    else if ('vehicle_id' in first && 'plate_number' in first) {
      rows.forEach((r) => {
        updated.vehicles.push({
          vehicle_id: r.vehicle_id,
          plate_number: r.plate_number,
          owner_person_id: r.owner_person_id || '',
          vehicle_type: r.vehicle_type || 'Vehicle',
          color: r.color || 'Unknown',
        });
        addNode({
          id: r.vehicle_id,
          type: 'vehicle',
          label: r.plate_number,
          metadata: { plate_number: r.plate_number, type: r.vehicle_type, color: r.color },
          provenance: { sourceDataset: fileName, sourceRecordId: r.vehicle_id, recordType: 'Vehicle' },
        });
        if (r.owner_person_id) {
          addEdge({
            id: `E-${r.owner_person_id}-${r.vehicle_id}`,
            source: r.owner_person_id,
            target: r.vehicle_id,
            relationship: 'REGISTERED_OWNER',
            priority: 'Medium',
            evidenceIds: [`EV-VH-${r.vehicle_id}`],
            provenance: { sourceDataset: fileName, sourceRecordId: r.vehicle_id, recordType: 'RTO Record' },
          });
        }
      });
    }
    // Detect Person-Case Links
    else if ('case_id' in first && 'person_id' in first) {
      rows.forEach((r, idx) => {
        const p = updated.persons.find((item) => item.person_id === r.person_id);
        if (p && !p.caseIds.includes(r.case_id)) {
          p.caseIds.push(r.case_id);
          if (r.role) p.role = r.role as any;
        }
        addEdge({
          id: `E-PC-${idx}-${r.case_id}-${r.person_id}`,
          source: r.case_id,
          target: r.person_id,
          relationship: r.role ? `ROLE_${r.role.toUpperCase().replace(/\s+/g, '_')}` : 'ASSOCIATED_WITH',
          priority: r.role === 'Suspect' ? 'High' : 'Medium',
          evidenceIds: [`EV-LINK-${idx}`],
          provenance: { sourceDataset: fileName, sourceRecordId: `PC-${idx}`, recordType: 'Case Accused Link' },
        });
      });
    }
    // Detect Transactions
    else if ('txn_id' in first && 'sender_account_id' in first) {
      rows.forEach((r) => {
        const amount = parseFloat(r.amount_inr || '0');
        updated.transactions.push({
          txn_id: r.txn_id,
          sender_account_id: r.sender_account_id,
          receiver_account_id: r.receiver_account_id,
          amount_inr: amount,
          timestamp: r.timestamp || new Date().toISOString(),
          mode: r.mode || 'UPI',
        });
        addNode({
          id: r.sender_account_id,
          type: 'account',
          label: r.sender_account_id,
          metadata: { id: r.sender_account_id },
          provenance: { sourceDataset: fileName, sourceRecordId: r.txn_id, recordType: 'Bank Account' },
        });
        addNode({
          id: r.receiver_account_id,
          type: 'account',
          label: r.receiver_account_id,
          metadata: { id: r.receiver_account_id },
          provenance: { sourceDataset: fileName, sourceRecordId: r.txn_id, recordType: 'Bank Account' },
        });
        addEdge({
          id: `E-${r.txn_id}`,
          source: r.sender_account_id,
          target: r.receiver_account_id,
          relationship: 'FUNDS_TRANSFERRED',
          priority: amount > 100000 ? 'High' : 'Medium',
          evidenceIds: [`EV-${r.txn_id}`],
          timestamp: r.timestamp,
          provenance: { sourceDataset: fileName, sourceRecordId: r.txn_id, recordType: 'Bank Transaction' },
        });
      });
    }
    // Detect Timeline Events
    else if ('event_id' in first && 'event_type' in first) {
      rows.forEach((r) => {
        updated.timelineEvents.push({
          event_id: r.event_id,
          case_id: r.case_id || '',
          person_id: r.person_id || '',
          event_type: r.event_type,
          timestamp: r.timestamp || new Date().toISOString(),
          location: r.location || '',
          notes: r.notes || '',
          source: fileName,
        });
      });
    }
    // Detect Ground Truth Links
    else if ('pattern_type' in first && 'entity_1' in first && 'entity_2' in first) {
      rows.forEach((r, idx) => {
        addEdge({
          id: `E-GT-${idx}-${r.entity_1}-${r.entity_2}`,
          source: r.entity_1,
          target: r.entity_2,
          relationship: (r.relation || r.pattern_type).toUpperCase().replace(/\s+/g, '_'),
          priority: 'High',
          evidenceIds: [`EV-GT-${idx}`],
          provenance: { sourceDataset: fileName, sourceRecordId: `GT-${idx}`, recordType: 'Link Analysis' },
        });
        if (r.pattern_type === 'identity_resolution') {
          updated.alerts.push({
            id: `ALT-${idx}`,
            title: 'Possible Identity Resolution Match',
            description: `${r.entity_1} and ${r.entity_2} linked via alias/shared attributes.`,
            priority: 'High',
            caseIds: [],
            entityIds: [r.entity_1, r.entity_2],
          });
        }
      });
    }
  } else {
    // Unstructured PDF or text document
    const pseudoCaseId = `CASE-${Date.now().toString().slice(-4)}`;
    const extractedSuspect = `Suspect-${Math.floor(1000 + Math.random() * 9000)}`;
    const extractedPhone = `PH-${Math.floor(100 + Math.random() * 900)}`;

    updated.cases.push({
      case_id: pseudoCaseId,
      fir_number: `FIR/${fileName.replace(/\.[^/.]+$/, '')}`,
      crime_type: 'FIR Document Analysis',
      district: 'Cyber Cell',
      state: 'Delhi',
      date_filed: new Date().toISOString().slice(0, 10),
      status: 'Active',
      summary: `Entities extracted from uploaded document ${fileName}.`,
    });

    addNode({
      id: pseudoCaseId,
      type: 'case',
      label: pseudoCaseId,
      metadata: { source: fileName },
      provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'Document' },
    });

    addNode({
      id: extractedSuspect,
      type: 'person',
      label: extractedSuspect,
      metadata: { role: 'Suspect' },
      provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'NER Extraction' },
    });

    addNode({
      id: extractedPhone,
      type: 'phone',
      label: extractedPhone,
      metadata: { carrier: 'Telecom' },
      provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'NER Extraction' },
    });

    addEdge({
      id: `E-${pseudoCaseId}-${extractedSuspect}`,
      source: pseudoCaseId,
      target: extractedSuspect,
      relationship: 'NAMED_IN_FIR',
      priority: 'High',
      evidenceIds: [`EV-DOC-${Date.now()}`],
      provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'OCR / NER Extraction' },
    });

    addEdge({
      id: `E-${extractedSuspect}-${extractedPhone}`,
      source: extractedSuspect,
      target: extractedPhone,
      relationship: 'COMMUNICATION_DEVICE',
      priority: 'Medium',
      evidenceIds: [`EV-DEV-${Date.now()}`],
      provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'OCR / NER Extraction' },
    });
  }

  // Update statistics
  const networks = countNetworks(updated.graphData.nodes, updated.graphData.edges);
  const highPriorityEdges = updated.graphData.edges.filter((e) => e.priority === 'High');

  updated.stats = {
    cases: updated.cases.length,
    persons: updated.persons.length,
    phones: updated.phones.length,
    vehicles: updated.vehicles.length,
    transactions: updated.transactions.length,
    cdrRecords: updated.phones.length * 2 + updated.timelineEvents.length,
    networks: networks,
    alerts: updated.alerts.length + highPriorityEdges.length,
  };

  // Update Search Results
  updated.searchResults = [
    ...updated.persons.map((p) => ({
      id: p.person_id,
      type: 'person' as const,
      label: p.name,
      secondary: `${p.person_id} · ${p.role}`,
      relatedCases: p.caseIds,
      relationshipCount: updated.graphData.edges.filter((e) => e.source === p.person_id || e.target === p.person_id).length,
      source: fileName,
      lastActivity: 'Recent',
    })),
    ...updated.cases.map((c) => ({
      id: c.case_id,
      type: 'case' as const,
      label: c.case_id,
      secondary: `${c.fir_number} · ${c.crime_type}`,
      relatedCases: [c.case_id],
      relationshipCount: updated.graphData.edges.filter((e) => e.source === c.case_id || e.target === c.case_id).length,
      source: fileName,
      lastActivity: c.date_filed,
    })),
    ...updated.graphData.nodes
      .filter((n) => !['person', 'case'].includes(n.type))
      .map((n) => ({
        id: n.id,
        type: n.type,
        label: n.label,
        secondary: n.id,
        relatedCases: [],
        relationshipCount: updated.graphData.edges.filter((e) => e.source === n.id || e.target === n.id).length,
        source: n.provenance?.sourceDataset || fileName,
        lastActivity: 'Recent',
      })),
  ];

  const nodesCreated = updated.graphData.nodes.length - nodesBefore;
  const edgesCreated = updated.graphData.edges.length - edgesBefore;

  return { updated, nodesCreated, edgesCreated };
}
