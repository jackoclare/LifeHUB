"use client";

import Link from "next/link";
import { ChevronRight, LogOut, Moon, Smartphone, Sun, UserRound } from "lucide-react";
import { useTheme } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { SetPin } from "@/components/SetPin";
import { NotificationSettings } from "@/components/NotificationSettings";
import { CalendarFeed } from "@/components/CalendarFeed";
import { ConnectionsStatus } from "@/components/ConnectionsStatus";
import { PreferencesCard } from "@/components/PreferencesCard";

export function SettingsView() {
  const [theme, setTheme] = useTheme();
  const { user, loading, signOut } = useAuth();

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Account</h2>
        {loading ? null : user ? (
          <div className="card flex items-center gap-3 p-4">
            <span className="icon-tile" style={{ "--tile": "var(--c-money)" } as React.CSSProperties}>
              <UserRound size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Signed in</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <button className="btn btn-ghost" onClick={signOut}>
              <LogOut size={16} /> Sign out
            </button>
          </div>
        ) : null}
        {!loading && user && (
          <div className="mt-3 space-y-3">
            <NotificationSettings />
            <CalendarFeed />
            <SetPin />
            <PreferencesCard />
            <ConnectionsStatus />
          </div>
        )}
        {loading || user ? null : (
          <SignInCard />
        )}
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Appearance</h2>
        <div className="card grid grid-cols-2 gap-2 p-2">
          {(
            [
              ["dark", "Dark", Moon],
              ["light", "Light", Sun],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              aria-pressed={theme === value}
              className={`flex min-h-14 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors ${
                theme === value ? "bg-accent text-white" : "text-muted hover:bg-surface-2"
              }`}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Dashboard</h2>
        <Link href="/" className="card flex min-h-14 items-center justify-between px-4 py-3 text-sm font-medium">
          Choose which sections appear — tap “Customise” on the dashboard
          <ChevronRight size={18} className="shrink-0 text-faint" />
        </Link>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Install on iPhone</h2>
        <div className="card flex gap-3 p-4 text-sm">
          <Smartphone size={20} className="mt-0.5 shrink-0 text-accent" />
          <p className="text-muted">
            Open this site in <span className="font-semibold text-ink">Safari</span>, tap the <span className="font-semibold text-ink">Share</span> button,
            then <span className="font-semibold text-ink">Add to Home Screen</span>. LifeHub then opens full-screen like a normal app.
          </p>
        </div>
      </section>

      <section>
        <h2 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Coming later</h2>
        <div className="card divide-y divide-line text-sm">
          <p className="px-4 py-3 text-muted">Favourite teams, location and notification preferences — Phases 4–6</p>
        </div>
      </section>
    </div>
  );
}
