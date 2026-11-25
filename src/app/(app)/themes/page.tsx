"use client";
import { Check, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer } from "recharts";
import { useApp } from "@/components/providers";
import { Badge, Button, Card, Checkbox, Field, PageHeader, Progress, Ring, Segmented, Switch, cn, useUI } from "@/components/ui";
import { ACCENT_PALETTE, DEFAULT_THEME, GRADIENT_PRESETS, PRESETS, TARGET_KEYS, chartColors, gradientCss, normalizeHex, type GradientCfg, type Theme, type TargetKey } from "@/lib/theme";

const TARGET_LABEL: Record<TargetKey, string> = { app: "App background", dashboard: "Dashboard hero", cards: "Cards (subtle tint)", buttons: "Primary buttons", accent: "Accent elements & logo text", progress: "Progress bars", charts: "Charts", nav: "Navigation highlight", profile: "Profile avatar ring" };
const FONTS = [["sniglet", "Sniglet"], ["inter", "Inter — LIFE OS"], ["kavoon", "Kavoon"], ["merienda", "Merienda"], ["shantell", "Shantell Sans"], ["plex", "IBM Plex Sans"], ["cairo", "Cairo"], ["manrope", "Manrope"], ["serif", "Source Serif 4"], ["system", "System UI"]] as const;
const FONT_CSS: Record<string, string> = { sniglet: "'Sniglet',cursive", inter: "'Inter',sans-serif", kavoon: "'Kavoon',serif", merienda: "'Merienda',cursive", shantell: "'Shantell Sans',cursive", plex: "'IBM Plex Sans',sans-serif", cairo: "'Cairo',sans-serif", manrope: "'Manrope',sans-serif", serif: "'Source Serif 4',serif", system: "system-ui,sans-serif" };

function Slider({ label, value, min = 0, max = 100, unit = "", onChange, hint }: { label: string; value: number; min?: number; max?: number; unit?: string; onChange: (n: number) => void; hint?: string }) {
  const { t } = useApp();
  return <Field label={`${t(label)} — ${value}${unit}`} hint={hint ? t(hint) : undefined}><input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={t(label)} /></Field>;
}
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { t } = useApp();
  return <div className="flex items-center justify-between gap-4 py-2"><span className="text-sm">{t(label)}{hint && <span className="block text-xs text-faint">{t(hint)}</span>}</span>{children}</div>;
}

