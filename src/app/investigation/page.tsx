import styles from './page.module.css';

export default function InvestigationAI() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Investigation Reasoning Engine</h1>
          <p>Ask questions in natural language to uncover actionable intelligence.</p>
        </div>
      </header>

      <div className={styles.workspace}>
        <div className={`glass-panel ${styles.chatSection}`}>
          <div className={styles.chatHistory}>
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Welcome to the Reasoning Engine. Start asking questions to query the connected database.
            </div>
          </div>
          
          <div className={styles.chatInputContainer}>
            <input 
              type="text" 
              placeholder="E.g., Which individuals have the highest centrality score but no direct criminal record?" 
              className={styles.chatInput}
            />
            <button className="btn-primary">Ask AI</button>
          </div>
        </div>

        <div className={`glass-panel ${styles.intelligenceSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Actionable Intelligence</h3>
            <button className="btn-secondary">Export PDF</button>
          </div>
          
          <div className={styles.reportContent}>
            <h4>Generated Insights Summary</h4>
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No intelligence generated yet. Ask the AI to run an analysis on your data.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
