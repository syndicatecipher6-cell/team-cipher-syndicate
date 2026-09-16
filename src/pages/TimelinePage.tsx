import { useCallback } from 'react';
import { CalendarDays, Filter, MapPin } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Panel,
  SourceBadge,
} from '../components/ui';
import { cases } from '../data/mockData';
import { useAsync } from '../hooks/useAsync';
import { investigationService } from '../services';

export function TimelinePage() {
  const [params, setParams] = useSearchParams();
  const caseId = params.get('caseId') ?? '';
  const loader = useCallback(
    () => investigationService.getTimeline(caseId ? { caseId } : undefined),
    [caseId]
  );
  const { data, loading, error, retry } = useAsync(loader, [loader]);

  return (
    <>
      <PageHeader
        eyebrow="Chronological intelligence"
        title="Investigation Timeline"
        description="Review case, person and cross-case events in a shared chronological sequence."
      />
      <Panel className="filter-panel">
        <div className="graph-filter-bar">
          <Filter size={15} />
          <label>
            Case
            <select
              value={caseId}
              onChange={(e) => setParams(e.target.value ? { caseId: e.target.value } : {})}
            >
              <option value="">All cases</option>
              {cases.map((c) => (
                <option key={c.case_id} value={c.case_id}>
                  {c.case_id}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date from
            <input type="date" />
          </label>
          <label>
            Date to
            <input type="date" />
          </label>
          <label>
            Event type
            <select>
              <option>All event types</option>
              <option>Communication record</option>
              <option>Transaction recorded</option>
              <option>Location overlap</option>
              <option>FIR registered</option>
            </select>
          </label>
        </div>
      </Panel>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} retry={() => void retry()} />
      ) : !data?.length ? (
        <Panel>
          <EmptyState
            title="No timeline events found"
            message="Upload CDR logs, transaction histories, or case event files in Data Ingestion to generate chronological events."
          />
        </Panel>
      ) : (
        <Panel
          title={`${data.length} chronological events`}
          subtitle="Events sequenced chronologically from active records"
        >
          <div className="timeline-full">
            {[...data]
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
              .map((event) => (
                <article key={event.event_id}>
                  <div className="timeline-date">
                    <strong>
                      {new Date(event.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </strong>
                    <span>{new Date(event.timestamp).getFullYear()}</span>
                  </div>
                  <div className="timeline-marker">
                    <i />
                    <span />
                  </div>
                  <div className="timeline-event-card">
                    <header>
                      <div>
                        <CalendarDays size={16} />
                        <strong>{event.event_type}</strong>
                      </div>
                      <SourceBadge>{event.source}</SourceBadge>
                    </header>
                    <p>{event.notes}</p>
                    <footer>
                      <span>{event.case_id}</span>
                      {event.person_id && <span>{event.person_id}</span>}
                      <span>
                        <MapPin size={12} />
                        {event.location}
                      </span>
                      <time>
                        {new Date(event.timestamp).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </time>
                    </footer>
                  </div>
                </article>
              ))}
          </div>
        </Panel>
      )}
    </>
  );
}
