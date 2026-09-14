import styles from './page.module.css';
import { supabase } from '@/lib/supabase';

export const revalidate = 0;

export default async function DataIngestion() {
  const { data: jobs } = await supabase
    .from('processing_jobs')
    .select('*')
    .order('id', { ascending: false });
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1>Multi-Source Data Collection & Processing</h1>
          <p>Ingest and normalize raw data from various intelligence sources.</p>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={`glass-panel ${styles.uploadSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Upload New Data</h3>
          </div>
          <div className={styles.uploadArea}>
            <div className={styles.uploadIcon}>📥</div>
            <h4>Drag & Drop files here</h4>
            <p>Support for CSV, JSON, PDF (FIRs), and unstructured text.</p>
            <button className="btn-primary" style={{marginTop: '1rem'}}>Browse Files</button>
          </div>
          
          <div className={styles.sourceConnections}>
            <h4>Or connect live sources:</h4>
            <div className={styles.sourceList}>
              <button className={`btn-secondary ${styles.sourceBtn}`}>
                <span>📞</span> CDR Database API
              </button>
              <button className={`btn-secondary ${styles.sourceBtn}`}>
                <span>🏦</span> Financial Records API
              </button>
              <button className={`btn-secondary ${styles.sourceBtn}`}>
                <span>🏛️</span> National Crime DB
              </button>
            </div>
          </div>
        </div>

        <div className={`glass-panel ${styles.pipelineSection}`}>
          <div className={styles.sectionHeader}>
            <h3>Processing Pipeline Status</h3>
            <span className={styles.badgeSuccess}>System Operational</span>
          </div>
          
          <div className={styles.pipelineList}>
            {jobs && jobs.length > 0 ? (
              jobs.map((job: any) => (
                <div key={job.id} className={styles.pipelineJob}>
                  <div className={styles.jobHeader}>
                    <div className={styles.jobInfo}>
                      <span className={styles.jobIcon}>
                        {job.type === 'FIR' ? '📄' : job.type === 'CDR' ? '📊' : '🏦'}
                      </span>
                      <strong>{job.filename}</strong>
                    </div>
                    <span className={styles.statusBadge} data-status={job.status}>
                      {job.status === 'processing' ? `Processing (${job.progress}%)` : job.status === 'completed' ? 'Completed' : 'Failed'}
                    </span>
                  </div>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{
                        width: `${job.progress}%`, 
                        backgroundColor: job.status === 'completed' ? 'var(--success)' : job.status === 'error' ? 'var(--danger)' : 'var(--accent-primary)'
                      }}
                    ></div>
                  </div>
                  <div className={styles.jobDetails}>
                    <span style={{color: job.status === 'error' ? 'var(--danger)' : 'inherit'}}>{job.details}</span>
                    {job.status === 'error' && <button className={styles.textBtn}>View Logs</button>}
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>
                <p>No active processing jobs. Upload data or connect a source to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
