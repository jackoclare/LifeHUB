"use client";

import { FileText, Image as ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { SignInCard } from "@/components/SignInCard";
import { ErrorNote, Field, Sheet, inputClass } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { useRows } from "@/lib/useRows";

export type Doc = { id: string; title: string; category: string; path: string; mime: string | null; size_bytes: number | null; expires_on: string | null; notes: string | null; created_at: string };

export const DOC_CATS: { id: string; label: string; emoji: string }[] = [
  { id: "insurance", label: "Insurance", emoji: "🛡️" },
  { id: "vehicle", label: "Vehicle", emoji: "🚗" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "warranty", label: "Warranties", emoji: "🧾" },
  { id: "receipt", label: "Receipts", emoji: "🧾" },
  { id: "home", label: "Home", emoji: "🏠" },
  { id: "finance", label: "Finance", emoji: "💷" },
  { id: "health", label: "Health", emoji: "🩺" },
  { id: "id", label: "ID & passport", emoji: "🪪" },
  { id: "other", label: "Other", emoji: "📄" },
];

const size = (b: number | null) => (b == null ? "" : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
const daysUntil = (iso: string) => Math.round((new Date(`${iso}T12:00:00`).getTime() - new Date(new Date().toDateString() + " 12:00").getTime()) / 864e5);

export function DocumentsView() {
  const { user, loading } = useAuth();
  const docs = useRows<Doc>("documents", [{ column: "created_at", ascending: false }], Boolean(user));
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [adding, setAdding] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return docs.rows.filter((d) => (cat === "all" || d.category === cat) && (!s || `${d.title} ${d.notes ?? ""} ${d.category}`.toLowerCase().includes(s)));
  }, [docs.rows, q, cat]);

  if (loading) return null;
  if (!user) return <SignInCard reason="Unlock to see your documents." />;

  const open = async (d: Doc) => {
    setOpening(d.id);
    const { data } = await createClient().storage.from("documents").createSignedUrl(d.path, 300);
    setOpening(null);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };
  const remove = async (d: Doc) => {
    if (!confirm(`Delete "${d.title}"? This can't be undone.`)) return;
    const sb = createClient();
    await sb.storage.from("documents").remove([d.path]);
    await sb.from("documents").delete().eq("id", d.id);
    docs.reload();
  };

  const used = new Set(docs.rows.map((d) => d.category));

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full bg-surface px-4 shadow-[var(--shadow)] focus-within:ring-2 focus-within:ring-accent">
          <Search size={16} className="text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="w-full bg-transparent text-base outline-none" />
        </label>
        <button className="btn btn-primary shrink-0" onClick={() => setAdding(true)}>
          <Upload size={16} /> Add
        </button>
      </div>
      {used.size > 1 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {[{ id: "all", label: "All", emoji: "" }, ...DOC_CATS.filter((c) => used.has(c.id))].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`min-h-9 shrink-0 rounded-full px-3 text-sm font-semibold ${cat === c.id ? "bg-accent text-white" : "bg-surface text-muted shadow-[var(--shadow)]"}`}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      )}

      {docs.rows.length === 0 && !docs.loading ? (
        <div className="card p-6 text-center">
          <FileText className="mx-auto text-accent" size={30} />
          <p className="mt-2 font-semibold">Your private document wallet</p>
          <p className="mt-1 text-sm text-muted">Keep insurance, MOT certificates, warranties, receipts and bookings in one place. Add an expiry date and LifeHub will remind you.</p>
          <button className="btn btn-primary mt-4" onClick={() => setAdding(true)}>
            <Upload size={16} /> Add a document or photo
          </button>
        </div>
      ) : (
        <ul className="card stagger divide-y divide-line overflow-hidden">
          {list.map((d, i) => {
            const c = DOC_CATS.find((x) => x.id === d.category);
            const days = d.expires_on ? daysUntil(d.expires_on) : null;
            return (
              <li key={d.id} style={{ "--i": Math.min(i, 10) } as React.CSSProperties} className="flex items-center gap-3 px-4 py-3">
                <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => open(d)}>
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl">
                    {opening === d.id ? <Loader2 size={18} className="animate-spin" /> : d.mime?.startsWith("image/") ? <ImageIcon size={18} className="text-muted" /> : c?.emoji}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{d.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {c?.label} · {size(d.size_bytes)}
                      {days != null && (
                        <span style={{ color: days < 0 ? "#ff3b30" : days <= 30 ? "#ff9500" : undefined }}>
                          {" "}
                          · {days < 0 ? "expired" : "expires"} {new Date(`${d.expires_on}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <button className="grid size-9 place-items-center rounded-full text-faint hover:text-red-500" aria-label={`Delete ${d.title}`} onClick={() => remove(d)}>
                  <Trash2 size={15} />
                </button>
              </li>
            );
          })}
          {list.length === 0 && <li className="p-5 text-sm text-muted">Nothing matches.</li>}
        </ul>
      )}
      <p className="text-xs text-faint">Files are stored privately in your own folder — only you can open them, using a short-lived link.</p>
      <AddDoc open={adding} onClose={() => setAdding(false)} onSaved={docs.reload} />
    </div>
  );
}

function AddDoc({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [expires, setExpires] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reset = () => {
    setFile(null);
    setTitle("");
    setCategory("other");
    setExpires("");
    setNotes("");
    setErr(null);
  };

  const save = async () => {
    if (!file || !user) return setErr("Choose a file or photo first");
    if (file.size > 15 * 1024 * 1024) return setErr("That file is over 15 MB");
    setBusy(true);
    const sb = createClient();
    const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const up = await sb.storage.from("documents").upload(path, file, { contentType: file.type || undefined });
    if (up.error) {
      setBusy(false);
      return setErr(up.error.message);
    }
    const { error } = await sb.from("documents").insert({ title: title.trim() || file.name, category, path, mime: file.type || null, size_bytes: file.size, expires_on: expires || null, notes: notes || null });
    setBusy(false);
    if (error) return setErr(error.message);
    reset();
    onSaved();
    onClose();
  };

  return (
    <Sheet open={open} title="Add a document" onClose={onClose}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          setFile(f);
          if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, ""));
        }}
      />
      <button className="flex w-full flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-line p-5 text-sm text-muted" onClick={() => fileRef.current?.click()}>
        <Upload size={22} className="text-accent" />
        {file ? <span className="font-medium text-ink">{file.name}</span> : "Take a photo or choose a file (PDF, image, Word…)"}
      </button>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Car insurance 2026" />
        </Field>
        <Field label="Type">
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {DOC_CATS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Expires (optional)">
          <input type="date" className={inputClass} value={expires} onChange={(e) => setExpires(e.target.value)} />
        </Field>
        <Field label="Notes" className="col-span-2">
          <input className={inputClass} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Policy number, where bought…" />
        </Field>
      </div>
      {err && <ErrorNote message={err} />}
      <button className="btn btn-primary mt-4 w-full" disabled={busy || !file} onClick={save}>
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} Save
      </button>
    </Sheet>
  );
}
