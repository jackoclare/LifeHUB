import type { Section } from "@/lib/nav";

export function PageHeader({ section, title, subtitle, action }: { section?: Section; title?: string; subtitle?: string; action?: React.ReactNode }) {
  const Icon = section?.icon;
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="icon-tile size-11! rounded-2xl!" style={{ "--tile": section!.color } as React.CSSProperties}>
            <Icon size={22} />
          </span>
        )}
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title ?? section?.label}</h1>
          {(subtitle ?? section?.blurb) && <p className="mt-0.5 text-sm text-muted">{subtitle ?? section?.blurb}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
