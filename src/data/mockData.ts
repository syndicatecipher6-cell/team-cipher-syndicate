import type { AssistantResponse, CaseRecord, DashboardStats, DataSource, Evidence, GraphData, Person, SearchResult, TimelineEvent } from '../types/domain';

// Sample benchmark data used ONLY when explicitly requested via sample loader
export const sampleCases: CaseRecord[] = [
  { case_id: 'CASE-001', fir_number: 'FIR/ND/1042/26', crime_type: 'Organised fraud', district: 'New Delhi', state: 'Delhi', date_filed: '2026-08-18', status: 'Active', summary: 'Identity and communication records linked across multiple financial complaints.' },
  { case_id: 'CASE-017', fir_number: 'FIR/GGN/0881/26', crime_type: 'Financial fraud', district: 'Gurugram', state: 'Haryana', date_filed: '2026-08-24', status: 'Under Review', summary: 'Account activity and a shared device identifier require cross-case review.' },
  { case_id: 'CASE-024', fir_number: 'FIR/JPR/1210/26', crime_type: 'Identity misuse', district: 'Jaipur', state: 'Rajasthan', date_filed: '2026-09-01', status: 'Active', summary: 'Transactions connect an identity misuse report to an account from another case.' },
  { case_id: 'CASE-031', fir_number: 'FIR/LKO/0773/26', crime_type: 'Document fraud', district: 'Lucknow', state: 'Uttar Pradesh', date_filed: '2026-09-05', status: 'Active', summary: 'A recurring location and vehicle record overlap with two earlier investigations.' },
];

export const samplePersons: Person[] = [
  { person_id: 'P-0044', name: 'Aarav Mehta', role: 'Person of Interest', caseIds: ['CASE-001', 'CASE-017'], phoneIds: ['PH-0104'], vehicleIds: ['VH-0201'], accountIds: [], locationIds: ['L-09'] },
  { person_id: 'P-0188', name: 'Kabir Khan', role: 'Witness', caseIds: ['CASE-017'], phoneIds: ['PH-0811'], vehicleIds: [], accountIds: ['AC-0204'], locationIds: [] },
  { person_id: 'P-0271', name: 'Naina Rao', role: 'Person of Interest', caseIds: ['CASE-024'], phoneIds: ['PH-0270'], vehicleIds: [], accountIds: ['AC-0541'], locationIds: ['L-11'] },
  { person_id: 'P-0352', name: 'Dev Malhotra', role: 'Witness', caseIds: ['CASE-031'], phoneIds: [], vehicleIds: ['VH-0440'], accountIds: [], locationIds: ['L-11'] },
];

const p = (sourceDataset: string, sourceRecordId: string, recordType: string) => ({ sourceDataset, sourceRecordId, recordType });

