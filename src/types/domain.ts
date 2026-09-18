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
  role: 'Suspect' | 'Witness' | 'Victim' | 'Complainant' | 'Officer' | 'Person of Interest';
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
  findings?: InvestigationFinding[];
  contradictions?: string[];
  unresolved?: string[];
  queryPlan?: string[];
  provider?: string;
  model?: string;
  warnings?: string[];
}

export type FindingStatus = 'Verified Fact' | 'Corroborated' | 'Inferred' | 'Unresolved';

export interface EvidenceCitation {
  evidence_id: string;
  source_dataset: string;
  source_record_id: string;
  record_type: string;
  excerpt: string;
}

export interface InvestigationFinding {
  status: FindingStatus;
  statement: string;
  confidence: number;
  citations: EvidenceCitation[];
}

export interface CaseIntelligenceBrief {
  case_id: string;
  overview: string;
  key_entities: string[];
  relationships: string[];
  linked_cases: string[];
  evidence: EvidenceCitation[];
  timeline: string[];
  contradictions: string[];
  gaps: string[];
  hypotheses: InvestigationFinding[];
  priorities: string[];
  generated_by: string;
  warnings: string[];
}

export type SandboxOperation =
  | 'IDENTITY_MERGE'
  | 'RELATIONSHIP_ADD'
  | 'RELATIONSHIP_REMOVE'
  | 'EVIDENCE_DISPUTE'
  | 'ENTITY_SPLIT'
  | 'TIMELINE_CHANGE';

export interface SandboxModificationInput {
  operation: SandboxOperation;
  parameters: Record<string, unknown>;
  rationale?: string;
  evidence_ids?: string[];
}

export interface SandboxModification extends SandboxModificationInput {
  modification_id: string;
  created_at: string;
  created_by: string;
}

export interface SandboxMetrics {
  node_count: number;
  relationship_count: number;
  community_count: number;
  affected_cases: string[];
  multi_hop_path_count: number;
  lpi: Record<string, number>;
  timeline_change_count: number;
}

export interface SandboxComparison {
  before: SandboxMetrics;
  after: SandboxMetrics;
  added_nodes: string[];
  removed_nodes: string[];
  added_relationships: string[];
  removed_relationships: string[];
  impact_summary: string[];
}

export interface SandboxSession {
  sandbox_id: string;
  base_case_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  status: 'active' | 'closed';
  label: 'HYPOTHETICAL / SANDBOX';
  modifications: SandboxModification[];
  comparison?: SandboxComparison;
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

export interface PipelineJob {
  id: string;
  fileName: string;
  fileType: 'csv' | 'json' | 'pdf' | 'text' | 'api';
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  nodesCreated?: number;
  edgesCreated?: number;
  errorMessage?: string;
  timestamp: string;
  fileSize?: string;
  stageMessage?: string;
}
