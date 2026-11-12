import { NextResponse } from "next/server";

/**
 * Deals from HotUKDeals' public RSS feeds (community-posted and voted UK deals; each links back to the deal page).
 * Cached for 15 minutes.
 */
export const revalidate = 900;

const FEEDS = {
  hot: "https://www.hotukdeals.com/rss/hot",
  new: "https://www.hotukdeals.com/rss/new",
} as const;

export type Deal = {
  id: string;
  title: string;
  link: string;
  merchant: string | null;
  price: string | null;
  heat: number | null;
  category: string | null;
  image: string | null;
  summary: string;
  published: string | null;
};

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&pound;/g, "£");
const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decode(m[1]).trim() : null;
};
const attr = (xml: string, name: string, a: string) => xml.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]*)"`))?.[1] ?? null;

function parse(xml: string): Deal[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
    const rawTitle = tag(it, "title") ?? "";
    const heat = rawTitle.match(/^(-?\d+)°\s*-\s*/);
    const link = tag(it, "link") ?? "";
    const summary = decode(tag(it, "description") ?? "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return {
      id: link.match(/(\d+)(?:[/?#]|$)/)?.[1] ?? link,
      title: heat ? rawTitle.slice(heat[0].length) : rawTitle,
      link,
      merchant: attr(it, "pepper:merchant", "name"),
      price: attr(it, "pepper:merchant", "price"),
      heat: heat ? Number(heat[1]) : null,
      category: tag(it, "category"),
      image: attr(it, "media:content", "url")?.replace("/re/150x150/", "/re/300x300/") ?? null,
      summary: summary.replace(/^£[\d.,]+ - [^ ]+ /, "").slice(0, 220),
      published: tag(it, "pubDate") ? new Date(tag(it, "pubDate")!).toISOString() : null,
    };
  });
}

export async function GET(req: Request) {
  const feed = new URL(req.url).searchParams.get("feed") === "new" ? "new" : "hot";
  try {
    const r = await fetch(FEEDS[feed], { headers: { "User-Agent": "MyLifeHub/1.0 (personal dashboard)" }, next: { revalidate: 900 } });
    if (!r.ok) throw new Error(String(r.status));
    return NextResponse.json({ deals: parse(await r.text()), fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ deals: [], error: "Couldn't load deals right now" }, { status: 502 });
  }
}
