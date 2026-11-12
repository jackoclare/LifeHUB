import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/** Shows which server settings are present and working (never their values). */
export async function GET() {
  const check = (name: string) => {
    const v = process.env[name] ?? "";
    return { set: v.length > 0, length: v.length };
  };
  let supabaseSecretWorks = false;
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (url && secret) {
      const admin = createClient(url, secret, { auth: { persistSession: false } });
      const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
      supabaseSecretWorks = !error;
    }
  } catch {
    supabaseSecretWorks = false;
  }
  return NextResponse.json(
    {
      SUPABASE_SECRET_KEY: { ...check("SUPABASE_SECRET_KEY"), works: supabaseSecretWorks },
      API_FOOTBALL_KEY: check("API_FOOTBALL_KEY"),
      GEOAPIFY_KEY: check("GEOAPIFY_KEY"),
      THESPORTSDB_KEY: check("THESPORTSDB_KEY"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
