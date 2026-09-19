import { useState } from 'react';
import { BookOpenCheck, Search, SlidersHorizontal } from 'lucide-react';
import { Button, EmptyState, PageHeader, Panel, SourceBadge } from '../components/ui';
import { apiConfig } from '../config/api';
import { useInvestigation } from '../context/InvestigationContext';
import { getBackendAuthHeaders } from '../security/demoSession';

interface HybridResult {
  id: string;
  type: string;
  text: string;
  score: number;
  case_id: string;
  provenance: { sourceDataset?: string; sourceRecordId?: string; recordType?: string };
  entity_ids: string[];
}

export function RetrievalPage() {
  const { dataset } = useInvestigation();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<HybridResult[]>([]);
  const [method, setMethod] = useState('BM25 + reranking');
  const [loading, setLoading] = useState(false);

  const runSearch = async (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    setSubmitted(normalized);
    setLoading(true);
    try {
      const response = await fetch(`${apiConfig.baseUrl}/retrieval/search`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...getBackendAuthHeaders(),
        },
        body: JSON.stringify({ query: normalized, evidence: dataset.evidence, cases: dataset.cases, top_k: 8 }),
      });
      if (!response.ok) throw new Error(`Retrieval service returned ${response.status}.`);
      const payload = await response.json() as { results: HybridResult[]; method: string };
      setResults(payload.results);
      setMethod(payload.method);
    } catch {
      const needle = normalized.toLowerCase();
      setResults(dataset.evidence.filter(item =>
        `${item.evidence_id} ${item.relationship} ${item.entityA} ${item.entityB} ${item.supportingData} ${item.case_id}`
          .toLowerCase().includes(needle)
      ).slice(0, 8).map(item => ({
        id: item.evidence_id,
        type: 'evidence',
        text: item.supportingData,
        score: 0.5,
        case_id: item.case_id,
        provenance: item.provenance,
        entity_ids: [item.entityA, item.entityB],
      })));
      setMethod('Local keyword fallback — backend retrieval unavailable');
    } finally {
      setLoading(false);
    }
  };

  const dynamicSuggestions = [
    dataset.cases[0] ? `Show evidence for ${dataset.cases[0].case_id}` : '',
    dataset.persons[0] ? `Find records mentioning ${dataset.persons[0].name}` : '',
    'Search CDR call communication logs',
    'Find financial account transactions',
  ].filter(Boolean);

  const relatedEntityIds = Array.from(
    new Set(results.flatMap((r) => [...r.entity_ids, r.case_id]))
  ).slice(0, 6);

  return (
    <>
      <PageHeader
        eyebrow="Hybrid evidence retrieval"
        title="Retrieval"
        description="Search FIR text and supporting records through the backend retrieval service."
      />
      <Panel className="retrieval-hero">
        <span className="eyebrow">Investigation evidence search</span>
        <h2>What records do you need to find?</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch(query);
          }}
        >
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Search suspect name, phone number, vehicle, or case ID..."
          />
          <Button disabled={loading}>{loading ? 'Searching...' : 'Search evidence'}</Button>
        </form>
        {dynamicSuggestions.length > 0 && (
          <div className="prompt-suggestions">
            {dynamicSuggestions.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setQuery(prompt);
                  void runSearch(prompt);
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
      </Panel>

      {submitted ? (
        <div className="retrieval-layout">
          <Panel
            title={`${results.length} relevant records`}
            subtitle={`Results for “${submitted}”`}
            actions={
              <Button variant="quiet">
                <SlidersHorizontal size={14} />
                Filters
              </Button>
            }
          >
            {results.length === 0 ? (
              <EmptyState
                title="No matching records found"
                message="No evidence records matched your search query in current ingested data."
              />
            ) : (
              <div className="retrieval-results">
                {results.map((item) => (
                  <article key={item.id}>
                    <header>
                      <BookOpenCheck />
                      <strong>{item.id}</strong>
                      <span>Relevance {Math.round(item.score * 100)}%</span>
                    </header>
                    <p>{item.text}</p>
                    <div>
                      <SourceBadge>{item.provenance.sourceDataset || 'Uploaded records'}</SourceBadge>
                      <span>{item.case_id}</span>
                      <span>{item.provenance.sourceRecordId}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Search context">
            <dl className="metadata">
              <div>
                <dt>Search scope</dt>
                <dd>{dataset.evidence.length} ingested records</dd>
              </div>
              <div>
                <dt>Matching cases</dt>
                <dd>{dataset.cases.length} active</dd>
              </div>
              <div>
                <dt>Backend method</dt>
                <dd>{method}</dd>
              </div>
            </dl>
            {relatedEntityIds.length > 0 && (
              <>
                <h3>Related entities</h3>
                <div className="id-chips">
                  {relatedEntityIds.map((id) => (
                    <span key={id}>{id}</span>
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      ) : (
        <EmptyState
          title="Enter an investigative query"
          message="Search results will include relevant text, entity references, source records and available evidence."
        />
      )}
    </>
  );
}
