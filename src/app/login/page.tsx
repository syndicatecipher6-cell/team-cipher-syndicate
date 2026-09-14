import { login } from './actions'
import styles from './page.module.css'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  return (
    <div className={styles.loginContainer}>
      <div className={`glass-panel ${styles.loginCard}`}>
        <div className={styles.loginHeader}>
          <div className={styles.logo}>🛡️</div>
          <h2>Access Restricted</h2>
          <p>Please authenticate to access the SIH Dashboard</p>
        </div>

        <form className={styles.loginForm} action={login}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="officer@agency.gov"
              required
            />
          </div>
          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}>
            Secure Login
          </button>
          
          {searchParams?.message && (
            <p className={styles.errorMessage}>{searchParams.message}</p>
          )}
        </form>
      </div>
    </div>
  )
}
