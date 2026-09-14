import styles from './page.module.css';

export default function Entities() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Entities & Identity Resolution</h1>
          <p>Manage extracted entities and resolve duplicate identities.</p>
        </div>
        <div className={styles.actions}>
          <div className={styles.searchBar}>
            <span>🔍</span>
            <input type="text" placeholder="Search entities..." />
          </div>
          <button className="btn-primary">Export List</button>
        </div>
      </header>

      <div className={styles.layout}>
        <div className={`glass-panel ${styles.tableSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Extracted Entities Directory</h3>
            <div className={styles.filters}>
              <select>
                <option>All Types</option>
                <option>People</option>
                <option>Organizations</option>
                <option>Locations</option>
                <option>Vehicles</option>
              </select>
            </div>
          </div>
          
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name / Value</th>
                  <th>Type</th>
                  <th>Risk Score</th>
                  <th>Source</th>
                  <th>Extracted Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                    No entities extracted yet.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className={`glass-panel ${styles.resolutionSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Identity Resolution Engine</h3>
            <span className={styles.badgePending} style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>0 Pending Tasks</span>
          </div>

          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No potential duplicates detected at this time.
          </div>
        </div>
      </div>
    </div>
  );
}
