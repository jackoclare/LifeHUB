import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Shows which server settings are present (never their values). */
export function GET() {
  const check = (name: string) => {
    const v = process.env[name] ?? "";
    return { set: v.length > 0, length: v.length };
  };
  return NextResponse.json(
    {
      SUPABASE_SECRET_KEY: check("SUPABASE_SECRET_KEY"),
      API_FOOTBALL_KEY: check("API_FOOTBALL_KEY"),
      GEOAPIFY_KEY: check("GEOAPIFY_KEY"),
      THESPORTSDB_KEY: check("THESPORTSDB_KEY"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
