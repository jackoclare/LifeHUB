"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in the browser.
 * Uses only the publishable key — safe to ship, because every table is
 * protected by Row Level Security (set up in Phase 2).
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).");
  }
  return createBrowserClient(url, key);
}
