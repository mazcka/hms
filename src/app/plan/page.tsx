import Link from "next/link";

const LINKS = [
  { href: "/classes", title: "חוגים", text: "לוח שבועי קבוע לפי ילדה ויום." },
  { href: "/events", title: "אירועים", text: "יום הולדת, תור או אסיפה לפי תאריך." },
  { href: "/wishes", title: "משאלות", text: "רעיון, הוחלט לקנות, או נקנה." },
];

export default function PlanPage() {
  return (
    <>
      <h1>לוח</h1>
      <p className="lede">חוגים, אירועים ורשימת משאלות.</p>
      {LINKS.map((item) => (
        <Link key={item.href} href={item.href} className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <h2>{item.title}</h2>
          <p className="meta">{item.text}</p>
        </Link>
      ))}
    </>
  );
}
