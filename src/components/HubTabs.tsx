import Link from "next/link";
import { hubSections, type Section } from "@/lib/nav";

/** Tabs across the top of a hub (e.g. Money · Bills · Wish list · Deals) so related pages are one tap apart. */
export function HubTabs({ section }: { section: Section }) {
  const tabs = hubSections(section.group);
  if (tabs.length < 2) return null;
  return (
    <nav aria-label={section.group} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const on = t.href === section.href;
        const Icon = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-all active:scale-95 ${
              on ? "text-white shadow-[0_8px_20px_-10px_var(--tab)]" : "bg-surface text-muted shadow-[var(--shadow)] hover:text-ink"
            }`}
            style={{ "--tab": t.color, ...(on ? { background: t.color } : {}) } as React.CSSProperties}
          >
            <Icon size={15} strokeWidth={2.3} /> {t.short ?? t.label}
          </Link>
        );
      })}
    </nav>
  );
}
