import webpush from "web-push";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const DELAY_MS = 30_000;

type PushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

function isSubscription(value: unknown): value is PushSubscription {
  if (!value || typeof value !== "object") return false;
  const row = value as PushSubscription;
  return (
    typeof row.endpoint === "string" &&
    row.endpoint.startsWith("https://") &&
    typeof row.keys?.p256dh === "string" &&
    typeof row.keys?.auth === "string"
  );
}

export async function POST(request: Request) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:push@matzka.app";
  if (!publicKey || !privateKey) {
    return Response.json({ error: "מפתחות ההתראות לא הוגדרו בשרת." }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  ).trim();
  if (!token || !supabaseUrl || !supabaseKey) {
    return Response.json({ error: "צריך להיות מחוברים." }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return Response.json({ error: "ההתחברות לא תקפה." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  const subscription = (body as { subscription?: unknown }).subscription;
  if (!isSubscription(subscription)) {
    return Response.json({ error: "אין מנוי התראות." }, { status: 400 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const payload = JSON.stringify({
    title: "מצקה",
    body: "בדיקה: ההתראה הגיעה אחרי שסגרת את האפליקציה.",
  });

  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (sendError) {
      console.error("push test failed", sendError);
    }
  });

  return Response.json({ ok: true, delaySeconds: DELAY_MS / 1000 });
}
