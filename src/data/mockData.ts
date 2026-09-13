import type { AssistantResponse, CaseRecord, DashboardStats, DataSource, Evidence, GraphData, Person, SearchResult, TimelineEvent } from '../types/domain';

export const cases: CaseRecord[] = [
  { case_id: 'CASE-001', fir_number: 'FIR/ND/1042/26', crime_type: 'Organised fraud', district: 'New Delhi', state: 'Delhi', date_filed: '2026-08-18', status: 'Active', summary: 'Identity and communication records linked across multiple financial complaints.' },
  { case_id: 'CASE-017', fir_number: 'FIR/GGN/0881/26', crime_type: 'Financial fraud', district: 'Gurugram', state: 'Haryana', date_filed: '2026-08-24', status: 'Under Review', summary: 'Account activity and a shared device identifier require cross-case review.' },
  { case_id: 'CASE-024', fir_number: 'FIR/JPR/1210/26', crime_type: 'Identity misuse', district: 'Jaipur', state: 'Rajasthan', date_filed: '2026-09-01', status: 'Active', summary: 'Transactions connect an identity misuse report to an account from another case.' },
  { case_id: 'CASE-031', fir_number: 'FIR/LKO/0773/26', crime_type: 'Document fraud', district: 'Lucknow', state: 'Uttar Pradesh', date_filed: '2026-09-05', status: 'Active', summary: 'A recurring location and vehicle record overlap with two earlier investigations.' },
];

export const persons: Person[] = [
  { person_id: 'P-0044', name: 'Aarav Mehta', role: 'Person of Interest', caseIds: ['CASE-001', 'CASE-017'], phoneIds: ['PH-0104'], vehicleIds: ['VH-0201'], accountIds: [], locationIds: ['L-09'] },
  { person_id: 'P-0188', name: 'Kabir Khan', role: 'Witness', caseIds: ['CASE-017'], phoneIds: ['PH-0811'], vehicleIds: [], accountIds: ['AC-0204'], locationIds: [] },
  { person_id: 'P-0271', name: 'Naina Rao', role: 'Person of Interest', caseIds: ['CASE-024'], phoneIds: ['PH-0270'], vehicleIds: [], accountIds: ['AC-0541'], locationIds: ['L-11'] },
  { person_id: 'P-0352', name: 'Dev Malhotra', role: 'Witness', caseIds: ['CASE-031'], phoneIds: [], vehicleIds: ['VH-0440'], accountIds: [], locationIds: ['L-11'] },
];

const p = (sourceDataset: string, sourceRecordId: string, recordType: string) => ({ sourceDataset, sourceRecordId, recordType });