function Preview({ theme }: { theme: Theme }) {
  const { t, lang } = useApp();
  const cols = chartColors(theme);
  const data = [3, 5, 4, 7, 6, 9, 8].map((v, i) => ({ v, i }));
  return (
    <div className="space-y-3" aria-label={t("Live theme preview")}>
      <div className="glass-panel flex items-center gap-2 rounded-2xl p-2">
        <span className="nav-link nav-active flex-1 justify-center py-1.5 text-xs">{t("Dashboard")}</span><span className="nav-link flex-1 justify-center py-1.5 text-xs">{t("Tasks")}</span><span className="nav-link flex-1 justify-center py-1.5 text-xs">{t("Focus")}</span>
      </div>
      <div className="glass card-pad dash-hero">
        <p className="text-xs text-muted">{t("Good evening")}</p><p className="text-lg font-semibold">{t("Welcome back")}</p>
        <div className="mt-3 flex items-center gap-4"><Ring value={68} size={72} stroke={7}><span className="text-sm font-semibold">68%</span></Ring><div className="flex-1 space-y-2"><Progress value={72} /><Progress value={35} /></div></div>
        <div className="mt-3 flex flex-wrap gap-2"><button className="glass-btn btn-primary btn-sm">{t("Primary")}</button><button className="glass-btn btn-sm">{t("Glass")}</button><button className="glass-btn btn-ghost btn-sm">{t("Ghost")}</button></div>
      </div>
      <div className="glass flex items-center gap-3 p-3" style={{ borderRadius: "var(--radius-sm)" }}><Checkbox checked onChange={() => {}} label={t("sample")} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{t("Example task")}</p><div className="mt-1 flex gap-1.5"><Badge tone="red">urgent</Badge><Badge>Work</Badge></div></div></div>
      <input className="input" placeholder={t("Input field")} readOnly aria-label={t("Preview input")} />
      <div className="glass card-pad"><div className="grid h-24 grid-cols-2 gap-3"><ResponsiveContainer><AreaChart data={data}><Area dataKey="v" stroke={cols[0]} fill={cols[0]} fillOpacity={0.25} strokeWidth={2} isAnimationActive={false} /></AreaChart></ResponsiveContainer><ResponsiveContainer><BarChart data={data}><Bar dataKey="v" fill={cols[1] ?? cols[0]} radius={[4, 4, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></div>
    </div>
  );
}

export default function ThemesPage() {
  const { theme, setDraft, hasDraft, savePrefs, prefs, t } = useApp();
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
      <PageHeader title={t("Theme Studio")} subtitle={t("Changes preview live across the whole app. Press Apply to save them to your account.")} actions={<>
        <Button onClick={async () => { if (await confirm(t("Load the default theme? (You still need to press Apply to save it.)"), t("Load defaults"))) { setDraft(DEFAULT_THEME); toast("info", t("Defaults loaded — press Apply to save.")); } }}><RotateCcw className="size-4" /> {t("Reset Theme")}</Button>
        {hasDraft && <Button onClick={() => setDraft(null)}><X className="size-4" /> {t("Discard")}</Button>}
        <Button variant="primary" disabled={!hasDraft} onClick={() => run(() => savePrefs({ theme }), "Theme applied and saved")}><Check className="size-4" /> {t("Apply Theme")}</Button>
      </>} />
      {hasDraft && <p role="status" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">{t("Previewing unsaved changes.")}</p>}
      <div className="grid gap-[var(--gap)] lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-4">
          <Segmented value={tab} onChange={setTab} label={t("Theme sections")} options={[{ value: "presets", label: t("Presets") }, { value: "color", label: t("Color") }, { value: "glass", label: t("Glass") }, { value: "background", label: t("Background") }, { value: "gradients", label: t("Gradients") }, { value: "fonts", label: t("Fonts") }, { value: "interface", label: t("Interface") }, { value: "saved", label: t("My themes") }]} />

          {tab === "presets" && (
            <Card>
              <h2 className="mb-3 text-sm font-medium text-muted">{t("Appearance mode")}</h2>
              <Segmented value={theme.mode} onChange={(m) => set({ mode: m })} label={t("Appearance mode")} options={[{ value: "dark", label: t("Dark") }, { value: "light", label: t("Light") }, { value: "system", label: t("System") }]} />
              <h2 className="mb-3 mt-6 text-sm font-medium text-muted">{t("Theme presets")}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {PRESETS.map((p) => { const pal = theme.mode === "light" || (theme.mode === "system" && false) ? p.l : p.d; return (
                  <button key={p.id} onClick={() => applyPreset(p.id)} aria-pressed={theme.preset === p.id} className={cn("overflow-hidden rounded-2xl border text-start transition-all", theme.preset === p.id ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-[var(--border-strong)]")}>
                    <div className="relative h-16" style={{ background: `radial-gradient(80% 120% at 10% 0%, ${pal.g1}88, transparent 60%), radial-gradient(80% 120% at 100% 100%, ${pal.g2}77, transparent 60%), linear-gradient(160deg, ${pal.bg}, ${pal.bg2})` }}><span className="absolute bottom-2 end-2 size-4 rounded-full border border-white/40" style={{ background: p.accent }} /></div>
                    <p className="flex items-center justify-between px-3 py-2 text-xs font-medium">{t(p.name)}{theme.preset === p.id && <Check className="size-3.5 text-accent" />}</p>
                  </button>); })}
              </div>
            </Card>
          )}

          {tab === "color" && (
            <Card className="space-y-5">
              <h2 className="text-sm font-medium text-muted">{t("Accent color")}</h2>
              <div className="flex flex-wrap items-center gap-3">
                <input type="color" value={theme.accent} onChange={(e) => { set({ accent: e.target.value }); setHex(null); }} aria-label={t("Accent color picker")} />
                <input className="input w-32 font-mono" value={hex ?? theme.accent} onChange={(e) => { setHex(e.target.value); const n = normalizeHex(e.target.value); if (n) set({ accent: n }); }} onBlur={() => setHex(null)} aria-label={t("Accent HEX")} aria-invalid={hex !== null && !normalizeHex(hex)} placeholder="#8b7cff" />
                {hex !== null && !normalizeHex(hex) && <span className="text-xs text-red-400">{t("Enter a valid HEX color")}</span>}
              </div>
              <div className="flex flex-wrap gap-2">{ACCENT_PALETTE.map((c) => <button key={c} onClick={() => { set({ accent: c }); setHex(null); }} aria-label={`${t("Accent")} ${c}`} aria-pressed={theme.accent === c} className={cn("size-9 rounded-full border-2 transition-transform hover:scale-110", theme.accent === c ? "border-fg" : "border-transparent")} style={{ background: c }} />)}</div>
              <p className="text-xs text-faint">{t("The accent drives buttons, icons, active navigation, progress, charts, highlights and focus rings. Text on accent adapts automatically for contrast.")}</p>
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
              <Field label={t("Background style")}><Segmented value={theme.background} onChange={(v) => set({ background: v })} label={t("Background")} options={[{ value: "solid", label: t("Solid") }, { value: "soft", label: t("Soft gradient") }, { value: "ambient", label: t("Ambient glow") }]} /></Field>
              <Row label={t("Film grain")} hint="Very subtle texture"><Switch checked={theme.noise} onChange={(v) => set({ noise: v })} label="Film grain" /></Row>
              <Row label="Mouse-following light" hint="Desktop pointer only"><Switch checked={theme.mouseLight} onChange={(v) => set({ mouseLight: v })} label={t("Mouse light")} /></Row>
              <p className="text-xs text-faint">Enable “App background” under Gradients to layer a custom gradient on top.</p>
            </Card>
          )}

          {tab === "gradients" && (
            <div className="space-y-4">
              <Card>
                <h2 className="mb-3 text-sm font-medium text-muted">{t("Gradient presets")}</h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {GRADIENT_PRESETS.map((p) => { const cfg: GradientCfg = { ...g, kind: p.kind, angle: p.angle, stops: p.stops }; return (
                    <button key={p.id} onClick={() => set({ gradientPreset: p.id, gradient: cfg })} aria-pressed={theme.gradientPreset === p.id} className={cn("overflow-hidden rounded-2xl border text-start", theme.gradientPreset === p.id ? "border-accent ring-2 ring-accent/40" : "border-line")}>
                      <div className="h-14" style={{ backgroundImage: gradientCss(cfg, 100), backgroundColor: "#0b0b10" }} /><p className="px-3 py-2 text-xs font-medium">{t(p.name)}</p>
                    </button>); })}
                </div>
              </Card>
              <Card className="space-y-4">
                <div className="h-20 rounded-2xl border border-line" style={{ backgroundColor: "var(--bg)", backgroundImage: gradientCss(g, g.intensity), opacity: Math.max(0.25, g.opacity / 100) }} aria-label={t("Gradient preview")} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Type")}><select className="input" value={g.kind} onChange={(e) => setG({ kind: e.target.value as GradientCfg["kind"] })} aria-label={t("Gradient type")}><option value="linear">{t("Linear")}</option><option value="radial">{t("Radial")}</option><option value="conic">{t("Conic")}</option><option value="mesh">{t("Mesh (multi-point soft)")}</option></select></Field>
                  <Slider label={t(g.kind === "radial" ? "Direction (focal point)" : "Angle")} value={g.angle} max={360} unit="°" onChange={(v) => setG({ angle: v })} />
                  <Slider label="Intensity" value={g.intensity} onChange={(v) => setG({ intensity: v })} hint="Color strength" />
                  <Slider label="Opacity" value={g.opacity} onChange={(v) => setG({ opacity: v })} hint="Background layer" />
                  <Field label={t("Background blending")}><select className="input" value={g.blend} onChange={(e) => setG({ blend: e.target.value as GradientCfg["blend"] })} aria-label={t("Blend mode")}>{["normal", "overlay", "soft-light", "screen", "lighten"].map((b) => <option key={b} value={b}>{t(b)}</option>)}</select></Field>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-muted">{t("Color stops")}</p>
                  <ul className="space-y-2">{g.stops.map((s, i) => <li key={i} className="flex items-center gap-3"><input type="color" value={s.color} onChange={(e) => stopPos(i, { color: e.target.value })} aria-label={t("Stop {n} color").replace("{n}", String(i + 1))} /><input type="range" min={0} max={100} value={s.pos} onChange={(e) => stopPos(i, { pos: Number(e.target.value) })} aria-label={t("Stop {n} position").replace("{n}", String(i + 1))} /><span className="w-10 text-xs tabular-nums text-faint">{s.pos}%</span><Button variant="ghost" size="icon" disabled={g.stops.length <= 2} aria-label={t("Remove stop")} onClick={() => setG({ stops: g.stops.filter((_, j) => j !== i) })}><Trash2 className="size-3.5" /></Button></li>)}</ul>
                  <Button size="sm" className="mt-2" disabled={g.stops.length >= 6} onClick={() => setG({ stops: [...g.stops, { color: "#4b5bd1", pos: 100 }] })}><Plus className="size-4" /> {t("Add stop")}</Button>
                </div>
              </Card>
              <Card className="space-y-3">
                <h2 className="text-sm font-medium text-muted">{t("Apply gradient to")}</h2>
                <p className="text-xs text-faint">{t("Off by default so hierarchy and readability stay intact. Enable only what you like.")}</p>
                <div className="grid gap-x-8 sm:grid-cols-2">{TARGET_KEYS.map((k) => <Row key={k} label={t(TARGET_LABEL[k])}><Switch checked={theme.targets[k]} onChange={(v) => set({ targets: { ...theme.targets, [k]: v } })} label={t(TARGET_LABEL[k])} /></Row>)}</div>
              </Card>
              <Card className="space-y-4">
                <Row label={t("Animated gradient")} hint="Slow, subtle drift. Disabled automatically with reduced motion."><Switch checked={g.animated} onChange={(v) => setG({ animated: v })} label="Animated gradient" /></Row>
                {g.animated && <div className="grid gap-4 sm:grid-cols-2"><Slider label="Animation speed" value={g.animSpeed} min={1} onChange={(v) => setG({ animSpeed: v })} /><Slider label="Animation intensity" value={g.animIntensity} min={1} onChange={(v) => setG({ animIntensity: v })} /><Field label={t("Direction")}><select className="input" value={g.animDirection} onChange={(e) => setG({ animDirection: e.target.value as GradientCfg["animDirection"] })} aria-label="Animation direction"><option value="normal">{t("Forward")}</option><option value="reverse">{t("Reverse")}</option><option value="alternate">{t("Alternate")}</option></select></Field></div>}
                {g.animated && !theme.targets.app && <p className="text-xs text-amber-300">{t("Animation shows on the app background — enable “App background” above.")}</p>}
              </Card>
            </div>
          )}

          {tab === "fonts" && (
            <Card className="space-y-4">
              <div><h2 className="text-base font-semibold">{t("Fonts")}</h2><p className="mt-1 text-sm text-muted">{t("Choose the font that feels right. Arabic uses Playpen Sans Arabic automatically for clear shaping and spacing.")}</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {FONTS.map(([key, label]) => <button key={key} type="button" onClick={() => set({ font: key as Theme["font"] })} aria-pressed={theme.font === key} className={cn("rounded-2xl border p-4 text-start transition-all", theme.font === key ? "border-accent bg-accent/10" : "border-line bg-card hover:bg-card-hover")}>
                  <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{label}</span>{theme.font === key && <Check className="size-4 text-accent" />}</span>
                  <span className="mt-3 block text-xl leading-relaxed" style={{ fontFamily: FONT_CSS[key] }}>{lang === "ar" ? "نص عربي تجريبي · ٠١٢٣٤٥" : "The quick brown fox · 012345"}</span>
                  <span className="mt-1 block text-xs text-muted">{lang === "ar" ? "أب · LIFE OS" : "Aa · LIFE OS"}</span>
                </button>)}
              </div>
              <div className="rounded-xl border border-line bg-card p-4"><p className="text-sm font-medium">{t("Arabic font · Playpen Sans Arabic")}</p><p className="mt-2 text-lg leading-loose" style={{ fontFamily: "'Playpen Sans Arabic','Cairo',sans-serif" }}>أهلاً بيك في LIFE OS — رتّب يومك وحقق أهدافك</p><p className="mt-2 text-xs text-muted">{t("Arabic font applies automatically when Arabic is selected, independently from the English font.")}</p></div>
            </Card>
          )}

          {tab === "interface" && (
            <Card className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Slider label="Animation intensity" value={theme.animation} onChange={(v) => set({ animation: v })} hint="0 turns motion off" />
                <Slider label="Transition speed" value={theme.speed} min={50} max={200} unit="%" onChange={(v) => set({ speed: v })} />
                <Slider label="Rounded corners" value={theme.radius} min={6} max={32} unit="px" onChange={(v) => set({ radius: v })} />
                <Field label={t("Interface density")}><Segmented value={theme.density} onChange={(v) => set({ density: v })} label={t("Density")} options={[{ value: "compact", label: t("Compact") }, { value: "comfortable", label: t("Comfortable") }, { value: "spacious", label: t("Spacious") }]} /></Field>
                <Field label={t("Font selection")}><p className="text-sm text-muted">{t("Manage typefaces in the dedicated Fonts section.")}</p></Field>
              </div>
              <Row label="Reduced motion" hint="Stops animated gradients, pointer light and transitions"><Switch checked={theme.reducedMotion} onChange={(v) => set({ reducedMotion: v })} label="Reduced motion" /></Row>
              <p className="text-xs text-faint">{t("Your operating system's reduced-motion setting is always respected, too. Arabic uses Playpen Sans Arabic automatically. English uses the selected font.")}</p>
            </Card>
          )}

          {tab === "saved" && (
            <Card className="space-y-4">
              <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name.trim()) return; if (await run(() => savePrefs({ customThemes: [...prefs.customThemes, { id: crypto.randomUUID(), name: name.trim(), theme }] }), "Custom theme saved")) setName(""); }}>
                <input className="input" placeholder={t("Name this theme…")} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label={t("Custom theme name")} />
                <Button type="submit" variant="primary" disabled={!name.trim() || prefs.customThemes.length >= 20}><Save className="size-4" /> {t("Save Custom Theme")}</Button>
              </form>
              {prefs.customThemes.length === 0 ? <p className="text-sm text-muted">{t("No saved themes yet. Tweak the current look, name it, and save it here.")}</p> : <ul className="space-y-2">{prefs.customThemes.map((c) => <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2.5"><span className="size-5 rounded-full" style={{ background: c.theme.accent }} /><span className="flex-1 truncate text-sm">{c.name}</span><Button size="sm" onClick={() => setDraft(c.theme)}>{t("Preview")}</Button><Button variant="ghost" size="icon" aria-label={t("Delete {title}").replace("{title}", c.name)} onClick={() => run(() => savePrefs({ customThemes: prefs.customThemes.filter((x) => x.id !== c.id) }), t("Deleted"))}><Trash2 className="size-4" /></Button></li>)}</ul>}
            </Card>
          )}
        </div>
        <div className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3 text-sm font-medium text-muted">{t("Live preview")}</h2>
          <Preview theme={theme} />
          <div className="mt-4 flex gap-2"><Button variant="primary" className="flex-1" disabled={!hasDraft} onClick={() => run(() => savePrefs({ theme }), "Theme applied and saved")}>{t("Apply Theme")}</Button></div>
        </div>
      </div>
    </>
  );
}
