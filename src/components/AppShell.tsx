"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { groups, mobileTabs, sections } from "@/lib/nav";
import { ThemeToggle } from "./ThemeToggle";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh lg:flex">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-bg-elevated px-4 py-6 lg:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 px-2">
          <Logo />
          <span className="font-display text-lg font-semibold tracking-tight">MyLife Hub</span>
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
                          className={`flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors ${
                            active ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"
                          }`}
                        >
                          <Icon size={18} style={{ color: active ? s.color : undefined }} />
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
        <header className="pt-safe sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2">
              <Logo />
              <span className="font-display font-semibold tracking-tight">MyLife</span>
            </Link>
            <ThemeToggle compact />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
          <div key={pathname} className="animate-rise">
            {children}
          </div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav
          aria-label="Tabs"
          className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg-elevated/85 backdrop-blur-xl lg:hidden"
        >
          <ul className="mx-auto grid max-w-md grid-cols-5">
            {mobileTabs.map((t) => {
              const active = isActive(pathname, t.href);
              const Icon = t.icon;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-16 flex-col items-center justify-center gap-1 text-[0.68rem] font-semibold transition-colors ${
                      active ? "text-ink" : "text-faint"
                    }`}
                  >
                    <Icon size={22} strokeWidth={active ? 2.3 : 1.8} style={{ color: active ? t.color : undefined }} />
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
      className="grid size-8 place-items-center rounded-[0.65rem] bg-accent font-display text-sm font-bold text-white shadow-[0_6px_16px_-6px_var(--accent)]"
    >
      M
    </span>
  );
}
