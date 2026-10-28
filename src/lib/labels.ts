export const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"] as const;

export const TASK_STATUS = {
  open: "פתוחה",
  in_progress: "בתהליך",
  done: "בוצעה",
} as const;

export const RELATIONS = {
  daughter: "בת",
  partner: "בן/בת זוג",
  other: "אחר",
} as const;

export const EVENT_KINDS = {
  birthday: "יום הולדת",
  appointment: "תור",
  other: "אחר",
} as const;

export const WISH_STATUS = {
  idea: "רעיון",
  planned: "הוחלט לקנות",
  bought: "נקנה",
} as const;

export const DRAFT_KINDS = {
  task: "משימת בית",
  shop: "קניות",
  class: "חוג",
  event: "אירוע",
  wish: "משאלה",
} as const;

export function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function addDaysIso(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}
