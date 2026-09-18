import { useState } from 'react';
import { ArrowRight, BookOpenCheck, Check, GitCompareArrows, Link2, Search } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EvidenceDrawer } from '../components/Drawers';
import { GraphView } from '../components/GraphView';
import {
  Button,
  EmptyState,
  EntityBadge,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  PriorityIndicator,
} from '../components/ui';
import { cases, searchResults } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { mockInvestigationService } from '../services/mockInvestigationService';
import type { GraphEdge } from '../types/domain';

export function HiddenConnectionsPage() {
  const [params, setParams] = useSearchParams();
  const options = searchResults.filter((result) =>
    ['person', 'phone', 'account', 'case', 'vehicle'].includes(result.type)
  );

  const defaultFrom = options[0]?.id ?? '';
  const defaultTo = options[1]?.id ?? '';
  const from = params.get('from') ?? defaultFrom;
  const to = params.get('to') ?? defaultTo;

  const [searched, setSearched] = useState(Boolean(from && to && options.length >= 2));
  const [edge, setEdge] = useState<GraphEdge>();

  const { data, loading, error, retry } = useAsync(
    () => (from && to ? mockInvestigationService.findHiddenConnection(from, to) : Promise.resolve(null)),
    [from, to],
  );

  if (options.length < 2) {
    return (
      <>
        <PageHeader
          eyebrow="Relationship discovery"
          title="Hidden Connection Finder"
          description="Find evidence-backed paths between two normalized entities. Results remain investigative leads until verified."
        />
        <Panel>
          <EmptyState
            title="No entities available for path analysis"
            message="Upload investigation records (FIR, CDR, Bank logs) in Data Ingestion to analyze entity connection paths."
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Relationship discovery"
        title="Hidden Connection Finder"
        description="Find evidence-backed paths between two normalized entities. Results remain investigative leads until verified."
      />
      <Panel className="connection-form">
        <div className="entity-picker">
          <label>
            Start entity
            <select
              value={from}
              onChange={(event) => {
                setSearched(false);
                setParams({ from: event.target.value, to });
              }}
            >
              {options.map((item) => (
                <option value={item.id} key={item.id}>
                  {item.label} · {item.id}
                </option>
              ))}
            </select>
          </label>
          <div className="connection-line">
            <span />
            <Link2 />
          </div>
          <label>
            End entity
            <select
              value={to}
              onChange={(event) => {
                setSearched(false);
                setParams({ from, to: event.target.value });
              }}
            >
              {options
                .filter((item) => item.id !== from)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label} · {item.id}
                  </option>
                ))}
            </select>
          </label>
          <Button onClick={() => setSearched(true)}>
            <Search size={16} />
            Find connection
          </Button>
        </div>
      </Panel>

      {searched &&
        (loading ? (
          <LoadingState label="Finding connection path..." />
        ) : error || !data ? (
          <ErrorState message={error || 'No path found between selected entities.'} retry={() => void retry()} />
        ) : data.orderedNodeIds.length === 0 ? (
          <Panel>
            <EmptyState
              title="No path found"
              message={`No direct or indirect connections found between ${from} and ${to} in the current dataset.`}
            />
          </Panel>
        ) : (
          <>
            <div className="connection-summary">
              <article>
                <span>Shortest path</span>
                <strong>{data.hopCount} hops</strong>
              </article>
              <article>
                <span>Intermediate entities</span>
                <strong>{Math.max(0, data.orderedNodeIds.length - 2)}</strong>
              </article>
              <article>
                <span>Supporting records</span>
                <strong>{data.evidenceIds.length}</strong>
              </article>
              <article>
                <span>Link priority</span>
                <PriorityIndicator value={data.priority} />
              </article>
            </div>
            <Panel
              title={`${from} to ${to}`}
              subtitle="Select any relationship to inspect its supporting evidence"
            >
              <GraphView
                data={data.graph}
                selectedPath={[...data.orderedNodeIds, ...data.orderedEdgeIds]}
                onEdgeSelect={setEdge}
              />
            </Panel>
            <Panel title="Connection path">
              <div className="path-strip">
                {data.orderedNodeIds.map((id, index) => {
                  const node = data.graph.nodes.find((item) => item.id === id);
                  return node ? (
                    <div key={id}>
                      <article>
                        <EntityBadge type={node.type} />
                        <strong>{node.label}</strong>
                        <span>{node.id}</span>
                      </article>
                      {index < data.orderedNodeIds.length - 1 && <ArrowRight />}
                    </div>
                  ) : null;
                })}
              </div>
              <p className="verification-note">
                Path discovered from active records. Review each supporting record before using
                this as an investigative finding.
              </p>
            </Panel>
          </>
        ))}
      <EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
    </>
  );
}

