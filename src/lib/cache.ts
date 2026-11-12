"use client";

/** Tiny on-device cache so pages show the last data instantly, then refresh quietly. */
export function readCache<T>(key: string, maxAgeMs = 24 * 3600e3): T | null {
  try {
    const raw = localStorage.getItem(`mlh.c.${key}`);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw) as { t: number; v: T };
    return Date.now() - t < maxAgeMs ? v : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, v: T) {
  try {
    localStorage.setItem(`mlh.c.${key}`, JSON.stringify({ t: Date.now(), v }));
  } catch {
    /* storage full or blocked — fine */
  }
}
