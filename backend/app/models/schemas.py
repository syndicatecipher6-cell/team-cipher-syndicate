from typing import List, Optional, Dict, Any, Union
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

class AssistantResponse(BaseModel):
    answer: str
    recordCount: int
    entities: List[str]
    cases: List[str]
    evidenceIds: List[str]
    suggestedQuestions: List[str]

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
