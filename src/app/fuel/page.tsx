import { ExternalLink, Fuel, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { findSection } from "@/lib/nav";

export const metadata = { title: "Fuel" };

export default function FuelPage() {
  const section = findSection("/fuel")!;
  return (
    <>
      <PageHeader section={section} />
      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-6">
          <span className="chip">
            <KeyRound size={12} /> Needs your free registration
          </span>
          <h2 className="mt-4 font-display text-xl font-semibold">Official UK fuel prices — Fuel Finder</h2>
          <p className="mt-2 text-sm text-muted">
            Since February 2026 every UK petrol station must report its prices to the government&apos;s <strong className="text-ink">Fuel Finder</strong> scheme within 30
            minutes of a change. The data is free, but the API needs a one-off registration in your own name, so I can&apos;t set it up for you.
          </p>
          <ol className="mt-5 space-y-3 text-sm">
            {[
              "Open the Fuel Finder developer page (button below) and sign in with GOV.UK One Login — create one if you don't have it.",
              "Register as an “information recipient” for API access. It's free.",
              "You'll get a Client ID and a Client Secret. Don't paste them into chat.",
              "Tell me when you have them — I'll open Vercel's settings so you can paste them in, then I'll switch on the live map.",
            ].map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href="https://www.gov.uk/guidance/access-the-latest-fuel-prices-and-forecourt-data-via-api-or-email"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary mt-6"
          >
            Fuel Finder on GOV.UK <ExternalLink size={14} />
          </a>
        </section>
        <section className="card p-6">
          <Fuel size={28} className="text-[var(--c-discover)]" />
          <h3 className="mt-3 font-semibold">What you&apos;ll get</h3>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li>• Map of stations near you or any postcode/town</li>
            <li>• Unleaded, diesel and premium prices</li>
            <li>• Cheapest and nearest lists, with distance</li>
            <li>• &ldquo;Last updated&rdquo; time on every price</li>
            <li>• Directions in Apple Maps</li>
          </ul>
          <p className="mt-4 text-xs text-faint">Prices come from retailers; always check the pump before you fill up.</p>
        </section>
      </div>
    </>
  );
}
