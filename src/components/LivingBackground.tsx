"use client";

import { useMemo } from "react";
import { useVibe } from "@/lib/vibe";

/**
 * The sky behind the whole app: follows the time of day (dawn → day → dusk → night)
 * and the real weather where you are (rain streaks, snowflakes, drifting cloud, stars, sun glow).
 * Sits behind everything, can't be tapped, and calms right down if "reduce motion" is on.
 */
export function LivingBackground() {
  const { scene, sky, ready } = useVibe();

  // Fixed, deterministic positions so nothing jumps between renders
  const drops = useMemo(() => Array.from({ length: 46 }, (_, i) => ({ x: (i * 37) % 100, d: 0.55 + ((i * 13) % 10) / 20, delay: ((i * 7) % 20) / 10 })), []);
  const flakes = useMemo(() => Array.from({ length: 34 }, (_, i) => ({ x: (i * 29) % 100, s: 3 + (i % 4), d: 6 + (i % 7), delay: (i % 10) * 0.7 })), []);
  const stars = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ x: (i * 41) % 100, y: (i * 23) % 55, s: 1 + (i % 3), delay: (i % 9) * 0.4 })), []);

  if (!ready) return null;
  const wet = sky === "rain" || sky === "storm";
  return (
    <div aria-hidden className={`living-bg scene-${scene} sky-${sky}`}>
      <div className="living-sky" />
      {(scene === "day" || scene === "dawn") && sky === "clear" && <div className="living-sun" />}
      {scene === "night" && (sky === "clear" || sky === "cloud") && (
        <>
          <div className="living-moon" />
          {stars.map((s, i) => (
            <span key={i} className="living-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.delay}s` }} />
          ))}
        </>
      )}
      {(sky === "cloud" || wet || sky === "fog" || sky === "snow") && (
        <>
          <div className="living-cloud c1" />
          <div className="living-cloud c2" />
          <div className="living-cloud c3" />
        </>
      )}
      {wet &&
        drops.map((d, i) => <span key={i} className="living-drop" style={{ left: `${d.x}%`, animationDuration: `${d.d}s`, animationDelay: `${d.delay}s` }} />)}
      {sky === "storm" && <div className="living-flash" />}
      {sky === "snow" &&
        flakes.map((f, i) => (
          <span key={i} className="living-flake" style={{ left: `${f.x}%`, width: f.s, height: f.s, animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` }} />
        ))}
      {sky === "fog" && <div className="living-fog" />}
    </div>
  );
}
