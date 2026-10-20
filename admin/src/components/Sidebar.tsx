"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SECTIONS: { title: string; links: { href: string; label: string }[] }[] = [
  { title: "Overview", links: [{ href: "/dashboard", label: "Dashboard" }, { href: "/analytics", label: "Analytics" }] },
  {
    title: "People & farms",
    links: [
      { href: "/farmers", label: "Farmers" },
      { href: "/farms", label: "Farms" },
      { href: "/voice-calls", label: "Voice calls" },
      { href: "/support", label: "Support inbox" },
    ],
  },
  {
    title: "Knowledge",
    links: [
      { href: "/crops", label: "Crops" },
      { href: "/diseases", label: "Diseases" },
      { href: "/pests", label: "Pests" },
      { href: "/schemes", label: "Schemes" },
    ],
  },
  {
    title: "Data & models",
    links: [
      { href: "/models", label: "Models" },
      { href: "/markets", label: "Market prices" },
      { href: "/weather", label: "Weather cache" },
    ],
  },
  {
    title: "Operations",
    links: [
      { href: "/notifications", label: "Notifications" },
      { href: "/system-health", label: "System health" },
    ],
  },
];

export function Sidebar({ logout }: { logout: () => Promise<void> }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-full flex-col border-b border-line bg-surface-1 md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 md:border-r">
      <div className="flex items-center gap-2 px-5 py-4">
        <span aria-hidden className="text-xl">🌱</span>
        <span className="font-semibold">AgriSmart</span>
        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-ink-3">Admin</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {SECTIONS.map((section) => (
          <div key={section.title} className="mt-3">
            <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-ink-3">{section.title}</p>
            {section.links.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-2 py-1.5 text-sm ${active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:bg-surface-2"}`}>
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <form action={logout} className="border-t border-line p-3">
        <button className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-ink-2 hover:bg-surface-2">Sign out</button>
      </form>
    </aside>
  );
}
