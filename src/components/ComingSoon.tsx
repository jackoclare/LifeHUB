import Link from "next/link";
import { ArrowLeft, Hammer } from "lucide-react";
import { findSection, phaseNames } from "@/lib/nav";
import { PageHeader } from "./PageHeader";

/** Placeholder for sections that are planned but not built yet. Shows no fake data. */
export function ComingSoon({ href, plans }: { href: string; plans: string[] }) {
  const section = findSection(href)!;
  return (
    <>
      <PageHeader section={section} />
      <div className="card p-6 sm:p-8">
        <span className="chip">
          <Hammer size={12} /> Phase {section.phase} · {phaseNames[section.phase]}
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold">Not built yet</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          This section is planned and the space is ready. Nothing here is live yet, so no prices, scores or data are shown.
        </p>
        <ul className="stagger mt-5 grid gap-2 sm:grid-cols-2">
          {plans.map((p, i) => (
            <li key={p} style={{ "--i": i } as React.CSSProperties} className="flex items-start gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-sm">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: section.color }} />
              {p}
            </li>
          ))}
        </ul>
        <Link href="/" className="btn btn-ghost mt-6">
          <ArrowLeft size={16} /> Back to dashboard
        </Link>
      </div>
    </>
  );
}
