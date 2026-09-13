# NexusNet Frontend–Backend Integration

> **Proposed frontend integration contract — backend team should adapt/confirm.**

The frontend is independently runnable in mock mode. None of the paths below are claimed to exist. Confirm naming, authentication, permissions, pagination, and response envelopes with the backend team before setting `VITE_USE_MOCK_DATA=false`.

## Runtime configuration

```env
VITE_USE_MOCK_DATA=true
VITE_API_BASE_URL=https://confirmed-backend.example/api
```

`VITE_API_BASE_URL` is read only by the HTTP adapter. UI components use `InvestigationService`, not `fetch`, so the transport can change without rewriting pages.

```text
UI component → InvestigationService → mock or HTTP adapter → backend
```

## Service methods

The current abstraction includes:

- `getDashboardStats()`
- `getCases()` and `getCase(caseId)`
- `getPersons()` and `getPerson(personId)`
- `searchEntities(query, type?)`
- `getGraph(caseIds?)`
- `getEvidence({ caseId?, priority? })`
- `getTimeline({ caseId?, eventType? })`
- `getDataSources()`
- `askInvestigator(question)`

Future adapters can add the specified methods for phones, vehicles, accounts, CDRs, transactions, FIR processing, entity resolution, hidden connections, cross-case analysis, retrieval, priority links and export. The associated UI is already separated from backend computation; the backend must return the result rather than asking the browser to infer investigative conclusions.

## Proposed response structures

### Case

```ts
interface CaseRecord {
  case_id: string;
  fir_number: string;
  crime_type: string;
  district: string;
  state: string;
  date_filed: string; // ISO-8601
  status: 'Active' | 'Under Review' | 'Closed';
  summary: string;
}
```

### Entity and search result

```ts
type EntityType =
  | 'person' | 'case' | 'phone' | 'vehicle'
  | 'account' | 'transaction' | 'location' | 'evidence';

interface SearchResult {
  id: string;
  type: EntityType;
  label: string;
  secondary: string;
  relatedCases: string[];
  relationshipCount: number;
  source?: string;
  lastActivity?: string; // ISO-8601 preferred
}
```

IDs must remain the canonical backend IDs. Human-readable labels do not replace them.

### Normalized graph

```ts
interface Provenance {
  sourceDataset: string;
  sourceRecordId: string;
  recordType: string;
}

interface GraphNode {
  id: string;
  type: EntityType;
  label: string;
  metadata: Record<string, string | number | string[]>;
  provenance?: Provenance;
}

interface GraphEdge {
  id: string;
  source: string; // node ID
  target: string; // node ID
  relationship: string;
  timestamp?: string; // ISO-8601
  evidenceIds: string[];
  provenance?: Provenance;
  priority?: 'High' | 'Medium' | 'Low';
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
```

The contract is source-agnostic: ICDAR FIR, POLE, IBM AML, ICIJ, Data.police.uk, synthetic or other configured operational sources map into the same structure. Do not send every raw CDR or transaction by default. Return a relevant subgraph and support server-side filters and lazy expansion.

### Evidence

```ts
interface Evidence {
  evidence_id: string;
  relationship: string;
  entityA: string;
  entityB: string;
  case_id: string;
  timestamp: string;
  evidenceType: string;
  supportingData: string;
  priority: 'High' | 'Medium' | 'Low';
  sourceReliability: string;
  provenance: Provenance;
}
```

Provenance should be omitted when unavailable, not fabricated. An edge should expose its evidence IDs so a user can move from connection to supporting record.

### Timeline

```ts
interface TimelineEvent {
  event_id: string;
  case_id: string;
  person_id?: string;
  event_type: string;
  timestamp: string;
  location: string;
  notes: string;
  source: string;
}
```

### Hidden connection

```ts
interface HiddenConnectionResponse {
  startEntityId: string;
  endEntityId: string;
  path: GraphData;
  orderedNodeIds: string[];
  orderedEdgeIds: string[];
  hopCount: number;
  caseIds: string[];
  evidenceIds: string[];
  priority?: 'High' | 'Medium' | 'Low';
}
```

The backend owns path-finding and link priority. The frontend only renders the result.

### Cross-case response

```ts
interface CrossCaseConnection {
  caseIds: string[];
  sharedEntityId: string;
  relationship: string;
  supportingRecordIds: string[];
  evidenceIds: string[];
  source?: Provenance;
}

interface CrossCaseResponse {
  graph: GraphData;
  connections: CrossCaseConnection[];
}
```

### Retrieval response

```ts
interface RetrievalResult {
  id: string;
  text: string;
  caseId?: string;
  entityIds: string[];
  evidenceIds: string[];
  relevanceScore?: number;
  provenance?: Provenance;
}
```

Relevance scores should be included only when provided by the retrieval backend. Retrieval implementation details (BM25, embeddings and reranking) stay behind the API.

### Investigator Assistant / GraphRAG response

```ts
interface AssistantResponse {
  answer: string;
  recordCount: number;
  entities: string[];
  cases: string[];
  evidenceIds: string[];
  suggestedQuestions: string[];
}
```

Answers should be read-only and grounded in returned records. Evidence/source IDs are rendered separately from the AI explanation. Do not provide invented citations.

## Error format

Proposed shape:

```json
{
  "error": {
    "code": "GRAPH_SCOPE_INVALID",
    "message": "The selected graph scope is not available.",
    "requestId": "optional-correlation-id",
    "details": {}
  }
}
```

Normal users receive a safe message; request IDs can be logged for technical support. Never return credentials, secrets or stack traces to the UI.

## Pagination and filtering

For search, cases, people, evidence, timeline, CDRs and transactions, confirm cursor-based pagination:

```json
{
  "items": [],
  "page": { "nextCursor": null, "hasMore": false, "total": 0 }
}
```

Recommended filters include `caseId`, repeated or comma-separated `caseIds`, `entityId`, `entityType`, `dateFrom`, `dateTo`, `source`, `priority`, `eventType`, `query`, `cursor` and `limit`. Dates should be ISO-8601 with an explicit offset or UTC `Z`. The frontend preserves meaningful filters in URL query parameters.

## FIR processing and export

The current FIR screen demonstrates UI states only. It does not upload a selected file or perform OCR. Confirm an authenticated upload mechanism, size/type limits, processing job status, retention policy and extraction response before integration.

Export buttons are honest placeholders in mock mode. Confirm server-generated PDF/CSV/report endpoints and authorization before enabling them.

## Integration checklist

1. Confirm endpoint paths and response envelopes.
2. Confirm authentication, roles and case-level authorization.
3. Add adapters from actual backend fields to the normalized frontend types.
4. Confirm pagination, filters, time zones and source registry.
5. Validate graph size limits and lazy node expansion.
6. Test error, empty, slow and partial-provenance responses.
7. Test evidence traceability from every important relationship.
8. Set environment values outside source control and disable mock mode.
9. Run typecheck, build, lint and the main investigation workflow.
