import { useMemo, useState } from 'react';
import { ArrowRight, BookOpenCheck, Filter, Search, ShieldCheck } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  EmptyState,
  PageHeader,
  Panel,
  PriorityIndicator,
  SourceBadge,
} from '../components/ui';
import { useInvestigation } from '../context/InvestigationContext';
import type { Evidence, Priority } from '../types/domain';

export function EvidencePage() {
  const { dataset } = useInvestigation();
  const [params, setParams] = useSearchParams();
  const caseId = params.get('caseId') ?? '';
  const [selected, setSelected] = useState<Evidence>();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => dataset.evidence.filter(
    (item) =>
      (!caseId || item.case_id === caseId) &&
      (!query ||
        `${item.evidence_id} ${item.relationship} ${item.entityA} ${item.entityB} ${item.provenance?.sourceRecordId ?? ''}`
          .toLowerCase()
          .includes(query.toLowerCase()))
  ), [caseId, dataset.evidence, query]);

  return (
    <>
      <PageHeader
        eyebrow="Evidence-first analysis"
        title="Evidence Explorer"
        description="Understand why a relationship is displayed and trace it to the supporting source record."
        actions={<><Link className="button button--secondary" to="/retrieval">Hybrid Retrieval</Link><Link className="button button--secondary" to="/priority-links">Priority Links</Link></>}
      />
      <Panel className="filter-panel">
        <div className="evidence-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search evidence ID, entity or source record"
          />
          <Filter size={15} />
          <select
            value={caseId}
            onChange={(e) => setParams(e.target.value ? { caseId: e.target.value } : {})}
          >
            <option value="">All cases</option>
            {dataset.cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_id}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {!visible.length ? (
        <Panel>
          <EmptyState
            title="No evidence records loaded"
            message="Upload police FIRs, CDR files, or bank statements in Data Ingestion to analyze evidence relationships."
          />
        </Panel>
      ) : (
        <div className="evidence-layout">
          <Panel
            title={`${visible.length} supporting records`}
            subtitle="Select a record to inspect provenance"
          >
            <div className="evidence-record-list">
              {visible.map((item) => (
                <button
                  className={selected?.evidence_id === item.evidence_id ? 'active' : ''}
                  onClick={() => setSelected(item)}
                  key={item.evidence_id}
                >
                  <BookOpenCheck size={18} />
                  <div>
                    <strong>{item.evidence_id}</strong>
                    <span>{item.relationship}</span>
                    <small>
                      {item.entityA} <ArrowRight size={11} /> {item.entityB}
                    </small>
                  </div>
                  <PriorityIndicator value={item.priority} />
                </button>
              ))}
            </div>
          </Panel>
          <Panel title="Evidence detail">
            {selected ? (
              <EvidenceDetail item={selected} />
            ) : (
              <EmptyState
                title="Select a supporting record"
                message="The complete provenance and relationship details will appear here."
              />
            )}
          </Panel>
        </div>
      )}
    </>
  );
}

function EvidenceDetail({ item }: { item: Evidence }) {
  return (
    <div className="evidence-detail">
      <div className="evidence-detail-head">
        <ShieldCheck />
        <div>
          <span>Evidence record</span>
          <h2>{item.evidence_id}</h2>
        </div>
        <PriorityIndicator value={item.priority} />
      </div>
      <section>
        <span>Relationship</span>
        <div className="relationship-display">
          <strong>{item.entityA}</strong>
          <span>
            {item.relationship}
            <ArrowRight size={14} />
          </span>
          <strong>{item.entityB}</strong>
        </div>
      </section>
      <section>
        <span>Supporting data</span>
        <p>{item.supportingData}</p>
      </section>
      <dl className="metadata">
        <div>
          <dt>Case</dt>
          <dd>{item.case_id}</dd>
        </div>
        <div>
          <dt>Evidence type</dt>
          <dd>{item.evidenceType}</dd>
        </div>
        <div>
          <dt>Date / time</dt>
          <dd>{new Date(item.timestamp).toLocaleString('en-IN')}</dd>
        </div>
        <div>
          <dt>Source reliability</dt>
          <dd>{item.sourceReliability}</dd>
        </div>
      </dl>
      {item.provenance && (
        <section>
          <span>Provenance</span>
          <SourceBadge>{item.provenance.sourceDataset}</SourceBadge>
          <dl className="metadata">
            <div>
              <dt>Source record ID</dt>
              <dd>{item.provenance.sourceRecordId}</dd>
            </div>
            <div>
              <dt>Record type</dt>
              <dd>{item.provenance.recordType}</dd>
            </div>
          </dl>
        </section>
      )}
      <p className="verification-note">
        This record supports a displayed relationship; it does not establish guilt. Investigator
        verification is required.
      </p>
    </div>
  );
}

