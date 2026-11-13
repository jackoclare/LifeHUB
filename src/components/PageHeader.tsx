import type { Section } from "@/lib/nav";
import { HubTabs } from "@/components/HubTabs";

/** iOS-style large title */
export function PageHeader({ section, title, subtitle, action }: { section?: Section; title?: string; subtitle?: string; action?: React.ReactNode }) {
  const Icon = section?.icon;
  return (
    <>
    {section && <HubTabs section={section} />}
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="min-w-0">
        {Icon && (
          <span className="mb-2 flex items-center gap-1.5 text-[0.8rem] font-semibold" style={{ color: section!.color }}>
            <Icon size={15} strokeWidth={2.4} /> {section!.group}
          </span>
        )}
        <h1 className="large-title">{title ?? section?.label}</h1>
        {(subtitle ?? section?.blurb) && <p className="mt-1.5 text-[0.95rem] text-muted">{subtitle ?? section?.blurb}</p>}
      </div>
      {action}
    </div>
    </>
  );
}
