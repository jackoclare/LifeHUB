import { NextResponse } from "next/server";

/** UK bank holidays (England & Wales) from GOV.UK's official feed. Cached for a day. */
export const revalidate = 86400;

export async function GET() {
  try {
    const r = await fetch("https://www.gov.uk/bank-holidays.json", { next: { revalidate: 86400 } });
    const j = await r.json();
    const events = (j?.["england-and-wales"]?.events ?? []) as { title: string; date: string; notes: string }[];
    return NextResponse.json({ holidays: events.map((e) => ({ title: e.title, date: e.date, notes: e.notes || null })) });
  } catch {
    return NextResponse.json({ holidays: [] }, { status: 502 });
  }
}
