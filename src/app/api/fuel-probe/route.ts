import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Diagnostic: can this server reach the Fuel Finder API at all? (no credentials sent)
export async function GET() {
  try {
    const r = await fetch("https://www.fuel-finder.service.gov.uk/api/v1/pfs?batch-number=1", { headers: { accept: "application/json" }, cache: "no-store" });
    const body = (await r.text()).slice(0, 160);
    return NextResponse.json({ status: r.status, cache: r.headers.get("x-cache"), body, region: process.env.VERCEL_REGION ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) });
  }
}
