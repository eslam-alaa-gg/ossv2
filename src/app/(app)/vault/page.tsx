"use client";
import { Archive, Bold, BookMarked, Check, Eye, Heading1, Heading2, Link2, List, ListChecks, ListOrdered, Loader2, Pin, Plus, Search, Star, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, ErrorState, Field, ListSkeleton, PageHeader, Segmented, cn, useUI } from "@/components/ui";
import { api, useFetch } from "@/lib/client";
import { fmtLong, fmtShort } from "@/lib/dates";
import { renderMarkdown } from "@/lib/markdown";

type Note = { id: string; type: string; title: string; content: string; tags: string[]; collection: string; pinned: boolean; archived: boolean; favorite: boolean; updatedAt: string };
const TYPES: Record<string, string> = { quick: "Quick Note", idea: "Idea", learned: "Thing I Learned", reflection: "Reflection", reading: "Reading Note", project: "Project Note", important: "Important Info" };
const PROMPTS: { key: string; q: string }[] = [{ key: "accomplished", q: "What did I accomplish?" }, { key: "learned", q: "What did I learn?" }, { key: "improve", q: "What can I improve?" }, { key: "grateful", q: "What am I grateful for?" }, { key: "tomorrow", q: "What should I do tomorrow?" }];
const MOODS = ["😞", "😕", "😐", "🙂", "😄"];

function Editor({ note, onChange, onDeleted }: { note: Note; onChange: (n: Note) => void; onDeleted: () => void }) {
  const { run, confirm } = useUI();
  const [d, setD] = useState({ title: note.title, content: note.content, type: note.type, collection: note.collection, tags: note.tags.join(", ") });
  const [state, setState] = useState<"saved" | "saving" | "error" | "dirty">("saved");
  const [preview, setPreview] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (v: typeof d) => {
    setState("saving");
    try {
      const r = await api<{ note: Note }>(`/api/notes/${note.id}`, { method: "PATCH", body: { title: v.title, content: v.content, type: v.type, collection: v.collection.trim(), tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 15) } });
      onChange(r.note);
      setState("saved");
    } catch { setState("error"); }
  }, [note.id, onChange]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(d), 900);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [d]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrap = (before: string, after = "", block = false) => {
    const el = ta.current; if (!el) return;
    const { selectionStart: s, selectionEnd: e, value } = el;
    const sel = value.slice(s, e) || (block ? "text" : "text");
    const ls = block ? value.lastIndexOf("\n", s - 1) + 1 : s;
    const next = block ? value.slice(0, ls) + before + value.slice(ls) : value.slice(0, s) + before + sel + after + value.slice(e);
    setD((x) => ({ ...x, content: next }));
    setTimeout(() => { el.focus(); el.selectionStart = el.selectionEnd = (block ? ls + before.length + (s - ls) : s + before.length + sel.length + after.length); }, 0);
  };
  const flag = async (patch: Partial<Note>, msg?: string) => { const r = await run(() => api<{ note: Note }>(`/api/notes/${note.id}`, { method: "PATCH", body: patch }), msg); if (r) onChange(r.note); };
  const tools = [[Heading1, "Heading 1", () => wrap("# ", "", true)], [Heading2, "Heading 2", () => wrap("## ", "", true)], [Bold, "Bold", () => wrap("**", "**")], [List, "Bullet list", () => wrap("- ", "", true)], [ListOrdered, "Numbered list", () => wrap("1. ", "", true)], [ListChecks, "Checklist", () => wrap("- [ ] ", "", true)], [Link2, "Link", () => wrap("[", "](https://)")]] as const;

  return (
    <Card className="flex min-h-[560px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className="input flex-1 text-base font-semibold" placeholder="Untitled" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={200} aria-label="Note title" />
        <span className="flex w-24 items-center justify-end gap-1.5 text-xs text-faint" role="status" aria-live="polite">{state === "saving" ? <><Loader2 className="size-3.5 animate-spin" />Saving…</> : state === "saved" ? <><Check className="size-3.5 text-emerald-400" />Saved</> : state === "error" ? <button className="text-red-400 underline" onClick={() => save(d)}>Retry save</button> : "Unsaved…"}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto py-1.5 text-xs" value={d.type} onChange={(e) => setD({ ...d, type: e.target.value })} aria-label="Note type">{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <input className="input w-36 py-1.5 text-xs" placeholder="Collection" value={d.collection} onChange={(e) => setD({ ...d, collection: e.target.value })} maxLength={40} aria-label="Collection" />
        <input className="input min-w-32 flex-1 py-1.5 text-xs" placeholder="tags, comma, separated" value={d.tags} onChange={(e) => setD({ ...d, tags: e.target.value })} aria-label="Tags" />
        <Button size="icon" variant="ghost" aria-pressed={note.pinned} aria-label={note.pinned ? "Unpin" : "Pin"} onClick={() => flag({ pinned: !note.pinned })}><Pin className={cn("size-4", note.pinned && "fill-current text-accent")} /></Button>
        <Button size="icon" variant="ghost" aria-pressed={note.favorite} aria-label="Favorite" onClick={() => flag({ favorite: !note.favorite })}><Star className={cn("size-4", note.favorite && "fill-current text-amber-400")} /></Button>
        <Button size="icon" variant="ghost" aria-label={note.archived ? "Unarchive" : "Archive"} onClick={() => flag({ archived: !note.archived }, note.archived ? "Restored" : "Archived")}><Archive className="size-4" /></Button>
        <Button size="icon" variant="ghost" className="btn-danger" aria-label="Delete note" onClick={async () => { if (await confirm("Delete this note permanently?", "Delete") && (await run(() => api(`/api/notes/${note.id}`, { method: "DELETE" }), "Note deleted"))) onDeleted(); }}><Trash2 className="size-4" /></Button>
      </div>
      <div className="flex items-center gap-1 border-y border-line py-1.5">
        {tools.map(([I, label, fn]) => <Button key={label} size="icon" variant="ghost" aria-label={label} onClick={fn} disabled={preview} className="!p-1.5"><I className="size-4" /></Button>)}
        <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setPreview(!preview)} aria-pressed={preview}><Eye className="size-4" /> {preview ? "Edit" : "Preview"}</Button>
      </div>
      {preview ? <div className="md min-h-[320px] flex-1 overflow-y-auto" dangerouslySetInnerHTML={{ __html: renderMarkdown(d.content) || '<p class="text-faint">Nothing to preview yet.</p>' }} /> : <textarea ref={ta} className="input min-h-[320px] flex-1 resize-y font-[inherit] leading-relaxed" placeholder="Start writing… use the toolbar for headings, lists, checklists and links." value={d.content} onChange={(e) => setD({ ...d, content: e.target.value })} maxLength={100000} aria-label="Note content" />}
    </Card>
  );
}

