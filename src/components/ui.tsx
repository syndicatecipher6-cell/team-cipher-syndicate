import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, FolderSearch, LoaderCircle } from 'lucide-react';
import type { EntityType, Priority } from '../types/domain';

export function Button({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button className={`button button--${variant} ${className}`} {...props} />;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function EntityBadge({ type, children }: { type: EntityType; children?: ReactNode }) {
  return <span className={`badge entity-${type}`}><i aria-hidden="true" />{children ?? type.replace('-', ' ')}</span>;
}

export function StatusBadge({ children }: { children: ReactNode }) { return <span className="badge status-badge">{children}</span>; }
export function SourceBadge({ children }: { children: ReactNode }) { return <span className="badge source-badge">{children}</span>; }

export function PriorityIndicator({ value }: { value: Priority }) {
  return <span className={`priority priority--${value.toLowerCase()}`}><i />{value} priority</span>;
}

export function LoadingState({ label = 'Loading investigation data...' }: { label?: string }) {
  return <div className="state"><LoaderCircle className="spin" size={22} /><strong>{label}</strong><span>Please wait while records are prepared.</span></div>;
}

export function ErrorState({ message = 'Unable to load investigation data.', retry }: { message?: string; retry?: () => void }) {
  return <div className="state"><AlertCircle size={22} /><strong>{message}</strong><span>The investigation service may be unavailable.</span>{retry && <Button onClick={retry}>Retry</Button>}</div>;
}

export function EmptyState({ title = 'No connected entities found.', message = 'Adjust the current filters or try a different search.' }: { title?: string; message?: string }) {
  return <div className="state"><FolderSearch size={22} /><strong>{title}</strong><span>{message}</span></div>;
}

export function Panel({ title, subtitle, actions, children, className = '' }: { title?: string; subtitle?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{(title || actions) && <header className="panel-header"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{actions}</header>}{children}</section>;
}

export function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>;
}
