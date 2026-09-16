import { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Folder,
  Network,
  Sparkles,
  UploadCloud,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GraphView } from '../components/GraphView';
import { EntityDetailsPanel, EvidenceDrawer } from '../components/Drawers';
import { useInvestigation } from '../context/InvestigationContext';
import type { GraphEdge, GraphNode } from '../types/domain';

export function DashboardPage() {
  const { dataset, isDataLoaded, loadSampleSIHData } = useInvestigation();
  const [selectedCase, setSelectedCase] = useState<string>('');
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
          (n) =>
            n.id === selectedCase ||
            dataset.graphData.edges.some(
              (e) =>
                (e.source === selectedCase && e.target === n.id) ||
                (e.target === selectedCase && e.source === n.id)
            )
        ),
        edges: dataset.graphData.edges.filter(
          (e) => e.source === selectedCase || e.target === selectedCase
        ),
      }
    : dataset.graphData;

  const totalEntities =
    dataset.persons.length +
    dataset.phones.length +
    dataset.vehicles.length +
    dataset.accounts.length;

  return (
    <div className="dashboard-wrapper">
      {/* Top Header Row */}
      <div className="dashboard-header-block">
        <div>
          <h1 className="dashboard-title">Crime & Network Analytics</h1>
          <p className="dashboard-subtitle">
            Overview of active investigations and detected network patterns.
          </p>
        </div>

        <div className="dashboard-controls-row">
          <select
            className="time-range-select"
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
          >
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>All Time</option>
          </select>

          <button className="generate-report-btn" onClick={handleGenerateReport}>
            Generate Report
          </button>
        </div>
      </div>

      {/* 4 Analytics Stat Cards (Exact match to Screenshot 2) */}
      <div className="analytics-kpi-grid">
        {/* Card 1: Active Cases */}
        <div className="analytics-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-icon-wrap text-amber">
              <Folder size={20} />
            </span>
            <span className="kpi-label">Active Cases</span>
          </div>
          <strong className="kpi-value">{dataset.cases.length}</strong>
          <span className="kpi-subtext">Total Pipeline Jobs</span>
        </div>

        {/* Card 2: Tracked Entities */}
        <div className="analytics-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-icon-wrap text-slate">
              <Users size={20} />
            </span>
            <span className="kpi-label">Tracked Entities</span>
          </div>
          <strong className="kpi-value">{totalEntities}</strong>
          <span className="kpi-subtext">Total Extracted</span>
        </div>

        {/* Card 3: Identified Networks */}
        <div className="analytics-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-icon-wrap text-slate">
              <Network size={20} />
            </span>
            <span className="kpi-label">Identified Networks</span>
          </div>
          <strong className="kpi-value">{dataset.stats.networks}</strong>
          <span className="kpi-subtext">
            {dataset.stats.networks === 0 ? 'Waiting for data' : 'Detected Modules'}
          </span>
        </div>

        {/* Card 4: High Risk Alerts */}
        <div className="analytics-kpi-card">
          <div className="kpi-card-header">
            <span className="kpi-icon-wrap text-yellow">
              <AlertTriangle size={20} />
            </span>
            <span className="kpi-label">High Risk Alerts</span>
          </div>
          <strong className="kpi-value">{dataset.stats.alerts}</strong>
          <span className="kpi-subtext">Recent Alerts</span>
        </div>
      </div>

      {/* Clean Zero-Data State or Populated Analytics */}
      {!isDataLoaded ? (
        <div className="clean-workspace-card">
          <div className="clean-icon-circle">
            <UploadCloud size={36} />
          </div>
          <h2>Workspace is Clean — No Data Ingested</h2>
          <p>
            The system is in a clean state. Upload crime records (CDRs, FIRs, bank statements, or
            unstructured text) in <strong>Data Ingestion</strong> to automatically discover hidden
            networks, resolve identities, and compute risk analytics.
          </p>
          <div className="clean-actions-row">
            <button
              className="primary-action-btn"
              onClick={() => navigate('/ingestion')}
            >
              <UploadCloud size={16} />
              Go to Data Ingestion
            </button>
            <button
              className="secondary-action-btn"
              onClick={() => void loadSampleSIHData()}
            >
              <Sparkles size={16} />
              Load Sample SIH Dataset
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main Network Graph Panel */}
          <div className="dashboard-graph-card">
            <div className="dashboard-card-header">
              <div>
                <h2>Criminal Knowledge Graph</h2>
                <p>
                  Multi-entity network showing relationships, call linkages, and transaction trails.
                </p>
              </div>
              <div className="graph-scope-row">
                <label>Filter by Case:</label>
                <select
                  value={selectedCase}
                  onChange={(e) => setSelectedCase(e.target.value)}
                >
                  <option value="">All Active Cases</option>
                  {dataset.cases.map((c) => (
                    <option key={c.case_id} value={c.case_id}>
                      {c.case_id} — {c.crime_type}
                    </option>
                  ))}
                </select>
                {selectedCase && (
                  <button
                    className="reset-scope-btn"
                    onClick={() => setSelectedCase('')}
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div className="graph-viewport-wrapper">
              <GraphView
                data={filteredGraph}
                onNodeSelect={(n) => {
                  setEdge(undefined);
                  setNode(n);
                }}
                onEdgeSelect={(e) => {
                  setNode(undefined);
                  setEdge(e);
                }}
              />
            </div>
          </div>

          {/* Bottom Row: Activity & Alerts */}
          <div className="dashboard-bottom-grid">
            {/* Recent Investigation Activity */}
            <div className="dashboard-subpanel">
              <div className="subpanel-header">
                <h3>Recent Investigation Activity</h3>
                <span>{dataset.timelineEvents.length} recorded events</span>
              </div>
              <div className="timeline-activity-feed">
                {dataset.timelineEvents.length === 0 ? (
                  <p className="empty-feed-text">No chronological events found in current files.</p>
                ) : (
                  dataset.timelineEvents.slice(0, 5).map((event) => (
                    <div key={event.event_id} className="feed-item">
                      <span className="feed-icon">
                        <Activity size={15} />
                      </span>
                      <div className="feed-content">
                        <strong>{event.event_type}</strong>
                        <p>{event.notes}</p>
                        <small>
                          {event.case_id} {event.location ? `· ${event.location}` : ''}
                        </small>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* High Risk Alerts & Emerging Leads */}
            <div className="dashboard-subpanel">
              <div className="subpanel-header">
                <h3>High Risk Alerts & Anomalies</h3>
                <span>Priority review required</span>
              </div>
              <div className="alerts-feed">
                {dataset.alerts.length === 0 ? (
                  <p className="empty-feed-text">No anomalies detected in current scope.</p>
                ) : (
                  dataset.alerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="alert-item">
                      <span className={`alert-severity-stripe ${alert.priority.toLowerCase()}`} />
                      <div className="alert-body">
                        <strong>{alert.title}</strong>
                        <p>{alert.description}</p>
                        <span className="alert-badge">{alert.priority} Priority</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <EntityDetailsPanel node={node} onClose={() => setNode(undefined)} />
      <EvidenceDrawer edge={edge} onClose={() => setEdge(undefined)} />
    </div>
  );
}
