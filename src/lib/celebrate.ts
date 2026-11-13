"use client";

/**
 * Little celebrations: a confetti burst from wherever you tapped, plus a tiny buzz on phones that support it.
 * Pure DOM + Web Animations (no library); skipped if the person has "reduce motion" on.
 */
const COLOURS = ["#ffd34d", "#ff4f81", "#4fd1ff", "#7cf29a", "#a78bff", "#ff9f43"];

export function celebrate(from?: { x: number; y: number } | Element | null, pieces = 26) {
  if (typeof window === "undefined") return;
  try {
    navigator.vibrate?.(18);
  } catch {}
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (from instanceof Element) {
    const r = from.getBoundingClientRect();
    x = r.left + r.width / 2;
    y = r.top + r.height / 2;
  } else if (from) {
    x = from.x;
    y = from.y;
  }
  for (let i = 0; i < pieces; i++) {
    const el = document.createElement("span");
    el.className = "confetti-bit";
    const size = 5 + Math.random() * 6;
    el.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size * (Math.random() > 0.5 ? 1 : 0.45)}px;background:${COLOURS[i % COLOURS.length]}`;
    document.body.appendChild(el);
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 110;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 60;
    el.animate(
      [
        { transform: "translate(-50%,-50%) rotate(0deg)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 140}px)) rotate(${Math.random() * 720}deg)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.7,.3,1)" },
    ).onfinish = () => el.remove();
  }
}
