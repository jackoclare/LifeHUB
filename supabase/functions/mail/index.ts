// LifeHub — Yahoo Mail link (Supabase Edge Function, Deno)
//
// Reads Jack's Yahoo inbox over IMAP using a Yahoo *app password* (a separate password made just for LifeHub,
// which he can revoke at any time in Yahoo → Account security). Read-only: never sends, deletes or moves mail.
//
// Secrets (Supabase → Edge Functions → Secrets, entered by Jack): YAHOO_EMAIL, YAHOO_APP_PASSWORD
//
// GET               → { configured, reachable? }            (?probe=1 checks Yahoo's mail server answers)
// POST {inbox}      → latest messages (signed-in owner only — the LifeHub user whose login email is YAHOO_EMAIL)
// POST {check}      → cron: push-notify new rental-alert / important emails to the owner's phone (deduped)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { ImapFlow } from "npm:imapflow@1.0.171";
import webpush from "npm:web-push@3.6.7";

const EMAIL = (Deno.env.get("YAHOO_EMAIL") ?? "").trim().toLowerCase();
const PASS = (Deno.env.get("YAHOO_APP_PASSWORD") ?? "").replace(/\s+/g, "");
const configured = EMAIL.includes("@") && PASS.length >= 12;
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const VAPID_PUBLIC = (Deno.env.get("VAPID_PUBLIC_KEY") ?? "").replace(/[\s"']/g, "");
const VAPID_PRIVATE = (Deno.env.get("VAPID_PRIVATE_KEY") ?? "").replace(/[\s"']/g, "");
let pushReady = false;
try {
  if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails("mailto:noreply@mylifehub.app", VAPID_PUBLIC, VAPID_PRIVATE);
    pushReady = true;
  }
} catch {
  /* push not set up */
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Who sends what: rental alerts get a 🏠 push; a few other senders are flagged as worth a look
const RENTAL = /rightmove|zoopla|openrent|onthemarket|spareroom|homepoint|wrekin|homesplus/i;
const IMPORTANT = /(dvla|hmrc|gov\.uk|nhs|council|bank|pockit|paypal|e\.on|eon|severn trent|plusnet|insurance|royal mail|evri|dpd|amazon)/i;

type Msg = { uid: number; from: string; fromAddr: string; subject: string; date: string; unread: boolean; kind: "rental" | "important" | "other"; snippet: string };

function classify(fromAddr: string, from: string, subject: string): Msg["kind"] {
  const s = `${fromAddr} ${from} ${subject}`;
  if (RENTAL.test(s)) return "rental";
  if (IMPORTANT.test(s)) return "important";
  return "other";
}

function textSnippet(raw: string) {
  // Very small, safe text preview from the start of the message body (no HTML is ever returned)
  const body = raw.split(/\r?\n\r?\n/).slice(1).join("\n");
  return body
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/--[0-9a-zA-Z_=.-]{10,}[\s\S]*?Content-Transfer-Encoding:[^\n]*\n/g, " ")
    .replace(/Content-Type:[^\n]*\n/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

async function withInbox<T>(fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: "imap.mail.yahoo.com",
    port: 993,
    secure: true,
    auth: { user: EMAIL, pass: PASS },
    logger: false,
    socketTimeout: 25000,
  });
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX", { readOnly: true });
    try {
      return await fn(client);
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

async function latest(count: number, withSnippet: boolean): Promise<{ unread: number; messages: Msg[] }> {
  return await withInbox(async (c) => {
    const status = c.mailbox as { exists: number } | false;
    const total = status ? status.exists : 0;
    if (!total) return { unread: 0, messages: [] };
    const from = Math.max(1, total - count + 1);
    const out: Msg[] = [];
    for await (const m of c.fetch(`${from}:*`, { uid: true, envelope: true, flags: true, ...(withSnippet ? { source: { start: 0, maxLength: 6000 } } : {}) })) {
      const env = m.envelope ?? {};
      const f = env.from?.[0] ?? {};
      const fromAddr = String(f.address ?? "").toLowerCase();
      const fromName = String(f.name || fromAddr || "Unknown");
      const subject = String(env.subject ?? "(no subject)");
      out.push({
        uid: m.uid,
        from: fromName,
        fromAddr,
        subject,
        date: env.date ? new Date(env.date).toISOString() : "",
        unread: !(m.flags ?? new Set()).has("\\Seen"),
        kind: classify(fromAddr, fromName, subject),
        snippet: withSnippet && m.source ? textSnippet(new TextDecoder().decode(m.source)) : "",
      });
    }
    let unread = 0;
    try {
      const st = await c.status("INBOX", { unseen: true });
      unread = st.unseen ?? 0;
    } catch {
      unread = out.filter((x) => x.unread).length;
    }
    return { unread, messages: out.sort((a, b) => b.uid - a.uid) };
  });
}

async function ownerId(): Promise<string | null> {
  // The one LifeHub account whose login email is the linked Yahoo address
  for (let page = 1; page <= 5; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const hit = data?.users?.find((u) => (u.email ?? "").toLowerCase() === EMAIL);
    if (hit) return hit.id;
    if (!data?.users?.length || data.users.length < 200) break;
  }
  return null;
}

async function once(userId: string, key: string) {
  const { error } = await admin.from("notification_log").insert({ user_id: userId, key });
  return !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);

  if (req.method === "GET") {
    if (url.searchParams.get("probe")) {
      try {
        const conn = await Deno.connectTls({ hostname: "imap.mail.yahoo.com", port: 993 });
        const buf = new Uint8Array(200);
        const n = await conn.read(buf);
        conn.close();
        return json({ configured, reachable: true, greeting: new TextDecoder().decode(buf.subarray(0, n ?? 0)).slice(0, 40) });
      } catch (e) {
        return json({ configured, reachable: false, error: (e as Error).message });
      }
    }
    return json({ configured });
  }

  const body = await req.json().catch(() => ({}));

  // ---- Cron: ping the owner's phone about new rental alerts / important mail
  if (body?.check) {
    if (!configured) return json({ ok: false, configured });
    const owner = await ownerId();
    if (!owner) return json({ ok: false, error: "No LifeHub account uses the linked Yahoo address" });
    const { data: subs } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", owner);
    let sent = 0;
    try {
      const { messages } = await latest(15, false);
      const fresh = messages.filter((m) => m.unread && m.kind !== "other" && Date.now() - Date.parse(m.date || "0") < 36 * 3600e3);
      for (const m of fresh) {
        if (!(await once(owner, `mail-${m.uid}`))) continue;
        if (!pushReady || !subs?.length) continue;
        const msg =
          m.kind === "rental"
            ? { title: `🏠 New rental alert · ${m.from}`, body: m.subject.slice(0, 150), url: "/mail", tag: `mail-${m.uid}` }
            : { title: `✉️ ${m.from}`, body: m.subject.slice(0, 150), url: "/mail", tag: `mail-${m.uid}` };
        for (const s of subs) {
          try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 3600 });
            sent++;
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      }
      return json({ ok: true, checked: messages.length, sent });
    } catch (e) {
      return json({ ok: false, error: (e as Error).message.slice(0, 200) }, 502);
    }
  }

  // ---- Inbox for the signed-in owner
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Please unlock the app first." }, 401);
  if (!configured) return json({ configured: false });
  if ((u.user.email ?? "").toLowerCase() !== EMAIL) return json({ error: "This inbox belongs to another account." }, 403);
  try {
    const r = await latest(Math.min(40, Math.max(5, Number(body?.count) || 25)), true);
    return json({ configured: true, ...r });
  } catch (e) {
    const msg = (e as Error).message;
    return json(
      { configured: true, error: /auth|login|credential|invalid/i.test(msg) ? "Yahoo didn't accept the app password — make a new one and paste it again." : `Couldn't reach Yahoo Mail (${msg.slice(0, 120)}).` },
      502,
    );
  }
});
