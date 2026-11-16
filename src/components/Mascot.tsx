"use client";

import type { Mood } from "@/lib/vibe";

/**
 * John — LifeHub's mascot. An original cartoon: a stocky, bearded little midfielder in a
 * claret shirt with sky-blue collar and sleeves (no crest, not any real player).
 * His face and props follow the day: celebrating when your team wins, umbrella when rain's due,
 * a claret-and-blue scarf when it's freezing, shades in the sun, sleepy after 11pm, a tear after a loss.
 */
const SKIN = "#f2c6a0";
const SKIN_SHADE = "#e3ab84";
const HAIR = "#3a2a20";
const BEARD = "#4a3427";
const CLARET = "#7b1e3e";
const CLARET_DARK = "#5e1630";
const SKY = "#8fc3ea";
const INK = "#2a1a14";

export function Mascot({ mood = "happy", size = 56, className = "", title }: { mood?: Mood; size?: number; className?: string; title?: string }) {
  const closed = mood === "sleepy";
  const sad = mood === "gutted";
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`mascot ${mood === "cold" ? "mascot-shiver" : "mascot-bob"} ${className}`}
      role="img"
      aria-label={title ?? `John, the LifeHub mascot, looking ${mood}`}
    >
      {/* umbrella (behind) */}
      {mood === "rain" && (
        <g className="mascot-prop">
          <path d="M8 26 Q50 -14 92 26 Q82 19 71 26 Q60 19 50 26 Q40 19 29 26 Q18 19 8 26Z" fill={CLARET} />
          <path d="M29 26 Q40 19 50 26 Q40 4 29 26Z M71 26 Q60 19 50 26 Q60 4 71 26Z" fill={SKY} opacity="0.9" />
          <path d="M50 26 V8" stroke={CLARET_DARK} strokeWidth="2" />
          <path d="M90 26 V60 q0 6 -6 6" stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </g>
      )}

      {/* shirt: stocky shoulders, sky-blue sleeves and collar */}
      <path d="M8 100 Q8 76 30 71 L70 71 Q92 76 92 100Z" fill={CLARET} />
      <path d="M8 100 Q8 81 22 74.5 Q25 84 21 94 Q14 95 10 100Z" fill={SKY} />
      <path d="M92 100 Q92 81 78 74.5 Q75 84 79 94 Q86 95 90 100Z" fill={SKY} />
      <path d="M40 71 L50 82 L60 71Z" fill={SKY} />
      <path d="M43 71 L50 79 L57 71Z" fill={SKIN_SHADE} />
      {/* shirt number vibe: a simple stripe, no badge */}
      <path d="M50 84 V100" stroke={CLARET_DARK} strokeWidth="1.5" opacity="0.6" />

      {/* neck + head */}
      <rect x="42" y="62" width="16" height="12" rx="4" fill={SKIN_SHADE} />
      <circle cx="27" cy="47" r="5" fill={SKIN} />
      <circle cx="73" cy="47" r="5" fill={SKIN} />
      <ellipse cx="50" cy="45" rx="23" ry="24" fill={SKIN} />

      {/* hair: short, swept-up quiff */}
      <path d="M27 42 Q26 20 44 17 Q48 10 58 15 Q75 18 73 42 Q70 30 60 27 Q52 31 44 27 Q33 29 27 42Z" fill={HAIR} />

      {/* beard: full, along the jaw */}
      <path
        d="M27 46 Q27 66 39 71 Q50 76 61 71 Q73 66 73 46 Q70 56 63 58 Q57 54 50 55 Q43 54 37 58 Q30 56 27 46Z"
        fill={BEARD}
      />
      {/* moustache */}
      <path d="M40 57 Q50 52 60 57 Q55 59 50 57.5 Q45 59 40 57Z" fill={BEARD} />

      {/* eyebrows */}
      <g stroke={HAIR} strokeWidth="3" strokeLinecap="round">
        {sad ? (
          <>
            <path d="M35 37 L43 35" />
            <path d="M57 35 L65 37" />
          </>
        ) : mood === "party" ? (
          <>
            <path d="M35 33 Q39 30 43 33" fill="none" />
            <path d="M57 33 Q61 30 65 33" fill="none" />
          </>
        ) : (
          <>
            <path d="M35 36 L43 35" />
            <path d="M57 35 L65 36" />
          </>
        )}
      </g>

      {/* eyes */}
      {closed ? (
        <g stroke={INK} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M35 44 q4 3 8 0" />
          <path d="M57 44 q4 3 8 0" />
        </g>
      ) : mood === "sunny" ? (
        <g>
          <rect x="31" y="38" width="16" height="10" rx="4" fill="#111" />
          <rect x="53" y="38" width="16" height="10" rx="4" fill="#111" />
          <path d="M47 41 h6" stroke="#111" strokeWidth="2.5" />
          <path d="M34 41 l4 0" stroke="#fff" strokeWidth="1.6" opacity="0.6" strokeLinecap="round" />
        </g>
      ) : mood === "party" ? (
        <g stroke={INK} strokeWidth="2.8" strokeLinecap="round" fill="none">
          <path d="M35 44 q4 -4 8 0" />
          <path d="M57 44 q4 -4 8 0" />
        </g>
      ) : (
        <g className="mascot-eyes">
          <ellipse cx="39" cy="43" rx="3.4" ry="4" fill={INK} />
          <ellipse cx="61" cy="43" rx="3.4" ry="4" fill={INK} />
          <circle cx="40.2" cy="41.6" r="1.2" fill="#fff" />
          <circle cx="62.2" cy="41.6" r="1.2" fill="#fff" />
        </g>
      )}

      {/* nose */}
      <path d="M50 45 Q47 51 50 52 Q53 51 50 45" fill={SKIN_SHADE} />

      {/* mouth (inside the beard) */}
      {mood === "party" ? (
        <g>
          <path d="M41 60 Q50 72 59 60 Z" fill="#5a1a1a" />
          <path d="M42.5 60.5 H57.5 L56 63 H44Z" fill="#fff" />
        </g>
      ) : sad ? (
        <path d="M43 65 Q50 59 57 65" stroke={INK} strokeWidth="2.5" fill="none" strokeLinecap="round" />
      ) : mood === "rain" || mood === "cold" ? (
        <path d="M44 62 h12" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
      ) : mood === "sleepy" ? (
        <ellipse cx="50" cy="62" rx="3" ry="2.4" fill="#5a1a1a" />
      ) : (
        <g>
          <path d="M42 59.5 Q50 69 58 59.5 Z" fill="#5a1a1a" />
          <path d="M43.5 60 H56.5 L55.5 62.2 H44.5Z" fill="#fff" />
        </g>
      )}

      {/* props */}
      {mood === "party" && (
        <g className="mascot-prop">
          <circle cx="12" cy="18" r="2.5" fill="#ffd34d" className="mascot-confetti" />
          <rect x="84" y="12" width="4" height="4" fill={SKY} className="mascot-confetti" />
          <circle cx="90" cy="36" r="2" fill={CLARET} className="mascot-confetti" />
          <rect x="6" y="38" width="3.5" height="3.5" fill="#7cf29a" className="mascot-confetti" />
          <path d="M80 22 l3 -6 l3 6 l-6 -3.5 h6Z" fill="#ffd34d" className="mascot-confetti" />
        </g>
      )}
      {mood === "cold" && (
        <g>
          {/* claret-and-blue scarf */}
          <path d="M24 71 Q50 85 76 71 L78 80 Q50 94 22 80 Z" fill={SKY} />
          <path d="M24 71 Q37 79 42 80 L41 88.5 Q32 86 22 80Z M58 80 Q63 79 76 71 L78 80 Q68 86 59 88.5Z" fill={CLARET} />
          <rect x="62" y="82" width="10" height="18" rx="2" fill={CLARET} />
          <rect x="62" y="88" width="10" height="5" fill={SKY} />
        </g>
      )}
      {sad && <path d="M66 47 q3 6 0 9 q-3 -3 0 -9Z" fill="#7fd0ff" className="mascot-tear" />}
      {mood === "sleepy" && (
        <g fill="#c9b8ff" fontFamily="inherit" fontWeight="700" className="mascot-zzz">
          <text x="76" y="22" fontSize="12">z</text>
          <text x="85" y="12" fontSize="9">z</text>
        </g>
      )}
    </svg>
  );
}
