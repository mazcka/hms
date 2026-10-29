"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/classes", label: "חוגים" },
  { href: "/events", label: "אירועים" },
] as const;

export function SectionTabs() {
  const pathname = usePathname();
  return (
    <div className="section-tabs" role="tablist" aria-label="חוגים ואירועים">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          role="tab"
          aria-selected={pathname === tab.href}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
