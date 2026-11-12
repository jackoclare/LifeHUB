// Extracts the text lines from a bank-statement PDF so the app can read the transactions.
// Signed-in users only. The PDF is processed in memory and never stored.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getDocumentProxy } from "npm:unpdf@0.12.1";

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST a PDF" }, 405);
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Please unlock the app first." }, 401);

  const buf = new Uint8Array(await req.arrayBuffer());
  if (buf.length > 12 * 1024 * 1024) return json({ error: "That PDF is over 12 MB" }, 413);
  if (String.fromCharCode(...buf.slice(0, 5)) !== "%PDF-") return json({ error: "That doesn't look like a PDF" }, 400);
  try {
    const pdf = await getDocumentProxy(buf);
    const lines: string[] = [];
    // Rebuild table rows: group text pieces that sit on the same line (same y), left to right, with a tab between columns
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const tc = await page.getTextContent();
      const rows = new Map<number, { x: number; w: number; s: string }[]>();
      // deno-lint-ignore no-explicit-any
      for (const it of tc.items as any[]) {
        const s = String(it.str ?? "").trim();
        if (!s) continue;
        const y = Math.round(it.transform[5] / 2.5);
        const row = rows.get(y) ?? [];
        row.push({ x: it.transform[4], w: it.width ?? 0, s });
        rows.set(y, row);
      }
      for (const y of [...rows.keys()].sort((a, b) => b - a)) {
        const parts = rows.get(y)!.sort((a, b) => a.x - b.x);
        let out = "";
        let end = -1;
        for (const p of parts) {
          if (out) out += p.x - end > 12 ? "\t" : " ";
          out += p.s;
          end = p.x + p.w;
        }
        lines.push(out);
      }
    }
    return json({ pages: pdf.numPages, lines });
  } catch (e) {
    return json({ error: `Couldn't read that PDF (${e instanceof Error ? e.message : "unknown error"}). If it's password-protected, download it again without a password, or use CSV.` }, 422);
  }
});
