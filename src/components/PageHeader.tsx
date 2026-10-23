import type { ReactNode } from 'react';

/** Page heading; the h1 receives focus after navigation (see useRouteFocus). */
export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return <header className="page-header">
    <div>
      {eyebrow && <span className="eyebrow">{eyebrow}</span>}
      <h1 tabIndex={-1} data-page-title>{title}</h1>
      {description && <p>{description}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}
