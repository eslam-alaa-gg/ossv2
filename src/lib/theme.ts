export type TargetKey = "app" | "dashboard" | "cards" | "buttons" | "accent" | "progress" | "charts" | "nav" | "profile";
export type GradientCfg = {
  kind: "linear" | "radial" | "conic" | "mesh";
  angle: number;
  stops: { color: string; pos: number }[];
  intensity: number;
  opacity: number;
  blend: "normal" | "overlay" | "soft-light" | "screen" | "lighten";
  animated: boolean;
  animSpeed: number;
  animIntensity: number;
  animDirection: "normal" | "reverse" | "alternate";
};
export type Theme = {
  preset: string;
  mode: "dark" | "light" | "system";
  accent: string;
  glassOpacity: number;
  blur: number;
  borderOpacity: number;
  brightness: number;
  glow: number;
  cardOpacity: number;
  background: "solid" | "soft" | "ambient";
  noise: boolean;
  mouseLight: boolean;
  radius: number;
  density: "compact" | "comfortable" | "spacious";
  font: "inter" | "plex" | "cairo" | "manrope" | "serif" | "system";
  animation: number;
  speed: number;
  reducedMotion: boolean;
  gradientPreset: string;
  gradient: GradientCfg;
  targets: Record<TargetKey, boolean>;
};

type Palette = { bg: string; bg2: string; g1: string; g2: string };
type Preset = { id: string; name: string; accent: string; l: Palette; d: Palette };
const palette = (bg: string, bg2: string, g1: string, g2: string): Palette => ({ bg, bg2, g1, g2 });

export const PRESETS: Preset[] = [
  { id: "midnight", name: "Midnight", accent: "#8b7cff", d: palette("#08080b", "#11111a", "#6d5dfc", "#2f6bff"), l: palette("#f5f5fb", "#e9eaf5", "#9589ff", "#78a2ff") },
  { id: "ocean", name: "Ocean", accent: "#45b8d8", d: palette("#061116", "#0b2029", "#087e9c", "#315bba"), l: palette("#f0fbff", "#e1f3f8", "#58bdd2", "#7199db") },
  { id: "forest", name: "Forest", accent: "#55c58a", d: palette("#08120e", "#102019", "#1c8b62", "#4e8b56"), l: palette("#f2fbf5", "#e3f3e8", "#72c69a", "#8ebc7d") },
  { id: "sunset", name: "Sunset", accent: "#f09a72", d: palette("#160d12", "#24131b", "#c45b72", "#d88b4d"), l: palette("#fff7f3", "#f8e9e3", "#e99a9f", "#efb16f") },
  { id: "rose", name: "Rose", accent: "#e88ab7", d: palette("#150d15", "#211421", "#a94b91", "#684db0"), l: palette("#fff5fb", "#f5e8f3", "#d58abb", "#a89ae0") },
  { id: "mono", name: "Monochrome", accent: "#b4b8c4", d: palette("#0a0b0e", "#17191f", "#555b6b", "#858b98"), l: palette("#f6f7f9", "#e9ebef", "#9da4b1", "#737b8a") },
];

export const ACCENT_PALETTE = [
  "#8b7cff", "#45b8d8", "#55c58a", "#f09a72", "#e88ab7", "#e5b84b", "#6f9cff", "#b18cff", "#e16f78", "#b4b8c4",
];

export const TARGET_KEYS: TargetKey[] = ["app", "dashboard", "cards", "buttons", "accent", "progress", "charts", "nav", "profile"];

type GradientPreset = { id: string; name: string } & Pick<GradientCfg, "kind" | "angle" | "stops">;

export const GRADIENT_PRESETS: GradientPreset[] = [
  Object.assign({ id: "aurora", name: "Aurora" }, { kind: "linear" as const, angle: 135, stops: [{ color: "#6757e8", pos: 0 }, { color: "#2679a8", pos: 52 }, { color: "#38a77b", pos: 100 }] }),
  Object.assign({ id: "violet", name: "Violet haze" }, { kind: "radial" as const, angle: 45, stops: [{ color: "#8b5cf6", pos: 0 }, { color: "#312e81", pos: 100 }] }),
  Object.assign({ id: "ember", name: "Ember" }, { kind: "linear" as const, angle: 35, stops: [{ color: "#d97757", pos: 0 }, { color: "#9f426a", pos: 55 }, { color: "#39245f", pos: 100 }] }),
  Object.assign({ id: "glacier", name: "Glacier" }, { kind: "linear" as const, angle: 145, stops: [{ color: "#4ba6c8", pos: 0 }, { color: "#5367b8", pos: 100 }] }),
  Object.assign({ id: "meadow", name: "Meadow" }, { kind: "mesh" as const, angle: 120, stops: [{ color: "#2f9e78", pos: 0 }, { color: "#5179bb", pos: 50 }, { color: "#a2a34e", pos: 100 }] }),
];

