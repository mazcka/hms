"use client";

import { useRef, useState } from "react";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { PlaceField } from "@/components/place-field";
import { WeekdayPicker } from "@/components/weekday-picker";
import { PageHead } from "@/components/ui";
import { DRAFT_KINDS, EVENT_KINDS, RELATIONS } from "@/lib/labels";
import {
  emptyDraft,
  missingFields,
  type DraftKind,
  type VoiceDraft,
} from "@/lib/voice-draft";

export default function VoicePage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const [recording, setRecording] = useState(false);
  const [draft, setDraft] = useState<VoiceDraft | null>(null);
  const [pending, setPending] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  if (!gate) return null;
  const missing = draft ? missingFields(draft) : [];

  async function toggleRecord() {
    if (recording && recorder.current) {
      recorder.current.stop();
      setRecording(false);
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      showNotice({ tone: "error", text: "אין גישה למיקרופון. ההקלטה מתחילה רק אחרי אישור." });
      return;
    }
    const media = new MediaRecorder(stream);
    chunks.current = [];
    media.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
      chunks.current = [];
      void transcribe(blob);
    };
    recorder.current = media;
    media.start();
    setRecording(true);
  }

  async function transcribe(blob: Blob) {
    setPending(true);
    try {
      const body = new FormData();
      body.append("audio", blob, "clip.webm");
      const response = await fetch("/api/voice", { method: "POST", body });
      const json = (await response.json()) as VoiceDraft;
      setDraft({
        ...emptyDraft(),
        ...json,
        items: json.items?.length ? json.items : emptyDraft().items,
      });
    } catch (cause) {
      setDraft(emptyDraft({ aiMessage: cause instanceof Error ? cause.message : "הבקשה נכשלה" }));
    } finally {
      setPending(false);
    }
  }

  async function writeLog(status: "approved" | "rejected", target?: { table: string; id: string }) {
    if (!gate || !draft) return;
    const { error: writeError } = await gate.supabase.from("hms_voice_logs").insert({
      household_id: gate.member.household_id,
      member_id: gate.member.id,
      transcript: draft.transcript.trim() || draft.aiMessage || "אין תמלול",
      extracted: draft,
      status,
      target_table: target?.table ?? null,
      target_id: target?.id ?? null,
    });
    if (writeError) throw new Error(writeError.message);
  }

  async function cancel() {
    if (!draft) return;
    setPending(true);
    try {
      await writeLog("rejected");
      setDraft(null);
      showNotice({ tone: "ok", text: "הטיוטה בוטלה." });
    } catch {
      showNotice({ tone: "error", text: "לא הצלחנו לבטל. נסה שוב." });
    } finally {
      setPending(false);
    }
  }

  async function create() {
    if (!gate || !draft || missing.length) return;
    setPending(true);
    try {
      const target = await persist(draft);
      await writeLog("approved", target);
      setDraft(null);
      showNotice({ tone: "ok", text: "נוצר בבית." });
    } catch {
      showNotice({ tone: "error", text: "לא הצלחנו לשמור. נסה שוב." });
    } finally {
      setPending(false);
    }
  }

  async function persist(current: VoiceDraft) {
    if (!gate) throw new Error("אין חיבור");
    const hid = gate.member.household_id;
    if (current.kind === "task") {
      const { data, error: writeError } = await gate.supabase.from("hms_tasks").insert({
        household_id: hid,
        title: current.taskTitle.trim(),
        details: current.taskDetails.trim() || null,
        due_date: current.taskDue || null,
        due_time: current.taskTime || null,
        weekday: current.taskWeekday === "" ? null : Number(current.taskWeekday),
        assignee_id: gate.member.id,
        created_by: gate.member.id,
      }).select("id").single();
      if (writeError) throw new Error(writeError.message);
      return { table: "hms_tasks", id: (data as { id: string }).id };
    }
    if (current.kind === "shop") {
      const name = current.listName.trim();
      const existing = await gate.supabase.from("hms_shop_lists").select("id").eq("household_id", hid).eq("name", name).maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      let listId = (existing.data as { id: string } | null)?.id;
      if (!listId) {
        const created = await gate.supabase.from("hms_shop_lists").insert({ household_id: hid, name }).select("id").single();
        if (created.error) throw new Error(created.error.message);
        listId = (created.data as { id: string }).id;
      }
      const items = current.items.filter((item) => item.name.trim()).map((item) => ({
        household_id: hid,
        list_id: listId,
        name: item.name.trim(),
        quantity: item.quantity ? Number(item.quantity) : null,
        unit: item.unit.trim() || null,
        one_off: item.one_off,
      }));
      const inserted = await gate.supabase.from("hms_shop_items").insert(items);
      if (inserted.error) throw new Error(inserted.error.message);
      return { table: "hms_shop_lists", id: listId };
    }
    if (current.kind === "class") {
      const found = await gate.supabase.from("hms_people").select("id").eq("household_id", hid).eq("name", current.personName.trim()).maybeSingle();
      if (found.error) throw new Error(found.error.message);
      let personId = (found.data as { id: string } | null)?.id;
      if (!personId) {
        const created = await gate.supabase.from("hms_people").insert({
          household_id: hid,
          name: current.personName.trim(),
          relation: current.relation,
        }).select("id").single();
        if (created.error) throw new Error(created.error.message);
        personId = (created.data as { id: string }).id;
      }
      const days = current.weekdays.length ? [...current.weekdays].sort((a, b) => a - b) : [Number(current.weekday)];
      const createdClass = await gate.supabase.from("hms_classes").insert({
        household_id: hid,
        person_id: personId,
        name: current.className.trim(),
        weekday: days[0],
        weekdays: days,
        starts_at: current.startsAt,
        ends_at: current.endsAt || null,
        place: current.place.trim() || null,
      }).select("id").single();
      if (createdClass.error) throw new Error(createdClass.error.message);
      return { table: "hms_classes", id: (createdClass.data as { id: string }).id };
    }
    if (current.kind === "event") {
      let personId: string | null = null;
      if (current.eventPerson.trim()) {
        const found = await gate.supabase.from("hms_people").select("id").eq("household_id", hid).eq("name", current.eventPerson.trim()).maybeSingle();
        if (found.error) throw new Error(found.error.message);
        personId = (found.data as { id: string } | null)?.id ?? null;
      }
      const created = await gate.supabase.from("hms_events").insert({
        household_id: hid,
        title: current.eventTitle.trim(),
        kind: current.eventKind,
        event_date: current.eventDate,
        event_time: current.eventTime || null,
        person_id: personId,
        place: current.place.trim() || null,
        notes: current.eventNotes.trim() || null,
        created_by: gate.member.id,
      }).select("id").single();
      if (created.error) throw new Error(created.error.message);
      return { table: "hms_events", id: (created.data as { id: string }).id };
    }
    const created = await gate.supabase.from("hms_wishes").insert({
      household_id: hid,
      title: current.wishTitle.trim(),
      for_label: current.forLabel.trim() || null,
      url: current.url.trim() || null,
      notes: current.wishNotes.trim() || null,
      priority: Number(current.priority) || 0,
      created_by: gate.member.id,
    }).select("id").single();
    if (created.error) throw new Error(created.error.message);
    return { table: "hms_wishes", id: (created.data as { id: string }).id };
  }

  return (
    <>
      <PageHead title="קול" lede="ההקלטה לא נשמרת. שורה בבית נוצרת רק אחרי «צור»." />
      <button className="btn btn-accent" type="button" onClick={() => void toggleRecord()} disabled={pending}>
        {recording ? "עצירת הקלטה" : "הקלטה"}
      </button>
      {pending ? <p className="note" role="status">מעבד…</p> : null}
      {draft ? (
        <form
          className="card stack"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <h2>טיוטה</h2>
          {draft.aiMessage ? <p className="note" role="status">{draft.aiMessage}</p> : null}
          <p>תמלול: {draft.transcript || "אין תמלול"}</p>
          {!draft.confident ? <p>יש יותר מאפשרות אחת, או שהניתוח לא בטוח, בחרו סוג</p> : null}
          <div className="row" role="group" aria-label="סוג רשומה">
            {(draft.options.length ? draft.options : (Object.keys(DRAFT_KINDS) as DraftKind[])).map((kind) => (
              <button
                key={kind}
                className="choice"
                type="button"
                aria-pressed={draft.kind === kind}
                onClick={() => setDraft({ ...draft, kind })}
              >
                {DRAFT_KINDS[kind]}
              </button>
            ))}
          </div>
          {draft.kind === "task" ? (
            <>
              <label>כותרת<input value={draft.taskTitle} onChange={(e) => setDraft({ ...draft, taskTitle: e.target.value })} /></label>
              <label>פירוט<textarea value={draft.taskDetails} onChange={(e) => setDraft({ ...draft, taskDetails: e.target.value })} /></label>
            </>
          ) : null}
          {draft.kind === "shop" ? (
            <>
              <label>קטגוריה<input value={draft.listName} onChange={(e) => setDraft({ ...draft, listName: e.target.value })} /></label>
              {draft.items.map((item, index) => (
                <label key={index}>
                  פריט {index + 1}
                  <input
                    value={item.name}
                    onChange={(e) => {
                      const items = draft.items.slice();
                      items[index] = { ...item, name: e.target.value };
                      setDraft({ ...draft, items });
                    }}
                  />
                </label>
              ))}
              <button
                className="btn btn-quiet"
                type="button"
                onClick={() => setDraft({ ...draft, items: [...draft.items, { name: "", quantity: "", unit: "", one_off: false }] })}
              >
                פריט נוסף
              </button>
            </>
          ) : null}
          {draft.kind === "class" ? (
            <>
              <label>שם<input value={draft.personName} onChange={(e) => setDraft({ ...draft, personName: e.target.value })} /></label>
              <label>
                קשר
                <select value={draft.relation} onChange={(e) => setDraft({ ...draft, relation: e.target.value as VoiceDraft["relation"] })}>
                  <option value="">בחירה</option>
                  {Object.entries(RELATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>חוג<input value={draft.className} onChange={(e) => setDraft({ ...draft, className: e.target.value })} /></label>
              <WeekdayPicker value={draft.weekdays} onChange={(weekdays) => setDraft({ ...draft, weekdays, weekday: weekdays.length ? String(weekdays[0]) : "" })} />
              <label>התחלה<input type="time" value={draft.startsAt} onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })} /></label>
              <label>מקום<PlaceField value={draft.place} onChange={(place) => setDraft({ ...draft, place })} /></label>
            </>
          ) : null}
          {draft.kind === "event" ? (
            <>
              <label>כותרת<input value={draft.eventTitle} onChange={(e) => setDraft({ ...draft, eventTitle: e.target.value })} /></label>
              <label>
                סוג
                <select value={draft.eventKind} onChange={(e) => setDraft({ ...draft, eventKind: e.target.value as VoiceDraft["eventKind"] })}>
                  {Object.entries(EVENT_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label>תאריך<input type="date" value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} /></label>
              <label>מקום<PlaceField value={draft.place} onChange={(place) => setDraft({ ...draft, place })} /></label>
            </>
          ) : null}
          {draft.kind === "wish" ? (
            <label>כותרת<input value={draft.wishTitle} onChange={(e) => setDraft({ ...draft, wishTitle: e.target.value })} /></label>
          ) : null}
          {missing.length ? (
            <div className="alert" role="alert" tabIndex={-1}>
              <strong>אי אפשר ליצור עדיין</strong>
              <ul>{missing.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
          <div className="row">
            <button className="btn btn-primary" type="submit" disabled={pending || missing.length > 0}>צור</button>
            <button className="btn btn-quiet" type="button" onClick={() => void cancel()} disabled={pending}>בטל</button>
          </div>
        </form>
      ) : null}
    </>
  );
}
