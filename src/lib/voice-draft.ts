export type DraftKind = "task" | "shop" | "class" | "event" | "wish";
export type Relation = "daughter" | "partner" | "other";
export type EventKind = "birthday" | "appointment" | "other";

export type ShopItemDraft = {
  name: string;
  quantity: string;
  unit: string;
  one_off: boolean;
};

export type VoiceDraft = {
  transcript: string;
  aiConfigured: boolean;
  aiMessage: string;
  confident: boolean;
  options: DraftKind[];
  kind: DraftKind | "";
  taskTitle: string;
  taskDetails: string;
  taskDue: string;
  taskTime: string;
  taskWeekday: string;
  listName: string;
  items: ShopItemDraft[];
  personName: string;
  relation: Relation | "";
  className: string;
  weekday: string;
  weekdays: number[];
  startsAt: string;
  endsAt: string;
  place: string;
  eventTitle: string;
  eventKind: EventKind;
  eventDate: string;
  eventTime: string;
  eventNotes: string;
  eventPerson: string;
  wishTitle: string;
  forLabel: string;
  url: string;
  wishNotes: string;
  priority: string;
};

const KINDS: DraftKind[] = ["task", "shop", "class", "event", "wish"];

export function emptyDraft(partial?: Partial<VoiceDraft>): VoiceDraft {
  return {
    transcript: "",
    aiConfigured: false,
    aiMessage: "",
    confident: false,
    options: [...KINDS],
    kind: "",
    taskTitle: "",
    taskDetails: "",
    taskDue: "",
    taskTime: "",
    taskWeekday: "",
    listName: "",
    items: [{ name: "", quantity: "", unit: "", one_off: false }],
    personName: "",
    relation: "",
    className: "",
    weekday: "",
    weekdays: [],
    startsAt: "",
    endsAt: "",
    place: "",
    eventTitle: "",
    eventKind: "other",
    eventDate: "",
    eventTime: "",
    eventNotes: "",
    eventPerson: "",
    wishTitle: "",
    forLabel: "",
    url: "",
    wishNotes: "",
    priority: "0",
    ...partial,
  };
}

function asKind(value: unknown): DraftKind | null {
  return KINDS.includes(value as DraftKind) ? (value as DraftKind) : null;
}

function str(value: unknown) {
  return typeof value === "string" ? value : "";
}

function parseWeekdays(row: Record<string, unknown>) {
  const listed = Array.isArray(row.weekdays) ? row.weekdays : [];
  const fromList = listed.map(Number).filter((day) => day >= 0 && day <= 6);
  if (fromList.length) return [...new Set(fromList)].sort((a, b) => a - b);
  const single = Number(str(row.weekday));
  return Number.isInteger(single) && single >= 0 && single <= 6 ? [single] : [];
}

export function draftFromModel(
  transcript: string,
  aiMessage: string,
  raw: unknown,
): VoiceDraft {
  const base = emptyDraft({ transcript, aiConfigured: true, aiMessage });
  if (!raw || typeof raw !== "object") {
    return { ...base, confident: false, kind: "" };
  }
  const body = raw as { confident?: unknown; options?: unknown };
  const optionsIn = Array.isArray(body.options) ? body.options : [];
  const cleaned = optionsIn
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const kind = asKind(row.kind);
      if (!kind) return null;
      return { kind, row };
    })
    .filter((x): x is { kind: DraftKind; row: Record<string, unknown> } => Boolean(x));

  const uniqueKinds = [...new Set(cleaned.map((c) => c.kind))];
  const confident = body.confident === true && uniqueKinds.length === 1;
  const first = cleaned[0]?.row ?? {};
  const itemsRaw = Array.isArray(first.items) ? first.items : [];
  const items: ShopItemDraft[] = itemsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      return {
        name: str(row.name),
        quantity: str(row.quantity),
        unit: str(row.unit),
        one_off: row.one_off === true,
      };
    })
    .filter((x): x is ShopItemDraft => Boolean(x));

  const relation = (["daughter", "partner", "other"] as const).includes(
    first.relation as Relation,
  )
    ? (first.relation as Relation)
    : "";
  const eventKind = (["birthday", "appointment", "other"] as const).includes(
    first.eventKind as EventKind,
  )
    ? (first.eventKind as EventKind)
    : "other";

  return emptyDraft({
    transcript,
    aiConfigured: true,
    aiMessage,
    confident,
    options: uniqueKinds.length ? uniqueKinds : [...KINDS],
    kind: confident ? uniqueKinds[0] : "",
    taskTitle: str(first.taskTitle),
    taskDetails: str(first.taskDetails),
    taskDue: str(first.taskDue),
    taskTime: str(first.taskTime),
    taskWeekday: str(first.taskWeekday),
    listName: str(first.listName),
    items: items.length ? items : [{ name: "", quantity: "", unit: "", one_off: false }],
    personName: str(first.personName),
    relation,
    className: str(first.className),
    weekday: str(first.weekday),
    weekdays: parseWeekdays(first),
    startsAt: str(first.startsAt),
    endsAt: str(first.endsAt),
    place: str(first.place),
    eventTitle: str(first.eventTitle),
    eventKind,
    eventDate: str(first.eventDate),
    eventTime: str(first.eventTime),
    eventNotes: str(first.eventNotes),
    eventPerson: str(first.eventPerson),
    wishTitle: str(first.wishTitle),
    forLabel: str(first.forLabel),
    url: str(first.url),
    wishNotes: str(first.wishNotes),
    priority: str(first.priority) || "0",
  });
}

export function missingFields(draft: VoiceDraft): string[] {
  if (!draft.kind) return ["בחרו סוג רשומה"];
  if (draft.kind === "task" && !draft.taskTitle.trim()) return ["כותרת המשימה"];
  if (draft.kind === "shop") {
    const missing: string[] = [];
    if (!draft.listName.trim()) missing.push("שם קטגוריית הקניות");
    if (!draft.items.some((item) => item.name.trim())) missing.push("לפחות פריט אחד");
    return missing;
  }
  if (draft.kind === "class") {
    const missing: string[] = [];
    if (!draft.personName.trim()) missing.push("שם הילדה או האדם");
    if (!draft.relation) missing.push("קשר");
    if (!draft.className.trim()) missing.push("שם החוג");
    if (!draft.weekdays.length && draft.weekday === "") missing.push("יום בשבוע");
    if (!draft.startsAt) missing.push("שעת התחלה");
    return missing;
  }
  if (draft.kind === "event") {
    const missing: string[] = [];
    if (!draft.eventTitle.trim()) missing.push("כותרת האירוע");
    if (!draft.eventDate) missing.push("תאריך");
    return missing;
  }
  if (!draft.wishTitle.trim()) return ["כותרת המשאלה"];
  return [];
}
