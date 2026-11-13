import Link from "next/link";
import { hubSections, hubs, sections } from "@/lib/nav";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Explore" };

/** Everything in LifeHub, bunched into a few hubs. Tap a hub, or jump straight to one of its parts. */
export default function MenuPage() {
  const ai = sections.find((s) => s.href === "/ai")!;
  const AiIcon = ai.icon;
  return (
    <>
      <PageHeader title="Explore" subtitle="Everything in LifeHub, in one place." />
      <div className="stagger grid grid-cols-2 gap-3">
        {hubs.map((h, i) => {
          const parts = hubSections(h.id);
          const Icon = h.icon;
          return (
            <div
              key={h.id}
              className={`card relative overflow-hidden p-4 ${parts.length === 1 ? "" : ""} ${h.id === "Health" ? "col-span-2" : ""}`}
              style={{ "--i": i, "--tile": h.color } as React.CSSProperties}
            >
              <Link href={parts[0].href} className="absolute inset-0" aria-label={`Open ${h.id}`} />
              <span className="icon-tile pointer-events-none relative">
                <Icon size={19} />
              </span>
              <p className="pointer-events-none relative mt-3 text-[1.05rem] font-bold tracking-tight">{h.id}</p>
              {parts.length > 1 ? (
                <div className="relative mt-2 flex flex-wrap gap-1.5">
                  {parts.map((p) => (
                    <Link
                      key={p.href}
                      href={p.href}
                      className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:text-ink active:scale-95"
                    >
                      {p.short ?? p.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="pointer-events-none relative mt-1 text-xs text-muted">{parts[0].blurb}</p>
              )}
            </div>
          );
        })}
      </div>

      <Link href={ai.href} className="card mt-3 flex min-h-16 items-center gap-3 p-4" style={{ "--tile": ai.color } as React.CSSProperties}>
        <span className="icon-tile">
          <AiIcon size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">AI chat</span>
          <span className="block truncate text-xs text-muted">{ai.blurb}</span>
        </span>
      </Link>
    </>
  );
}
