import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BriefcaseBusiness,
  Download,
  Network,
  Sparkles,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GraphView } from '../components/GraphView';
import { EntityDetailsPanel, EvidenceDrawer } from '../components/Drawers';
import { Button, PageHeader, Panel, StatCard } from '../components/ui';
import { useInvestigation } from '../context/InvestigationContext';
import type { GraphEdge, GraphNode } from '../types/domain';

export function DashboardPage() {
  const { dataset, isDataLoaded, loadSampleSIHData } = useInvestigation();
  const [selectedCase, setSelectedCase] = useState('');
  const [node, setNode] = useState<GraphNode>();
  const [edge, setEdge] = useState<GraphEdge>();
  const [timeRange, setTimeRange] = useState('Last 7 Days');
  const navigate = useNavigate();

  const handleGenerateReport = () => {
    if (!isDataLoaded) {
      alert('No data available to generate a report. Please upload investigation files first.');
      return;
    }
    alert(
      `Intelligence Report Generated:\n\nActive Cases: ${dataset.cases.length}\nTotal Tracked Entities: ${
        dataset.persons.length + dataset.phones.length + dataset.vehicles.length
      }\nHigh Risk Alerts: ${dataset.stats.alerts}\n\nEvidence-grounded dossier ready for review.`
    );
  };

  const filteredGraph = selectedCase
    ? {
        nodes: dataset.graphData.nodes.filter(
          (item) =>
            item.id === selectedCase ||
            dataset.graphData.edges.some(
              (relationship) =>
                (relationship.source === selectedCase && relationship.target === item.id) ||
                (relationship.target === selectedCase && relationship.source === item.id)
            )
        ),
        edges: dataset.graphData.edges.filter(
          (relationship) => relationship.source === selectedCase || relationship.target === selectedCase
        ),
      }
    : dataset.graphData;

  const totalEntities =
    dataset.persons.length +
    dataset.phones.length +
    dataset.vehicles.length +
    dataset.accounts.length;

  return (
    <>
      <PageHeader
        eyebrow="Investigation workspace"
        title="Good Morning, Investigator"
        description="Review investigations, connections, and emerging leads from uploaded records."
        actions={(
          <>
            <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)} aria-label="Dashboard time range">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>All Time</option>
            </select>
            <Button variant="secondary" onClick={handleGenerateReport}><Download size={16} />Export report</Button>
            <Button onClick={() => navigate('/ingestion')}><UploadCloud size={16} />Upload files</Button>
          </>
        )}
      />

      <div className="stats-grid">
        <StatCard label="Active cases" value={dataset.cases.length.toString()} detail="Uploaded investigation files" icon={<BriefcaseBusiness />} />
        <StatCard label="Tracked entities" value={totalEntities.toString()} detail="Normalized identifiers" icon={<Users />} />
        <StatCard label="Identified networks" value={dataset.stats.networks.toString()} detail={dataset.stats.networks ? 'Detected case modules' : 'Waiting for data'} icon={<Network />} />
        <StatCard label="High-risk alerts" value={dataset.stats.alerts.toString()} detail="Evidence-linked findings" icon={<AlertTriangle />} />
      </div>

      {!isDataLoaded ? (
        <div className="clean-workspace-card reference-clean-state">
          <div className="clean-icon-circle"><UploadCloud size={32} /></div>
          <h2>Workspace is ready for investigation data</h2>
          <p>Upload FIRs or other supported records to extract entities, resolve identities, and discover cross-case relationships.</p>
          <div className="clean-actions-row">
            <button className="primary-action-btn" onClick={() => navigate('/ingestion')}><UploadCloud size={16} />Go to Data Ingestion</button>
            <button className="secondary-action-btn" onClick={() => void loadSampleSIHData()}><Sparkles size={16} />Load Sample SIH Dataset</button>
          </div>
        </div>
      ) : (
        <>
          <Panel
            title="Multi-case knowledge graph"
            subtitle="Connections discovered across uploaded investigations"
            actions={(
              <div className="filter-row">
                <select value={selectedCase} onChange={(event) => setSelectedCase(event.target.value)} aria-label="Case scope">
                  <option value="">All active cases</option>
                  {dataset.cases.map((item) => <option key={item.case_id} value={item.case_id}>{item.case_id} — {item.crime_type}</option>)}
                </select>
                <Button variant="quiet" onClick={() => setSelectedCase('')}><Network size={15} />Reset scope</Button>
              </div>
            )}
          >
            <GraphView
              data={filteredGraph}
              onNodeSelect={(item) => { setEdge(undefined); setNode(item); }}
              onEdgeSelect={(item) => { setNode(undefined); setEdge(item); }}
            />
          </Panel>

          <div className="dashboard-bottom">
            <Panel title="Recent investigation activity" subtitle={`${dataset.timelineEvents.length} recorded events`}>
              <div className="activity-list">
                {dataset.timelineEvents.length ? dataset.timelineEvents.slice(0, 5).map((event) => (
                  <article key={event.event_id}>
                    <span className="activity-icon"><Activity size={15} /></span>
                    <div><strong>{event.event_type}</strong><p>{event.notes}</p><small>{event.case_id}{event.location ? ` · ${event.location}` : ''}</small></div>
                  </article>
                )) : <p className="empty-feed-text">No chronological events found in the uploaded files.</p>}
              </div>
            </Panel>

            <Panel title="High-risk alerts & anomalies" subtitle="Priority review queue">
              <div className="insight-list">
                {dataset.alerts.length ? dataset.alerts.slice(0, 4).map((alert) => (
                  <article key={alert.id}>
                    <i className={alert.priority === 'High' ? 'high' : 'medium'} />
                    <div><strong>{alert.title}</strong><p>{alert.description}</p><span>{alert.priority} priority · Investigator review required</span></div>
                  </article>
                )) : <p className="empty-feed-text">No anomalies detected in the current scope.</p>}
              </div>
            </Panel>
          </div>
        </>
      )}

      <EntityDetailsPanel node={node} onClose={() => setNode(undefined)} />
      <EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
    </>
  );
}
