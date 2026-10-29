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
import { PushSync } from "@/components/push-sync";
import { QuickAdd } from "@/components/quick-add";
import { TaskEditorProvider } from "@/components/task-editor";
import { BrandMark, Loader } from "@/components/ui";
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
  { href: "/", label: "היום", icon: "home" },
  { href: "/tasks", label: "משימות", icon: "check" },
  { href: "/classes", label: "יומן", icon: "calendar" },
  { href: "/shop", label: "קניות", icon: "bag" },
  { href: "/settings", label: "ניהול", icon: "settings" },
] as const;

function navIsCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/classes") return pathname === "/classes" || pathname === "/events";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavIcon({ name }: { name: (typeof NAV)[number]["icon"] }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...common} d="M4.5 11.2 12 5l7.5 6.2" />
        <path {...common} d="M7 10.6V19h10v-8.4" />
        <path {...common} d="M10.4 19v-4.2h3.2V19" />
        <path {...common} d="M12 5.2c.2-1.1 1.5-1.5 2.1-.4" />
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
  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect {...common} x="4" y="5" width="16" height="15" rx="2" />
        <path {...common} d="M8 3.5v3M16 3.5v3M4 10h16" />
      </svg>
    );
  }
  if (name === "settings") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="3" />
        <path {...common} d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6.1 6.1l1.6 1.6M16.3 16.3l1.6 1.6M17.9 6.1l-1.6 1.6M7.7 16.3l-1.6 1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path {...common} d="M6 8h12l-1 12H7L6 8z" />
      <path {...common} d="M9 8V7a3 3 0 0 1 6 0v1" />
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
        {supabase && !ready ? <Loader /> : null}
        {supabase && ready && !session && pathname !== "/login" ? <SignedOut /> : null}
        {supabase && ready && session && !member && pathname !== "/login" ? (
          <NeedsHousehold userId={session.user.id} error={error} />
        ) : null}
        {error && member ? <p className="alert" role="alert">{error}</p> : null}
        {supabase && ready && (pathname === "/login" || gate) ? (
          <TaskEditorProvider>
            {children}
          </TaskEditorProvider>
        ) : null}
      </div>
      {gate ? <PushSync accessToken={gate.session.access_token} /> : null}
      {showNav ? <QuickAdd /> : null}
      {showNav ? (
        <nav className="nav" aria-label="ראשי">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={navIsCurrent(pathname, item.href) ? "page" : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      ) : null}
    </GateContext.Provider>
  );
}

function BrandHeading({ title = "מצקה" }: { title?: string }) {
  return (
    <div className="brand-lockup">
      <BrandMark size={44} />
      <h1>{title}</h1>
    </div>
  );
}

function SetupMissing() {
  return (
    <section className="card stack">
      <BrandHeading />
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
      <BrandHeading />
      <p>כדי לראות את היום צריך להתחבר.</p>
      <Link className="btn btn-primary" href="/login">
        כניסה
      </Link>
    </section>
  );
}

function NeedsHousehold({ userId, error }: { userId: string; error: string }) {
  return (
    <section className="card stack">
      <BrandHeading title="החשבון עדיין לא משויך לבית" />
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
