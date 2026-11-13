"use client";

import type { Mood } from "@/lib/vibe";

/**
 * Hubby — LifeHub's little mascot. A glossy blob whose face and props follow the day:
 * party hat when your team wins, umbrella when rain's due, scarf when it's freezing,
 * shades in the sun, sleepy after 11pm, a tear after a loss.
 */
export function Mascot({ mood = "happy", size = 56, className = "", title }: { mood?: Mood; size?: number; className?: string; title?: string }) {
  const id = `m${mood}`;
  const closed = mood === "sleepy";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot ${mood === "cold" ? "mascot-shiver" : "mascot-bob"} ${className}`}
      role="img"
      aria-label={title ?? `Hubby the LifeHub mascot looking ${mood}`}
    >
      <defs>
        <radialGradient id={`${id}-body`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#8fd3ff" />
          <stop offset="45%" stopColor="#4f7bff" />
          <stop offset="100%" stopColor="#7a3cff" />
        </radialGradient>
        <linearGradient id={`${id}-hat`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd34d" />
          <stop offset="100%" stopColor="#ff4f81" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="50" cy="94" rx="24" ry="4" fill="#000" opacity="0.15" className="mascot-shadow" />

      {/* umbrella (behind) */}
      {mood === "rain" && (
        <g className="mascot-prop">
          <path d="M14 30 Q50 -6 86 30 Q77 24 68 30 Q59 24 50 30 Q41 24 32 30 Q23 24 14 30Z" fill="#ff4f81" />
          <path d="M50 30 V12" stroke="#ff4f81" strokeWidth="2" />
          <path d="M84 30 V58 q0 6 -6 6" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* body */}
      <path
        d="M50 22 C72 22 84 38 84 58 C84 78 70 90 50 90 C30 90 16 78 16 58 C16 38 28 22 50 22Z"
        fill={`url(#${id}-body)`}
      />
      {/* gloss */}
      <ellipse cx="36" cy="36" rx="10" ry="6" fill="#fff" opacity="0.35" transform="rotate(-25 36 36)" />

      {/* cheeks */}
      <circle cx="31" cy="64" r="5" fill={mood === "cold" ? "#9fd8ff" : "#ff8fb1"} opacity="0.55" />
      <circle cx="69" cy="64" r="5" fill={mood === "cold" ? "#9fd8ff" : "#ff8fb1"} opacity="0.55" />

      {/* eyes */}
      {closed ? (
        <g stroke="#1b1442" strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M33 54 q5 4 10 0" />
          <path d="M57 54 q5 4 10 0" />
        </g>
      ) : mood === "sunny" ? (
        <g>
          <rect x="27" y="47" width="20" height="12" rx="5" fill="#1b1442" />
          <rect x="53" y="47" width="20" height="12" rx="5" fill="#1b1442" />
          <path d="M47 51 h6" stroke="#1b1442" strokeWidth="3" />
          <path d="M31 50 l5 0" stroke="#fff" strokeWidth="2" opacity="0.6" strokeLinecap="round" />
        </g>
      ) : (
        <g className="mascot-eyes">
          <ellipse cx="38" cy="53" rx="5" ry={mood === "party" ? 4 : 6} fill="#1b1442" />
          <ellipse cx="62" cy="53" rx="5" ry={mood === "party" ? 4 : 6} fill="#1b1442" />
          <circle cx="39.8" cy="51" r="1.8" fill="#fff" />
          <circle cx="63.8" cy="51" r="1.8" fill="#fff" />
        </g>
      )}

      {/* mouth */}
      {mood === "party" ? (
        <path d="M38 66 Q50 82 62 66 Z" fill="#1b1442" />
      ) : mood === "gutted" ? (
        <path d="M40 73 Q50 65 60 73" stroke="#1b1442" strokeWidth="3" fill="none" strokeLinecap="round" />
      ) : mood === "rain" || mood === "cold" ? (
        <path d="M43 70 h14" stroke="#1b1442" strokeWidth="3" strokeLinecap="round" />
      ) : mood === "sleepy" ? (
        <ellipse cx="50" cy="70" rx="4" ry="3" fill="#1b1442" />
      ) : (
        <path d="M40 67 Q50 77 60 67" stroke="#1b1442" strokeWidth="3" fill="none" strokeLinecap="round" />
      )}

      {/* props */}
      {mood === "party" && (
        <g className="mascot-prop">
          <path d="M50 4 L62 26 H38 Z" fill={`url(#${id}-hat)`} />
          <circle cx="50" cy="4" r="3.5" fill="#ffd34d" />
          <circle cx="16" cy="20" r="2.5" fill="#ffd34d" className="mascot-confetti" />
          <rect x="82" y="14" width="4" height="4" fill="#4fd1ff" className="mascot-confetti" />
          <circle cx="88" cy="40" r="2" fill="#ff4f81" className="mascot-confetti" />
          <rect x="8" y="42" width="3.5" height="3.5" fill="#7cf29a" className="mascot-confetti" />
        </g>
      )}
      {mood === "cold" && (
        <g>
          <path d="M20 76 Q50 90 80 76 L80 84 Q50 98 20 84 Z" fill="#ff4f5e" />
          <rect x="62" y="82" width="9" height="16" rx="3" fill="#ff4f5e" />
          <path d="M64 92 h5 M64 95 h5" stroke="#fff" strokeWidth="1.2" opacity="0.7" />
        </g>
      )}
      {mood === "gutted" && <path d="M66 60 q3 6 0 9 q-3 -3 0 -9Z" fill="#7fd0ff" className="mascot-tear" />}
      {mood === "sleepy" && (
        <g fill="#c9b8ff" fontFamily="inherit" fontWeight="700" className="mascot-zzz">
          <text x="76" y="26" fontSize="12">z</text>
          <text x="84" y="16" fontSize="9">z</text>
        </g>
      )}
    </svg>
  );
}
