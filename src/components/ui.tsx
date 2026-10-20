import type { ReactNode } from "react";

export function Alert({ children }: { children: string }) {
  if (!children) return null;
  return (
    <p className="alert" role="alert">
      {children}
    </p>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
        <rect x="8" y="18" width="32" height="20" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="M8 24 L24 12 L40 24" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
      <p>{title}</p>
      {hint ? <p>{hint}</p> : null}
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
