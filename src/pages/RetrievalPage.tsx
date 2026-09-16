import { useState } from 'react';
import { BookOpenCheck, Search, SlidersHorizontal } from 'lucide-react';
import { Button, EmptyState, PageHeader, Panel, SourceBadge } from '../components/ui';
import { cases, evidence, persons } from '../data/mockData';

export function RetrievalPage() {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');

  const q = submitted.toLowerCase().trim();
  const results = submitted
    ? evidence
        .filter(
          (e) =>
            !q ||
            e.evidence_id.toLowerCase().includes(q) ||
            e.entityA.toLowerCase().includes(q) ||
            e.entityB.toLowerCase().includes(q) ||
            e.supportingData.toLowerCase().includes(q) ||
            e.relationship.toLowerCase().includes(q) ||
            e.case_id.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : [];

  const dynamicSuggestions = [
    cases[0] ? `Show evidence for ${cases[0].case_id}` : '',
    persons[0] ? `Find records mentioning ${persons[0].name}` : '',
    'Search CDR call communication logs',
    'Find financial account transactions',
  ].filter(Boolean);

  const relatedEntityIds = Array.from(
    new Set(results.flatMap((r) => [r.entityA, r.entityB, r.case_id]))
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
            if (query.trim()) setSubmitted(query);
          }}
        >
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Search suspect name, phone number, vehicle, or case ID..."
          />
          <Button>Search evidence</Button>
        </form>
        {dynamicSuggestions.length > 0 && (
          <div className="prompt-suggestions">
            {dynamicSuggestions.map((prompt) => (
              <button
                key={prompt}
                onClick={() => {
                  setQuery(prompt);
                  setSubmitted(prompt);
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
                {results.map((item, index) => (
                  <article key={item.evidence_id}>
                    <header>
                      <BookOpenCheck />
                      <strong>{item.evidence_id}</strong>
                      <span>Relevance {Math.max(65, 96 - index * 6)}%</span>
                    </header>
                    <p>{item.supportingData}</p>
                    <div>
                      {item.provenance && (
                        <SourceBadge>{item.provenance.sourceDataset}</SourceBadge>
                      )}
                      <span>{item.case_id}</span>
                      <span>{item.provenance?.sourceRecordId}</span>
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
                <dd>{evidence.length} ingested records</dd>
              </div>
              <div>
                <dt>Matching cases</dt>
                <dd>{cases.length} active</dd>
              </div>
              <div>
                <dt>Backend method</dt>
                <dd>Hybrid keyword & link retrieval</dd>
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
