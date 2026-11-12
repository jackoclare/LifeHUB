"use client";

import { Bell, BellOff, BellRing, CloudLightning, Loader2, Receipt, Share, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "./AuthProvider";
import { metRegion } from "@/components/weather/WeatherWidgets";
import { readPlace } from "@/lib/weather";

const myRegion = () => {
  const p = readPlace();
  return p ? metRegion(p.lat, p.lon) : "wm";
};

const FN_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify`;

function b64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type Status = "loading" | "unsupported" | "needs-install" | "not-configured" | "off" | "on" | "denied";

export function NotificationSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [prefs, setPrefs] = useState({ bills: true, matches: true, weather: true });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (isIOS && !standalone) return setStatus("needs-install");
      if (!supported) return setStatus("unsupported");
      try {
        const cfg = await fetch(FN_URL, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "" } }).then((r) => r.json());
        if (!cfg.configured || !cfg.publicKey) return setStatus("not-configured");
        setPublicKey(cfg.publicKey);
      } catch {
        return setStatus("not-configured");
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? "on" : "off");
      const { data } = await createClient().from("notification_prefs").select("bills,matches,weather").maybeSingle();
      if (data) setPrefs({ bills: data.bills, matches: data.matches, weather: data.weather ?? true });
    })();
  }, [user]);

  if (!user) return null;

  const enable = async () => {
    if (!publicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus(perm === "denied" ? "denied" : "off");
        setBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(publicKey) });
      const j = sub.toJSON();
      const supabase = createClient();
      const { error } = await supabase
        .from("push_subscriptions")
        .upsert({ endpoint: j.endpoint, p256dh: j.keys?.p256dh, auth: j.keys?.auth, device: navigator.userAgent.slice(0, 120) }, { onConflict: "endpoint" });
      if (error) throw new Error(error.message);
      await supabase.from("notification_prefs").upsert({ user_id: user.id, ...prefs, weather_region: myRegion() });
      setStatus("on");
      await sendTest();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't turn notifications on");
    }
    setBusy(false);
  };

  const disable = async () => {
    setBusy(true);
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("off");
    setBusy(false);
  };

  const sendTest = async () => {
    const { data, error } = await createClient().functions.invoke("notify", { body: { test: true } });
    setMsg(error ? "Test failed — try again in a moment." : data?.sent ? "Test notification sent 🎉" : "No devices registered yet.");
  };

  const togglePref = async (k: "bills" | "matches" | "weather") => {
    const next = { ...prefs, [k]: !prefs[k] };
    setPrefs(next);
    await createClient().from("notification_prefs").upsert({ user_id: user.id, ...next, weather_region: myRegion() });
  };

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <span className="icon-tile" style={{ "--tile": "var(--c-shop)" } as React.CSSProperties}>
          {status === "on" ? <BellRing size={18} /> : <Bell size={18} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Notifications</p>
          <p className="text-xs text-muted">
            {status === "loading"
              ? "Checking…"
              : status === "on"
                ? "On for this device"
                : status === "off"
                  ? "Bill reminders and kick-off alerts"
                  : status === "needs-install"
                    ? "Add MyLife to your Home Screen first"
                    : status === "denied"
                      ? "Blocked in your phone's settings"
                      : status === "not-configured"
                        ? "Being set up — not ready yet"
                        : "Not supported in this browser"}
          </p>
        </div>
        {status === "off" && (
          <button className="btn btn-primary" onClick={enable} disabled={busy}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Turn on
          </button>
        )}
        {status === "on" && (
          <button className="btn btn-ghost" onClick={disable} disabled={busy} aria-label="Turn off notifications">
            <BellOff size={16} />
          </button>
        )}
      </div>

      {status === "needs-install" && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs text-muted">
          <Share size={14} className="mt-0.5 shrink-0" /> On iPhone, notifications only work from the Home Screen app: open this site in Safari, tap Share → Add to
          Home Screen, then open MyLife from your Home Screen and come back here.
        </p>
      )}
      {status === "denied" && (
        <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-muted">Go to iPhone Settings → Notifications → MyLife and allow notifications, then reopen the app.</p>
      )}

      {status === "on" && (
        <div className="mt-4 space-y-1 border-t border-line pt-3">
          {(
            [
              ["bills", "Bill reminders", "Day before, on the day, and if overdue", Receipt],
              ["matches", "Kick-off alerts", "An hour before Aston Villa & England", Trophy],
              ["weather", "Weather warnings", "Met Office warnings for your area", CloudLightning],
            ] as const
          ).map(([k, label, sub, Icon]) => (
            <label key={k} className="flex min-h-12 cursor-pointer items-center gap-3">
              <Icon size={16} className="text-faint" />
              <span className="flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted">{sub}</span>
              </span>
              <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={prefs[k]} onChange={() => togglePref(k)} />
            </label>
          ))}
          <button onClick={sendTest} className="mt-2 text-xs font-semibold text-accent">
            Send a test notification
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
