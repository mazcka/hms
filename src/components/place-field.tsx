"use client";

import { useEffect, useId, useState } from "react";

export function PlaceField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const listId = useId();
  const [hits, setHits] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void fetch(`/api/places?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : []))
        .then((rows: unknown) => {
          setHits(Array.isArray(rows) ? rows.filter((row): row is string => typeof row === "string") : []);
          setOpen(true);
        })
        .catch(() => setHits([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value]);

  return (
    <div className="place-field">
      <input
        value={value}
        role="combobox"
        aria-expanded={open && hits.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder="רחוב, מוסד או עיר"
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
      />
      {open && hits.length ? (
        <ul className="place-hits" id={listId} role="listbox">
          {hits.map((hit) => (
            <li key={hit} role="option">
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(hit);
                  setOpen(false);
                }}
              >
                {hit}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
