import { NextResponse } from "next/server";

/**
 * Food lookup from Open Food Facts (free, open database — ODbL licence).
 * GET /api/food?q=baked beans   or   /api/food?barcode=5000157024671
 * Returns per-100g nutrition (and per-serving size if known).
 */
export const revalidate = 86400;
const UA = "LifeHub/1.0 (personal food diary; https://life-hub-nine-rouge.vercel.app)";

export type Food = {
  code: string;
  name: string;
  brand: string | null;
  serving: string | null;
  servingGrams: number | null;
  per100: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null; sugar: number | null; fibre: number | null; salt: number | null };
};

type Raw = { code?: string; product_name?: string; brands?: string | string[]; serving_size?: string; serving_quantity?: number | string; nutriments?: Record<string, number> };

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
function toFood(p: Raw): Food | null {
  if (!p.product_name) return null;
  const nu = p.nutriments ?? {};
  const kcal = n(nu["energy-kcal_100g"]) ?? (typeof nu["energy_100g"] === "number" ? n(nu["energy_100g"] / 4.184) : null);
  const sg = Number(p.serving_quantity);
  return {
    code: String(p.code ?? ""),
    name: p.product_name.trim(),
    brand: Array.isArray(p.brands) ? (p.brands[0] ?? null) : (p.brands?.split(",")[0]?.trim() ?? null),
    serving: p.serving_size ?? null,
    servingGrams: Number.isFinite(sg) && sg > 0 ? sg : null,
    per100: { kcal, protein: n(nu.proteins_100g), carbs: n(nu.carbohydrates_100g), fat: n(nu.fat_100g), sugar: n(nu.sugars_100g), fibre: n(nu.fiber_100g), salt: n(nu.salt_100g) },
  };
}

export async function GET(req: Request) {
  const u = new URL(req.url);
  const barcode = (u.searchParams.get("barcode") ?? "").replace(/\D/g, "");
  const q = (u.searchParams.get("q") ?? "").trim().slice(0, 80);
  const fields = "code,product_name,brands,nutriments,serving_size,serving_quantity";
  try {
    if (barcode) {
      const r = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
      const j = await r.json();
      const f = j?.product ? toFood({ ...j.product, code: barcode }) : null;
      return NextResponse.json({ foods: f ? [f] : [], error: f ? undefined : "That barcode isn't in the database yet — add it by hand." });
    }
    if (q.length < 2) return NextResponse.json({ foods: [] });
    const r = await fetch(`https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25&fields=${fields}&langs=en`, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(9000),
    });
    const j = await r.json();
    const foods = ((j?.hits ?? []) as Raw[]).map(toFood).filter((f): f is Food => !!f && f.per100.kcal != null);
    return NextResponse.json({ foods: foods.slice(0, 15) });
  } catch {
    return NextResponse.json({ foods: [], error: "The food database isn't responding — try again or add it by hand." }, { status: 502 });
  }
}