export function CrossCasePage() {
  const [params, setParams] = useSearchParams();
  const initial =
    params.get('cases')?.split(',').filter(Boolean) ?? cases.map((item) => item.case_id);
  const [selected, setSelected] = useState(initial);
  const [analysedCases, setAnalysedCases] = useState(initial);

  const { data, loading, error, retry } = useAsync(
    () =>
      analysedCases.length >= 2
        ? mockInvestigationService.findCrossCaseConnections(analysedCases)
        : Promise.resolve({ graph: { nodes: [], edges: [] }, connections: [] }),
    [analysedCases],
  );

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );

  if (cases.length < 2) {
    return (
      <>
        <PageHeader
          eyebrow="Multi-case analysis"
          title="Cross-Case Finder"
          description="Answer “what connects these cases?” using shared entities and their supporting records."
        />
        <Panel>
          <EmptyState
            title="No cases loaded for cross-case comparison"
            message="Upload two or more police FIRs or CSV case records in Data Ingestion to analyze shared suspects, devices, and financial links."
          />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Multi-case analysis"
        title="Cross-Case Finder"
        description="Answer “what connects these cases?” using shared entities and their supporting records."
      />
      <Panel title="Select investigations" subtitle="Choose two or more cases to compare">
        <div className="case-selector">
          {cases.map((item) => (
            <button
              className={selected.includes(item.case_id) ? 'selected' : ''}
              onClick={() => toggle(item.case_id)}
              key={item.case_id}
            >
              <span>{selected.includes(item.case_id) && <Check size={13} />}</span>
              <div>
                <strong>{item.case_id}</strong>
                <small>
                  {item.crime_type} · {item.district}
                </small>
              </div>
            </button>
          ))}
          <Button
            disabled={selected.length < 2}
            onClick={() => {
              setParams({ cases: selected.join(',') });
              setAnalysedCases(selected);
            }}
          >
            <GitCompareArrows size={16} />
            Compare {selected.length} cases
          </Button>
        </div>
      </Panel>

      {loading ? (
        <LoadingState label="Comparing selected cases..." />
      ) : error || !data ? (
        <ErrorState message={error} retry={() => void retry()} />
      ) : (
        <div className="two-column two-column--wide">
          <Panel
            title="Cross-case network"
            subtitle={`${analysedCases.length} cases in current scope`}
          >
            <GraphView data={data.graph} compact />
          </Panel>
          <Panel
            title={`${data.connections.length} connections identified`}
            subtitle="Each result is backed by the listed records"
          >
            {data.connections.length ? (
              <div className="shared-list">
                {data.connections.map((item) => (
                  <article key={item.sharedEntityId}>
                    <div>
                      <EntityBadge type={item.sharedEntityType} />
                      <PriorityIndicator value={item.priority} />
                    </div>
                    <h3>
                      {item.caseIds[0]} <ArrowRight size={14} /> {item.caseIds[1]}
                    </h3>
                    <strong>{item.sharedEntityId}</strong>
                    <p>{item.relationship}</p>
                    <span>
                      <BookOpenCheck size={13} /> {item.supportingRecordIds.length} records ·{' '}
                      {item.evidenceIds.join(', ')}
                    </span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No cross-case connections found"
                message="The selected cases do not share any common entities or communication trails."
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
