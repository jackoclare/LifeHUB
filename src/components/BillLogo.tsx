"use client";

import { Building2, Car, Droplets, Flame, HeartPulse, Home, Landmark, ReceiptPoundSterling, Repeat, Shield, Wifi } from "lucide-react";
import { useState } from "react";

const categoryIcon: Record<string, typeof Home> = {
  Housing: Home,
  Utilities: Flame,
  "Council tax": Building2,
  "Phone & internet": Wifi,
  Insurance: Shield,
  "Car & travel": Car,
  Subscriptions: Repeat,
  "Credit & loans": Landmark,
  "Health & fitness": HeartPulse,
  Water: Droplets,
};

/** Company logo from the bill's website (via Google's favicon service), or a category icon. */
export function BillLogo({ website, category, tone, size = 36 }: { website?: string | null; category: string; tone: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const Icon = categoryIcon[category] ?? ReceiptPoundSterling;

  if (website && !failed) {
    return (
      <span className="grid shrink-0 place-items-center overflow-hidden rounded-[0.8rem] bg-white p-1.5 shadow-sm ring-1 ring-black/5" style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(website)}&sz=128`}
          alt=""
          className="size-full object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // Google returns a tiny generic globe when it has no logo — fall back to our icon instead
            if ((e.currentTarget as HTMLImageElement).naturalWidth <= 16) setFailed(true);
          }}
        />
      </span>
    );
  }
  return (
    <span className="icon-tile shrink-0" style={{ "--tile": tone, width: size, height: size } as React.CSSProperties}>
      <Icon size={Math.round(size / 2)} />
    </span>
  );
}
