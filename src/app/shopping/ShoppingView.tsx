"use client";

import { Check, ChevronDown, ListPlus, Loader2, Minus, Plus, RotateCcw, ShoppingBasket, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { celebrate } from "@/lib/celebrate";
import { run, useRows } from "@/lib/useRows";
import type { ShoppingItem, ShoppingList } from "@/lib/types";
import { Empty, ErrorNote, Field, Sheet, Spinner, inputClass, money } from "@/components/ui";

/** Rough supermarket aisle order. */
export const aisles = [
  "Fruit & veg",
  "Bakery",
  "Meat & fish",
  "Dairy & eggs",
  "Chilled",
  "Frozen",
  "Cupboard",
  "Drinks",
  "Snacks",
  "Household",
  "Toiletries",
  "Other",
] as const;

const guesses: [RegExp, (typeof aisles)[number]][] = [
  [/apple|banana|orange|grape|berr|lemon|lime|potato|onion|carrot|tomato|lettuce|salad|pepper|cucumber|broccoli|mushroom|garlic|avocado|veg|fruit/i, "Fruit & veg"],
  [/bread|roll|bagel|wrap|croissant|crumpet|muffin|loaf|pitta/i, "Bakery"],
  [/chicken|beef|mince|pork|bacon|sausage|ham|lamb|steak|fish|salmon|tuna|prawn|cod|turkey/i, "Meat & fish"],
  [/milk|cheese|butter|yog|egg|cream/i, "Dairy & eggs"],
  [/pizza|ice ?cream|frozen|chips|peas/i, "Frozen"],
  [/pasta|rice|noodle|cereal|beans|soup|sauce|oil|flour|sugar|tea|coffee|tin|spice|stock|jam|honey/i, "Cupboard"],
  [/water|juice|coke|cola|squash|beer|wine|lager|cider|pop|lemonade/i, "Drinks"],
  [/crisp|chocolate|biscuit|sweet|nuts|popcorn|cake/i, "Snacks"],
  [/toilet roll|kitchen roll|washing|detergent|bin bag|foil|cling|clean|bleach|sponge|fairy|dishwasher/i, "Household"],
  [/shampoo|soap|toothpaste|deodorant|razor|shower|conditioner|tissue/i, "Toiletries"],
];
export const guessAisle = (name: string) => guesses.find(([re]) => re.test(name))?.[1] ?? "Other";

export function ShoppingView() {
  const lists = useRows<ShoppingList>("shopping_lists", [{ column: "created_at" }]);
  const items = useRows<ShoppingItem>("shopping_items", [{ column: "created_at" }]);
  const [listId, setListId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [newList, setNewList] = useState(false);
  const [showTicked, setShowTicked] = useState(false);
  const creatingDefault = useRef(false);

  // Make a first list automatically so you can start straight away
  useEffect(() => {
    if (lists.loading || lists.error || lists.rows.length || creatingDefault.current) return;
    creatingDefault.current = true;
    createClient()
      .from("shopping_lists")
      .insert({ name: "Weekly shop" })
      .then(({ error }) => (error ? setError(error.message) : lists.reload()));
  }, [lists]);

  useEffect(() => {
    if (!listId && lists.rows.length) setListId(lists.rows[0].id);
    if (listId && lists.rows.length && !lists.rows.some((l) => l.id === listId)) setListId(lists.rows[0].id);
  }, [lists.rows, listId]);

  const current = items.rows.filter((i) => i.list_id === listId);
  const todo = current.filter((i) => !i.checked);
  const done = current.filter((i) => i.checked);
  const total = current.reduce((s, i) => s + (i.est_price ?? 0) * Number(i.quantity), 0);
  const remaining = todo.reduce((s, i) => s + (i.est_price ?? 0) * Number(i.quantity), 0);

  const frequent = useMemo(() => {
    const onList = new Set(todo.map((i) => i.name.toLowerCase()));
    const counts = new Map<string, { name: string; n: number; item: ShoppingItem }>();
    for (const i of items.rows) {
      const k = i.name.toLowerCase();
      const c = counts.get(k);
      counts.set(k, { name: i.name, n: (c?.n ?? 0) + 1, item: i });
    }
    return [...counts.values()].filter((c) => !onList.has(c.name.toLowerCase())).sort((a, b) => b.n - a.n).slice(0, 12);
  }, [items.rows, todo]);

  const grouped = useMemo(() => {
    return aisles
      .map((a) => ({ aisle: a, items: todo.filter((i) => (aisles as readonly string[]).includes(i.category) ? i.category === a : a === "Other") }))
      .filter((g) => g.items.length);
  }, [todo]);

  const addItem = async (name: string, extra: Partial<ShoppingItem> = {}) => {
    if (!listId || !name.trim()) return;
    const n = name.trim();
    const temp: ShoppingItem = {
      id: `temp-${crypto.randomUUID()}`,
      list_id: listId,
      name: n,
      quantity: extra.quantity ?? 1,
      category: extra.category ?? guessAisle(n),
      est_price: extra.est_price ?? null,
      checked: false,
      created_at: new Date().toISOString(),
    };
    items.setRows((r) => [...r, temp]);
    const msg = await run(() =>
      createClient().from("shopping_items").insert({ list_id: listId, name: n, quantity: temp.quantity, category: temp.category, est_price: temp.est_price }),
    );
    setError(msg);
    items.reload();
  };

  const toggle = async (i: ShoppingItem) => {
    items.setRows((r) => r.map((x) => (x.id === i.id ? { ...x, checked: !x.checked } : x)));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
    // Ticked the last thing on the list? Party.
    const sameList = items.rows.filter((x) => x.list_id === i.list_id);
    if (!i.checked && sameList.length > 1 && sameList.every((x) => x.id === i.id || x.checked)) celebrate(null, 70);
    const msg = await run(() => createClient().from("shopping_items").update({ checked: !i.checked }).eq("id", i.id));
    if (msg) {
      setError(msg);
      items.reload();
    }
  };

  const bulk = async (kind: "untick" | "remove") => {
    if (!listId) return;
    const supabase = createClient();
    const msg =
      kind === "untick"
        ? await run(() => supabase.from("shopping_items").update({ checked: false }).eq("list_id", listId).eq("checked", true))
        : await run(() => supabase.from("shopping_items").delete().eq("list_id", listId).eq("checked", true));
    setError(msg);
    items.reload();
  };

  if (lists.loading || items.loading || (!lists.rows.length && !lists.error && !error)) return <Spinner label="Loading your lists" />;

  const currentList = lists.rows.find((l) => l.id === listId);

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      {/* List picker */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {lists.rows.map((l) => (
          <button
            key={l.id}
            onClick={() => setListId(l.id)}
            aria-pressed={l.id === listId}
            className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold transition-colors ${
              l.id === listId ? "bg-[var(--c-shop)] text-black" : "card text-muted hover:text-ink"
            }`}
          >
            {l.name}
            <span className="ml-1.5 opacity-60">{items.rows.filter((i) => i.list_id === l.id && !i.checked).length}</span>
          </button>
        ))}
        <button onClick={() => setNewList(true)} className="card flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-muted hover:text-ink">
          <ListPlus size={16} /> New list
        </button>
      </div>

      {(error ?? lists.error ?? items.error) && <ErrorNote message={(error ?? lists.error ?? items.error)!} />}

      <QuickAdd onAdd={addItem} />

      {frequent.length > 0 && (
        <div>
          <p className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">Often bought</p>
          <div className="flex flex-wrap gap-2">
            {frequent.map((f) => (
              <button
                key={f.name}
                onClick={() => addItem(f.name, { category: f.item.category, est_price: f.item.est_price })}
                className="chip min-h-9 px-3! transition-transform active:scale-95"
              >
                <Plus size={12} /> {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {current.length === 0 ? (
        <Empty
          icon={<ShoppingBasket size={36} />}
          title={`${currentList?.name ?? "This list"} is empty`}
          text="Type something above and press Add. Items are sorted into supermarket aisles automatically."
        />
      ) : (
        <>
          {grouped.map((g) => (
            <section key={g.aisle}>
              <h3 className="mb-2 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">{g.aisle}</h3>
              <ul className="card divide-y divide-line overflow-hidden">
                {g.items.map((i) => (
                  <ItemRow key={i.id} item={i} onToggle={toggle} onEdit={setEditing} />
                ))}
              </ul>
            </section>
          ))}
          {todo.length === 0 && (
            <p className="card p-5 text-center text-sm font-semibold text-[var(--c-money)]">
              <Check size={18} className="mr-1 inline" /> Everything&apos;s in the trolley!
            </p>
          )}
          {done.length > 0 && (
            <section>
              <button onClick={() => setShowTicked((s) => !s)} className="mb-2 flex min-h-10 items-center gap-1.5 px-1 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-faint">
                <ChevronDown size={14} className={`transition-transform ${showTicked ? "" : "-rotate-90"}`} /> In the trolley ({done.length})
              </button>
              {showTicked && (
                <ul className="card divide-y divide-line overflow-hidden opacity-70">
                  {done.map((i) => (
                    <ItemRow key={i.id} item={i} onToggle={toggle} onEdit={setEditing} />
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => bulk("untick")} className="btn btn-ghost text-xs">
                  <RotateCcw size={14} /> Untick all (reuse list)
                </button>
                <button onClick={() => bulk("remove")} className="btn btn-ghost text-xs">
                  <Trash2 size={14} /> Remove ticked items
                </button>
              </div>
            </section>
          )}
        </>
      )}

      {/* Running total — sits above the tab bar on iPhone */}
      {current.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 pl-4 pr-20 lg:static lg:px-0">
          <div className="card mx-auto flex max-w-md items-center justify-between gap-4 px-4 py-3 lg:max-w-none">
            <div>
              <p className="text-xs text-muted">Estimated total</p>
              <p className="font-display text-lg font-semibold tabular-nums">{money(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted">Still to get</p>
              <p className="font-display text-lg font-semibold tabular-nums text-[var(--c-shop)]">
                {todo.length} · {money(remaining)}
              </p>
            </div>
          </div>
        </div>
      )}

      <ItemSheet
        item={editing}
        onClose={() => setEditing(null)}
        onDone={(msg) => {
          setError(msg);
          setEditing(null);
          items.reload();
        }}
      />
      <ListSheet
        open={newList}
        current={currentList}
        onClose={() => setNewList(false)}
        onDone={async (msg, id) => {
          setError(msg);
          setNewList(false);
          await lists.reload();
          if (id) setListId(id);
        }}
      />
    </div>
  );
}

function QuickAdd({ onAdd }: { onAdd: (name: string, extra?: Partial<ShoppingItem>) => void }) {
  const [name, setName] = useState("");
  const [qty, setQty] = useState(1);
  const [price, setPrice] = useState("");
  const [more, setMore] = useState(false);

  return (
    <form
      className="card p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        const p = Number(price.replace(/[£,\s]/g, ""));
        onAdd(name, { quantity: qty, est_price: price && Number.isFinite(p) ? p : null });
        setName("");
        setQty(1);
        setPrice("");
      }}
    >
      <div className="flex gap-2">
        <input className={`${inputClass} mt-0!`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Add an item…" enterKeyHint="done" maxLength={120} aria-label="Item name" />
        <button type="submit" className="btn btn-primary shrink-0" aria-label="Add item">
          <Plus size={18} />
          <span className="hidden sm:inline">Add</span>
        </button>
      </div>
      <button type="button" onClick={() => setMore((m) => !m)} className="mt-2 flex min-h-8 items-center gap-1 px-1 text-xs font-medium text-muted">
        <ChevronDown size={14} className={`transition-transform ${more ? "" : "-rotate-90"}`} /> Quantity & price
      </button>
      {more && (
        <div className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Quantity</p>
            <div className="mt-1 flex items-center gap-2">
              <button type="button" className="btn btn-ghost px-3!" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Less">
                <Minus size={16} />
              </button>
              <span className="w-8 text-center font-semibold tabular-nums">{qty}</span>
              <button type="button" className="btn btn-ghost px-3!" onClick={() => setQty((q) => q + 1)} aria-label="More">
                <Plus size={16} />
              </button>
            </div>
          </div>
          <Field label="Price each (£, optional)">
            <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
          </Field>
        </div>
      )}
    </form>
  );
}

function ItemRow({ item, onToggle, onEdit }: { item: ShoppingItem; onToggle: (i: ShoppingItem) => void; onEdit: (i: ShoppingItem) => void }) {
  const qty = Number(item.quantity);
  return (
    <li className="flex items-center">
      <button
        onClick={() => onToggle(item)}
        className="grid size-14 shrink-0 place-items-center"
        aria-label={item.checked ? `Untick ${item.name}` : `Tick off ${item.name}`}
        aria-pressed={item.checked}
      >
        <span
          className={`grid size-7 place-items-center rounded-full border-2 transition-colors ${
            item.checked ? "animate-tick border-[var(--c-money)] bg-[var(--c-money)] text-black" : "border-line"
          }`}
        >
          {item.checked && <Check size={16} strokeWidth={3} />}
        </span>
      </button>
      <button onClick={() => onEdit(item)} className="flex min-h-14 min-w-0 flex-1 items-center gap-2 pr-4 text-left">
        <span className={`min-w-0 flex-1 truncate text-[0.95rem] ${item.checked ? "text-muted line-through" : "font-medium"}`}>
          {qty !== 1 && <span className="mr-1.5 font-semibold text-[var(--c-shop)]">{qty}×</span>}
          {item.name}
        </span>
        {item.est_price != null && <span className="shrink-0 text-sm tabular-nums text-muted">{money(item.est_price * qty)}</span>}
      </button>
    </li>
  );
}

function ItemSheet({ item, onClose, onDone }: { item: ShoppingItem | null; onClose: () => void; onDone: (msg: string | null) => void }) {
  return (
    <Sheet open={!!item} title="Edit item" onClose={onClose}>
      {item && <ItemSheetBody key={item.id} item={item} onDone={onDone} />}
    </Sheet>
  );
}

function ItemSheetBody({ item, onDone }: { item: ShoppingItem; onDone: (msg: string | null) => void }) {
  const [name, setName] = useState(item.name);
  const [qty, setQty] = useState(String(item.quantity));
  const [price, setPrice] = useState(item.est_price != null ? String(item.est_price) : "");
  const [category, setCategory] = useState(item.category);
  const [busy, setBusy] = useState(false);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const p = Number(price.replace(/[£,\s]/g, ""));
    const q = Number(qty);
    const msg = await run(() =>
      createClient()
        .from("shopping_items")
        .update({ name: name.trim(), quantity: q > 0 ? q : 1, est_price: price && Number.isFinite(p) ? p : null, category })
        .eq("id", item.id),
    );
    onDone(msg);
  };
  const remove = async () => {
    setBusy(true);
    onDone(await run(() => createClient().from("shopping_items").delete().eq("id", item.id)));
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Item">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity">
          <input className={inputClass} value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Price each (£)">
          <input className={inputClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0.00" />
        </Field>
      </div>
      <Field label="Aisle">
        <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
          {aisles.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2">
        <button type="button" onClick={remove} disabled={busy} className="btn btn-ghost" aria-label="Remove item">
          <Trash2 size={16} /> Remove
        </button>
        <button type="submit" disabled={busy} className="btn btn-primary ml-auto">
          {busy && <Loader2 size={16} className="animate-spin" />} Save
        </button>
      </div>
    </form>
  );
}

function ListSheet({
  open,
  current,
  onClose,
  onDone,
}: {
  open: boolean;
  current?: ShoppingList;
  onClose: () => void;
  onDone: (msg: string | null, id?: string) => void;
}) {
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  return (
    <Sheet open={open} title="Lists" onClose={onClose}>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const { data, error } = await createClient().from("shopping_lists").insert({ name: name.trim() }).select("id").single();
          setName("");
          onDone(error?.message ?? null, data?.id);
        }}
      >
        <Field label="New list name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aldi top-up" required maxLength={80} autoFocus />
        </Field>
        <button type="submit" className="btn btn-primary w-full">
          <ListPlus size={16} /> Create list
        </button>
      </form>
      {current && (
        <div className="mt-6 border-t border-line pt-4">
          <p className="text-xs text-muted">Current list: {current.name}</p>
          {confirm ? (
            <button
              className="btn mt-2 w-full bg-red-500/15 text-red-400"
              onClick={async () => {
                const msg = await run(() => createClient().from("shopping_lists").delete().eq("id", current.id));
                setConfirm(false);
                onDone(msg);
              }}
            >
              <Trash2 size={16} /> Yes, delete “{current.name}” and its items
            </button>
          ) : (
            <button className="btn btn-ghost mt-2 w-full" onClick={() => setConfirm(true)}>
              <Trash2 size={16} /> Delete this list
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
