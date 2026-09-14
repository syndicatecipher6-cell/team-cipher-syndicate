import styles from './page.module.css';
import { supabase } from '@/lib/supabase';

export const revalidate = 0; // Disable static caching for live data

export default async function Dashboard() {
  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  const { count: entitiesCount } = await supabase
    .from('extracted_entities')
    .select('*', { count: 'exact', head: true });

  const { count: casesCount } = await supabase
    .from('processing_jobs')
    .select('*', { count: 'exact', head: true });
  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>Crime & Network Analytics</h1>
          <p>Overview of active investigations and detected network patterns.</p>
        </div>
        <div className={styles.actions}>
          <select className={styles.timeFilter}>
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Year</option>
          </select>
          <button className="btn-primary">Generate Report</button>
        </div>
      </header>

      <div className={styles.statsGrid}>
        <div className={`glass-panel hover-lift ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📂</span>
            <span className={styles.statTitle}>Active Cases</span>
          </div>
          <div className={styles.statValue}>{casesCount || 0}</div>
          <div className={styles.statTrend} data-trend="neutral">Total Pipeline Jobs</div>
        </div>
        <div className={`glass-panel hover-lift ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>👤</span>
            <span className={styles.statTitle}>Tracked Entities</span>
          </div>
          <div className={styles.statValue}>{entitiesCount || 0}</div>
          <div className={styles.statTrend} data-trend="neutral">Total Extracted</div>
        </div>
        <div className={`glass-panel hover-lift ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>🕸️</span>
            <span className={styles.statTitle}>Identified Networks</span>
          </div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statTrend} data-trend="neutral">Waiting for data</div>
        </div>
        <div className={`glass-panel hover-lift ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>⚠️</span>
            <span className={styles.statTitle}>High Risk Alerts</span>
          </div>
          <div className={styles.statValue}>{alerts?.length || 0}</div>
          <div className={styles.statTrend} data-trend="neutral">Recent Alerts</div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={`glass-panel ${styles.chartSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Entity Resolution Trends</h3>
            <button className="btn-secondary">View Details</button>
          </div>
          <div className={styles.placeholderChart}>
            {/* Placeholder for actual chart component */}
            <div className={styles.barContainer}>
              <div className={styles.bar} style={{ height: '40%' }}></div>
              <div className={styles.bar} style={{ height: '60%' }}></div>
              <div className={styles.bar} style={{ height: '30%' }}></div>
              <div className={styles.bar} style={{ height: '80%' }}></div>
              <div className={styles.bar} style={{ height: '50%' }}></div>
              <div className={styles.bar} style={{ height: '90%' }}></div>
              <div className={styles.bar} style={{ height: '70%' }}></div>
            </div>
            <p className={styles.chartCaption}>New entities extracted vs. resolved aliases over time.</p>
          </div>
        </div>

        <div className={`glass-panel ${styles.alertsSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Suspicious Activity Alerts</h3>
            <span className={styles.badge}>Live</span>
          </div>
          <div className={styles.alertsList}>
            {alerts && alerts.length > 0 ? (
              alerts.map((alert: any) => (
                <div key={alert.id} className={styles.alertItem}>
                  <div className={styles.alertIcon} data-severity={alert.severity}>
                    {alert.severity === 'high' ? '🔴' : alert.severity === 'medium' ? '🟠' : '🟡'}
                  </div>
                  <div className={styles.alertContent}>
                    <h4>{alert.title}</h4>
                    <p>{alert.description}</p>
                    <span className={styles.alertTime}>
                      {new Date(alert.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No alerts generated yet. Ensure databases are connected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
