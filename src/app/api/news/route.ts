import { NextResponse } from "next/server";

/**
 * Headlines from BBC RSS feeds (free, public; each item links back to the BBC).
 * Cached on Vercel for 10 minutes so we stay well within fair use.
 */
export const revalidate = 600;

const FEEDS = {
  news: "https://feeds.bbci.co.uk/news/rss.xml",
  uk: "https://feeds.bbci.co.uk/news/uk/rss.xml",
  football: "https://feeds.bbci.co.uk/sport/football/rss.xml",
  sport: "https://feeds.bbci.co.uk/sport/rss.xml",
  villa: "https://feeds.bbci.co.uk/sport/football/teams/aston-villa/rss.xml",
} as const;

export type Headline = {
  title: string;
  link: string;
  summary: string;
  published: string | null;
  image: string | null;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();

const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]) : "";
};

function parse(xml: string): Headline[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((it) => {
      const img = it.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? null;
      const pub = tag(it, "pubDate");
      const link = tag(it, "link").replace(/\?at_medium=.*$/, "");
      return {
        title: tag(it, "title"),
        link,
        summary: tag(it, "description"),
        published: pub ? new Date(pub).toISOString() : null,
        // ask the BBC image service for a larger version of the thumbnail
        image: img ? img.replace(/\/ace\/standard\/\d+\//, "/ace/standard/480/") : null,
      };
    })
    .filter((h) => h.title && /^https:\/\/(www\.)?bbc\.(co\.uk|com)\//.test(h.link));
}

async function load(url: string) {
  const res = await fetch(url, { next: { revalidate: 600 }, headers: { "User-Agent": "MyLifeHub/1.0 (personal dashboard)" } });
  if (!res.ok) throw new Error(`${res.status}`);
  return parse(await res.text());
}

export async function GET(req: Request) {
  const feed = (new URL(req.url).searchParams.get("feed") ?? "news") as keyof typeof FEEDS;
  const url = FEEDS[feed] ?? FEEDS.news;
  try {
    const items = await load(url);
    return NextResponse.json(
      { source: "BBC", feed, fetchedAt: new Date().toISOString(), items: items.slice(0, 30) },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" } },
    );
  } catch (e) {
    return NextResponse.json({ source: "BBC", feed, items: [], error: `Couldn't load headlines (${(e as Error).message})` }, { status: 502 });
  }
}
