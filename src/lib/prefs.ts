import { z } from "zod";
import { DEFAULT_THEME, type Theme } from "./theme";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pct = z.number().min(0).max(100);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const gradientSchema = z.object({
  kind: z.enum(["linear", "radial", "conic", "mesh"]),
  angle: z.number().min(0).max(360),
  stops: z.array(z.object({ color: hex, pos: pct })).min(2).max(6),
  intensity: pct,
  opacity: pct,
  blend: z.enum(["normal", "overlay", "soft-light", "screen", "lighten"]),
  animated: z.boolean(),
  animSpeed: z.number().min(1).max(100),
  animIntensity: z.number().min(1).max(100),
  animDirection: z.enum(["normal", "reverse", "alternate"]),
});

const b = z.boolean();
export const themeSchema = z.object({
  preset: z.string().max(40),
  mode: z.enum(["dark", "light", "system"]),
  accent: hex,
  glassOpacity: pct,
  blur: z.number().min(0).max(40),
  borderOpacity: pct,
  brightness: z.number().min(50).max(150),
  glow: pct,
  cardOpacity: pct,
  background: z.enum(["solid", "soft", "ambient"]),
  noise: b,
  mouseLight: b,
  radius: z.number().min(6).max(32),
  density: z.enum(["compact", "comfortable", "spacious"]),
  font: z.enum(["inter", "plex", "cairo", "manrope", "serif", "system", "sniglet", "kavoon", "merienda", "shantell", "custom"]),
  animation: pct,
  speed: z.number().min(50).max(200),
  reducedMotion: b,
  gradientPreset: z.string().max(40),
  gradient: gradientSchema,
  targets: z.object({ app: b, dashboard: b, cards: b, buttons: b, accent: b, progress: b, charts: b, nav: b, profile: b }),
}) as unknown as z.ZodType<Theme>;

export type Prefs = {
  theme: Theme;
  customThemes: { id: string; name: string; theme: Theme }[];
  dashboard: { widgets: Record<string, boolean>; order: string[]; sizes: Record<string, "compact" | "standard" | "wide">; musicSource: "spotify" | "detection" | "youtube" };
  notifications: { inApp: boolean; push: boolean; email: boolean; quietStart: string; quietEnd: string; challengeTime: string; habitTime: string };
  spotify: { ambience: boolean; autoRefresh: boolean };
  waterGoal: number;
  focus: { sound: string; volume: number; preset: number; themePreset: "midnight" | "ocean" | "forest" | "rose" | "sunrise" | "mono"; background: "none" | "forest" | "ocean" | "rain" | "sunset" | "cosmos" | "photo-mountains" | "photo-lake" | "photo-coast" | "photo-sunset" | "photo-forest"; timerStyle: "ring" | "digital" | "minimal" | "bar" | "orbit"; overlay: number };
  onboarding: { goals: string[]; habits: string[] };
};

export const WIDGETS = ["progress", "streak", "focus", "challenge", "habits", "reminders", "weekly", "achievements", "music"] as const;

export const DEFAULT_PREFS: Prefs = {
  theme: DEFAULT_THEME,
  customThemes: [],
  dashboard: { widgets: Object.fromEntries(WIDGETS.map((w) => [w, true])), order: [...WIDGETS], sizes: Object.fromEntries(WIDGETS.map((w) => [w, "standard" as const])), musicSource: "spotify" },
  notifications: { inApp: true, push: false, email: false, quietStart: "22:00", quietEnd: "07:00", challengeTime: "09:00", habitTime: "18:00" },
  spotify: { ambience: true, autoRefresh: true },
  waterGoal: 2000,
  focus: { sound: "none", volume: 0.5, preset: 25, themePreset: "midnight", background: "none", timerStyle: "ring", overlay: 45 },
  onboarding: { goals: [], habits: [] },
};

export const prefSchemas: { [K in keyof Prefs]: z.ZodType<Prefs[K]> } = {
  theme: themeSchema,
  customThemes: z.array(z.object({ id: z.string().max(60), name: z.string().trim().min(1).max(40), theme: themeSchema })).max(20),
  dashboard: z.object({ widgets: z.record(z.string(), z.boolean()), order: z.array(z.string().max(40)).max(30).optional().default([...WIDGETS]), sizes: z.record(z.string(), z.enum(["compact", "standard", "wide"])).optional().default({}), musicSource: z.enum(["spotify", "detection", "youtube"]).optional().default("spotify") }),
  notifications: z.object({ inApp: b, push: b, email: b, quietStart: hhmm, quietEnd: hhmm, challengeTime: hhmm, habitTime: hhmm }),
  spotify: z.object({ ambience: b, autoRefresh: b }),
  waterGoal: z.number().int().min(500).max(10000),
  focus: z.object({ sound: z.string().max(20), volume: z.number().min(0).max(1), preset: z.number().int().min(1).max(240), themePreset: z.enum(["midnight", "ocean", "forest", "rose", "sunrise", "mono"]).default("midnight"), background: z.enum(["none", "forest", "ocean", "rain", "sunset", "cosmos", "photo-mountains", "photo-lake", "photo-coast", "photo-sunset", "photo-forest"]).default("none"), timerStyle: z.enum(["ring", "digital", "minimal", "bar", "orbit"]).default("ring"), overlay: z.number().min(0).max(80).default(45) }),
  onboarding: z.object({ goals: z.array(z.string().max(60)).max(20), habits: z.array(z.string().max(60)).max(20) }),
};

export const PREF_KEYS = Object.keys(prefSchemas) as (keyof Prefs)[];

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function parsePrefs(raw: unknown): Prefs {
  const r = isObj(raw) ? raw : {};
  const out: Record<string, unknown> = { ...DEFAULT_PREFS };
  for (const k of PREF_KEYS) {
    let val = r[k];
    if (k === "theme" && isObj(val)) {
      val = {
        ...DEFAULT_THEME,
        ...val,
        gradient: { ...DEFAULT_THEME.gradient, ...(isObj(val.gradient) ? val.gradient : {}) },
        targets: { ...DEFAULT_THEME.targets, ...(isObj(val.targets) ? val.targets : {}) },
      };
    } else if (isObj(val) && isObj(DEFAULT_PREFS[k])) {
      val = { ...(DEFAULT_PREFS[k] as object), ...val };
      if (k === "dashboard") {
        const dashboard = val as Record<string, unknown>;
        const widgets = isObj(dashboard.widgets) ? dashboard.widgets : {};
        const sizes = isObj(dashboard.sizes) ? dashboard.sizes : {};
        const suppliedOrder = Array.isArray(dashboard.order) ? dashboard.order : [];
        const validOrder = suppliedOrder.filter((item): item is string =>
          typeof item === "string" && (WIDGETS as readonly string[]).includes(item)
        );
        dashboard.widgets = { ...DEFAULT_PREFS.dashboard.widgets, ...widgets };
        dashboard.sizes = { ...DEFAULT_PREFS.dashboard.sizes, ...sizes };
        dashboard.order = [...new Set([...validOrder, ...WIDGETS])];
      }
    }
    if (val === undefined) continue;
    const s = prefSchemas[k].safeParse(val);
    if (s.success) out[k] = s.data;
  }
  return out as Prefs;
}
