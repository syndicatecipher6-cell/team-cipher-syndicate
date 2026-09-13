export type EntityType = 'person' | 'case' | 'phone' | 'vehicle' | 'account' | 'transaction' | 'location' | 'evidence';
export type Priority = 'High' | 'Medium' | 'Low';

export interface Provenance {
  sourceDataset: string;
  sourceRecordId: string;
  recordType: string;
}

export interface CaseRecord {
  case_id: string;
  fir_number: string;
  crime_type: string;
  district: string;
  state: string;
  date_filed: string;
  status: 'Active' | 'Under Review' | 'Closed';
  summary: string;
}

export interface Person {
  person_id: string;
  name: string;
  role: 'Suspect' | 'Witness' | 'Victim' | 'Person of Interest';
  caseIds: string[];
  phoneIds: string[];
  vehicleIds: string[];
  accountIds: string[];
  locationIds: string[];
}

export interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  metadata: Record<string, string | number | string[]>;
  provenance?: Provenance;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: string;
  timestamp?: string;
  evidenceIds: string[];
  provenance?: Provenance;
  priority?: Priority;
}

export interface GraphData { nodes: GraphNode[]; edges: GraphEdge[] }

export interface Evidence {
  evidence_id: string;
  relationship: string;
  entityA: string;
  entityB: string;
  case_id: string;
  timestamp: string;
  evidenceType: string;
  supportingData: string;
  priority: Priority;
  sourceReliability: string;
  provenance: Provenance;
}

export interface TimelineEvent {
  event_id: string;
  case_id: string;
  person_id?: string;
  event_type: string;
  timestamp: string;
  location: string;
  notes: string;
  source: string;
}

export interface SearchResult {
  id: string;
  type: EntityType;
  label: string;
  secondary: string;
  relatedCases: string[];
  relationshipCount: number;
  source?: string;
  lastActivity?: string;
}

export interface DashboardStats {
  cases: number;
  persons: number;
  phones: number;
  vehicles: number;
  transactions: number;
  cdrRecords: number;
}

export interface DataSource {
  id: string;
  name: string;
  category: string;
  status: 'Demo data' | 'Backend required';
}

export interface AssistantResponse {
  answer: string;
  recordCount: number;
  entities: string[];
  cases: string[];
  evidenceIds: string[];
  suggestedQuestions: string[];
}

export interface HiddenConnectionResponse {
  graph: GraphData;
  orderedNodeIds: string[];
  orderedEdgeIds: string[];
  hopCount: number;
  evidenceIds: string[];
  priority: Priority;
}

export interface CrossCaseConnection {
  caseIds: string[];
  sharedEntityId: string;
  sharedEntityType: EntityType;
  relationship: string;
  supportingRecordIds: string[];
  evidenceIds: string[];
  priority: Priority;
}

export interface CrossCaseResponse {
  graph: GraphData;
  connections: CrossCaseConnection[];
}
