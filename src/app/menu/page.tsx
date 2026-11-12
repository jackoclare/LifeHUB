import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { groups, sections } from "@/lib/nav";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Explore" };

export default function MenuPage() {
  return (
    <>
      <PageHeader title="Explore" subtitle="Everything in LifeHub." />
      <div className="space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">{g}</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {sections
                .filter((s) => s.group === g)
                .map((s) => {
                  const Icon = s.icon;
                  return (
                    <li key={s.href}>
                      <Link href={s.href} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-surface-2">
                        <span className="icon-tile" style={{ "--tile": s.color } as React.CSSProperties}>
                          <Icon size={18} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">{s.label}</span>
                          <span className="block truncate text-xs text-muted">{s.blurb}</span>
                        </span>
                        <ChevronRight size={18} className="text-faint" />
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
