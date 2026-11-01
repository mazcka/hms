"use client";

import { CalendarDays, CheckSquare, House, Settings, ShoppingBag } from "lucide-react";
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
import { ActionNoticeProvider } from "@/components/action-notice";
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
  { href: "/", label: "היום", icon: House },
  { href: "/tasks", label: "משימות", icon: CheckSquare },
  { href: "/classes", label: "יומן", icon: CalendarDays },
  { href: "/shop", label: "קניות", icon: ShoppingBag },
  { href: "/settings", label: "ניהול", icon: Settings },
] as const;

function navIsCurrent(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/classes") return pathname === "/classes" || pathname === "/events";
  return pathname === href || pathname.startsWith(`${href}/`);
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
      setError("לא הצלחנו לטעון את החברות בבית. נסה לרענן.");
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
    if (allError) setError("לא הצלחנו לטעון את בני הבית. נסה לרענן.");
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
      <ActionNoticeProvider>
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
      {showNav ? <QuickAdd /> : null}
      {showNav ? (
        <nav className="nav" aria-label="ראשי">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={navIsCurrent(pathname, item.href) ? "page" : undefined}
              >
                <Icon aria-hidden="true" strokeWidth={1.8} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : null}
      </ActionNoticeProvider>
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
      <p>כדי לראות את היום צריך להתחבר</p>
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
        המדיניות חוסמת יצירה מהאפליקציה לפני שיש חברות
      </p>
      <p>
        מזהה המשתמש: <code>{userId}</code>
      </p>
      {error ? <p className="alert" role="alert">{error}</p> : null}
    </section>
  );
}
