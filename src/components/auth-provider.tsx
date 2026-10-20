"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";

export type Member = {
  id: string;
  household_id: string;
  user_id: string;
  display_name: string;
};

type Gate = {
  supabase: SupabaseClient;
  session: Session;
  member: Member;
  members: Member[];
  reload: () => Promise<void>;
};

const GateContext = createContext<Gate | null>(null);

export function useHousehold() {
  return useContext(GateContext);
}

const NAV = [
  { href: "/", label: "השבוע" },
  { href: "/tasks", label: "משימות" },
  { href: "/shop", label: "קניות" },
  { href: "/plan", label: "לוח" },
  { href: "/voice", label: "קול" },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabase(), []);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState("");

  async function loadMember(client: SupabaseClient, userId: string) {
    const { data, error: memberError } = await client
      .from("hms_members")
      .select("id, household_id, user_id, display_name")
      .eq("user_id", userId)
      .maybeSingle();
    if (memberError) {
      setError(memberError.message);
      setMember(null);
      return;
    }
    const row = data as Member | null;
    setMember(row);
    if (!row) {
      setMembers([]);
      return;
    }
    const { data: all, error: allError } = await client
      .from("hms_members")
      .select("id, household_id, user_id, display_name")
      .eq("household_id", row.household_id);
    if (allError) setError(allError.message);
    setMembers((all ?? []) as Member[]);
  }

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) {
        loadMember(supabase, data.session.user.id).finally(() => active && setReady(true));
      } else {
        setReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) loadMember(supabase, next.user.id);
      else {
        setMember(null);
        setMembers([]);
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const gate = session && member && supabase
    ? { supabase, session, member, members, reload: () => loadMember(supabase, session.user.id) }
    : null;

  const showNav = Boolean(gate) && pathname !== "/login";

  return (
    <GateContext.Provider value={gate}>
      <div className="app-main">
        {!supabase ? <SetupMissing /> : null}
        {supabase && !ready ? <p>טוען…</p> : null}
        {supabase && ready && !session && pathname !== "/login" ? <SignedOut /> : null}
        {supabase && ready && session && !member && pathname !== "/login" ? (
          <NeedsHousehold userId={session.user.id} error={error} />
        ) : null}
        {error && member ? <p className="alert" role="alert">{error}</p> : null}
        {supabase && ready && (pathname === "/login" || gate) ? children : null}
      </div>
      {showNav ? (
        <nav className="nav" aria-label="ראשי">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={
                item.href === "/plan"
                  ? ["/plan", "/classes", "/events", "/wishes"].includes(pathname)
                    ? "page"
                    : undefined
                  : pathname === item.href
                    ? "page"
                    : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </GateContext.Provider>
  );
}

function SetupMissing() {
  return (
    <section className="card stack">
      <h1>בית</h1>
      <p>
        חסרים מפתחות Supabase. העתיקו את <code>.env.example</code> אל <code>.env.local</code> ומלאו
        את <code>NEXT_PUBLIC_SUPABASE_URL</code> ואת <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>.
        אחר כך הריצו את <code>supabase/migrations/001_hms_schema.sql</code> ב-SQL Editor.
      </p>
    </section>
  );
}

function SignedOut() {
  return (
    <section className="card stack">
      <h1>בית</h1>
      <p>כדי לראות את השבוע צריך להתחבר.</p>
      <Link className="btn btn-primary" href="/login">
        כניסה
      </Link>
    </section>
  );
}

function NeedsHousehold({ userId, error }: { userId: string; error: string }) {
  return (
    <section className="card stack">
      <h1>החשבון עדיין לא משויך לבית</h1>
      <p>
        אחרי שיש שני משתמשי Auth, יוצרים משק בית ושתי שורות ב-<code>hms_members</code> ב-SQL Editor.
        המדיניות חוסמת יצירה מהאפליקציה לפני שיש חברות.
      </p>
      <p>
        מזהה המשתמש: <code>{userId}</code>
      </p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
    </section>
  );
}
