import type { ReactNode } from "react";

export function FacilityPage({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="facility-page p-5 lg:p-8">
      <header className="facility-header">
        <div>
          <p className="text-xs font-bold uppercase text-jade">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action ? <div className="facility-header-action">{action}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function FacilityTutorial({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="facility-tutorial">
      <div className="facility-title-bar">{title}</div>
      <div className="facility-tutorial-body">{children}</div>
    </section>
  );
}

export function FacilityPanel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`facility-panel ${className}`}>
      <div className="facility-title-bar">
        <span>{title}</span>
        {subtitle ? <small>{subtitle}</small> : null}
      </div>
      <div className="facility-panel-body">{children}</div>
    </section>
  );
}

export function FacilityActionCard({ title, meta, description, children }: { title: string; meta: string; description: string; children?: ReactNode }) {
  return (
    <div className="facility-action-card">
      <div>
        <b>{title}</b>
        <small>{meta}</small>
      </div>
      <p>{description}</p>
      {children}
    </div>
  );
}

export function FacilityTierStrip({ children }: { children: ReactNode }) {
  return <div className="facility-tier-strip">{children}</div>;
}
