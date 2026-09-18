from typing import List, Optional, Dict, Any, Union, Literal
from pydantic import BaseModel, Field

class Provenance(BaseModel):
    sourceDataset: str = ""
    sourceRecordId: str = ""
    recordType: str = ""

class CaseRecord(BaseModel):
    case_id: str
    fir_number: str
    crime_type: str
    district: str
    state: str
    date_filed: str
    status: str = "Active"
    summary: str

class Person(BaseModel):
    person_id: str
    name: str
    role: str
    caseIds: List[str] = Field(default_factory=list)
    phoneIds: List[str] = Field(default_factory=list)
    vehicleIds: List[str] = Field(default_factory=list)
    accountIds: List[str] = Field(default_factory=list)
    locationIds: List[str] = Field(default_factory=list)

class GraphNode(BaseModel):
    id: str
    type: str
    label: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    provenance: Optional[Provenance] = None

class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: str
    timestamp: Optional[str] = None
    evidenceIds: List[str] = Field(default_factory=list)
    provenance: Optional[Provenance] = None
    priority: Optional[str] = "Medium"

class GraphData(BaseModel):
    nodes: List[GraphNode] = Field(default_factory=list)
    edges: List[GraphEdge] = Field(default_factory=list)

class Evidence(BaseModel):
    evidence_id: str
    relationship: str
    entityA: str
    entityB: str
    case_id: str
    timestamp: str
    evidenceType: str
    supportingData: str
    priority: str = "Medium"
    sourceReliability: str = "Record verified"
    provenance: Provenance

class TimelineEvent(BaseModel):
    event_id: str
    case_id: str
    person_id: Optional[str] = None
    event_type: str
    timestamp: str
    location: str
    notes: str
    source: str

class SearchResult(BaseModel):
    id: str
    type: str
    label: str
    secondary: str
    relatedCases: List[str] = Field(default_factory=list)
    relationshipCount: int = 0
    source: Optional[str] = None
    lastActivity: Optional[str] = None

class DashboardStats(BaseModel):
    cases: int = 0
    persons: int = 0
    phones: int = 0
    vehicles: int = 0
    transactions: int = 0
    cdrRecords: int = 0
    networks: int = 0
    alerts: int = 0

class DataSource(BaseModel):
    id: str
    name: str
    category: str
    status: str

class HiddenConnectionResponse(BaseModel):
    graph: GraphData
    orderedNodeIds: List[str]
    orderedEdgeIds: List[str]
    hopCount: int
    evidenceIds: List[str]
    priority: str

class CrossCaseConnection(BaseModel):
    caseIds: List[str]
    sharedEntityId: str
    sharedEntityType: str
    relationship: str
    supportingRecordIds: List[str]
    evidenceIds: List[str]
    priority: str

class CrossCaseResponse(BaseModel):
    graph: GraphData
    connections: List[CrossCaseConnection]

class RetrievalSearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=1000)
    evidence: List[Evidence] = Field(default_factory=list)
    cases: List[CaseRecord] = Field(default_factory=list)
    top_k: int = Field(default=8, ge=1, le=25)

class RetrievalSearchResult(BaseModel):
    id: str
    type: str
    text: str
    score: float
    case_id: str
    provenance: Dict[str, Any] = Field(default_factory=dict)
    entity_ids: List[str] = Field(default_factory=list)

class RetrievalSearchResponse(BaseModel):
    results: List[RetrievalSearchResult] = Field(default_factory=list)
    method: str
    cross_encoder_enabled: bool = False

class AssistantResponse(BaseModel):
    answer: str
    recordCount: int
    entities: List[str]
    cases: List[str]
    evidenceIds: List[str]
    suggestedQuestions: List[str]
    findings: List["InvestigationFinding"] = Field(default_factory=list)
    contradictions: List[str] = Field(default_factory=list)
    unresolved: List[str] = Field(default_factory=list)
    queryPlan: List[str] = Field(default_factory=list)
    provider: str = "deterministic-grounded"
    model: str = "none"
    warnings: List[str] = Field(default_factory=list)

class EvidenceCitation(BaseModel):
    evidence_id: str
    source_dataset: str = ""
    source_record_id: str = ""
    record_type: str = ""
    excerpt: str = ""

class InvestigationFinding(BaseModel):
    status: Literal["Verified Fact", "Corroborated", "Inferred", "Unresolved"]
    statement: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    citations: List[EvidenceCitation] = Field(default_factory=list)

class AssistantQueryRequest(BaseModel):
    question: str = Field(min_length=2, max_length=2000)
    case_id: Optional[str] = None
    sandbox_id: Optional[str] = None

class CaseIntelligenceBrief(BaseModel):
    case_id: str
    overview: str
    key_entities: List[str] = Field(default_factory=list)
    relationships: List[str] = Field(default_factory=list)
    linked_cases: List[str] = Field(default_factory=list)
    evidence: List[EvidenceCitation] = Field(default_factory=list)
    timeline: List[str] = Field(default_factory=list)
    contradictions: List[str] = Field(default_factory=list)
    gaps: List[str] = Field(default_factory=list)
    hypotheses: List[InvestigationFinding] = Field(default_factory=list)
    priorities: List[str] = Field(default_factory=list)
    generated_by: str = "deterministic-grounded"
    warnings: List[str] = Field(default_factory=list)

SandboxOperation = Literal[
    "IDENTITY_MERGE",
    "RELATIONSHIP_ADD",
    "RELATIONSHIP_REMOVE",
    "EVIDENCE_DISPUTE",
    "ENTITY_SPLIT",
    "TIMELINE_CHANGE",
]

class SandboxModificationInput(BaseModel):
    operation: SandboxOperation
    parameters: Dict[str, Any] = Field(default_factory=dict)
    rationale: str = Field(default="", max_length=1000)
    evidence_ids: List[str] = Field(default_factory=list)

class SandboxModification(SandboxModificationInput):
    modification_id: str
    created_at: str
    created_by: str

class SandboxCreateRequest(BaseModel):
    base_case_id: str

class SandboxMetrics(BaseModel):
    node_count: int = 0
    relationship_count: int = 0
    community_count: int = 0
    affected_cases: List[str] = Field(default_factory=list)
    multi_hop_path_count: int = 0
    lpi: Dict[str, float] = Field(default_factory=dict)
    timeline_change_count: int = 0

class SandboxComparison(BaseModel):
    before: SandboxMetrics
    after: SandboxMetrics
    added_nodes: List[str] = Field(default_factory=list)
    removed_nodes: List[str] = Field(default_factory=list)
    added_relationships: List[str] = Field(default_factory=list)
    removed_relationships: List[str] = Field(default_factory=list)
    impact_summary: List[str] = Field(default_factory=list)

class SandboxSession(BaseModel):
    sandbox_id: str
    base_case_id: str
    created_by: str
    created_at: str
    updated_at: str
    status: Literal["active", "closed"] = "active"
    label: str = "HYPOTHETICAL / SANDBOX"
    modifications: List[SandboxModification] = Field(default_factory=list)
    comparison: Optional[SandboxComparison] = None

class PipelineJob(BaseModel):
    id: str
    fileName: str
    fileType: str
    status: str
    progress: int
    fileSize: str
    nodesCreated: Optional[int] = None
    edgesCreated: Optional[int] = None
    stageMessage: Optional[str] = None
    errorMessage: Optional[str] = None
    timestamp: str


AssistantResponse.model_rebuild()
