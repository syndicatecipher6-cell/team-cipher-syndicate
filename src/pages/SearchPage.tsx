import { useCallback, useState } from 'react';
import { ArrowUpRight, Filter, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, EntityBadge, ErrorState, LoadingState, PageHeader, Panel, SourceBadge } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const type = params.get('type') ?? 'all';
  const loader = useCallback(() => investigationService.searchEntities(params.get('q') ?? '', type), [params, type]);
  const { data, loading, error, retry } = useAsync(loader, [loader]);
  const submit = (event: React.FormEvent) => { event.preventDefault(); setParams((current) => { const next = new URLSearchParams(current); if (query) next.set('q', query); else next.delete('q'); return next; }); };
  return <><PageHeader eyebrow="Unified entity index" title="Entity Search" description="Search normalized people, cases, phones, vehicles, accounts, transactions, locations and evidence." />
    <Panel className="search-workspace"><form className="large-search" onSubmit={submit}><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name, ID, phone, vehicle, FIR, account, transaction or location"/><button>Search records</button></form><div className="filter-row filter-bar"><Filter size={15} /><span>Entity type</span>{['all', 'person', 'case', 'phone', 'vehicle', 'account', 'transaction', 'location'].map((item) => <button key={item} className={type === item ? 'active' : ''} onClick={() => setParams((current) => { const next = new URLSearchParams(current); if (item === 'all') next.delete('type'); else next.set('type', item); return next; })}>{item === 'all' ? 'All records' : item}</button>)}</div></Panel>
    {loading ? <LoadingState /> : error ? <ErrorState message={error} retry={() => void retry()} /> : !data?.length ? <EmptyState title="No matching investigation records" /> : <Panel title={`${data.length} records found`} subtitle="Results are from the current mock investigation scope"><div className="results-table"><div className="table-head"><span>Record</span><span>Related cases</span><span>Connections</span><span>Source</span><span /></div>{data.map((item) => { const path = item.type === 'person' ? `/persons/${item.id}` : item.type === 'case' ? `/cases/${item.id}` : `/graph?entityId=${item.id}`; return <Link to={path} className="table-row" key={item.id}><span className="record-cell"><EntityBadge type={item.type} /><span><strong>{item.label}</strong><small>{item.secondary}</small></span></span><span>{item.relatedCases.length ? item.relatedCases.join(', ') : '—'}</span><span>{item.relationshipCount}</span><span>{item.source ? <SourceBadge>{item.source}</SourceBadge> : 'Not provided'}</span><span><ArrowUpRight size={16} /></span></Link>;})}</div></Panel>}
  </>;
}
