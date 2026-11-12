"use client";

import { useState } from "react";
import { HeadlineList, LiveBadge, NewsTicker } from "@/components/news/NewsWidgets";
import { Segmented, Spinner } from "@/components/ui";
import { type Feed, timeAgo, useHeadlines } from "@/lib/news";

export function NewsView() {
  const [feed, setFeed] = useState<Feed>("news");
  const { items, loading, error, fetchedAt } = useHeadlines(feed);

  return (
    <div className="space-y-5">
      <NewsTicker feed={feed} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Feed>
          value={feed}
          onChange={setFeed}
          options={[
            { value: "news", label: "Top stories" },
            { value: "uk", label: "UK" },
            { value: "football", label: "Football" },
            { value: "sport", label: "Sport" },
          ]}
        />
        <span className="flex items-center gap-2 text-xs text-faint">
          <LiveBadge /> {fetchedAt ? `Updated ${timeAgo(fetchedAt)}` : ""}
        </span>
      </div>
      {loading ? (
        <Spinner label="Loading headlines" />
      ) : error && !items.length ? (
        <p className="card p-6 text-sm text-muted">{error}</p>
      ) : (
        <HeadlineList key={feed} items={items.slice(0, 19)} />
      )}
      <p className="text-center text-xs text-faint">Headlines from BBC News RSS feeds. Tap a story to read it on the BBC.</p>
    </div>
  );
}
