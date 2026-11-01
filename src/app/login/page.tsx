"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { BrandMark } from "@/components/ui";

function authMessage(message: string) {
  if (/invalid login|invalid credentials|invalid_credentials/i.test(message)) return "האימייל או הסיסמה לא נכונים.";
  if (/already registered|already been registered/i.test(message)) return "האימייל כבר רשום. אפשר להתחבר.";
  if (/rate/i.test(message)) return "יותר מדי ניסיונות. חכה רגע ונסה שוב.";
  return "לא הצלחנו להשלים את הפעולה. נסה שוב.";
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabase();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, setPending] = useState(false);

  if (!supabase) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    setError("");
    setInfo("");
    if (!email.trim() || password.length < 6) {
      setError("צריך אימייל וסיסמה של 6 תווים לפחות.");
      return;
    }
    setPending(true);
    if (mode === "up") {
      const { error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: name.trim() } },
      });
      setPending(false);
      if (signError) setError(authMessage(signError.message));
      else setInfo("החשבון נוצר. אם צריך לאשר במייל — אשרו ואז התחברו. השיוך לבית נעשה אחר כך.");
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (signError) setError(authMessage(signError.message));
    else router.replace("/");
  }

  return (
    <section className="card auth-card">
      <div className="brand-lockup">
        <BrandMark size={44} />
        <h1>מצקה</h1>
      </div>
      <p className="lede">{mode === "in" ? "כניסה לבית, לשני בני הזוג." : "חשבון חדש לבית."}</p>
      <form className="stack" onSubmit={onSubmit}>
        {error ? <p className="alert" role="alert">{error}</p> : null}
        {info ? <p className="note">{info}</p> : null}
        {mode === "up" ? (
          <label>
            שם תצוגה
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        ) : null}
        <label>
          אימייל
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label>
          סיסמה
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            aria-describedby="password-hint"
          />
        </label>
        <p id="password-hint" className="meta">לפחות 6 תווים</p>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "שולח…" : mode === "in" ? "כניסה" : "יצירת חשבון"}
        </button>
        <button
          className="btn btn-quiet"
          type="button"
          onClick={() => { setMode(mode === "in" ? "up" : "in"); setError(""); setInfo(""); }}
        >
          {mode === "in" ? "אין חשבון? יצירה" : "יש חשבון? כניסה"}
        </button>
      </form>
    </section>
  );
}