const baseGradient: GradientCfg = {
  kind: "linear", angle: 135,
  stops: [{ color: "#6757e8", pos: 0 }, { color: "#2679a8", pos: 52 }, { color: "#38a77b", pos: 100 }],
  intensity: 35, opacity: 32, blend: "soft-light", animated: true, animSpeed: 35, animIntensity: 35, animDirection: "alternate",
};

export const DEFAULT_THEME: Theme = {
  preset: "midnight", mode: "dark", accent: "#8b7cff", glassOpacity: 7, blur: 22, borderOpacity: 11,
  brightness: 100, glow: 15, cardOpacity: 7, background: "ambient", noise: true, mouseLight: true,
  radius: 20, density: "comfortable", font: "inter", animation: 75, speed: 100, reducedMotion: false,
  gradientPreset: "aurora", gradient: baseGradient,
  targets: { app: false, dashboard: false, cards: false, buttons: false, accent: false, progress: false, charts: false, nav: false, profile: false },
};

export function normalizeHex(value: string): string | null {
  const s = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(s)) return "#" + s.slice(1).split("").map((c) => c + c).join("").toLowerCase();
  return null;
}

function rgba(hex: string, alpha: number): string {
  const h = normalizeHex(hex) ?? "#8b7cff";
  const n = Number.parseInt(h.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, alpha))})`;
}

export function gradientCss(g: GradientCfg, intensity = g.intensity): string {
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${normalizeHex(s.color) ?? "#8b7cff"} ${s.pos}%`).join(", ");
  const strength = Math.max(0, Math.min(100, intensity)) / 100;
  if (g.kind === "radial") return `radial-gradient(ellipse at ${g.angle % 100}% ${Math.round(g.angle / 360 * 100)}%, ${stops})`;
  if (g.kind === "conic") return `conic-gradient(from ${g.angle}deg, ${stops})`;
  if (g.kind === "mesh") {
    const colors = g.stops.slice(0, 4);
    return colors.map((s, i) => `radial-gradient(55% 65% at ${15 + i * 24}% ${20 + (i % 2) * 55}%, ${rgba(s.color, strength)}, transparent 75%)`).join(", ");
  }
  return `linear-gradient(${g.angle}deg, ${stops})`;
}

