/**
 * Reads bank-statement transactions from CSV text or PDF text lines (Pockit and most UK banks).
 * Amounts: negative = money out, positive = money in.
 */
export type Txn = { date: string; description: string; amount: number; category: string };

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** dd/mm/yyyy, dd-mm-yy, yyyy-mm-dd, 12 Nov 2026, 12 November, Nov 12 2026 → yyyy-mm-dd */
export function parseDateToken(s: string, fallbackYear = new Date().getFullYear()): string | null {
  const t = s.trim().toLowerCase();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) return ymd(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3})[a-z]*\.?(?:[\s-]+(\d{2,4}))?/);
  if (m && MONTHS.includes(m[2])) return ymd(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : fallbackYear, MONTHS.indexOf(m[2]) + 1, +m[1]);
  m = t.match(/^([a-z]{3})[a-z]*\.? (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})/);
  if (m && MONTHS.includes(m[1])) return ymd(+m[3], MONTHS.indexOf(m[1]) + 1, +m[2]);
  return null;
}
function ymd(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const money = (s: string) => {
  const neg = /^\(.*\)$/.test(s.trim()) || /^-|-£|£-|^−/.test(s.trim()) || /\bDR\b/i.test(s);
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? (neg ? -n : n) : null;
};
const AMOUNT_RE = /[-+−(]?\s?£?\s?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s?(?:CR|DR))?/gi;

/** Rules for sorting transactions — first match wins */
const RULES: [RegExp, string][] = [
  [/salary|wages|payroll|hmrc|universal credit|dwp|child benefit/i, "income"],
  [/tesco|asda|sainsbury|aldi|lidl|morrisons|co-?op|iceland|waitrose|m&s food|marks.*spencer.*food|ocado|farmfoods|spar\b/i, "groceries"],
  [/shell|\bbp\b|esso|texaco|jet\b|gulf\b|murco|petrol|fuel|applegreen|mfg|motor fuel/i, "fuel"],
  [/mcdonald|greggs|kfc|subway|nando|costa|starbucks|pret\b|burger king|domino|pizza|just eat|deliveroo|uber ?eats|wetherspoon|restaurant|cafe|takeaway|chippy|five guys/i, "eating out"],
  [/netflix|spotify|disney|prime video|amazon prime|apple\.com|icloud|youtube|now tv|sky\b|dazn|playstation|xbox|patreon|google storage/i, "subscriptions"],
  [/\btfl\b|trainline|national rail|uber(?! ?eats)|bolt\b|bus|stagecoach|parking|ringgo|paybyphone|dvla|toll|nx west|west midlands railway/i, "transport"],
  [/amazon|ebay|argos|currys|primark|asos|next\b|h&m|zara|jd sports|sports direct|boots|superdrug|b&m|home bargains|the range|ikea|wilko|temu|shein/i, "shopping"],
  [/british gas|octopus|eon|e\.on|edf|ovo|scottish power|severn trent|water|council tax|tv licen[cs]e|vodafone|\bee\b|o2\b|three\b|virgin|bt\b|talktalk|insurance|admiral|aviva|direct line|rent|mortgage/i, "bills"],
  [/atm|cash withdrawal|cashpoint|link atm/i, "cash"],
  [/gym|puregym|the gym|david lloyd|fitness/i, "health"],
  [/bet365|sky bet|paddy power|william hill|ladbrokes|coral\b|betfair|lottery|national lottery/i, "betting"],
  [/transfer|faster payment|standing order|top ?up|sent to|received from|from:|to:/i, "transfers"],
];
export const CATEGORIES = ["groceries", "eating out", "fuel", "transport", "bills", "subscriptions", "shopping", "health", "cash", "betting", "transfers", "income", "other"] as const;
export const CAT_EMOJI: Record<string, string> = {
  groceries: "🛒",
  "eating out": "🍔",
  fuel: "⛽",
  transport: "🚌",
  bills: "🧾",
  subscriptions: "📺",
  shopping: "🛍️",
  health: "💪",
  cash: "💵",
  betting: "🎲",
  transfers: "🔁",
  income: "💷",
  other: "📦",
};
export function categorise(desc: string, amount: number) {
  for (const [re, c] of RULES) if (re.test(desc)) return c === "income" && amount < 0 ? "bills" : c;
  return amount > 0 ? "income" : "other";
}

/** CSV: finds the date / description / amount (or in/out, debit/credit) columns from the header row */
export function parseCsv(text: string): Txn[] {
  const rows = text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map(splitCsv);
  const hi = rows.findIndex((r) => r.some((c) => /date/i.test(c)) && r.some((c) => /amount|paid|debit|credit|money|in|out|value/i.test(c)));
  if (hi < 0) return [];
  const h = rows[hi].map((c) => c.toLowerCase().trim());
  const di = h.findIndex((c) => /date/.test(c));
  const col = (re: RegExp) => h.findIndex((c, i) => i !== di && re.test(c));
  const desc = [col(/description|details|narrative|merchant|payee|name|reference|transaction/), col(/reference|memo|notes/)].filter((i, k, a) => i >= 0 && a.indexOf(i) === k);
  const ai = col(/^amount|amount\b|value/);
  const inI = col(/paid in|money in|credit|^in$|received/);
  const outI = col(/paid out|money out|debit|^out$|spent/);
  const out: Txn[] = [];
  for (const r of rows.slice(hi + 1)) {
    const date = parseDateToken(r[di] ?? "");
    if (!date) continue;
    let amount: number | null = null;
    if (ai >= 0 && r[ai]?.trim()) amount = money(r[ai]);
    else {
      const i = inI >= 0 ? money(r[inI] ?? "") : null;
      const o = outI >= 0 ? money(r[outI] ?? "") : null;
      amount = (i ? Math.abs(i) : 0) - (o ? Math.abs(o) : 0);
    }
    if (amount == null || amount === 0) continue;
    const description = desc.map((i) => r[i]?.trim()).filter(Boolean).join(" · ") || "Transaction";
    out.push({ date, description, amount, category: categorise(description, amount) });
  }
  return out;
}
function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if ((ch === "," || ch === ";" || ch === "\t") && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** PDF text lines: a row starts with a date and ends with one or more amounts (amount, then running balance) */
export function parsePdfLines(lines: string[]): Txn[] {
  const yearHint = Number(lines.join(" ").match(/\b(20\d{2})\b/)?.[1]) || new Date().getFullYear();
  const rows: { date: string; description: string; amounts: number[]; raw: string }[] = [];
  let lastDate: string | null = null;
  for (const raw of lines) {
    const line = raw.replace(/\t+/g, " \t ").trim();
    const date = parseDateToken(line, yearHint);
    const amounts = [...line.matchAll(AMOUNT_RE)].map((m) => m[0]);
    if (!amounts.length) continue;
    const d = date ?? lastDate;
    if (!d) continue;
    if (date) lastDate = date;
    // description = text between the date and the first amount
    const firstAmt = line.search(AMOUNT_RE);
    let description = line.slice(0, firstAmt);
    if (date) description = stripDate(description);
    description = description.replace(/\t/g, " ").replace(/\s+/g, " ").replace(/^[-–:|]\s*/, "").trim();
    if (!description || /^(balance|opening|closing|brought forward|carried forward|total|date)/i.test(description)) {
      // opening/closing balances help us work out signs below
      if (/balance|brought forward/i.test(line)) rows.push({ date: d, description: "__balance__", amounts: amounts.map((a) => money(a)!).filter((n) => n != null), raw });
      continue;
    }
    rows.push({ date: d, description, amounts: amounts.map((a) => money(a)!).filter((n) => n != null), raw });
  }
  // Work out signs: with a running balance, the change tells us in/out; otherwise use words and +/− signs
  const out: Txn[] = [];
  let prevBal: number | null = null;
  for (const r of rows) {
    if (r.description === "__balance__") {
      prevBal = r.amounts[r.amounts.length - 1] ?? prevBal;
      continue;
    }
    let amount = r.amounts[0];
    if (r.amounts.length >= 2) {
      const bal = r.amounts[r.amounts.length - 1];
      const amt = Math.abs(r.amounts[0]);
      if (prevBal != null && Math.abs(Math.abs(bal - prevBal) - amt) < 0.015) amount = bal > prevBal ? amt : -amt;
      else if (r.amounts.length >= 3) amount = r.amounts[0] ? -Math.abs(r.amounts[0]) || Math.abs(r.amounts[1]) : Math.abs(r.amounts[1]);
      else amount = /\b(in|credit|received|refund|top ?up|deposit|salary|from)\b/i.test(r.description) || /\+\s?£?\d/.test(r.raw) ? amt : -amt;
      prevBal = bal;
    } else if (!/^[-−+(]/.test(r.raw.slice(r.raw.search(AMOUNT_RE)))) {
      amount = /\b(credit|received|refund|top ?up|deposit|salary|paid in|from)\b/i.test(r.description) ? Math.abs(amount) : -Math.abs(amount);
    }
    if (!amount) continue;
    out.push({ date: r.date, description: r.description.slice(0, 200), amount: Math.round(amount * 100) / 100, category: categorise(r.description, amount) });
  }
  return out;
}

function stripDate(s: string) {
  const t = s.trimStart();
  for (const re of [/^\d{4}-\d{1,2}-\d{1,2}/, /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/, /^\d{1,2}(?:st|nd|rd|th)?[\s-]+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[\s-]+\d{4}|[\s-]+\d{2}(?!\d))?/i, /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}(?:st|nd|rd|th)?,? \d{4}/i]) {
    const m = t.match(re);
    if (m) return t.slice(m[0].length);
  }
  return t;
}

/** Stable key so re-uploading the same statement never doubles up */
export function dedupeKey(t: Txn, i: number, list: Txn[]) {
  const same = list.slice(0, i).filter((x) => x.date === t.date && x.description === t.description && x.amount === t.amount).length;
  return `${t.date}|${t.amount.toFixed(2)}|${t.description.toLowerCase().replace(/\s+/g, " ").slice(0, 80)}|${same}`;
}
