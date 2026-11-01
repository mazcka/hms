import webpush from "web-push";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

type Sub = { id: string; household_id: string; endpoint: string; p256dh: string; auth: string };
type Note = { householdId: string; kind: "event" | "class" | "task"; entityId: string; title: string; body: string; url: string };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function jerusalemNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function serviceClient() {
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function claim(supabase: SupabaseClient, note: Note, slot: string) {
  const { data, error } = await supabase
    .from("hms_push_sent")
    .insert({ household_id: note.householdId, kind: note.kind, entity_id: note.entityId, slot })
    .select("id")
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.id);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:push@matzka.app";
  const supabase = serviceClient();
  if (!publicKey || !privateKey || !supabase) {
    return Response.json({ error: "push is not configured" }, { status: 500 });
  }

  const now = jerusalemNow();
  const tomorrow = addDays(now.date, 1);
  const notes: Note[] = [];

  const { data } = await supabase
    .from("hms_events")
    .select("id, household_id, title")
    .eq("remind_day_before", true)
    .eq("event_date", tomorrow);
  for (const row of data ?? []) {
    notes.push({
      householdId: row.household_id,
      kind: "event",
      entityId: row.id,
      title: "מצקה",
      body: `מחר: ${row.title}`,
      url: "/events",
    });
  }

  const { data: classes } = await supabase
    .from("hms_classes")
    .select("id, household_id, name, starts_at, weekdays")
    .eq("active", true)
    .contains("weekdays", [now.weekday]);
  for (const row of classes ?? []) {
    const time = row.starts_at.slice(0, 5);
    notes.push({
      householdId: row.household_id,
      kind: "class",
      entityId: row.id,
      title: "מצקה",
      body: `היום ב־${time}: ${row.name}`,
      url: "/classes",
    });
  }

  const { data: tasks } = await supabase
    .from("hms_tasks")
    .select("id, household_id, title, due_time")
    .eq("due_date", now.date)
    .neq("status", "done");
  for (const row of tasks ?? []) {
    notes.push({
      householdId: row.household_id,
      kind: "task",
      entityId: row.id,
      title: "מצקה",
      body: row.due_time ? `היום ב־${row.due_time.slice(0, 5)}: ${row.title}` : `היום: ${row.title}`,
      url: "/tasks",
    });
  }

  const { data: subs } = await supabase.from("hms_push_subscriptions").select("id, household_id, endpoint, p256dh, auth");
  const byHousehold = new Map<string, Sub[]>();
  for (const sub of (subs ?? []) as Sub[]) {
    const list = byHousehold.get(sub.household_id) ?? [];
    list.push(sub);
    byHousehold.set(sub.household_id, list);
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let sent = 0;
  for (const note of notes) {
    const targets = byHousehold.get(note.householdId) ?? [];
    if (!targets.length) continue;
    if (!(await claim(supabase, note, now.date))) continue;
    const payload = JSON.stringify({ title: note.title, body: note.body, url: note.url });
    for (const sub of targets) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
        );
        sent += 1;
      } catch (error) {
        const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (status === 404 || status === 410) {
          await supabase.from("hms_push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error("push send failed", status);
        }
      }
    }
  }

  return Response.json({ ok: true, considered: notes.length, sent });
}
