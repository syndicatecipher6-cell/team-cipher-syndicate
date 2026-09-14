import styles from './Navbar.module.css';

export default function Navbar() {
  return (
    <header className={styles.navbar}>
      <div className={styles.searchContainer}>
        <span className={styles.searchIcon}>🔍</span>
        <input 
          type="text" 
          placeholder="Search entities, FIRs, or locations..." 
          className={styles.searchInput}
        />
      </div>
      
      <div className={styles.actions}>
        <button className={styles.iconBtn}>
          <span className={styles.badge}>3</span>
          🔔
        </button>
        <button className={styles.iconBtn}>
          ⚙️
        </button>
        <button className="btn-primary">
          + New Investigation
        </button>
      </div>
    </header>
  );
}