export function PriorityLinksPage() {
  const { dataset } = useInvestigation();
  const [priority, setPriority] = useState('All');
  const scoredRecords = useMemo(() => {
    const pairCounts = new Map<string, number>();
    dataset.evidence.forEach(item => {
      const key = [item.entityA, item.entityB].sort().join('|');
      pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
    });
    const caseIds = new Set(dataset.cases.map(item => item.case_id));
    const casesByEntity = new Map<string, Set<string>>();
    dataset.graphData.edges.forEach(edge => {
      const caseId = caseIds.has(edge.source) ? edge.source : caseIds.has(edge.target) ? edge.target : '';
      const entityId = caseId === edge.source ? edge.target : caseId === edge.target ? edge.source : '';
      if (!caseId || !entityId) return;
      const linked = casesByEntity.get(entityId) ?? new Set<string>();
      linked.add(caseId);
      casesByEntity.set(entityId, linked);
    });
    return dataset.evidence.map(item => {
      let score = 0;
      const factors: string[] = [];
      if (/verified/i.test(item.sourceReliability)) { score += 35; factors.push('verified source'); }
      else { score += 20; factors.push('source requires verification'); }
      if (item.provenance.sourceDataset && item.provenance.sourceRecordId) { score += 15; factors.push('complete provenance'); }
      if (item.supportingData.trim().length >= 40) { score += 10; factors.push('substantive record'); }
      if ((pairCounts.get([item.entityA, item.entityB].sort().join('|')) ?? 0) > 1) { score += 15; factors.push('corroborated link'); }
      const linkedCases = new Set([...(casesByEntity.get(item.entityA) ?? []), ...(casesByEntity.get(item.entityB) ?? []), item.case_id]);
      if (linkedCases.size > 1) { score += 25; factors.push(`cross-case (${linkedCases.size} cases)`); }
      const calculatedPriority: Priority = score >= 70 ? 'High' : score >= 45 ? 'Medium' : 'Low';
      return { item, score, factors, calculatedPriority };
    }).sort((left, right) => right.score - left.score);
  }, [dataset.cases, dataset.evidence, dataset.graphData.edges]);
  const records = scoredRecords.filter(record => priority === 'All' || record.calculatedPriority === priority).slice(0, 9);
  const highCount = scoredRecords.filter(record => record.calculatedPriority === 'High').length;
  const verifiedCount = dataset.evidence.filter(
    (e) => e.sourceReliability === 'Record verified' || e.sourceReliability === 'Bank verified' || e.sourceReliability === 'Telecom verified'
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Explainable prioritization"
        title="Priority Links"
        description="Review relationships ordered by evidence strength and cross-case relevance—not guilt or legal conclusions."
      />
      <div className="priority-overview">
        <article>
          <strong>{highCount}</strong>
          <span>High priority links</span>
          <small>Review supporting evidence first</small>
        </article>
        <article>
          <strong>{verifiedCount}</strong>
          <span>Verified source records</span>
          <small>Directly backed by ingested data</small>
        </article>
        <article>
          <strong>{dataset.cases.length}</strong>
          <span>Active cases</span>
          <small>In current scope</small>
        </article>
      </div>

      <Panel
        title="Prioritized relationships"
        subtitle="Priority scores are derived from evidence strength and cross-case links"
        actions={
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option>All</option>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        }
      >
        {records.length === 0 ? (
          <EmptyState
            title="No prioritized relationships found"
            message="Upload files in Data Ingestion to analyze and prioritize relationship links."
          />
        ) : (
          <div className="priority-table">
            <div className="table-head">
              <span>Priority</span>
              <span>Relationship</span>
              <span>Entities</span>
              <span>Supporting factors</span>
              <span>Evidence</span>
            </div>
            {records.map(({ item, score, factors, calculatedPriority }) => (
              <article key={item.evidence_id}>
                <PriorityIndicator value={calculatedPriority} />
                <strong>{item.relationship}</strong>
                <span>
                  {item.entityA} → {item.entityB}
                </span>
                <span>
                  {score}/100 · {factors.join(' · ')}
                </span>
                <span>{item.evidence_id}</span>
              </article>
            ))}
          </div>
        )}
      </Panel>
      <p className="page-note">
        Link Priority helps focus review. It is not a guilt probability, criminal probability, or
        arrest prediction.
      </p>
    </>
  );
}