export const graphData: GraphData = {
  nodes: [
    ...cases.map((item) => ({ id: item.case_id, type: 'case' as const, label: item.case_id, metadata: { fir_number: item.fir_number, status: item.status, crime_type: item.crime_type }, provenance: p('Synthetic NexusNet Data', item.fir_number, 'Case') })),
    ...persons.map((item) => ({ id: item.person_id, type: 'person' as const, label: item.name, metadata: { role: item.role, cases: item.caseIds }, provenance: p('Synthetic NexusNet Data', item.person_id, 'Person') })),
    { id: 'PH-0104', type: 'phone', label: 'Phone •••• 104', metadata: { carrier: 'Demo Telecom', number: '+91 ••••• ••104' }, provenance: p('Synthetic NexusNet Data', 'PHONE-104', 'Phone') },
    { id: 'PH-0811', type: 'phone', label: 'Phone •••• 811', metadata: { carrier: 'Demo Telecom', number: '+91 ••••• ••811' }, provenance: p('Synthetic NexusNet Data', 'PHONE-811', 'Phone') },
    { id: 'VH-0201', type: 'vehicle', label: 'DL 04 NX 0201', metadata: { vehicle_type: 'Hatchback', color: 'Grey' }, provenance: p('Synthetic NexusNet Data', 'VEHICLE-201', 'Vehicle') },
    { id: 'AC-0204', type: 'account', label: 'Account ••0204', metadata: { type: 'Bank account', institution: 'Demo Cooperative Bank' }, provenance: p('Synthetic NexusNet Data', 'ACCOUNT-204', 'Account') },
    { id: 'AC-0541', type: 'account', label: 'Account ••0541', metadata: { type: 'UPI-linked account', institution: 'Demo National Bank' }, provenance: p('Synthetic NexusNet Data', 'ACCOUNT-541', 'Account') },
    { id: 'TX-0204', type: 'transaction', label: 'TX-0204', metadata: { amount: '₹84,000', mode: 'IMPS' }, provenance: p('Synthetic NexusNet Data', 'TXN-0204', 'Transaction') },
    { id: 'L-11', type: 'location', label: 'Sector 18, Noida', metadata: { location_type: 'Observed location' }, provenance: p('Synthetic NexusNet Data', 'LOCATION-11', 'Location') },
  ],
  edges: [
    { id: 'E-01', source: 'CASE-001', target: 'P-0044', relationship: 'REFERENCES', evidenceIds: ['EV-101'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'LINK-001', 'Person-Case Link') },
    { id: 'E-02', source: 'P-0044', target: 'PH-0104', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-102'], priority: 'High', provenance: p('Synthetic NexusNet Data', 'CDR-10482', 'CDR') },
    { id: 'E-03', source: 'PH-0104', target: 'P-0188', relationship: 'COMMUNICATED WITH', evidenceIds: ['EV-103'], timestamp: '2026-09-10T14:32:00+05:30', priority: 'High', provenance: p('Synthetic NexusNet Data', 'CDR-10511', 'CDR') },
    { id: 'E-04', source: 'P-0188', target: 'CASE-017', relationship: 'REFERENCES', evidenceIds: ['EV-104'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'LINK-017', 'Person-Case Link') },
    { id: 'E-05', source: 'P-0188', target: 'AC-0204', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-105'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'ACCOUNT-LINK-204', 'Account Link') },
    { id: 'E-06', source: 'AC-0204', target: 'TX-0204', relationship: 'SENT', evidenceIds: ['EV-106'], timestamp: '2026-09-08T11:08:00+05:30', priority: 'High', provenance: p('Synthetic NexusNet Data', 'TXN-0204', 'Transaction') },
    { id: 'E-07', source: 'TX-0204', target: 'AC-0541', relationship: 'RECEIVED BY', evidenceIds: ['EV-106'], timestamp: '2026-09-08T11:08:00+05:30', priority: 'High', provenance: p('Synthetic NexusNet Data', 'TXN-0204', 'Transaction') },
    { id: 'E-08', source: 'AC-0541', target: 'P-0271', relationship: 'ASSOCIATED WITH', evidenceIds: ['EV-107'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'ACCOUNT-LINK-541', 'Account Link') },
    { id: 'E-09', source: 'P-0271', target: 'CASE-024', relationship: 'REFERENCES', evidenceIds: ['EV-108'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'LINK-024', 'Person-Case Link') },
    { id: 'E-10', source: 'P-0271', target: 'L-11', relationship: 'OBSERVED AT', evidenceIds: ['EV-109'], timestamp: '2026-09-06T17:20:00+05:30', priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'EVENT-182', 'Event') },
    { id: 'E-11', source: 'L-11', target: 'P-0352', relationship: 'OBSERVED AT', evidenceIds: ['EV-110'], timestamp: '2026-09-07T09:12:00+05:30', priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'EVENT-199', 'Event') },
    { id: 'E-12', source: 'P-0352', target: 'CASE-031', relationship: 'REFERENCES', evidenceIds: ['EV-111'], priority: 'Low', provenance: p('Synthetic NexusNet Data', 'LINK-031', 'Person-Case Link') },
    { id: 'E-13', source: 'P-0044', target: 'VH-0201', relationship: 'REGISTERED USER', evidenceIds: ['EV-112'], priority: 'Medium', provenance: p('Synthetic NexusNet Data', 'VEHICLE-LINK-201', 'Vehicle Link') },
    { id: 'E-14', source: 'VH-0201', target: 'CASE-017', relationship: 'RECORDED IN', evidenceIds: ['EV-113'], priority: 'High', provenance: p('Synthetic NexusNet Data', 'EVENT-211', 'Event') },
  ],
};

export const evidence: Evidence[] = graphData.edges.map((edge, index) => ({
  evidence_id: edge.evidenceIds[0], relationship: edge.relationship, entityA: edge.source, entityB: edge.target,
  case_id: edge.target.startsWith('CASE') ? edge.target : index < 3 ? 'CASE-001' : index < 8 ? 'CASE-017' : index < 11 ? 'CASE-024' : 'CASE-031',
  timestamp: edge.timestamp ?? `2026-09-${String(Math.max(1, 11 - index)).padStart(2, '0')}T10:00:00+05:30`,
  evidenceType: edge.provenance?.recordType ?? 'Record', supportingData: `${edge.provenance?.recordType ?? 'Record'} supports the displayed ${edge.relationship.toLowerCase()} relationship.`,
  priority: edge.priority ?? 'Medium', sourceReliability: index % 4 === 0 ? 'Corroboration recommended' : 'Record verified',
  provenance: edge.provenance ?? p('Synthetic NexusNet Data', `RECORD-${index + 1}`, 'Record'),
})).filter((item, index, records) => records.findIndex((candidate) => candidate.evidence_id === item.evidence_id) === index);

