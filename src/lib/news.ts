"use client";

import { useEffect, useState } from "react";

export type Headline = { title: string; link: string; summary: string; published: string | null; image: string | null };
export type Feed = "news" | "uk" | "football" | "sport";

/** Loads headlines and refreshes them every 10 minutes while the page is open. */
export function useHeadlines(feed: Feed) {
  const [items, setItems] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/news?feed=${feed}`);
        const data = await res.json();
        if (!alive) return;
        setItems(data.items ?? []);
        setFetchedAt(data.fetchedAt ?? null);
        setError(data.error ?? null);
      } catch {
        if (alive) setError("Couldn't load headlines");
      } finally {
        if (alive) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 10 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [feed]);

  return { items, loading, error, fetchedAt };
}

export function timeAgo(iso: string | null) {
  if (!iso) return "";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
