// PIN unlock, run inside Supabase so it can use the built-in service-role key (no key needs copying into Vercel).
// 1. check_app_pin() verifies the PIN (bcrypt, with lock-out after repeated wrong tries)
// 2. on success, a one-time sign-in token is generated (no email is sent) and returned to the browser,
//    which exchanges it for a normal session with supabase.auth.verifyOtp().
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, reason: "bad_request" }, 405);

  let pin = "";
  try {
    pin = String((await req.json())?.pin ?? "");
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  if (!/^\d{4,8}$/.test(pin)) return json({ ok: false, reason: "wrong", tries_left: null }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: check, error } = await admin.rpc("check_app_pin", { p_pin: pin });
  if (error) {
    console.error("check_app_pin failed", error.message);
    return json({ ok: false, reason: "server_error" }, 500);
  }
  const r = check as { ok: boolean; email?: string; reason?: string; tries_left?: number; locked_until?: string };
  if (!r.ok || !r.email) return json({ ok: false, reason: r.reason ?? "wrong", tries_left: r.tries_left, locked_until: r.locked_until }, 401);

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: r.email });
  const token_hash = link?.properties?.hashed_token;
  if (linkError || !token_hash) {
    console.error("generateLink failed", linkError?.message);
    return json({ ok: false, reason: "server_error" }, 500);
  }
  return json({ ok: true, token_hash });
});
