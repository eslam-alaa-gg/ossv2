"use client";
import { Check, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer } from "recharts";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Checkbox, Field, PageHeader, Progress, Ring, Segmented, Switch, cn, useUI } from "@/components/ui";
import { ACCENT_PALETTE, DEFAULT_THEME, GRADIENT_PRESETS, PRESETS, TARGET_KEYS, chartColors, gradientCss, normalizeHex, type GradientCfg, type Theme, type TargetKey } from "@/lib/theme";

const TARGET_LABEL: Record<TargetKey, string> = { app: "App background", dashboard: "Dashboard hero", cards: "Cards (subtle tint)", buttons: "Primary buttons", accent: "Accent elements & logo text", progress: "Progress bars", charts: "Charts", nav: "Navigation highlight", profile: "Profile avatar ring" };
const FONTS = [["inter", "Inter (+ Cairo for Arabic)"], ["plex", "IBM Plex Sans (+ Arabic)"], ["cairo", "Cairo"], ["manrope", "Manrope"], ["serif", "Source Serif 4 (+ Naskh)"], ["system", "System UI"]] as const;

function Slider({ label, value, min = 0, max = 100, unit = "", onChange, hint }: { label: string; value: number; min?: number; max?: number; unit?: string; onChange: (n: number) => void; hint?: string }) {
  return <Field label={`${label} — ${value}${unit}`} hint={hint}><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} /></Field>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-4 py-2"><span className="text-sm">{label}{hint && <span className="block text-xs text-faint">{hint}</span>}</span>{children}</div>;
}