export const timelineEvents: TimelineEvent[] = [
  { event_id: 'TE-260', case_id: 'CASE-001', person_id: 'P-0044', event_type: 'FIR registered', timestamp: '2026-08-18T09:30:00+05:30', location: 'New Delhi', notes: 'Case record created from submitted FIR.', source: 'Synthetic NexusNet Data' },
  { event_id: 'TE-261', case_id: 'CASE-017', person_id: 'P-0188', event_type: 'Communication record', timestamp: '2026-09-10T14:32:00+05:30', location: 'Gurugram', notes: 'CDR record links two phones; investigator verification required.', source: 'Synthetic NexusNet Data' },
  { event_id: 'TE-262', case_id: 'CASE-024', person_id: 'P-0271', event_type: 'Transaction recorded', timestamp: '2026-09-08T11:08:00+05:30', location: 'Online', notes: 'Account-to-account transfer included in case material.', source: 'Synthetic NexusNet Data' },
  { event_id: 'TE-263', case_id: 'CASE-031', person_id: 'P-0352', event_type: 'Location overlap', timestamp: '2026-09-07T09:12:00+05:30', location: 'Sector 18, Noida', notes: 'Two separate event records reference the same location.', source: 'Synthetic NexusNet Data' },
  { event_id: 'TE-264', case_id: 'CASE-017', person_id: 'P-0044', event_type: 'Vehicle record', timestamp: '2026-09-05T16:20:00+05:30', location: 'Gurugram', notes: 'Vehicle identifier appears in supporting case material.', source: 'Synthetic NexusNet Data' },
];

export const dashboardStats: DashboardStats = { cases: 80, persons: 650, phones: 950, vehicles: 400, transactions: 6525, cdrRecords: 11025 };

export const dataSources: DataSource[] = [
  { id: 'synthetic', name: 'Synthetic NexusNet Data', category: 'Operational demo source', status: 'Demo data' },
  { id: 'fir', name: 'ICDAR FIR Dataset', category: 'FIR processing', status: 'Backend required' },
  { id: 'pole', name: 'POLE', category: 'Investigation graph', status: 'Backend required' },
  { id: 'ibm-aml', name: 'IBM AML', category: 'Financial records', status: 'Backend required' },
  { id: 'icij', name: 'ICIJ Offshore Leaks', category: 'Entity relationships', status: 'Backend required' },
  { id: 'police-uk', name: 'Data.police.uk', category: 'Location and timeline records', status: 'Backend required' },
];

export const searchResults: SearchResult[] = [
  ...persons.map((item) => ({ id: item.person_id, type: 'person' as const, label: item.name, secondary: `${item.person_id} · ${item.role}`, relatedCases: item.caseIds, relationshipCount: item.phoneIds.length + item.vehicleIds.length + item.accountIds.length + item.locationIds.length + item.caseIds.length, source: 'Synthetic NexusNet Data', lastActivity: '10 Sep 2026' })),
  ...cases.map((item) => ({ id: item.case_id, type: 'case' as const, label: item.case_id, secondary: `${item.fir_number} · ${item.crime_type}`, relatedCases: [item.case_id], relationshipCount: graphData.edges.filter((e) => e.source === item.case_id || e.target === item.case_id).length, source: 'Synthetic NexusNet Data', lastActivity: item.date_filed })),
  ...graphData.nodes.filter((n) => !['person', 'case'].includes(n.type)).map((node) => ({ id: node.id, type: node.type, label: node.label, secondary: node.id, relatedCases: evidence.filter((e) => e.entityA === node.id || e.entityB === node.id).map((e) => e.case_id), relationshipCount: graphData.edges.filter((e) => e.source === node.id || e.target === node.id).length, source: node.provenance?.sourceDataset, lastActivity: '08 Sep 2026' })),
];

export const assistantDemo: AssistantResponse = {
  answer: 'The selected cases are connected through two evidence-backed paths. CASE-001 and CASE-017 share a vehicle record and a person reference. CASE-017 and CASE-024 are connected through a recorded account-to-account transaction. These are investigative leads and require human verification.',
  recordCount: 6, entities: ['P-0044', 'VH-0201', 'P-0188', 'AC-0204', 'TX-0204', 'AC-0541'], cases: ['CASE-001', 'CASE-017', 'CASE-024'], evidenceIds: ['EV-101', 'EV-105', 'EV-106', 'EV-112', 'EV-113'],
  suggestedQuestions: ['What evidence supports the transaction path?', 'Show the shortest path between CASE-001 and CASE-024.', 'Which entities are common across these cases?'],
};