export const sampleGraphData: GraphData = {
  nodes: [
    ...sampleCases.map((item) => ({ id: item.case_id, type: 'case' as const, label: item.case_id, metadata: { fir_number: item.fir_number, status: item.status, crime_type: item.crime_type }, provenance: p('Delhi_FIRs_Batch_04.pdf', item.fir_number, 'Case') })),
    ...samplePersons.map((item) => ({ id: item.person_id, type: 'person' as const, label: item.name, metadata: { role: item.role, cases: item.caseIds }, provenance: p('Delhi_FIRs_Batch_04.pdf', item.person_id, 'Person') })),
    { id: 'PH-0104', type: 'phone', label: 'Phone •••• 104', metadata: { carrier: 'Airtel', number: '+91 98110 00104' }, provenance: p('CDR_Export_Q3.csv', 'PHONE-104', 'Phone') },
    { id: 'PH-0811', type: 'phone', label: 'Phone •••• 811', metadata: { carrier: 'Jio', number: '+91 98200 00811' }, provenance: p('CDR_Export_Q3.csv', 'PHONE-811', 'Phone') },
    { id: 'VH-0201', type: 'vehicle', label: 'DL 04 NX 0201', metadata: { vehicle_type: 'Hatchback', color: 'Grey' }, provenance: p('RTO_Records.csv', 'VEHICLE-201', 'Vehicle') },
    { id: 'AC-0204', type: 'account', label: 'Account ••0204', metadata: { type: 'Bank account', institution: 'State Bank of India' }, provenance: p('Bank_Statement.csv', 'ACCOUNT-204', 'Account') },
    { id: 'AC-0541', type: 'account', label: 'Account ••0541', metadata: { type: 'UPI-linked account', institution: 'HDFC Bank' }, provenance: p('Bank_Statement.csv', 'ACCOUNT-541', 'Account') },
    { id: 'TX-0204', type: 'transaction', label: 'TX-0204', metadata: { amount: '₹84,000', mode: 'IMPS' }, provenance: p('Bank_Statement.csv', 'TXN-0204', 'Transaction') },
    { id: 'L-11', type: 'location', label: 'Sector 18, Noida', metadata: { location_type: 'Observed location' }, provenance: p('CDR_Export_Q3.csv', 'LOCATION-11', 'Location') },
  ],
  edges: [
    { id: 'E-01', source: 'CASE-001', target: 'P-0044', relationship: 'REFERENCES', evidenceIds: ['EV-101'], priority: 'Medium', provenance: p('Delhi_FIRs_Batch_04.pdf', 'LINK-001', 'Person-Case Link') },
    { id: 'E-02', source: 'P-0044', target: 'PH-0104', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-102'], priority: 'High', provenance: p('CDR_Export_Q3.csv', 'CDR-10482', 'CDR') },
    { id: 'E-03', source: 'PH-0104', target: 'P-0188', relationship: 'COMMUNICATED WITH', evidenceIds: ['EV-103'], timestamp: '2026-09-10T14:32:00+05:30', priority: 'High', provenance: p('CDR_Export_Q3.csv', 'CDR-10511', 'CDR') },
    { id: 'E-04', source: 'P-0188', target: 'CASE-017', relationship: 'REFERENCES', evidenceIds: ['EV-104'], priority: 'Medium', provenance: p('Delhi_FIRs_Batch_04.pdf', 'LINK-017', 'Person-Case Link') },
    { id: 'E-05', source: 'P-0188', target: 'AC-0204', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-105'], priority: 'Medium', provenance: p('Bank_Statement.csv', 'ACCOUNT-LINK-204', 'Account Link') },
    { id: 'E-06', source: 'AC-0204', target: 'TX-0204', relationship: 'SENT', evidenceIds: ['EV-106'], timestamp: '2026-09-08T11:08:00+05:30', priority: 'High', provenance: p('Bank_Statement.csv', 'TXN-0204', 'Transaction') },
    { id: 'E-07', source: 'TX-0204', target: 'AC-0541', relationship: 'RECEIVED BY', evidenceIds: ['EV-106'], timestamp: '2026-09-08T11:08:00+05:30', priority: 'High', provenance: p('Bank_Statement.csv', 'TXN-0204', 'Transaction') },
    { id: 'E-08', source: 'AC-0541', target: 'P-0271', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-107'], priority: 'Medium', provenance: p('Bank_Statement.csv', 'ACCOUNT-LINK-541', 'Account Link') },
    { id: 'E-09', source: 'P-0271', target: 'CASE-024', relationship: 'REFERENCES', evidenceIds: ['EV-108'], priority: 'Medium', provenance: p('Delhi_FIRs_Batch_04.pdf', 'LINK-024', 'Person-Case Link') },
    { id: 'E-10', source: 'P-0271', target: 'L-11', relationship: 'OBSERVED AT', evidenceIds: ['EV-109'], timestamp: '2026-09-06T17:20:00+05:30', priority: 'Medium', provenance: p('CDR_Export_Q3.csv', 'EVENT-182', 'Event') },
    { id: 'E-11', source: 'L-11', target: 'P-0352', relationship: 'OBSERVED AT', evidenceIds: ['EV-110'], timestamp: '2026-09-07T09:12:00+05:30', priority: 'Medium', provenance: p('CDR_Export_Q3.csv', 'EVENT-199', 'Event') },
    { id: 'E-12', source: 'P-0352', target: 'CASE-031', relationship: 'REFERENCES', evidenceIds: ['EV-111'], priority: 'Low', provenance: p('Delhi_FIRs_Batch_04.pdf', 'LINK-031', 'Person-Case Link') },
    { id: 'E-13', source: 'P-0044', target: 'VH-0201', relationship: 'REGISTERED USER', evidenceIds: ['EV-112'], priority: 'Medium', provenance: p('RTO_Records.csv', 'VEHICLE-LINK-201', 'Vehicle Link') },
    { id: 'E-14', source: 'VH-0201', target: 'CASE-017', relationship: 'RECORDED IN', evidenceIds: ['EV-113'], priority: 'High', provenance: p('Delhi_FIRs_Batch_04.pdf', 'EVENT-211', 'Event') },
  ],
};

// -------------------------------------------------------------
// ACTIVE DATASET (Defaults to COMPLETELY CLEAN: zero mock data)
// -------------------------------------------------------------

export const cases: CaseRecord[] = [];
export const persons: Person[] = [];
export const graphData: GraphData = { nodes: [], edges: [] };
export const evidence: Evidence[] = [];
export const timelineEvents: TimelineEvent[] = [];
export const dashboardStats: DashboardStats = { cases: 0, persons: 0, phones: 0, vehicles: 0, transactions: 0, cdrRecords: 0 };
export const searchResults: SearchResult[] = [];

export const dataSources: DataSource[] = [
  { id: 'fir', name: 'FIR Police Reports (PDF/Text)', category: 'Document Ingestion', status: 'Backend required' },
  { id: 'cdr', name: 'Call Detail Records (CDRs)', category: 'Telecom Ingestion', status: 'Backend required' },
  { id: 'banking', name: 'Bank & Hawala Transaction Logs', category: 'Financial Ingestion', status: 'Backend required' },
];

export const assistantDemo: AssistantResponse = {
  answer: 'Workspace is clean. No investigation records have been uploaded yet. Upload files in Data Ingestion to analyze suspects, cases, and network relationships.',
  recordCount: 0,
  entities: [],
  cases: [],
  evidenceIds: [],
  suggestedQuestions: [
    'How do I upload FIR or CDR files?',
    'What file formats are supported?',
    'How does automated entity resolution work?',
  ],
};

// -------------------------------------------------------------
// REACTIVE DATA MANAGEMENT HOOKS & CONTROLLERS
// -------------------------------------------------------------

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeToDataChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

/**
 * Updates active exported arrays with newly parsed data from uploaded files.
 */
export function setActiveDataset(data: {
  cases?: CaseRecord[];
  persons?: Person[];
  graphData?: GraphData;
  evidence?: Evidence[];
  timelineEvents?: TimelineEvent[];
  stats?: { cases: number; persons: number; phones: number; vehicles: number; transactions: number; cdrRecords: number };
  searchResults?: SearchResult[];
}) {
  if (data.cases) {
    cases.length = 0;
    cases.push(...data.cases);
  }
  if (data.persons) {
    persons.length = 0;
    persons.push(...data.persons);
  }
  if (data.graphData) {
    graphData.nodes.length = 0;
    graphData.nodes.push(...data.graphData.nodes);
    graphData.edges.length = 0;
    graphData.edges.push(...data.graphData.edges);
  }
  if (data.evidence) {
    evidence.length = 0;
    evidence.push(...data.evidence);
  }
  if (data.timelineEvents) {
    timelineEvents.length = 0;
    timelineEvents.push(...data.timelineEvents);
  }
  if (data.searchResults) {
    searchResults.length = 0;
    searchResults.push(...data.searchResults);
  }
  if (data.stats) {
    dashboardStats.cases = data.stats.cases;
    dashboardStats.persons = data.stats.persons;
    dashboardStats.phones = data.stats.phones;
    dashboardStats.vehicles = data.stats.vehicles;
    dashboardStats.transactions = data.stats.transactions;
    dashboardStats.cdrRecords = data.stats.cdrRecords;
  }

  notifyListeners();
}

/**
 * Wipes all active exported arrays back to clean zero state.
 */
export function clearActiveDataset() {
  cases.length = 0;
  persons.length = 0;
  graphData.nodes.length = 0;
  graphData.edges.length = 0;
  evidence.length = 0;
  timelineEvents.length = 0;
  searchResults.length = 0;

  dashboardStats.cases = 0;
  dashboardStats.persons = 0;
  dashboardStats.phones = 0;
  dashboardStats.vehicles = 0;
  dashboardStats.transactions = 0;
  dashboardStats.cdrRecords = 0;

  notifyListeners();
}

/**
 * Populates active exported arrays with SIH sample benchmark data.
 */
export function loadSampleBenchmark() {
  setActiveDataset({
    cases: sampleCases,
    persons: samplePersons,
    graphData: sampleGraphData,
    evidence: sampleGraphData.edges.map((edge, index) => ({
      evidence_id: edge.evidenceIds[0],
      relationship: edge.relationship,
      entityA: edge.source,
      entityB: edge.target,
      case_id: edge.target.startsWith('CASE') ? edge.target : 'CASE-001',
      timestamp: edge.timestamp ?? '2026-09-08T10:00:00+05:30',
      evidenceType: edge.provenance?.recordType ?? 'Record',
      supportingData: `${edge.provenance?.recordType ?? 'Record'} supports the displayed ${edge.relationship.toLowerCase()} relationship.`,
      priority: edge.priority ?? 'Medium',
      sourceReliability: 'Record verified',
      provenance: edge.provenance ?? p('CDR_Export_Q3.csv', `REC-${index}`, 'Record'),
    })),
    timelineEvents: [
      { event_id: 'TE-260', case_id: 'CASE-001', person_id: 'P-0044', event_type: 'FIR registered', timestamp: '2026-08-18T09:30:00+05:30', location: 'New Delhi', notes: 'Case record created from submitted FIR.', source: 'Delhi_FIRs_Batch_04.pdf' },
      { event_id: 'TE-261', case_id: 'CASE-017', person_id: 'P-0188', event_type: 'Communication record', timestamp: '2026-09-10T14:32:00+05:30', location: 'Gurugram', notes: 'CDR record links two phones.', source: 'CDR_Export_Q3.csv' },
      { event_id: 'TE-262', case_id: 'CASE-024', person_id: 'P-0271', event_type: 'Transaction recorded', timestamp: '2026-09-08T11:08:00+05:30', location: 'Online', notes: 'Account transfer ₹84,000.', source: 'Bank_Statement.csv' },
    ],
    stats: {
      cases: sampleCases.length,
      persons: samplePersons.length,
      phones: 2,
      vehicles: 1,
      transactions: 1,
      cdrRecords: 4502,
    },
    searchResults: [
      ...samplePersons.map((p) => ({ id: p.person_id, type: 'person' as const, label: p.name, secondary: `${p.person_id} · ${p.role}`, relatedCases: p.caseIds, relationshipCount: 4, source: 'Delhi_FIRs_Batch_04.pdf' })),
      ...sampleCases.map((c) => ({ id: c.case_id, type: 'case' as const, label: c.case_id, secondary: `${c.fir_number} · ${c.crime_type}`, relatedCases: [c.case_id], relationshipCount: 3, source: 'Delhi_FIRs_Batch_04.pdf' })),
    ],
  });
}
