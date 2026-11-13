"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hubSections, hubs, mobileTabs, sections, type Section } from "@/lib/nav";
import { ThemeToggle } from "./ThemeToggle";
import { Assistant } from "./assistant/Assistant";
import { LocationBanner } from "./LocationBanner";
import { useEffect, useState } from "react";
import { autoLocate } from "@/lib/weather";
import { syncPrefsFromAccount } from "@/lib/prefs";
import { VibeProvider } from "@/lib/vibe";
import { LivingBackground } from "./LivingBackground";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabIndex = mobileTabs.findIndex((t) => isActive(pathname, t.href));
  // Any section not on the bar (Travel, Fuel…) highlights "More"
  const activeTab = tabIndex >= 0 ? tabIndex : 2; // any other page lives under Explore
  useEffect(() => {
    autoLocate();
    syncPrefsFromAccount().catch(() => {});
  }, []);
  // Liquid-glass tab bar shrinks while scrolling down, grows back when scrolling up
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return;
      setCompact(y > last && y > 80);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <VibeProvider>
    <div className="min-h-dvh lg:flex">
      <LivingBackground />
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="dot-grid" aria-hidden />

      {/* ---------- Desktop sidebar ---------- */}
      <aside className="glass sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="text-lg font-bold tracking-tight">Life<span className="text-accent">Hub</span></span>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto" aria-label="Main">
          {(
            [
              ["", ["/", "/alerts", "/ai"].map((h) => sections.find((s) => s.href === h)!)],
              [
                "Hubs",
                hubs.map((h) => {
                  const parts = hubSections(h.id);
                  return { ...parts[0], label: h.id, icon: h.icon, color: h.color, hubParts: parts.map((p) => p.href) };
                }),
              ],
              ["", [sections.find((s) => s.href === "/settings")!]],
            ] as [string, (Section & { hubParts?: string[] })[]][]
          ).map(([title, items], gi) => (
            <div key={gi}>
              {title && <p className="mb-1.5 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint">{title}</p>}
              <ul className="space-y-0.5">
                {items.map((s) => {
                  const active = s.hubParts ? s.hubParts.some((h) => isActive(pathname, h)) : isActive(pathname, s.href);
                  const Icon = s.icon;
                  return (
                    <li key={s.label}>
                      <Link
                        href={s.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-[0.95rem] font-medium transition-all duration-300 active:scale-[0.97] ${
                          active ? "bg-accent text-white" : "text-ink hover:bg-surface-2"
                        }`}
                      >
                        <span className="grid size-7 place-items-center rounded-lg text-white" style={{ background: s.color }}>
                          <Icon size={16} strokeWidth={2.2} />
                        </span>
                        {s.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="mt-4 border-t border-line pt-4">
          <ThemeToggle />
        </div>
      </aside>

      {/* ---------- Page ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="liquid pt-safe sticky top-0 z-30 lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display font-semibold tracking-tight">LifeHub</span>
            </Link>
            <ThemeToggle compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <div key={pathname} className="animate-rise">
            <LocationBanner />
            {children}
          </div>
        </main>

        <Assistant />

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Tabs"
          className={`liquid tabbar fixed inset-x-3 z-40 mx-auto max-w-md rounded-[2rem] lg:hidden ${compact ? "tabbar-compact" : ""}`}
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 0.6rem)" }}
        >
          <ul className="relative grid grid-cols-5 px-1">
            {/* sliding highlight behind the active tab */}
            {activeTab >= 0 && (
              <span
                aria-hidden
                className="tab-pill absolute w-[20%] px-1.5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{ transform: `translateX(${activeTab * 100}%)` }}
              >
                <span
                  className="block h-full rounded-[1.4rem] transition-colors duration-500"
                  style={{ background: `color-mix(in srgb, ${mobileTabs[activeTab].color} 16%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${mobileTabs[activeTab].color} 22%, transparent)` }}
                />
              </span>
            )}
            {mobileTabs.map((t, i) => {
              const active = i === activeTab;
              const Icon = t.icon;
              return (
                <li key={t.href} className="relative">
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`tab-link flex flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors active:scale-90 ${
                      active ? "text-ink" : "text-faint"
                    }`}
                  >
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.3 : 1.8}
                      className={`transition-transform duration-300 ${active ? "-translate-y-0.5 scale-110" : ""}`}
                      style={{ color: active ? t.color : undefined }}
                    />
                    <span className="tab-label">{t.short ?? t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
    </VibeProvider>
  );
}

function Logo() {
  return (
    <span aria-hidden className="grid size-8 place-items-center rounded-[0.6rem] text-[0.95rem] font-extrabold text-white shadow-[0_6px_16px_-6px_#0a84ff]" style={{ background: "linear-gradient(160deg, #0a84ff, #5e5ce6)" }}>L</span>
  );
}
