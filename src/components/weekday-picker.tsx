"use client";

import { WEEKDAYS } from "@/lib/labels";

const DAY_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export function classDays(row: { weekday: number; weekdays?: number[] | null }) {
  const raw = row.weekdays?.length ? row.weekdays : [row.weekday];
  return [...new Set(raw.map(Number).filter((day) => day >= 0 && day <= 6))].sort((a, b) => a - b);
}

export function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const selected = value.map(Number);
  return (
    <div className="row" role="group" aria-label="ימים">
      {WEEKDAYS.map((day, index) => (
        <button
          key={day}
          className="choice"
          type="button"
          aria-label={day}
          aria-pressed={selected.includes(index)}
          onClick={() => {
            const next = selected.includes(index)
              ? selected.filter((dayIndex) => dayIndex !== index)
              : [...selected, index];
            onChange(next.sort((a, b) => a - b));
          }}
        >
          {DAY_LETTERS[index]}
        </button>
      ))}
    </div>
  );
}
