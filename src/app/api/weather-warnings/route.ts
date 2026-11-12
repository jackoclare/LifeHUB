import { NextResponse } from "next/server";

/** Met Office severe-weather warnings (public RSS, Crown copyright). Cached 15 minutes. */
export const revalidate = 900;

const REGIONS: Record<string, string> = {
  wm: "West Midlands", em: "East Midlands", ee: "East of England", se: "London & South East", sw: "South West England",
  nw: "North West England", ne: "North East England", yh: "Yorkshire & Humber", wl: "Wales", sc: "Scotland", ni: "Northern Ireland",
};

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").trim() ?? null;

export async function GET(req: Request) {
  const region = new URL(req.url).searchParams.get("region") ?? "wm";
  const code = REGIONS[region] ? region : "wm";
  try {
    const r = await fetch(`https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/${code}`, { next: { revalidate: 900 } });
    const xml = await r.text();
    const warnings = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, it]) => {
      const title = tag(it, "title") ?? "Weather warning";
      const level = /\bred\b/i.test(title) ? "red" : /\bamber\b/i.test(title) ? "amber" : "yellow";
      return { title, level, description: (tag(it, "description") ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(), link: tag(it, "link") ?? "https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings" };
    });
    return NextResponse.json({ region: REGIONS[code], warnings });
  } catch {
    return NextResponse.json({ region: REGIONS[code], warnings: [], error: "Couldn't check warnings" }, { status: 502 });
  }
}
