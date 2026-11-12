// LifeHub — TV listings sync (Supabase Edge Function, Deno)
//
// Pulls the free, open XMLTV guide for UK free-to-air channels published by the
// Freeview-EPG project (github.com/dp247/Freeview-EPG, rebuilt from Freeview/Freesat/Sky
// data every 8 hours, for personal use) and keeps the main channels for the next 7 days
// in public.tv_programmes. Run by pg_cron every 6 hours.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE = "https://raw.githubusercontent.com/dp247/Freeview-EPG/master/epg.xml";

// Channels kept (Midlands regional variants for BBC One / ITV1 / Channel 4)
export const CHANNELS = [
  "BBCOneWestMidlands.uk", "BBCTwoHD.uk", "ITV1CentralW.uk", "Channel4Midlands.uk", "5.uk",
  "ITV2.uk", "BBCThreeHD.uk", "BBCFourHD.uk", "ITV3.uk", "ITV4.uk", "SkyMix.uk", "QuestHD.uk",
  "E4.uk", "Film4.uk", "More4.uk", "UAndDave.uk", "UAndDrama.uk", "UAndYesterday.uk", "5USA.uk",
  "5Star.uk", "Challenge.uk", "DMAX.uk", "QuestRed.uk", "SkyArts.uk", "TalkingPicturesTV.uk",
  "Legend.uk", "CBBC.uk", "CBeebies.uk", "BBCNews.uk", "SkyNews.uk", "GBNews.uk",
];

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const unescape = (s: string) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, "&");

// "20261111220000 +0000" → ISO
function xmltvTime(t: string) {
  const m = t.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})?/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${m[7]}:${m[8] ?? "00"}`;
}

Deno.serve(async () => {
  try {
    const res = await fetch(SOURCE);
    if (!res.ok) throw new Error(`Guide download failed (${res.status})`);
    const xml = await res.text();
    const keep = new Set(CHANNELS);
    const now = Date.now();
    const from = now - 6 * 3600e3;
    const to = now + 7 * 86400e3;
    const rows: Record<string, string | null>[] = [];
    for (const [, attrs, body] of xml.matchAll(/<programme ([^>]+)>([\s\S]*?)<\/programme>/g)) {
      const channel = attrs.match(/channel="([^"]+)"/)?.[1];
      if (!channel || !keep.has(channel)) continue;
      const start = xmltvTime(attrs.match(/start="([^"]+)"/)?.[1] ?? "");
      const stop = xmltvTime(attrs.match(/stop="([^"]+)"/)?.[1] ?? "");
      if (!start || !stop) continue;
      const s = Date.parse(start);
      if (Date.parse(stop) < from || s > to) continue;
      const title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1];
      if (!title) continue;
      rows.push({
        channel,
        start_at: start,
        stop_at: stop,
        title: unescape(title.trim()),
        descr: body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)?.[1] ? unescape(body.match(/<desc[^>]*>([\s\S]*?)<\/desc>/)![1].trim()) : null,
        icon: body.match(/<icon src="([^"]+)"/)?.[1] ?? null,
        episode: body.match(/<episode-num system="onscreen">([^<]+)</)?.[1] ?? null,
      });
    }
    // De-duplicate on (channel, start) — the feed occasionally repeats a slot
    const unique = [...new Map(rows.map((r) => [`${r.channel}|${r.start_at}`, r])).values()];
    for (let i = 0; i < unique.length; i += 500) {
      const { error } = await admin.from("tv_programmes").upsert(unique.slice(i, i + 500), { onConflict: "channel,start_at" });
      if (error) throw new Error(error.message);
    }
    await admin.from("tv_programmes").delete().lt("stop_at", new Date(now - 12 * 3600e3).toISOString());
    await admin.from("tv_sync_log").insert({ programmes: unique.length });
    return new Response(JSON.stringify({ ok: true, programmes: unique.length }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    await admin.from("tv_sync_log").insert({ error: (e as Error).message });
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
