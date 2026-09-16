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

  const headers = parseRow(lines[0]).map((header) => normalizeFieldName(header));
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

function normalizeFieldName(value: string): string {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizePersonName(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/^(mr|mrs|ms|miss|dr|shri|smt)\.?\s+/i, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableId(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase();
}

function getFirstValue(row: Record<string, string>, fields: string[]): string {
  for (const field of fields) {
    const value = row[field]?.trim();
    if (value) return value;
  }
  return '';
}

function parseCaseStatus(value: string): CaseRecord['status'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'closed') return 'Closed';
  if (normalized === 'under review' || normalized === 'under_review') return 'Under Review';
  return 'Active';
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toGraphMetadata(record: Record<string, unknown>): Record<string, string | number | string[]> {
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => {
      if (typeof value === 'number') return [key, value];
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return [key, value];
      return [key, String(value ?? '')];
    })
  );
}

const PERSON_NAME_FIELDS = [
  'suspect_name',
  'suspect_names',
  'accused_name',
  'accused_names',
  'person_name',
  'individual_name',
  'subject_name',
  'offender_name',
  'criminal_name',
];

function getPersonNames(row: Record<string, string>): string[] {
  const values = PERSON_NAME_FIELDS.map((field) => row[field]).filter(Boolean);
  if (row.person_id && row.name) values.push(row.name);

  const seen = new Set<string>();
  return values
    .flatMap((value) => value.split(/[;|\n]+/))
    .map((value) => value.trim())
    .filter((value) => {
      const normalized = normalizePersonName(value);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

interface ExtractedTextPerson {
  name: string;
  role: Person['role'];
  excerpt: string;
}

function roleFromText(value: string): Person['role'] {
  const normalized = value.toLowerCase();
  if (normalized.includes('witness')) return 'Witness';
  if (normalized.includes('victim')) return 'Victim';
  if (normalized.includes('person of interest')) return 'Person of Interest';
  return 'Suspect';
}

function sentenceContaining(text: string, value: string): string {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .find((sentence) => sentence.toLowerCase().includes(value.toLowerCase()))
    ?.trim() || value;
}

function extractPeopleFromText(text: string): ExtractedTextPerson[] {
  const name = String.raw`[\p{L}][\p{L}'-]*(?:\s+[\p{L}][\p{L}'-]*){1,3}`;
  const properName = String.raw`[\p{Lu}][\p{L}'-]*(?:\s+[\p{Lu}][\p{L}'-]*){1,3}`;
  const title = String.raw`(?:(?:mr|mrs|ms|miss|dr|shri|smt)\.?\s+)?`;
  const role = String.raw`(suspect|accused|witness|victim|person\s+of\s+interest)`;
  const matches: Array<{ name: string; role: string }> = [];
  const nonPersonTerms = new Set([
    'case narrative',
    'crime branch',
    'economic offences wing',
    'police station',
    'singhania exports',
    'mahindra scorpio',
    'hyundai creta',
    'tata 407',
    'existing mumbai network',
  ]);
  const isPlausibleName = (value: string) => {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    const words = cleaned.split(' ');
    if (words.length < 2 || words.length > 4) return false;
    if (!words.every((word) => /^\p{Lu}[\p{L}'-]*$/u.test(word))) return false;
    return !nonPersonTerms.has(normalizePersonName(cleaned));
  };
  const addMatch = (candidate: string, matchedRole = 'person of interest') => {
    const cleaned = candidate.trim().replace(/[’']s$/i, '').replace(/\s+/g, ' ');
    if (isPlausibleName(cleaned)) matches.push({ name: cleaned, role: matchedRole });
  };
  const collect = (pattern: RegExp, nameGroup: number, roleGroup: number) => {
    for (const match of text.matchAll(pattern)) {
      if (match[nameGroup] && match[roleGroup]) {
        addMatch(match[nameGroup], match[roleGroup]);
      }
    }
  };

  collect(new RegExp(String.raw`\b(?:identifies|identified|names|named|mentions|records)\s+${title}(${name})\s+as\s+(?:the\s+)?(?:primary\s+|main\s+)?${role}\b`, 'giu'), 1, 2);
  collect(new RegExp(String.raw`\b${title}(${name})\s+(?:is|was)\s+(?:the\s+)?(?:primary\s+|main\s+)?${role}\b`, 'giu'), 1, 2);
  collect(new RegExp(String.raw`\b${role}\s+(?:named\s+|identified\s+as\s+)?${title}(${name})(?=[,.;\n]|\s+(?:who|was|is|has|had|used|uses|resides|residing|with)\b|$)`, 'giu'), 2, 1);
  collect(new RegExp(String.raw`\b${role}\s*(?:name\s*)?(?:is|was|named)?\s*[:\-]\s*${title}(${name})(?=[,.;\n]|$)`, 'giu'), 2, 1);

  // Narrative FIRs often identify people without an explicit role label. Only
  // use affirmative sentences and strong person-introduction contexts so a
  // negative statement such as "no connection with X" does not create a link.
  const sentences = text.split(/(?<=[.!?])\s+|\n+/).map((sentence) => sentence.trim()).filter(Boolean);
  const negativeRelationship = /\b(?:no\s+(?:known\s+|direct\s+|shared\s+)?(?:financial\s+)?(?:connection|transaction|communication|relationship|overlap)|(?:do|does|did)\s+not\s+(?:initially\s+)?(?:appear|establish)|not\s+(?:been\s+)?established|unrelated)\b/i;
  sentences.forEach((sentence) => {
    if (negativeRelationship.test(sentence)) return;

    const patterns = [
      new RegExp(String.raw`\b(?:[Ii]nvestigators?|[Oo]fficers?|[Rr]ecords?|[Aa]nalysis|[Rr]eview|[Aa]ctivity|[Tt]ransfers?|[Tt]ransactions?)\s+(?:also\s+|therefore\s+)?(?:identified|identify|involved|involving|referenced)\s+(?:the\s+registered\s+(?:owner|user|operator)\s+as\s+)?(${properName})(?=,|\s+(?:as|through|in|during|who|whose|already|previously|from|to|and)\b|$)`, 'gu'),
      new RegExp(String.raw`\b(?:[Ii]dentified|[Ii]nvolving|[Ii]nvolved|[Rr]egistered\s+to|[Rr]egistered\s+owner\s+as|[Aa]ccount\s+registered\s+to|[Aa]ssociated\s+with|[Cc]ontact\s+with|[Ll]inked\s+to|[Rr]eferenced)\s+(${properName})(?=,|\s+(?:as|through|in|during|who|whose|already|previously|from|to|and|was|is|had|has)\b|$)`, 'gu'),
      new RegExp(String.raw`\b(${properName}),\s*(?:resident\s+of|previously\s+(?:identified|referenced)|already\s+(?:connected|listed|referenced)|who\s+(?:appears|is|was|has|had))\b`, 'gu'),
      new RegExp(String.raw`\b(${properName})\s+(?:was|is)\s+(?:previously\s+|already\s+)?(?:identified|associated|listed|observed|connected|registered|referenced)\b`, 'gu'),
      new RegExp(String.raw`\b(?:between|from)\s+(${properName})\s+(?:and|to)\s+(${properName})(?=[,.;]|\s|$)`, 'gu'),
      new RegExp(String.raw`\b(${properName})\s+and\s+(${properName})\s+as\s+parties\b`, 'gu'),
      new RegExp(String.raw`\b(${properName})\s+(?:had|has|was|is)\s+(?:earlier\s+|previously\s+)?(?:communicated|exchanged|transferred|connected|linked|appeared|received|made|recorded)\b`, 'gu'),
      new RegExp(String.raw`\b(?:with|to|from|through)\s+(${properName})(?:'s)?(?=[,.;]|\s|$)`, 'gu'),
      new RegExp(String.raw`\b(?:involving|linking|connecting)\s+(${properName})(?=,)\s*,\s*(${properName})(?=\s+and\s+)\s+and\s+(${properName})(?=[,.;]|$)`, 'gu'),
      new RegExp(String.raw`\b(?:involving|linking|connecting)\s+(${properName})(?=\s+and\s+)\s+and\s+(${properName})(?=[,.;]|$)`, 'gu'),
    ];

    patterns.forEach((pattern) => {
      for (const match of sentence.matchAll(pattern)) {
        addMatch(match[1]);
        if (match[2]) addMatch(match[2]);
        if (match[3]) addMatch(match[3]);
      }
    });
  });

  const resolved = new Map<string, ExtractedTextPerson>();
  matches.forEach((match) => {
    const normalized = normalizePersonName(match.name);
    if (!normalized || resolved.has(normalized)) return;
    resolved.set(normalized, {
      name: match.name,
      role: roleFromText(match.role),
      excerpt: sentenceContaining(text, match.name),
    });
  });
  return [...resolved.values()];
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
    persons: current.persons.map((person) => ({
      ...person,
      caseIds: [...person.caseIds],
      phoneIds: [...person.phoneIds],
      vehicleIds: [...person.vehicleIds],
      accountIds: [...person.accountIds],
      locationIds: [...person.locationIds],
    })),
    phones: [...current.phones],
    vehicles: [...current.vehicles],
    accounts: [...current.accounts],
    transactions: [...current.transactions],
    timelineEvents: [...current.timelineEvents],
    graphData: {
      nodes: current.graphData.nodes.map((node) => ({
        ...node,
        metadata: { ...node.metadata },
        provenance: node.provenance ? { ...node.provenance } : undefined,
      })),
      edges: current.graphData.edges.map((edge) => ({
        ...edge,
        evidenceIds: [...edge.evidenceIds],
        provenance: edge.provenance ? { ...edge.provenance } : undefined,
      })),
    },
    evidence: [...current.evidence],
    searchResults: [...current.searchResults],
    alerts: [...current.alerts],
    stats: { ...current.stats },
  };

  const nodesBefore = updated.graphData.nodes.length;
  const edgesBefore = updated.graphData.edges.length;

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

  const addEdge = (edge: GraphEdge): boolean => {
    const key = `${edge.source}-${edge.target}-${edge.relationship}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      updated.graphData.edges.push(edge);
      return true;
    }
    return false;
  };

  const lowerName = fileName.toLowerCase();

  if (lowerName.endsWith('.json')) {
    try {
      const data: unknown = JSON.parse(content);
      const items = Array.isArray(data)
        ? data
        : isJsonRecord(data) && Array.isArray(data.records)
          ? data.records
          : [data];
      items.filter(isJsonRecord).forEach((item, idx) => {
        if (item.sender || item.from || item.account) {
          const srcId = String(item.sender ?? item.from ?? `AC-${idx}`);
          const dstId = String(item.receiver ?? item.to ?? `AC-${idx + 100}`);
          const metadata = toGraphMetadata(item);
          addNode({ id: srcId, type: 'account', label: srcId, metadata, provenance: { sourceDataset: fileName, sourceRecordId: `REC-${idx}`, recordType: 'Account' } });
          addNode({ id: dstId, type: 'account', label: dstId, metadata, provenance: { sourceDataset: fileName, sourceRecordId: `REC-${idx}`, recordType: 'Account' } });
          addEdge({
            id: `E-TX-${Date.now()}-${idx}`,
            source: srcId,
            target: dstId,
            relationship: String(item.relationship ?? 'TRANSFERRED_FUNDS'),
            priority: Number(item.amount ?? 0) > 50000 ? 'High' : 'Medium',
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
    const personByNormalizedName = new Map<string, Person>();
    updated.persons.forEach((person) => {
      const normalized = normalizePersonName(person.name);
      if (normalized) personByNormalizedName.set(normalized, person);
    });

    const parseRole = (value: string): Person['role'] => {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'witness') return 'Witness';
      if (normalized === 'victim') return 'Victim';
      if (normalized === 'person of interest' || normalized === 'poi') return 'Person of Interest';
      return 'Suspect';
    };

    const ensurePerson = (
      name: string,
      explicitId: string,
      role: Person['role'],
      caseId: string,
      row: Record<string, string>,
      rowIndex: number
    ): Person => {
      const normalizedName = normalizePersonName(name);
      const byId = explicitId
        ? updated.persons.find((person) => person.person_id === explicitId)
        : undefined;
      let person = byId ?? personByNormalizedName.get(normalizedName);

      if (!person) {
        const personId = explicitId || `P-NAME-${stableId(normalizedName)}`;
        person = {
          person_id: personId,
          name: name.trim(),
          role,
          caseIds: caseId ? [caseId] : [],
          phoneIds: [],
          vehicleIds: [],
          accountIds: [],
          locationIds: [],
        };
        updated.persons.push(person);
        personByNormalizedName.set(normalizedName, person);
        addNode({
          id: personId,
          type: 'person',
          label: person.name,
          metadata: {
            role,
            normalizedName,
            identityResolution: explicitId ? 'Identifier match' : 'Exact normalized-name match; investigator verification required',
            caseIds: caseId ? [caseId] : [],
            age: row.age || '',
            gender: row.gender || '',
          },
          provenance: { sourceDataset: fileName, sourceRecordId: explicitId || `ROW-${rowIndex + 1}`, recordType: 'Person extraction' },
        });
      } else {
        if (caseId && !person.caseIds.includes(caseId)) person.caseIds.push(caseId);
        const existingNode = nodeMap.get(person.person_id);
        if (existingNode) {
          existingNode.metadata = {
            ...existingNode.metadata,
            caseIds: [...person.caseIds],
            identityResolution: explicitId && explicitId === person.person_id
              ? 'Identifier match'
              : 'Exact normalized-name match; investigator verification required',
          };
        }
      }

      return person;
    };

    // A case row may also contain suspect fields. Extract both instead of treating
    // case and person records as mutually exclusive schemas.
    rows.forEach((r, rowIndex) => {
      const caseId = getFirstValue(r, ['case_id', 'case_number', 'case_no', 'fir_id']);
      const looksLikeCase = Boolean(caseId && (
        'fir_number' in r || 'crime_type' in r || 'case_id' in r || 'case_number' in r || 'case_no' in r
      ));

      if (looksLikeCase) {
        if (!updated.cases.some((c) => c.case_id === caseId)) {
          const caseRecord: CaseRecord = {
            case_id: caseId,
            fir_number: r.fir_number || `FIR/${caseId}`,
            crime_type: r.crime_type || 'General Offense',
            district: r.district || 'Unspecified',
            state: r.state || 'India',
            date_filed: r.date_filed || new Date().toISOString().slice(0, 10),
            status: parseCaseStatus(r.status || ''),
            summary: r.summary || r.description || `Investigation case ${caseId}`,
          };
          updated.cases.push(caseRecord);
          addNode({
            id: caseId,
            type: 'case',
            label: caseId,
            metadata: { fir_number: caseRecord.fir_number, crime_type: caseRecord.crime_type },
            provenance: { sourceDataset: fileName, sourceRecordId: caseId, recordType: 'Case' },
          });
        }
      }

      const personNames = getPersonNames(r);
      if (personNames.length === 0 && caseId && r.person_id) {
        const linkedPerson = updated.persons.find((person) => person.person_id === r.person_id);
        if (linkedPerson) {
          if (!linkedPerson.caseIds.includes(caseId)) linkedPerson.caseIds.push(caseId);
          const linkedNode = nodeMap.get(linkedPerson.person_id);
          if (linkedNode) linkedNode.metadata = { ...linkedNode.metadata, caseIds: [...linkedPerson.caseIds] };

          const relationship = (r.relationship || r.role || 'ASSOCIATED_WITH')
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '_');
          const evidenceId = `EV-PC-${stableId(`${fileName}:${rowIndex}:${caseId}:${r.person_id}`)}`;
          const provenance = {
            sourceDataset: fileName,
            sourceRecordId: `ROW-${rowIndex + 1}`,
            recordType: 'Case person link',
          };
          const edgeAdded = addEdge({
            id: `E-PC-${caseId}-${r.person_id}-${stableId(fileName)}`,
            source: caseId,
            target: r.person_id,
            relationship,
            priority: relationship.includes('SUSPECT') || relationship.includes('ACCUSED') ? 'High' : 'Medium',
            evidenceIds: [evidenceId],
            provenance,
          });
          if (edgeAdded) {
            updated.evidence.push({
              evidence_id: evidenceId,
              relationship,
              entityA: caseId,
              entityB: r.person_id,
              case_id: caseId,
              timestamp: new Date().toISOString(),
              evidenceType: 'Uploaded case-person link',
              supportingData: `${linkedPerson.name} is linked to ${caseId} by the uploaded record.`,
              priority: relationship.includes('SUSPECT') || relationship.includes('ACCUSED') ? 'High' : 'Medium',
              sourceReliability: 'Identifier supplied in source',
              provenance,
            });
          }
        }
      }

      personNames.forEach((personName, personIndex) => {
        const explicitId = personNames.length === 1 ? (r.person_id || '') : '';
        const role = parseRole(r.role || r.person_role || (PERSON_NAME_FIELDS.some((field) => Boolean(r[field])) ? 'Suspect' : ''));
        const person = ensurePerson(personName, explicitId, role, caseId, r, rowIndex);

        if (!caseId) return;
        const relationship = role === 'Suspect'
          ? 'NAMED_AS_SUSPECT'
          : `ROLE_${role.toUpperCase().replace(/\s+/g, '_')}`;
        const evidenceId = `EV-PC-${stableId(`${fileName}:${rowIndex}:${caseId}:${normalizePersonName(personName)}:${personIndex}`)}`;
        const provenance = {
          sourceDataset: fileName,
          sourceRecordId: caseId || `ROW-${rowIndex + 1}`,
          recordType: 'Case person extraction',
        };
        const edgeAdded = addEdge({
          id: `E-PC-${caseId}-${person.person_id}-${stableId(fileName)}`,
          source: caseId,
          target: person.person_id,
          relationship,
          priority: role === 'Suspect' ? 'High' : 'Medium',
          evidenceIds: [evidenceId],
          provenance,
        });

        if (edgeAdded && !updated.evidence.some((item) => item.evidence_id === evidenceId)) {
          updated.evidence.push({
            evidence_id: evidenceId,
            relationship,
            entityA: caseId,
            entityB: person.person_id,
            case_id: caseId,
            timestamp: new Date().toISOString(),
            evidenceType: 'Uploaded case record',
            supportingData: `${personName} is recorded as ${role.toLowerCase()} in ${caseId}.`,
            priority: role === 'Suspect' ? 'High' : 'Medium',
            sourceReliability: explicitId ? 'Identifier supplied in source' : 'Name match; investigator verification required',
            provenance,
          });
        }
      });
    });
    // Detect Phones
    if ('phone_id' in first && 'number' in first) {
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
    if ('vehicle_id' in first && 'plate_number' in first) {
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
    // Detect Transactions
    if ('txn_id' in first && 'sender_account_id' in first) {
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
    if ('event_id' in first && 'event_type' in first) {
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
    if ('pattern_type' in first && 'entity_1' in first && 'entity_2' in first) {
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
  } else if (lowerName.endsWith('.txt')) {
    const caseMatch = content.match(/^\s*(?:CASE|FIR)\s*[:#-]?\s*(\d{1,12})\b/im)
      ?? fileName.match(/\b(?:CASE|FIR)[\s_-]*(\d{1,12})\b/i);
    const firMatch = content.match(/^\s*FIR\s*(?:NO\.?|NUMBER)\s*:\s*([^\r\n]+)/im)
      ?? content.match(/\bFIR(?:\s*(?:NO\.?|NUMBER))?[\s:#/-]*([A-Z0-9][A-Z0-9/-]{1,30})/i);
    const caseId = caseMatch
      ? `CASE-${caseMatch[1].padStart(3, '0')}`
      : `CASE-TXT-${stableId(`${fileName}:${content.slice(0, 160)}`)}`;
    const firNumber = firMatch?.[1]?.trim() || firMatch?.[0]?.trim() || `FIR/${fileName.replace(/\.[^/.]+$/, '')}`;
    const crimeType = /financial|bank|transaction|fraud/i.test(content)
      ? 'Financial Fraud'
      : /cyber|online|phishing|digital/i.test(content)
        ? 'Cyber Crime'
        : /vehicle|car|motorcycle|theft/i.test(content)
          ? 'Vehicle Crime'
          : 'FIR Text Analysis';
    const provenance = { sourceDataset: fileName, sourceRecordId: caseId, recordType: 'TXT FIR extraction' };

    if (!updated.cases.some((item) => item.case_id === caseId)) {
      updated.cases.push({
        case_id: caseId,
        fir_number: firNumber,
        crime_type: crimeType,
        district: 'Unspecified',
        state: 'India',
        date_filed: new Date().toISOString().slice(0, 10),
        status: 'Active',
        summary: `Entities extracted from paragraph-based FIR ${fileName}.`,
      });
      addNode({
        id: caseId,
        type: 'case',
        label: caseId,
        metadata: { source: fileName, fir_number: firNumber, crime_type: crimeType },
        provenance,
      });
    }

    const extractedPeople = extractPeopleFromText(content);
    const resolvedPeople: Array<{ person: Person; extracted: ExtractedTextPerson }> = [];
    extractedPeople.forEach((extracted, index) => {
      const normalizedName = normalizePersonName(extracted.name);
      let person = updated.persons.find((item) => normalizePersonName(item.name) === normalizedName);
      if (!person) {
        person = {
          person_id: `P-NAME-${stableId(normalizedName)}`,
          name: extracted.name,
          role: extracted.role,
          caseIds: [caseId],
          phoneIds: [],
          vehicleIds: [],
          accountIds: [],
          locationIds: [],
        };
        updated.persons.push(person);
        addNode({
          id: person.person_id,
          type: 'person',
          label: person.name,
          metadata: {
            role: extracted.role,
            normalizedName,
            caseIds: [caseId],
            identityResolution: 'Exact normalized-name match; investigator verification required',
          },
          provenance: { ...provenance, sourceRecordId: `${caseId}-PERSON-${index + 1}` },
        });
      } else {
        if (!person.caseIds.includes(caseId)) person.caseIds.push(caseId);
        const personNode = nodeMap.get(person.person_id);
        if (personNode) personNode.metadata = { ...personNode.metadata, caseIds: [...person.caseIds] };
      }
      resolvedPeople.push({ person, extracted });

      const relationship = extracted.role === 'Suspect'
        ? 'NAMED_AS_SUSPECT'
        : `ROLE_${extracted.role.toUpperCase().replace(/\s+/g, '_')}`;
      const evidenceId = `EV-TXT-${stableId(`${fileName}:${caseId}:${person.person_id}:${relationship}`)}`;
      if (addEdge({
        id: `E-TXT-${caseId}-${person.person_id}`,
        source: caseId,
        target: person.person_id,
        relationship,
        priority: extracted.role === 'Suspect' ? 'High' : 'Medium',
        evidenceIds: [evidenceId],
        provenance,
      })) {
        updated.evidence.push({
          evidence_id: evidenceId,
          relationship,
          entityA: caseId,
          entityB: person.person_id,
          case_id: caseId,
          timestamp: new Date().toISOString(),
          evidenceType: 'TXT FIR paragraph',
          supportingData: extracted.excerpt,
          priority: extracted.role === 'Suspect' ? 'High' : 'Medium',
          sourceReliability: 'Rule-based text extraction; investigator verification required',
          provenance,
        });
      }
    });

    const findOwner = (rawValue: string): Person | undefined => {
      const sentence = sentenceContaining(content, rawValue).toLowerCase();
      const inSameSentence = resolvedPeople.find(({ extracted }) => sentence.includes(extracted.name.toLowerCase()));
      return inSameSentence?.person ?? (resolvedPeople.length === 1 ? resolvedPeople[0].person : undefined);
    };

    const phoneMatches = content.match(/(?:\+?91[\s-]?)?[6-9](?:[\s-]?\d){9}\b/g) ?? [];
    [...new Set(phoneMatches)].forEach((rawPhone) => {
      const digits = rawPhone.replace(/\D/g, '').slice(-10);
      const phoneId = `PH-${digits}`;
      const owner = findOwner(rawPhone);
      if (!updated.phones.some((phone) => phone.phone_id === phoneId)) {
        updated.phones.push({ phone_id: phoneId, number: digits, owner_person_id: owner?.person_id || '', carrier: 'Unknown' });
      }
      addNode({
        id: phoneId,
        type: 'phone',
        label: `Phone ${digits.slice(-4)}`,
        metadata: { number: digits, carrier: 'Unknown' },
        provenance,
      });
      if (owner) {
        if (!owner.phoneIds.includes(phoneId)) owner.phoneIds.push(phoneId);
        const evidenceId = `EV-TXT-PHONE-${stableId(`${fileName}:${owner.person_id}:${phoneId}`)}`;
        if (addEdge({
          id: `E-TXT-PHONE-${owner.person_id}-${phoneId}`,
          source: owner.person_id,
          target: phoneId,
          relationship: 'USES_PHONE',
          priority: 'High',
          evidenceIds: [evidenceId],
          provenance,
        })) {
          updated.evidence.push({
            evidence_id: evidenceId,
            relationship: 'USES_PHONE',
            entityA: owner.person_id,
            entityB: phoneId,
            case_id: caseId,
            timestamp: new Date().toISOString(),
            evidenceType: 'TXT FIR paragraph',
            supportingData: sentenceContaining(content, rawPhone),
            priority: 'High',
            sourceReliability: 'Rule-based text extraction; investigator verification required',
            provenance,
          });
        }
      }
    });

    const vehicleMatches = content.match(/\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}\b/gi) ?? [];
    [...new Set(vehicleMatches.map((value) => value.toUpperCase()))].forEach((rawVehicle) => {
      const plate = rawVehicle.replace(/\s+/g, ' ').trim();
      const vehicleId = `VH-${plate.replace(/[^A-Z0-9]/g, '')}`;
      const owner = findOwner(rawVehicle);
      if (!updated.vehicles.some((vehicle) => vehicle.vehicle_id === vehicleId)) {
        updated.vehicles.push({ vehicle_id: vehicleId, plate_number: plate, owner_person_id: owner?.person_id || '', vehicle_type: 'Vehicle', color: 'Unknown' });
      }
      addNode({ id: vehicleId, type: 'vehicle', label: plate, metadata: { plate_number: plate }, provenance });
      if (owner) {
        if (!owner.vehicleIds.includes(vehicleId)) owner.vehicleIds.push(vehicleId);
        const evidenceId = `EV-TXT-VEHICLE-${stableId(`${fileName}:${owner.person_id}:${vehicleId}`)}`;
        if (addEdge({
          id: `E-TXT-VEHICLE-${owner.person_id}-${vehicleId}`,
          source: owner.person_id,
          target: vehicleId,
          relationship: 'ASSOCIATED_WITH_VEHICLE',
          priority: 'Medium',
          evidenceIds: [evidenceId],
          provenance,
        })) {
          updated.evidence.push({
            evidence_id: evidenceId,
            relationship: 'ASSOCIATED_WITH_VEHICLE',
            entityA: owner.person_id,
            entityB: vehicleId,
            case_id: caseId,
            timestamp: new Date().toISOString(),
            evidenceType: 'TXT FIR paragraph',
            supportingData: sentenceContaining(content, rawVehicle),
            priority: 'Medium',
            sourceReliability: 'Rule-based text extraction; investigator verification required',
            provenance,
          });
        }
      }
    });
  } else {
    // Binary/scanned documents need OCR; do not fabricate person or device nodes.
    const pseudoCaseId = `CASE-DOC-${stableId(fileName)}`;
    if (!updated.cases.some((item) => item.case_id === pseudoCaseId)) {
      updated.cases.push({
        case_id: pseudoCaseId,
        fir_number: `FIR/${fileName.replace(/\.[^/.]+$/, '')}`,
        crime_type: 'Document awaiting OCR',
        district: 'Unspecified',
        state: 'India',
        date_filed: new Date().toISOString().slice(0, 10),
        status: 'Under Review',
        summary: `OCR is required before entities can be extracted from ${fileName}.`,
      });
      addNode({
        id: pseudoCaseId,
        type: 'case',
        label: pseudoCaseId,
        metadata: { source: fileName, extractionStatus: 'OCR required' },
        provenance: { sourceDataset: fileName, sourceRecordId: pseudoCaseId, recordType: 'Document' },
      });
    }
  }

  // A canonical person referenced by more than one case is the evidence-backed
  // bridge between those cases. Surface it as a reviewable cross-case lead.
  updated.persons.forEach((person) => {
    const caseIds = [...new Set(person.caseIds)].filter(Boolean);
    if (caseIds.length < 2) return;

    const alertId = `ALT-CROSS-${person.person_id}`;
    const alert = {
      id: alertId,
      title: 'Shared Suspect Across Cases',
      description: `${person.name} appears in ${caseIds.join(', ')}. Exact-name identity match requires investigator verification.`,
      priority: 'High' as const,
      caseIds,
      entityIds: [person.person_id],
    };
    const existingIndex = updated.alerts.findIndex((item) => item.id === alertId);
    if (existingIndex >= 0) updated.alerts[existingIndex] = alert;
    else updated.alerts.push(alert);
  });

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
