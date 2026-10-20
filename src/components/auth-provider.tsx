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
import { QuickAdd } from "@/components/quick-add";
import { TaskEditorProvider } from "@/components/task-editor";
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
  { href: "/", label: "השבוע", icon: "home" },
  { href: "/tasks", label: "משימות", icon: "check" },
  { href: "/shop", label: "קניות", icon: "bag" },
  { href: "/plan", label: "לוח", icon: "cal" },
  { href: "/voice", label: "קול", icon: "mic" },
] as const;

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="4" y="4" width="16" height="16" rx="3" />
        <path {...common} d="m8 12 2.5 2.5L16 9" />
      </svg>
    );
  }
  if (name === "bag") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M6 8h12l-1 12H7L6 8z" />
        <path {...common} d="M9 8V7a3 3 0 0 1 6 0v1" />
      </svg>
    );
  }
  if (name === "cal") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
        <path {...common} d="M8 3.5v3M16 3.5v3M4 10h16" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect {...common} x="9" y="3" width="6" height="11" rx="3" />
      <path {...common} d="M7 11a5 5 0 0 0 10 0M12 16v4" />
    </svg>
  );
}

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
        {supabase && ready && (pathname === "/login" || gate) ? (
          <TaskEditorProvider>
            {showNav && pathname !== "/" ? (
              <Link className="home-back" href="/">
                השבוע
              </Link>
            ) : null}
            {children}
          </TaskEditorProvider>
        ) : null}
      </div>
      {showNav ? <QuickAdd /> : null}
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
              <NavIcon name={item.icon} />
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
