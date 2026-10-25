import Link from "next/link";
import type { ReactNode } from "react";

export function PageHead({
  title,
  lede,
  action,
}: {
  title: string;
  lede?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton" aria-busy="true" aria-label="טוען">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function PersonLink({ id, name }: { id: string; name: string }) {
  if (!name) return null;
  return (
    <Link className="chip chip-person" href={`/people/${id}`}>
      {name}
    </Link>
  );
}

export function Alert({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="alert" role="alert">
      {children}
    </p>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <p className="empty-title">{title}</p>
      {hint ? <p className="meta">{hint}</p> : null}
      {action}
    </div>
  );
}

export function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: ReactNode;
  error?: string;
}) {
  const id = label.replace(/\s+/g, "-");
  return (
    <label>
      {label}
      <span id={id}>{children}</span>
      {error ? (
        <span className="alert" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
