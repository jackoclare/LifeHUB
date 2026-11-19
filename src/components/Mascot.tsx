"use client";

import type { Mood } from "@/lib/vibe";

/**
 * LifeHub's mascot — a simple glowing stick man drawn in bright line work on black.
 * His pose and props follow the day: arms up when your team wins, umbrella when rain's due,
 * a scarf when it's freezing, shades in the sun, sleepy after 11pm, a tear after a loss.
 */
const LINE = "#ffffff";
const GLOW = "#22d3ee";
const ACCENT = "#a3ff12";
const WARM = "#ffb020";

/** 1–26 December */
export function isXmas(d = new Date()) {
  if (typeof window !== "undefined") {
    try {
      const q = new URLSearchParams(window.location.search).get("xmas");
      if (q === "demo") sessionStorage.setItem("mlh.xmas", "1");
      if (q === "off") sessionStorage.removeItem("mlh.xmas");
      if (sessionStorage.getItem("mlh.xmas")) return true;
    } catch {}
  }
  return d.getMonth() === 11 && d.getDate() <= 26;
}

export function Mascot({ mood = "happy", size = 56, className = "", title }: { mood?: Mood; size?: number; className?: string; title?: string }) {
  const sad = mood === "gutted";
  const closed = mood === "sleepy";
  const party = mood === "party";

  // Arms: [left, right] as paths from the shoulder at (50,46)
  const arms =
    party
      ? ["M50 46 L34 26", "M50 46 L66 26"]
      : mood === "rain"
        ? ["M50 46 L36 58", "M50 46 L64 40 L70 34"]
        : mood === "cold"
          ? ["M50 46 L40 54 L54 56", "M50 46 L60 54 L46 57"]
          : sad
            ? ["M50 46 L40 64", "M50 46 L60 64"]
            : mood === "sleepy"
              ? ["M50 46 L38 60", "M50 46 L62 60"]
              : ["M50 46 L36 58", "M50 46 L66 34 L72 26"]; // happy / sunny: a wave

  const legs = party ? ["M50 68 L38 88", "M50 68 L62 88"] : ["M50 68 L41 92", "M50 68 L59 92"];

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot ${mood === "cold" ? "mascot-shiver" : "mascot-bob"} ${className}`}
      role="img"
      aria-label={title ?? `LifeHub stick man, looking ${mood}`}
    >
      <defs>
        <filter id="stickGlow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* umbrella */}
      {mood === "rain" && (
        <g className="mascot-prop" filter="url(#stickGlow)">
          <path d="M44 22 Q70 -4 96 22 Z" fill="none" stroke={GLOW} strokeWidth="3" strokeLinejoin="round" />
          <path d="M70 9 V34" stroke={GLOW} strokeWidth="2.5" strokeLinecap="round" />
          <g stroke={GLOW} strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
            <path d="M14 30 l-3 7" />
            <path d="M24 18 l-3 7" />
            <path d="M8 50 l-3 7" />
          </g>
        </g>
      )}

      <g
        filter="url(#stickGlow)"
        stroke={LINE}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        transform={sad ? "rotate(4 50 60)" : undefined}
      >
        {/* head */}
        <circle cx="50" cy="24" r="13" />
        {/* body */}
        <path d="M50 37 V68" />
        {arms.map((d) => (
          <path key={d} d={d} />
        ))}
        {legs.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>

      {/* Santa hat in December */}
      {isXmas() && mood !== "rain" && (
        <g className="xmas-hat">
          <path d="M37 15 Q48 -8 68 6 L63 15 Z" fill="#ff2d2d" style={{ filter: "drop-shadow(0 0 4px #ff2d2d)" }} />
          <rect x="35" y="12.5" width="30" height="5.5" rx="2.75" fill="#fff" />
          <circle cx="68.5" cy="6" r="3.6" fill="#fff" />
        </g>
      )}

      {/* face */}
      <g stroke={LINE} strokeWidth="2.4" strokeLinecap="round" fill="none">
        {mood === "sunny" ? (
          <g>
            <rect x="40" y="18" width="8.5" height="6" rx="2" fill={WARM} stroke="none" />
            <rect x="51.5" y="18" width="8.5" height="6" rx="2" fill={WARM} stroke="none" />
            <path d="M48.5 20.5 h3" strokeWidth="1.6" />
          </g>
        ) : closed || party ? (
          <>
            <path d={party ? "M42 22 q2.5 -3 5 0" : "M42 21 q2.5 2.5 5 0"} />
            <path d={party ? "M53 22 q2.5 -3 5 0" : "M53 21 q2.5 2.5 5 0"} />
          </>
        ) : (
          <g className="mascot-eyes" fill={LINE} stroke="none">
            <circle cx="45" cy="21" r="2" />
            <circle cx="55" cy="21" r="2" />
          </g>
        )}
        {/* mouth */}
        {sad ? (
          <path d="M45 31 q5 -4 10 0" />
        ) : mood === "rain" || mood === "cold" ? (
          <path d="M45.5 29.5 h9" />
        ) : closed ? (
          <circle cx="50" cy="29.5" r="1.6" />
        ) : (
          <path d={party ? "M43.5 27 q6.5 7 13 0" : "M44.5 27.5 q5.5 5 11 0"} />
        )}
      </g>

      {/* props */}
      {party && (
        <g className="mascot-prop">
          <circle cx="16" cy="16" r="2.5" fill={ACCENT} className="mascot-confetti" />
          <rect x="82" y="10" width="4" height="4" fill={GLOW} className="mascot-confetti" />
          <circle cx="88" cy="40" r="2" fill={WARM} className="mascot-confetti" />
          <rect x="8" y="40" width="3.5" height="3.5" fill="#ff3df2" className="mascot-confetti" />
        </g>
      )}
      {mood === "cold" && (
        <g filter="url(#stickGlow)">
          <path d="M40 38 Q50 44 60 38" stroke={WARM} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <path d="M57 40 L60 52" stroke={WARM} strokeWidth="4" strokeLinecap="round" />
        </g>
      )}
      {mood === "sunny" && (
        <g stroke={WARM} strokeWidth="2.2" strokeLinecap="round" className="mascot-prop">
          <circle cx="14" cy="14" r="5" fill="none" />
          <path d="M14 3 v3 M14 22 v3 M3 14 h3 M22 14 h3" />
        </g>
      )}
      {sad && <path d="M57 25 q2.5 5 0 7.5 q-2.5 -2.5 0 -7.5Z" fill={GLOW} className="mascot-tear" />}
      {closed && (
        <g fill={GLOW} fontFamily="inherit" fontWeight="700" className="mascot-zzz">
          <text x="68" y="16" fontSize="12">z</text>
          <text x="78" y="8" fontSize="9">z</text>
        </g>
      )}
    </svg>
  );
}
