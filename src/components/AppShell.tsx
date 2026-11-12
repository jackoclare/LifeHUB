"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groups, mobileTabs, sections } from "@/lib/nav";
import { ThemeToggle } from "./ThemeToggle";
import { Assistant } from "./assistant/Assistant";
import { LocationBanner } from "./LocationBanner";
import { useEffect } from "react";
import { autoLocate } from "@/lib/weather";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tabIndex = mobileTabs.findIndex((t) => isActive(pathname, t.href));
  // Any section not on the bar (Travel, Fuel…) highlights "More"
  const activeTab = tabIndex >= 0 ? tabIndex : mobileTabs.length - 1;
  useEffect(() => {
    autoLocate();
  }, []);

  return (
    <div className="min-h-dvh lg:flex">
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      {/* ---------- Desktop sidebar ---------- */}
      <aside className="glass sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-lg font-semibold tracking-tight">LifeHub</span>
        </Link>

        <nav className="flex-1 space-y-6 overflow-y-auto" aria-label="Main">
          {groups.map((group) => (
            <div key={group}>
              <p className="mb-1.5 px-2 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-faint">{group}</p>
              <ul className="space-y-0.5">
                {sections
                  .filter((s) => s.group === group)
                  .map((s) => {
                    const active = isActive(pathname, s.href);
                    const Icon = s.icon;
                    return (
                      <li key={s.href}>
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
        <header className="glass pt-safe sticky top-0 z-30 border-b border-line lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display font-semibold tracking-tight">LifeHub</span>
            </Link>
            <ThemeToggle compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <div key={pathname} className="animate-rise">
            <LocationBanner />
            {children}
          </div>
        </main>

        <Assistant />

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Tabs"
          className="glass pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line lg:hidden"
        >
          <ul className="relative mx-auto grid max-w-md grid-cols-5">
            {/* sliding highlight behind the active tab */}
            {activeTab >= 0 && (
              <span
                aria-hidden
                className="absolute top-2 h-12 w-[20%] px-3 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{ transform: `translateX(${activeTab * 100}%)` }}
              >
                <span
                  className="block h-full rounded-2xl transition-colors duration-500"
                  style={{ background: `color-mix(in srgb, ${mobileTabs[activeTab].color} 14%, transparent)` }}
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
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors active:scale-95 ${
                      active ? "text-ink" : "text-faint"
                    }`}
                  >
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.3 : 1.8}
                      className={`transition-transform duration-300 ${active ? "-translate-y-0.5 scale-110" : ""}`}
                      style={{ color: active ? t.color : undefined }}
                    />
                    {t.short ?? t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}

function Logo() {
  return (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-[0.65rem] font-display text-[0.8rem] font-black italic tracking-tight text-[#fff4ea] shadow-[0_6px_16px_-6px_#7c3aed]"
      style={{ background: "linear-gradient(135deg, #0a0c1c 0%, #4c1d95 60%, #ff5e3a 100%)" }}
    >
      JC
    </span>
  );
}
