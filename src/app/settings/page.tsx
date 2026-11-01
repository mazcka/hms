"use client";

import { Check, Lock, Pencil, Plus, Tag, Trash2, UserRound } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useActionNotice } from "@/components/action-notice";
import { useHousehold } from "@/components/auth-provider";
import { CollapsibleSection } from "@/components/collapsible-section";
import { MenuItem, RowMenu } from "@/components/menu";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { Empty, PageHead, PersonLink, Skeleton } from "@/components/ui";
import { EVENT_KINDS, RELATIONS } from "@/lib/labels";

type Person = { id: string; name: string; relation: keyof typeof RELATIONS };
type Kind = { id: string; label: string };

export default function SettingsPage() {
  const gate = useHousehold();
  const { showNotice } = useActionNotice();
  const router = useRouter();
  const [homeName, setHomeName] = useState("");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [kinds, setKinds] = useState<Kind[] | null>(null);
  const [personName, setPersonName] = useState("");
  const [relation, setRelation] = useState<Person["relation"]>("daughter");
  const [editing, setEditing] = useState<Person | null>(null);
  const [kindLabel, setKindLabel] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});

  async function load() {
    if (!gate) return;
    const [home, peopleResult, kindsResult] = await Promise.all([
      gate.supabase.from("hms_households").select("name").eq("id", gate.member.household_id).maybeSingle(),
      gate.supabase.from("hms_people").select("id, name, relation").eq("household_id", gate.member.household_id).order("name"),
      gate.supabase.from("hms_event_kinds").select("id, label").eq("household_id", gate.member.household_id).order("label"),
    ]);
    if (home.error || peopleResult.error || kindsResult.error) showNotice({ tone: "error", text: "לא הצלחנו לטעון את ההגדרות, נסה שוב" });
    setHomeName((home.data?.name as string | undefined) ?? "");
    setPeople((peopleResult.data ?? []) as Person[]);
    setKinds(kindsResult.error ? [] : (kindsResult.data ?? []) as Kind[]);
    setNames(Object.fromEntries(gate.members.map((member) => [member.id, member.display_name])));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate]);

  if (!gate) return null;

  async function saveHome(event: FormEvent) {
    event.preventDefault();
    if (!gate || !homeName.trim()) return;
    const { error: writeError } = await gate.supabase.from("hms_households").update({ name: homeName.trim() }).eq("id", gate.member.household_id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור את שם הבית, נסה שוב" });
    else showNotice({ tone: "ok", text: "שם הבית עודכן" });
  }

  async function addPerson(event: FormEvent) {
    event.preventDefault();
    if (!gate || !personName.trim()) {
      showNotice({ tone: "error", text: "חסר שם" });
      return;
    }
    const { error: writeError } = await gate.supabase.from("hms_people").insert({
      household_id: gate.member.household_id,
      name: personName.trim(),
      relation,
    });
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו להוסיף את האדם, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: `${personName.trim()} נוסף` });
      setPersonName("");
      await load();
    }
  }

  async function savePerson(event: FormEvent) {
    event.preventDefault();
    if (!gate || !editing || !editing.name.trim()) return;
    const { error: writeError } = await gate.supabase.from("hms_people").update({
      name: editing.name.trim(),
      relation: editing.relation,
    }).eq("id", editing.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: `${editing.name.trim()} עודכן` });
      setEditing(null);
      await load();
    }
  }

  async function removePerson(id: string) {
    if (!gate || !window.confirm("למחוק את האדם? החוגים שלו יימחקו איתו")) return;
    const { error: writeError } = await gate.supabase.from("hms_people").delete().eq("id", id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: "האדם נמחק" });
      await load();
    }
  }

  async function addKind(event: FormEvent) {
    event.preventDefault();
    if (!gate || !kindLabel.trim()) return;
    const { error: writeError } = await gate.supabase.from("hms_event_kinds").insert({
      household_id: gate.member.household_id,
      label: kindLabel.trim(),
    });
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו להוסיף סוג, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: `${kindLabel.trim()} נוסף` });
      setKindLabel("");
      await load();
    }
  }

  async function removeKind(kind: Kind) {
    if (!gate || !window.confirm(`למחוק את הסוג "${kind.label}"? אירועים מהסוג הזה יעברו ל"אחר"`)) return;
    await gate.supabase.from("hms_events").update({ kind: "other" }).eq("household_id", gate.member.household_id).eq("kind", kind.id);
    const { error: writeError } = await gate.supabase.from("hms_event_kinds").delete().eq("id", kind.id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו למחוק את הסוג, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: `${kind.label} נמחק` });
      await load();
    }
  }

  async function saveMember(id: string) {
    if (!gate) return;
    const display_name = names[id]?.trim();
    if (!display_name) return;
    const { error: writeError } = await gate.supabase.from("hms_members").update({ display_name }).eq("id", id);
    if (writeError) showNotice({ tone: "error", text: "לא הצלחנו לשמור את השם, נסה שוב" });
    else {
      showNotice({ tone: "ok", text: "השם עודכן" });
      await gate.reload();
    }
  }

  async function signOut() {
    if (!gate) return;
    await gate.supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <>
      <PageHead title="ניהול" lede="הבית, האנשים ומי שנכנס לאפליקציה" />

      <CollapsibleSection storageKey="settings-home" title={<h2>הבית</h2>} className="panel">
        <form className="record" onSubmit={saveHome}>
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} aria-label="שם הבית" />
          <button className="icon-btn" type="submit" aria-label="שמירה" title="שמירה"><Check aria-hidden="true" /></button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection storageKey="settings-people" title={<h2>אנשים</h2>} className="panel">
        {!people ? <Skeleton rows={2} /> : null}
        {people && people.length === 0 ? <Empty title="אין אנשים" /> : null}
        <ul className="stack">
          {people?.map((person) => (
            <SwipeRow
              key={person.id}
              endActions={[
                { label: "עריכה", icon: <Pencil aria-hidden="true" />, onSelect: () => setEditing(person) },
                { label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => removePerson(person.id), tone: "danger" },
              ]}
            >
              <button className="row-open" type="button" aria-label={`עריכת ${person.name}`} onClick={() => setEditing(person)}>
                <span className="meta">{RELATIONS[person.relation]}</span>
              </button>
              <PersonLink id={person.id} name={person.name} people={people ?? []} />
              <RowMenu label={`פעולות ${person.name}`}>
                <MenuItem icon={<Pencil aria-hidden="true" />} onSelect={() => setEditing(person)}>עריכה</MenuItem>
                <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => removePerson(person.id)}>מחיקה</MenuItem>
              </RowMenu>
            </SwipeRow>
          ))}
        </ul>
        <form className="record" onSubmit={addPerson}>
          <input value={personName} onChange={(e) => setPersonName(e.target.value)} placeholder="שם" aria-label="שם" />
          <select value={relation} aria-label="קשר" onChange={(e) => setRelation(e.target.value as Person["relation"])}>
            {Object.entries(RELATIONS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <button className="icon-btn" type="submit" aria-label="הוספה" title="הוספה"><Plus aria-hidden="true" /></button>
        </form>
      </CollapsibleSection>

      <CollapsibleSection storageKey="settings-kinds" title={<h2>סוגי אירועים</h2>} className="panel">
        <ul className="stack">
          {Object.values(EVENT_KINDS).map((label) => (
            <li className="record record-static" key={label}>
              <span className="row-mark" aria-hidden="true"><Lock /></span>
              <div className="row-open">
                <span>{label}</span>
                <span className="meta">קבוע</span>
              </div>
            </li>
          ))}
          {kinds?.map((kind) => (
            <SwipeRow
              key={kind.id}
              endActions={[{ label: "מחיקה", icon: <Trash2 aria-hidden="true" />, onSelect: () => removeKind(kind), tone: "danger" }]}
            >
              <span className="row-mark" aria-hidden="true"><Tag /></span>
              <div className="row-open"><span>{kind.label}</span></div>
              <RowMenu label={`פעולות ${kind.label}`}>
                <MenuItem danger icon={<Trash2 aria-hidden="true" />} onSelect={() => removeKind(kind)}>מחיקה</MenuItem>
              </RowMenu>
            </SwipeRow>
          ))}
        </ul>
        <form className="record" onSubmit={addKind}>
          <input value={kindLabel} onChange={(e) => setKindLabel(e.target.value)} placeholder="סוג חדש" aria-label="סוג חדש" />
          <button className="icon-btn" type="submit" aria-label="הוספה" title="הוספה"><Plus aria-hidden="true" /></button>
        </form>
        {kinds === null ? null : <p className="note">יום הולדת, תור ואחר תמיד זמינים. סוגים שמוסיפים כאן מופיעים בטופס אירוע.</p>}
      </CollapsibleSection>

      <CollapsibleSection storageKey="settings-members" title={<h2>מי שמשתמש באפליקציה</h2>} className="panel">
        <ul className="stack">
          {gate.members.map((member) => (
            <li key={member.id}>
              <form className="record" onSubmit={(event) => { event.preventDefault(); saveMember(member.id); }}>
                <span className="row-mark" aria-hidden="true"><UserRound /></span>
                <input
                  aria-label={`שם של ${member.display_name}`}
                  value={names[member.id] ?? member.display_name}
                  onChange={(e) => setNames({ ...names, [member.id]: e.target.value })}
                />
                <button className="icon-btn" type="submit" aria-label="שמירה" title="שמירה"><Check aria-hidden="true" /></button>
              </form>
            </li>
          ))}
        </ul>
      </CollapsibleSection>

      <button className="btn btn-quiet" type="button" onClick={signOut}>יציאה</button>

      <Sheet open={Boolean(editing)} title="עריכת אדם" onClose={() => setEditing(null)}>
        {editing ? (
          <form className="stack" onSubmit={savePerson}>
            <label>
              שם
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
            </label>
            <label>
              קשר
              <select value={editing.relation} onChange={(e) => setEditing({ ...editing, relation: e.target.value as Person["relation"] })}>
                {Object.entries(RELATIONS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <button className="btn btn-primary" type="submit">שמירה</button>
          </form>
        ) : null}
      </Sheet>
    </>
  );
}
