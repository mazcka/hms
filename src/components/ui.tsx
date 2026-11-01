"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  const pathname = usePathname();
  return (
    <header className="page-head">
      <div className="page-title">
        {pathname !== "/" ? (
          <Link className="home-back" href="/" aria-label="היום">
            <BrandMark />
          </Link>
        ) : (
          <span className="home-mark" aria-hidden="true">
            <BrandMark />
          </span>
        )}
        <div>
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}
        </div>
      </div>
      {action}
    </header>
  );
}

export function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <path fill="#1B5E42" d="M8 30.2 32 9.5 56 30.2v3.4L32 14.2 8 33.6z" />
      <path fill="#2E8A5E" d="M15 31.2h34v22.2a2.6 2.6 0 0 1-2.6 2.6H17.6A2.6 2.6 0 0 1 15 53.4z" />
      <rect fill="#C4A15A" x="29" y="40.5" width="6.5" height="12.5" rx="1" />
      <path fill="#C4A15A" d="M32 5.4c2.4 2.8 2.4 5.6 0 7-2.4-1.4-2.4-4.2 0-7z" />
    </svg>
  );
}

export function Loader({ label = "טוען" }: { label?: string }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <svg className="loader-mark" viewBox="0 0 64 64" aria-hidden="true">
        <path fill="#1B5E42" d="M8 30.2 32 9.5 56 30.2v3.4L32 14.2 8 33.6z" />
        <path fill="#2E8A5E" d="M15 31.2h34v22.2a2.6 2.6 0 0 1-2.6 2.6H17.6A2.6 2.6 0 0 1 15 53.4z" />
        <rect className="loader-door" fill="#C4A15A" x="29" y="40.5" width="6.5" height="12.5" rx="1" />
        <path className="loader-leaf" fill="#C4A15A" d="M32 5.4c2.4 2.8 2.4 5.6 0 7-2.4-1.4-2.4-4.2 0-7z" />
      </svg>
      <span className="loader-label">{label}</span>
    </div>
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

const URL_TEXT = /^(https?:\/\/|www\.)\S+$/i;

export function ItemLabel({ value }: { value: string }) {
  const text = value.trim();
  if (!URL_TEXT.test(text)) return <span className="item-label">{value}</span>;
  const href = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  return (
    <span className="item-label">
      <a href={href} target="_blank" rel="noreferrer">
        {text}
      </a>
    </span>
  );
}

const PERSON_TONES = 6;

function personTone(id: string, people: { id: string }[] = []) {
  const ids = people.map((person) => person.id).sort();
  const index = ids.indexOf(id);
  if (index >= 0) return index % PERSON_TONES;
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 33 + id.charCodeAt(i)) >>> 0;
  return hash % PERSON_TONES;
}

export function PersonLink({ id, name, people }: { id: string; name: string; people?: { id: string }[] }) {
  if (!name) return null;
  return (
    <Link className="chip chip-person" data-tone={personTone(id, people)} href={`/people/${id}`}>
      {name}
    </Link>
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
