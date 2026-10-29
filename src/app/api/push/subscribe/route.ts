import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

  const { data: member, error: memberError } = await supabase
    .from("hms_members")
    .select("id, household_id")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (memberError || !member) {
    return Response.json({ error: "החשבון לא משויך לבית." }, { status: 403 });
  }

  const { error: writeError } = await supabase.from("hms_push_subscriptions").upsert(
    {
      household_id: member.household_id,
      member_id: member.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (writeError) return Response.json({ error: writeError.message }, { status: 400 });
  return Response.json({ ok: true });
}
