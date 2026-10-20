import Link from "next/link";

const LINKS = [
  { href: "/classes", title: "חוגים", tone: "tile-plan" },
  { href: "/events", title: "אירועים", tone: "tile-people" },
  { href: "/wishes", title: "משאלות", tone: "tile-tasks" },
];

export default function PlanPage() {
  return (
    <>
      <h1>לוח</h1>
      <nav className="mosaic">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className={`tile ${item.tone}`}>
            {item.title}
          </Link>
        ))}
      </nav>
    </>
  );
}