function Preview({ theme }: { theme: Theme }) {
  const cols = chartColors(theme);
  const data = [3, 5, 4, 7, 6, 9, 8].map((v, i) => ({ v, i }));
  return (
    <div className="space-y-3" aria-label="Live theme preview">
      <div className="glass-panel flex items-center gap-2 rounded-2xl p-2">
        <span className="nav-link nav-active flex-1 justify-center py-1.5 text-xs">Dashboard</span><span className="nav-link flex-1 justify-center py-1.5 text-xs">Tasks</span><span className="nav-link flex-1 justify-center py-1.5 text-xs">Focus</span>
      </div>
      <div className="glass card-pad dash-hero">
        <p className="text-xs text-muted">Good evening</p><p className="text-lg font-semibold">Welcome back, <span className="accent-grad">Alex</span></p>
        <div className="mt-3 flex items-center gap-4"><Ring value={68} size={72} stroke={7}><span className="text-sm font-semibold">68%</span></Ring><div className="flex-1 space-y-2"><Progress value={72} /><Progress value={35} /></div></div>
        <div className="mt-3 flex flex-wrap gap-2"><button className="glass-btn btn-primary btn-sm">Primary</button><button className="glass-btn btn-sm">Glass</button><button className="glass-btn btn-ghost btn-sm">Ghost</button></div>
      </div>
      <div className="glass flex items-center gap-3 p-3" style={{ borderRadius: "var(--radius-sm)" }}><Checkbox checked onChange={() => {}} label="sample" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Finalize roadmap</p><div className="mt-1 flex gap-1.5"><Badge tone="red">urgent</Badge><Badge>Work</Badge></div></div></div>
      <input className="input" placeholder="Input field" readOnly aria-label="Preview input" />
      <div className="glass card-pad"><div className="grid h-24 grid-cols-2 gap-3"><ResponsiveContainer><AreaChart data={data}><Area dataKey="v" stroke={cols[0]} fill={cols[0]} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer><ResponsiveContainer><BarChart data={data}><Bar dataKey="v" fill={cols[1] ?? cols[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
    </div>
  );
}

export default function ThemesPage() {
  const { theme, setDraft, hasDraft, savePrefs, prefs } = useApp();
  const { run, toast, confirm } = useUI();
  const [tab, setTab] = useState("presets");
  const [hex, setHex] = useState<string | null>(null);
  const [name, setName] = useState("");
  const set = (p: Partial<Theme>) => setDraft({ ...theme, ...p });
  const setG = (p: Partial<GradientCfg>) => set({ gradient: { ...theme.gradient, ...p }, gradientPreset: "custom" });
  const cur = PRESETS.find((p) => p.id === theme.preset);
  const g = theme.gradient;

  const applyPreset = (id: string) => { const p = PRESETS.find((x) => x.id === id)!; set({ preset: id, accent: p.accent, mode: p.light ? "light" : cur?.light && theme.mode === "light" ? "dark" : theme.mode }); setHex(null); };
  const stopPos = (i: number, patch: Partial<{ color: string; pos: number }>) => setG({ stops: g.stops.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  return (
    <>
      <PageHeader title="Theme Studio" subtitle="Changes preview live across the whole app. Press Apply to save them to your account." actions={<>
        <Button onClick={async () => { if (await confirm("Load the default theme? (You still need to press Apply to save it.)", "Load defaults")) { setDraft(DEFAULT_THEME); toast("info", "Defaults loaded — press Apply to save."); } }}><RotateCcw className="size-4" /> Reset Theme</Button>
        {hasDraft && <Button onClick={() => setDraft(null)}><X className="size-4" /> Discard</Button>}
        <Button variant="primary" disabled={!hasDraft} onClick={() => run(() => savePrefs({ theme }), "Theme applied and saved")}><Check className="size-4" /> Apply Theme</Button>
      </>} />
      {hasDraft && <p role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">Previewing unsaved changes.</p>}
      <div className="grid gap-[var(--gap)] lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <Segmented value={tab} onChange={setTab} label="Theme sections" options={[{ value: "presets", label: "Presets" }, { value: "color", label: "Color" }, { value: "glass", label: "Glass" }, { value: "background", label: "Background" }, { value: "gradients", label: "Gradients" }, { value: "interface", label: "Interface" }, { value: "saved", label: "My themes" }]} />

          {tab === "presets" && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">Appearance mode</h2>
              <Segmented value={theme.mode} onChange={(m) => set({ mode: m })} label="Appearance mode" options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System" }]} />
              <h2 className="mb-3 mt-6 text-sm font-medium text-muted">Theme presets</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PRESETS.map((p) => { const pal = theme.mode === "light" || (theme.mode === "system" && false) ? p.l : p.d; return (
                  <button key={p.id} onClick={() => applyPreset(p.id)} aria-pressed={theme.preset === p.id} className={cn("overflow-hidden rounded-2xl border text-start transition-all", theme.preset === p.id ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-[var(--border-strong)]")}>
                    <div className="relative h-16" style={{ background: `radial-gradient(80% 120% at 10% 0%, ${pal.g1}88, transparent 60%), radial-gradient(80% 120% at 100% 100%, ${pal.g2}77, transparent 60%), linear-gradient(160deg, ${pal.bg}, ${pal.bg2})` }}><span className="absolute bottom-2 end-2 size-4 rounded-full border border-white/40" style={{ background: p.accent }} /></div>
                    <p className="flex items-center justify-between px-3 py-2 text-xs font-medium">{p.name}{theme.preset === p.id && <Check className="size-3.5 text-accent" />}</p>
                  </button>); })}
              </div>
            </Card>
          )}

          {tab === "color" && (
            <Card className="space-y-5">
              <h2 className="text-sm font-medium text-muted">Accent color</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input type="color" value={theme.accent} onChange={(e) => { set({ accent: e.target.value }); setHex(null); }} aria-label="Accent color picker" />
                <input className="input w-32 font-mono" value={hex ?? theme.accent} onChange={(e) => { setHex(e.target.value); const n = normalizeHex(e.target.value); if (n) set({ accent: n }); }} onBlur={() => setHex(null)} aria-label="Accent HEX" aria-invalid={hex !== null && !normalizeHex(hex)} placeholder="#8b7cff" />
                {hex !== null && !normalizeHex(hex) && <span className="text-xs text-red-400">Enter a valid HEX color</span>}
              </div>
              <div className="flex flex-wrap gap-2">{ACCENT_PALETTE.map((c) => <button key={c} onClick={() => { set({ accent: c }); setHex(null); }} aria-label={`Accent ${c}`} aria-pressed={theme.accent === c} className={cn("size-9 rounded-full border-2 transition-transform hover:scale-110", theme.accent === c ? "border-fg" : "border-transparent")} style={{ background: c }} />)}</div>
              <p className="text-xs text-faint">The accent drives buttons, icons, active navigation, progress, charts, highlights and focus rings. Text on accent adapts automatically for contrast.</p>
            </Card>
          )}

          {tab === "glass" && (
            <Card className="grid gap-5 sm:grid-cols-2">
              <Slider label="Glass opacity" value={theme.glassOpacity} onChange={(v) => set({ glassOpacity: v })} hint="Panels: sidebar, header, dialogs" />
              <Slider label="Card transparency" value={theme.cardOpacity} onChange={(v) => set({ cardOpacity: v })} />
              <Slider label="Background blur" value={theme.blur} max={40} unit="px" onChange={(v) => set({ blur: v })} />
              <Slider label="Border transparency" value={theme.borderOpacity} onChange={(v) => set({ borderOpacity: v })} />
              <Slider label="Surface brightness" value={theme.brightness} min={50} max={150} unit="%" onChange={(v) => set({ brightness: v })} />
              <Slider label="Ambient glow" value={theme.glow} onChange={(v) => set({ glow: v })} />
            </Card>
          )}

          {tab === "background" && (
            <Card className="space-y-4">
              <Field label="Background style"><Segmented value={theme.background} onChange={(v) => set({ background: v })} label="Background" options={[{ value: "solid", label: "Solid" }, { value: "soft", label: "Soft gradient" }, { value: "ambient", label: "Ambient glow" }]} /></Field>
              <Row label="Film grain" hint="Very subtle texture"><Switch checked={theme.noise} onChange={(v) => set({ noise: v })} label="Film grain" /></Row>
              <Row label="Mouse-following light" hint="Desktop pointer only"><Switch checked={theme.mouseLight} onChange={(v) => set({ mouseLight: v })} label="Mouse light" /></Row>
              <p className="text-xs text-faint">Enable “App background” under Gradients to layer a custom gradient on top.</p>
            </Card>
          )}

          {tab === "gradients" && (
            <div className="space-y-4">
              <Card>
                <h2 className="mb-3 text-sm font-medium text-muted">Gradient presets</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {GRADIENT_PRESETS.map((p) => { const cfg: GradientCfg = { ...g, kind: p.kind, angle: p.angle, stops: p.stops }; return (
                    <button key={p.id} onClick={() => set({ gradientPreset: p.id, gradient: cfg })} aria-pressed={theme.gradientPreset === p.id} className={cn("overflow-hidden rounded-2xl border text-start", theme.gradientPreset === p.id ? "border-accent ring-2 ring-accent/40" : "border-line")}>
                      <div className="h-14" style={{ backgroundImage: gradientCss(cfg, 100), backgroundColor: "#0b0b10" }} /><p className="px-3 py-2 text-xs font-medium">{p.name}</p>
                    </button>); })}
                </div>
              </Card>
              <Card className="space-y-4">
                <div className="h-20 rounded-2xl border border-line" style={{ backgroundColor: "var(--bg)", backgroundImage: gradientCss(g, g.intensity), opacity: Math.max(0.25, g.opacity / 100) }} aria-label="Gradient preview" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Type"><select className="input" value={g.kind} onChange={(e) => setG({ kind: e.target.value as GradientCfg["kind"] })} aria-label="Gradient type"><option value="linear">Linear</option><option value="radial">Radial</option><option value="conic">Conic</option><option value="mesh">Mesh (multi-point soft)</option></select></Field>
                  <Slider label={g.kind === "radial" ? "Direction (focal point)" : "Angle"} value={g.angle} max={360} unit="°" onChange={(v) => setG({ angle: v })} />
                  <Slider label="Intensity" value={g.intensity} onChange={(v) => setG({ intensity: v })} hint="Color strength" />
                  <Slider label="Opacity" value={g.opacity} onChange={(v) => setG({ opacity: v })} hint="Background layer" />
                  <Field label="Background blending"><select className="input" value={g.blend} onChange={(e) => setG({ blend: e.target.value as GradientCfg["blend"] })} aria-label="Blend mode">{["normal", "overlay", "soft-light", "screen", "lighten"].map((b) => <option key={b}>{b}</option>)}</select></Field>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">Color stops</p>
                  <ul className="space-y-2">{g.stops.map((s, i) => <li key={i} className="flex items-center gap-3"><input type="color" value={s.color} onChange={(e) => stopPos(i, { color: e.target.value })} aria-label={`Stop ${i + 1} color`} /><input type="range" min={0} max={100} value={s.pos} onChange={(e) => stopPos(i, { pos: Number(e.target.value) })} aria-label={`Stop ${i + 1} position`} /><span className="w-10 text-xs tabular-nums text-faint">{s.pos}%</span><Button variant="ghost" size="icon" disabled={g.stops.length <= 2} aria-label="Remove stop" onClick={() => setG({ stops: g.stops.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></Button></li>)}</ul>
                  <Button size="sm" className="mt-2" disabled={g.stops.length >= 6} onClick={() => setG({ stops: [...g.stops, { color: "#4b5bd1", pos: 100 }] })}><Plus className="size-4" /> Add stop</Button>
                </div>
              </Card>
              <Card className="space-y-3">
                <h2 className="text-sm font-medium text-muted">Apply gradient to</h2>
                <p className="text-xs text-faint">Off by default so hierarchy and readability stay intact. Enable only what you like.</p>
                <div className="grid gap-x-8 sm:grid-cols-2">{TARGET_KEYS.map((k) => <Row key={k} label={TARGET_LABEL[k]}><Switch checked={theme.targets[k]} onChange={(v) => set({ targets: { ...theme.targets, [k]: v } })} label={TARGET_LABEL[k]} /></Row>)}</div>
              </Card>
              <Card className="space-y-4">
                <Row label="Animated gradient" hint="Slow, subtle drift. Disabled automatically with reduced motion."><Switch checked={g.animated} onChange={(v) => setG({ animated: v })} label="Animated gradient" /></Row>
                {g.animated && <div className="grid gap-4 sm:grid-cols-2"><Slider label="Animation speed" value={g.animSpeed} min={1} onChange={(v) => setG({ animSpeed: v })} /><Slider label="Animation intensity" value={g.animIntensity} min={1} onChange={(v) => setG({ animIntensity: v })} /><Field label="Direction"><select className="input" value={g.animDirection} onChange={(e) => setG({ animDirection: e.target.value as GradientCfg["animDirection"] })} aria-label="Animation direction"><option value="normal">Forward</option><option value="reverse">Reverse</option><option value="alternate">Alternate</option></select></Field></div>}
                {g.animated && !theme.targets.app && <p className="text-xs text-amber-300">Animation shows on the app background — enable “App background” above.</p>}
              </Card>
            </div>
          )}

          {tab === "interface" && (
            <Card className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Slider label="Animation intensity" value={theme.animation} onChange={(v) => set({ animation: v })} hint="0 turns motion off" />
                <Slider label="Transition speed" value={theme.speed} min={50} max={200} unit="%" onChange={(v) => set({ speed: v })} />
                <Slider label="Rounded corners" value={theme.radius} min={6} max={32} unit="px" onChange={(v) => set({ radius: v })} />
                <Field label="Interface density"><Segmented value={theme.density} onChange={(v) => set({ density: v })} label="Density" options={[{ value: "compact", label: "Compact" }, { value: "comfortable", label: "Comfortable" }, { value: "spacious", label: "Spacious" }]} /></Field>
                <Field label="Font" className="sm:col-span-2"><select className="input" value={theme.font} onChange={(e) => set({ font: e.target.value as Theme["font"] })} aria-label="Font">{FONTS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
              </div>
              <Row label="Reduced motion" hint="Stops animated gradients, pointer light and transitions"><Switch checked={theme.reducedMotion} onChange={(v) => set({ reducedMotion: v })} label="Reduced motion" /></Row>
              <p className="text-xs text-faint">Your operating system's reduced-motion setting is always respected, too. Every font option includes an Arabic-capable family.</p>
            </Card>
          )}

          {tab === "saved" && (
            <Card className="space-y-4">
              <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; if (await run(() => savePrefs({ customThemes: [...prefs.customThemes, { id: crypto.randomUUID(), name: name.trim(), theme }] }), "Custom theme saved")) setName(""); }}>
                <input className="input" placeholder="Name this theme…" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Custom theme name" />
                <Button type="submit" variant="primary" disabled={!name.trim() || prefs.customThemes.length >= 20}><Save className="size-4" /> Save Custom Theme</Button>
              </form>
              {prefs.customThemes.length === 0 ? <p className="text-sm text-muted">No saved themes yet. Tweak the current look, name it, and save it here.</p> : <ul className="space-y-2">{prefs.customThemes.map((c) => <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5"><span className="size-5 rounded-full" style={{ background: c.theme.accent }} /><span className="flex-1 truncate text-sm">{c.name}</span><Button size="sm" onClick={() => setDraft(c.theme)}>Preview</Button><Button variant="ghost" size="icon" aria-label={`Delete ${c.name}`} onClick={() => run(() => savePrefs({ customThemes: prefs.customThemes.filter((x) => x.id !== c.id) }), "Deleted")}><Trash2 className="size-4" /></Button></li>)}</ul>}
            </Card>
          )}
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 text-sm font-medium text-muted">Live preview</h2>
          <Preview theme={theme} />
          <div className="mt-4 flex gap-2"><Button variant="primary" className="flex-1" disabled={!hasDraft} onClick={() => run(() => savePrefs({ theme }), "Theme applied and saved")}>Apply Theme</Button></div>
        </div>
      </div>
    </>
  );
}
