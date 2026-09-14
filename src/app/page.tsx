import styles from './page.module.css';

export default function Dashboard() {
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
          <div className={styles.statValue}>0</div>
          <div className={styles.statTrend} data-trend="neutral">Waiting for data</div>
        </div>
        <div className={`glass-panel hover-lift ${styles.statCard}`}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>👤</span>
            <span className={styles.statTitle}>Tracked Entities</span>
          </div>
          <div className={styles.statValue}>0</div>
          <div className={styles.statTrend} data-trend="neutral">Waiting for data</div>
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
          <div className={styles.statValue}>0</div>
          <div className={styles.statTrend} data-trend="neutral">Waiting for data</div>
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
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No alerts generated yet. Ensure databases are connected.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