function rgb(hex: string): [number, number, number] {
  const h = normalizeHex(hex) ?? "#8b7cff";
  const n = Number.parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function contrastText(hex: string): string {
  const [r, g, b] = rgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? "#101018" : "#ffffff";
}

export function chartColors(theme: Theme): string[] {
  const [r, g, b] = rgb(theme.accent);
  return [theme.accent, `#${[r, g, b].map((v) => Math.min(255, Math.round(v * 0.62 + 255 * 0.38)).toString(16).padStart(2, "0")).join("")}`, "#42b99a", "#e6a85c", "#7b9ce8"];
}

export function themeCss(theme: Theme): string {
  const preset = PRESETS.find((p) => p.id === theme.preset) ?? PRESETS[0];
  const dark = preset.d;
  const light = preset.l;
  const accent = normalizeHex(theme.accent) ?? DEFAULT_THEME.accent;
  const alpha = (n: number) => Math.max(0, Math.min(100, n)) / 100;
  const font = ({ inter: '"Inter", "Cairo", ui-sans-serif, system-ui, sans-serif', plex: '"IBM Plex Sans", "IBM Plex Sans Arabic", sans-serif', cairo: '"Cairo", "IBM Plex Sans Arabic", sans-serif', manrope: '"Manrope", "Cairo", sans-serif', serif: '"Source Serif 4", "Noto Naskh Arabic", serif', system: 'ui-sans-serif, system-ui, sans-serif' } as const)[theme.font];
  const vars = (p: Palette) => `
    --bg:${p.bg};--bg2:${p.bg2};--g1:${p.g1};--g2:${p.g2};
    --fg:#f5f5f7;--muted:rgba(245,245,247,.62);--faint:rgba(245,245,247,.38);
    --surface:rgba(255,255,255,${alpha(theme.glassOpacity)});--card:rgba(255,255,255,${alpha(theme.cardOpacity)});
    --card-hover:rgba(255,255,255,${Math.min(.2, alpha(theme.cardOpacity) + .04)});
    --border:rgba(255,255,255,${alpha(theme.borderOpacity)});--border-strong:rgba(255,255,255,.2);
    --hl:rgba(255,255,255,.09);--shadow:0 10px 40px rgba(0,0,0,.38);
    --glow-o:${alpha(theme.glow)};--input:rgba(0,0,0,.28);--overlay:rgba(0,0,0,.6);--pop:rgba(22,22,28,.94);
  `;
  const lightVars = `
    --fg:#171821;--muted:rgba(23,24,33,.68);--faint:rgba(23,24,33,.43);
    --surface:rgba(255,255,255,.72);--card:rgba(255,255,255,${Math.max(.48, alpha(theme.cardOpacity) + .42)});
    --card-hover:rgba(255,255,255,.88);--border:rgba(23,24,33,${Math.max(.07, alpha(theme.borderOpacity) * .7)});
    --border-strong:rgba(23,24,33,.18);--hl:rgba(23,24,33,.05);--shadow:0 10px 40px rgba(20,25,40,.1);
    --input:rgba(255,255,255,.7);--overlay:rgba(20,20,30,.35);--pop:rgba(255,255,255,.97);
  `;
  const g = theme.gradient;
  const grad = gradientCss(g, g.intensity);
  return `
    :root{--font-sans:${font};--radius:${theme.radius}px;--radius-sm:${Math.max(8, theme.radius * .6)}px;--radius-lg:${Math.min(40, theme.radius * 1.35)}px;--pad:${theme.density === "compact" ? 14 : theme.density === "spacious" ? 26 : 20}px;--gap:${theme.density === "compact" ? 12 : theme.density === "spacious" ? 24 : 18}px;--blur:${theme.blur}px;--dur:${Math.round(220 * theme.speed / 100)}ms;--lift:${(1.8 * theme.animation / 100).toFixed(2)}px;--accent:${accent};--accent-rgb:${rgb(accent).join(",")};--on-accent:${contrastText(accent)};--grad:${grad};--grad-op:${alpha(g.opacity)};--grad-blend:${g.blend};--grad-size:${Math.round(120 + g.animIntensity)}% ${Math.round(120 + g.animIntensity)}%;--grad-dur:${Math.max(8, 80 / Math.max(1, g.animSpeed / 10))}s;--grad-dir:${g.animDirection};filter:brightness(1)}
    :root[data-mode="dark"]{${vars(dark)}}
    :root[data-mode="light"]{${vars(light)}${lightVars}}
    ${theme.targets.app ? ".grad-layer{display:block}" : ".grad-layer{display:none}"}
    ${theme.targets.dashboard ? ".dash-hero{background-image:var(--grad);background-blend-mode:soft-light}" : ""}
    ${theme.targets.cards ? ".card,.glass.card-pad{background-image:var(--grad);background-blend-mode:soft-light}" : ""}
    ${theme.targets.buttons ? ".btn-primary{box-shadow:0 0 22px var(--accent-rgb)}" : ""}
    ${theme.targets.accent ? ".accent-grad{background-image:var(--grad);background-clip:text;color:transparent}" : ""}
    ${theme.targets.progress ? ".progress-fill{background-image:var(--grad)}" : ""}
    ${theme.targets.charts ? ".recharts-area-area,.recharts-line{filter:drop-shadow(0 0 5px var(--accent))}" : ""}
    ${theme.targets.nav ? ".nav-active{box-shadow:inset 0 0 0 1px var(--border-strong),0 0 18px var(--glow-o)}" : ""}
    ${theme.targets.profile ? ".avatar-ring{box-shadow:0 0 0 2px var(--accent),0 0 18px var(--accent)}" : ""}
    ${theme.reducedMotion || theme.animation === 0 ? "*,*::before,*::after{animation-duration:.01ms!important;transition-duration:.01ms!important;scroll-behavior:auto!important}" : ""}
  `;
}
