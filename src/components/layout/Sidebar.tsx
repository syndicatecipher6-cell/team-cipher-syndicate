import Link from 'next/link';
import styles from './Sidebar.module.css';

const navItems = [
  { name: 'Dashboard', href: '/', icon: '📊' },
  { name: 'Data Ingestion', href: '/ingestion', icon: '📥' },
  { name: 'Entities & Identities', href: '/entities', icon: '👤' },
  { name: 'Network Graph', href: '/graph', icon: '🕸️' },
  { name: 'Investigation AI', href: '/investigation', icon: '🤖' },
  { name: 'Settings', href: '/settings', icon: '⚙️' },
];

export default function Sidebar() {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>N</div>
        <h2>NexusNet</h2>
      </div>
      
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {navItems.map((item) => (
            <li key={item.name} className={styles.navItem}>
              <Link href={item.href} className={styles.navLink}>
                <span className={styles.icon}>{item.icon}</span>
                <span className={styles.text}>{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className={styles.footer}>
        <div className={styles.userProfile}>
          <div className={styles.avatar}>IN</div>
          <div className={styles.userInfo}>
            <div className={styles.userName}>Investigator</div>
            <div className={styles.userRole}>Admin</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
