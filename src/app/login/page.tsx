"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { Alert } from "@/components/ui";

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
      if (signError) setError(signError.message);
      else setInfo("החשבון נוצר. אם נדרש אימות במייל, אשרו אותו ואז התחברו. שיוך לבית נעשה ב-SQL.");
      return;
    }
    const { error: signError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (signError) setError(signError.message);
    else router.replace("/");
  }

  return (
    <section className="card">
      <h1>{mode === "in" ? "כניסה" : "חשבון חדש"}</h1>
      <p className="lede">שני בני הבית נכנסים עם אימייל וסיסמה.</p>
      <form className="stack" onSubmit={onSubmit}>
        <Alert>{error}</Alert>
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
        <p id="password-hint" className="meta">לפחות 6 תווים.</p>
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "שולח…" : mode === "in" ? "כניסה" : "יצירת חשבון"}
        </button>
        <button
          className="btn btn-quiet"
          type="button"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "אין חשבון? יצירה" : "יש חשבון? כניסה"}
        </button>
      </form>
    </section>
  );
}
