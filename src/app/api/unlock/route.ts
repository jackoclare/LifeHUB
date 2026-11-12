import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

/**
 * PIN unlock.
 * 1. Checks the PIN in the database (server-only function, with lock-out).
 * 2. If it matches, creates a normal Supabase session for that person
 *    (a one-time sign-in link generated and used entirely on the server — no email is sent).
 * 3. The session is stored in cookies, so the app is signed in from then on.
 *
 * Needs SUPABASE_SECRET_KEY in Vercel's environment variables (never sent to the browser).
 */
export async function POST(req: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json({ ok: false, reason: "not_configured" }, { status: 503 });
  }

  let pin = "";
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "");
  } catch {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  if (!/^\d{4,8}$/.test(pin)) {
    return NextResponse.json({ ok: false, reason: "wrong", tries_left: null }, { status: 400 });
  }

  const admin = createAdminClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: check, error: checkError } = await admin.rpc("check_app_pin", { p_pin: pin });
  if (checkError) {
    console.error("[unlock] check_app_pin failed", checkError.message);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }
  const result = check as { ok: boolean; email?: string; reason?: string; tries_left?: number; locked_until?: string };
  if (!result.ok || !result.email) {
    return NextResponse.json({ ok: false, reason: result.reason ?? "wrong", tries_left: result.tries_left, locked_until: result.locked_until }, { status: 401 });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: result.email });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("[unlock] generateLink failed", linkError?.message);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }

  const supabase = await createServerClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: tokenHash });
  if (verifyError) {
    console.error("[unlock] verifyOtp failed", verifyError.message);
    return NextResponse.json({ ok: false, reason: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
