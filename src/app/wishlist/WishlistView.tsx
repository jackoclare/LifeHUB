"use client";

import { ExternalLink, Gift, Loader2, PartyPopper, Plus, Tag, Trash2, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { run, useRows } from "@/lib/useRows";
import type { WishlistItem, WishlistPrice } from "@/lib/types";
import { Empty, ErrorNote, Field, Segmented, Sheet, Spinner, inputClass, money } from "@/components/ui";

const priorityLabel = { 1: "Must have", 2: "Want", 3: "Nice to have" } as const;
const priorityColor = { 1: "var(--c-health)", 2: "var(--c-shop)", 3: "var(--c-news)" } as const;

type Filter = "all" | "target" | "bought";

export function WishlistView() {
  const items = useRows<WishlistItem>("wishlist_items", [{ column: "priority" }, { column: "created_at", ascending: false }]);
  const prices = useRows<WishlistPrice>("wishlist_prices", [{ column: "recorded_at" }]);
  const [editing, setEditing] = useState<WishlistItem | "new" | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);

  const history = useMemo(() => {
    const m = new Map<string, WishlistPrice[]>();
    for (const p of prices.rows) m.set(p.item_id, [...(m.get(p.item_id) ?? []), p]);
    return m;
  }, [prices.rows]);

  const atTarget = (i: WishlistItem) => i.current_price != null && i.target_price != null && Number(i.current_price) <= Number(i.target_price);
  const visible = items.rows.filter((i) => (filter === "bought" ? i.purchased : !i.purchased && (filter === "all" || atTarget(i))));
  const wantedTotal = items.rows.filter((i) => !i.purchased).reduce((s, i) => s + Number(i.current_price ?? 0), 0);
  const targetCount = items.rows.filter((i) => !i.purchased && atTarget(i)).length;

  if (items.loading) return <Spinner label="Loading your wish list" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Wanted" },
            { value: "target", label: `At target${targetCount ? ` (${targetCount})` : ""}` },
            { value: "bought", label: "Bought" },
          ]}
        />
        <button className="btn btn-primary" onClick={() => setEditing("new")}>
          <Plus size={16} /> Add item
        </button>
      </div>

      {(error ?? items.error) && <ErrorNote message={(error ?? items.error)!} />}

      {items.rows.length === 0 ? (
        <Empty
          icon={<Gift size={36} />}
          title="Your wish list is empty"
          text="Save things you want — a PS5, a sofa, trainers — with the price now and the price you'd happily pay. You'll see when it hits your target."
          action={
            <button className="btn btn-primary" onClick={() => setEditing("new")}>
              <Plus size={16} /> Add your first item
            </button>
          }
        />
      ) : (
        <>
          {filter === "all" && (
            <p className="px-1 text-sm text-muted">
              {items.rows.filter((i) => !i.purchased).length} items · {money(wantedTotal)} at current prices
            </p>
          )}
          {visible.length === 0 ? (
            <p className="card p-6 text-sm text-muted">{filter === "target" ? "Nothing at your target price yet." : "Nothing here yet."}</p>
          ) : (
            <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((i, idx) => (
                <WishCard key={i.id} item={i} index={idx} history={history.get(i.id) ?? []} hit={atTarget(i)} onEdit={() => setEditing(i)} />
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={editing !== null} title={editing && editing !== "new" ? "Edit item" : "Add to wish list"} onClose={() => setEditing(null)}>
        {editing !== null && (
          <WishForm
            key={editing === "new" ? "new" : editing.id}
            existing={editing === "new" ? null : editing}
            onDone={async (msg) => {
              setError(msg);
              setEditing(null);
              await Promise.all([items.reload(), prices.reload()]);
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function WishCard({ item, index, history, hit, onEdit }: { item: WishlistItem; index: number; history: WishlistPrice[]; hit: boolean; onEdit: () => void }) {
  const [imgOk, setImgOk] = useState(true);
  const cur = item.current_price != null ? Number(item.current_price) : null;
  const tgt = item.target_price != null ? Number(item.target_price) : null;
  const gap = cur != null && tgt != null ? cur - tgt : null;
  const first = history[0] ? Number(history[0].price) : null;
  const drop = first != null && cur != null && cur < first ? first - cur : null;

  return (
    <article
      style={{ "--tile": priorityColor[item.priority], "--i": index } as React.CSSProperties}
      className={`card card-interactive flex flex-col overflow-hidden ${hit ? "ring-2 ring-[var(--c-money)]" : ""}`}
    >
      <button onClick={onEdit} className="text-left" aria-label={`Edit ${item.name}`}>
        <div className="relative aspect-[16/10] bg-surface-2">
          {item.image_url && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt="" className="size-full object-contain p-3" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          ) : (
            <div className="grid size-full place-items-center text-faint">
              <Gift size={40} />
            </div>
          )}
          <span className="chip absolute left-3 top-3 bg-bg/80! backdrop-blur" style={{ color: priorityColor[item.priority] }}>
            {priorityLabel[item.priority]}
          </span>
          {hit && (
            <span className="chip absolute right-3 top-3 bg-[var(--c-money)]! text-black!">
              <PartyPopper size={12} /> At target
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 font-semibold">{item.name}</h3>
          {item.retailer && <p className="text-xs text-muted">{item.retailer}</p>}
          <div className="mt-3 flex items-end justify-between gap-2">
            <div>
              <p className="text-[0.68rem] uppercase tracking-wider text-faint">Price</p>
              <p className="font-display text-xl font-semibold tabular-nums">{money(cur)}</p>
            </div>
            {tgt != null && (
              <div className="text-right">
                <p className="text-[0.68rem] uppercase tracking-wider text-faint">Target</p>
                <p className="text-sm font-semibold tabular-nums">{money(tgt)}</p>
                {gap != null && gap > 0 && <p className="text-xs text-muted">{money(gap)} to go</p>}
              </div>
            )}
          </div>
          {history.length > 1 && <Sparkline points={history.map((h) => Number(h.price))} target={tgt} />}
          {drop != null && (
            <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-[var(--c-money)]">
              <TrendingDown size={13} /> Down {money(drop)} since you added it
            </p>
          )}
        </div>
      </button>
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-auto flex min-h-11 items-center justify-center gap-1.5 border-t border-line text-sm font-semibold text-accent">
          View at {item.retailer || "shop"} <ExternalLink size={14} />
        </a>
      )}
    </article>
  );
}

function Sparkline({ points, target }: { points: number[]; target: number | null }) {
  const w = 220;
  const h = 40;
  const all = target != null ? [...points, target] : points;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - 4 - ((v - min) / span) * (h - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 h-10 w-full" aria-label="Price history" role="img">
      {target != null && <line x1="0" x2={w} y1={y(target)} y2={y(target)} stroke="var(--c-money)" strokeDasharray="3 4" strokeWidth="1" opacity="0.7" />}
      <path d={d} fill="none" stroke="var(--tile)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="draw" />
      <circle cx={x(points.length - 1)} cy={y(points[points.length - 1])} r="3" fill="var(--tile)" />
    </svg>
  );
}

function WishForm({ existing, onDone }: { existing: WishlistItem | null; onDone: (msg: string | null) => void }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [retailer, setRetailer] = useState(existing?.retailer ?? "");
  const [url, setUrl] = useState(existing?.url ?? "");
  const [image, setImage] = useState(existing?.image_url ?? "");
  const [price, setPrice] = useState(existing?.current_price != null ? String(existing.current_price) : "");
  const [target, setTarget] = useState(existing?.target_price != null ? String(existing.target_price) : "");
  const [priority, setPriority] = useState<1 | 2 | 3>(existing?.priority ?? 2);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [purchased, setPurchased] = useState(existing?.purchased ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const num = (s: string) => {
    if (!s.trim()) return null;
    const n = Number(s.replace(/[£,\s]/g, ""));
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const link = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = num(price);
    const t = num(target);
    if (Number.isNaN(p) || Number.isNaN(t)) return setError("Prices must be numbers, e.g. 479.99");
    setBusy(true);
    const supabase = createClient();
    const row = { name: name.trim(), retailer: retailer.trim() || null, url: link(url), image_url: link(image), current_price: p, target_price: t, priority, notes: notes.trim() || null, purchased };
    let id = existing?.id;
    let msg: string | null;
    if (existing) msg = await run(() => supabase.from("wishlist_items").update(row).eq("id", existing.id));
    else {
      const res = await supabase.from("wishlist_items").insert(row).select("id").single();
      msg = res.error?.message ?? null;
      id = res.data?.id;
    }
    // Record the price whenever it's new or has changed, to build up history
    const changed = !existing || Number(existing.current_price) !== p;
    if (!msg && id && p != null && changed) msg = await run(() => supabase.from("wishlist_prices").insert({ item_id: id, price: p }));
    setBusy(false);
    if (msg) setError(msg);
    else onDone(null);
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="What do you want?">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PlayStation 5 Pro" required maxLength={200} autoFocus={!existing} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Price now (£)">
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
        </Field>
        <Field label="Target price (£)">
          <input className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} inputMode="decimal" placeholder="Optional" />
        </Field>
      </div>
      <Field label="Shop">
        <input className={inputClass} value={retailer} onChange={(e) => setRetailer(e.target.value)} placeholder="e.g. Currys" maxLength={80} />
      </Field>
      <Field label="Product link">
        <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="Paste the web page address" />
      </Field>
      <Field label="Picture link (optional)">
        <input className={inputClass} value={image} onChange={(e) => setImage(e.target.value)} inputMode="url" placeholder="Long-press a product photo → Copy link" />
      </Field>
      <div>
        <p className="text-xs font-medium text-muted">Priority</p>
        <div className="mt-1 grid grid-cols-3 gap-2">
          {([1, 2, 3] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPriority(p)}
              aria-pressed={priority === p}
              className={`min-h-11 rounded-xl border text-sm font-semibold transition-colors ${priority === p ? "border-transparent text-black" : "border-line text-muted"}`}
              style={priority === p ? { background: priorityColor[p] } : undefined}
            >
              {priorityLabel[p]}
            </button>
          ))}
        </div>
      </div>
      <Field label="Notes">
        <textarea className={`${inputClass} min-h-16`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Colour, size, model…" />
      </Field>
      {existing && (
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} />
          <Tag size={15} /> I&apos;ve bought this
        </label>
      )}
      <p className="text-xs text-faint">Prices are what you enter. Automatic price tracking and drop alerts come with the Deals hub (Phase 3).</p>
      {error && <ErrorNote message={error} />}
      <div className="flex gap-2">
        {existing &&
          (confirm ? (
            <button
              type="button"
              className="btn bg-red-500/15 text-red-400"
              onClick={async () => onDone(await run(() => createClient().from("wishlist_items").delete().eq("id", existing.id)))}
            >
              <Trash2 size={16} /> Delete for good
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)} aria-label="Delete item">
              <Trash2 size={16} />
            </button>
          ))}
        <button type="submit" disabled={busy} className="btn btn-primary ml-auto">
          {busy && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}