function Journal() {
  const { run } = useUI();
  const { data, error, reload } = useFetch<{ entries: { date: string; mood: number | null; answers: Record<string, string> }[]; today: string }>("/api/journal");
  const [date, setDate] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [ans, setAns] = useState<Record<string, string>>({});
  const cur = date ?? data?.today ?? null;
  useEffect(() => { if (!data || !cur) return; const e = data.entries.find((x) => x.date === cur); setMood(e?.mood ?? null); setAns((e?.answers as Record<string, string>) ?? {}); }, [data, cur]);
  if (error && !data) return <ErrorState message={error} retry={reload} />;
  if (!data || !cur) return <ListSkeleton rows={3} />;
  return (
    <div className="grid gap-[var(--gap)] lg:grid-cols-[1fr_300px]">
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{fmtLong(cur)}</h2><p className="text-xs text-faint">Private to you. Every prompt is optional — skip any.</p></div><input type="date" className="input w-auto" value={cur} max={data.today} onChange={(e) => setDate(e.target.value)} aria-label="Journal date" /></div>
        <Field label="Mood"><div className="flex gap-2">{MOODS.map((m, i) => <button key={m} onClick={() => setMood(mood === i + 1 ? null : i + 1)} aria-pressed={mood === i + 1} aria-label={`Mood ${i + 1} of 5`} className={cn("grid size-11 place-items-center rounded-xl border text-xl transition-transform active:scale-90", mood === i + 1 ? "border-accent bg-accent/15" : "border-line")}>{m}</button>)}</div></Field>
        <div className="mt-4 space-y-4">{PROMPTS.map((p) => <Field key={p.key} label={p.q}><textarea className="input min-h-20" value={ans[p.key] ?? ""} onChange={(e) => setAns({ ...ans, [p.key]: e.target.value })} maxLength={3000} placeholder="Skip if you like" aria-label={p.q} /></Field>)}</div>
        <Button variant="primary" className="mt-5" onClick={async () => { const answers = Object.fromEntries(Object.entries(ans).filter(([, v]) => v.trim())); if (await run(() => api("/api/journal", { method: "PUT", body: { date: cur, mood, answers } }), "Journal saved")) reload(); }}>Save entry</Button>
      </Card>
      <Card><h3 className="mb-3 text-sm font-medium text-muted">Past entries</h3>{data.entries.length === 0 ? <p className="text-sm text-muted">No entries yet.</p> : <ul className="space-y-1">{data.entries.map((e) => <li key={e.date}><button onClick={() => setDate(e.date)} className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-card", e.date === cur && "bg-card")}><span>{fmtShort(e.date)}</span><span>{e.mood ? MOODS[e.mood - 1] : ""}</span></button></li>)}</ul>}</Card>
    </div>
  );
}

function Notes() {
  const { run } = useUI();
  const sp = useSearchParams();
  const { data, error, loading, reload, setData } = useFetch<{ notes: Note[] }>("/api/notes");
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [coll, setColl] = useState("all");
  const [show, setShow] = useState("active");
  const [sel, setSel] = useState<string | null>(null);
  const creating = useRef(false);
  const create = useCallback(async () => {
    const r = await run(() => api<{ note: Note }>("/api/notes", { body: { title: "", content: "", type: "quick" } }));
    if (r) { setData((d) => ({ notes: [r.note, ...(d?.notes ?? [])] })); setSel(r.note.id); setShow("active"); }
  }, [run, setData]);
  useEffect(() => { if (sp.get("new") === "1" && !creating.current) { creating.current = true; create(); } }, [sp, create]);
  const notes = data?.notes ?? [];
  const colls = useMemo(() => [...new Set(notes.map((n) => n.collection).filter(Boolean))], [notes]);
  const list = notes.filter((n) => (show === "archived" ? n.archived : show === "favorites" ? n.favorite && !n.archived : !n.archived)).filter((n) => (type === "all" || n.type === type) && (coll === "all" || n.collection === coll)).filter((n) => { const s = q.trim().toLowerCase(); return !s || n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s) || n.tags.some((t) => t.toLowerCase().includes(s)); });
  const cur = notes.find((n) => n.id === sel);
  const onChange = useCallback((n: Note) => setData((d) => d && { notes: d.notes.map((x) => (x.id === n.id ? n : x)) }), [setData]);
  return (
    <div className="grid gap-[var(--gap)] lg:grid-cols-[340px_1fr]">
      <div className="space-y-3">
        <div className="flex gap-2"><div className="relative flex-1"><Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-faint" /><input className="input ps-9" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" /></div><Button variant="primary" size="icon" onClick={create} aria-label="New note"><Plus className="size-4" /></Button></div>
        <div className="flex flex-wrap gap-2"><Segmented value={show} onChange={setShow} label="Filter" options={[{ value: "active", label: "All" }, { value: "favorites", label: "Favorites" }, { value: "archived", label: "Archived" }]} />
          <select className="input w-auto py-1.5 text-xs" value={type} onChange={(e) => setType(e.target.value)} aria-label="Type filter"><option value="all">All types</option>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          {colls.length > 0 && <select className="input w-auto py-1.5 text-xs" value={coll} onChange={(e) => setColl(e.target.value)} aria-label="Collection filter"><option value="all">All collections</option>{colls.map((c) => <option key={c}>{c}</option>)}</select>}</div>
        {error && !data ? <ErrorState message={error} retry={reload} /> : loading && !data ? <ListSkeleton /> : list.length === 0 ? <EmptyState icon={<BookMarked className="size-6" />} title={notes.length ? "No matching notes" : "Your vault is empty"} text="Capture ideas, things you learned, and reflections — all private." action={!notes.length && <Button variant="primary" onClick={create}>New note</Button>} /> : (
          <ul className="max-h-[70vh] space-y-2 overflow-y-auto pe-1">{list.map((n) => <li key={n.id}><button onClick={() => setSel(n.id)} className={cn("glass card-hover w-full p-3.5 text-start", sel === n.id && "!border-accent")} style={{ borderRadius: "var(--radius-sm)" }}><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-medium">{n.title || "Untitled"}</p><span className="flex shrink-0 gap-1">{n.pinned && <Pin className="size-3.5 fill-current text-accent" />}{n.favorite && <Star className="size-3.5 fill-current text-amber-400" />}</span></div><p className="mt-1 line-clamp-2 text-xs text-muted">{n.content.replace(/[#*\-\[\]]/g, "").slice(0, 120) || "Empty note"}</p><div className="mt-2 flex flex-wrap items-center gap-1.5"><Badge>{TYPES[n.type]}</Badge>{n.collection && <Badge tone="accent">{n.collection}</Badge>}{n.tags.slice(0, 2).map((t) => <Badge key={t}>#{t}</Badge>)}</div></button></li>)}</ul>
        )}
      </div>
      <div>{cur ? <Editor key={cur.id} note={cur} onChange={onChange} onDeleted={() => { setSel(null); reload(); }} /> : <div className="hidden min-h-[400px] lg:block"><EmptyState icon={<BookMarked className="size-6" />} title="Select or create a note" text="Autosaves as you type." /></div>}</div>
    </div>
  );
}

function Inner() {
  const [tab, setTab] = useState("notes");
  return (
    <>
      <PageHeader title="Memory Vault" subtitle="Your private library of notes, ideas and daily reflections." />
      <div className="mb-5"><Segmented value={tab} onChange={setTab} label="Vault sections" options={[{ value: "notes", label: "Notes" }, { value: "journal", label: "Daily Journal & Mood" }]} /></div>
      {tab === "notes" ? <Notes /> : <Journal />}
    </>
  );
}
export default function VaultPage() {
  return <Suspense><Inner /></Suspense>;
}
