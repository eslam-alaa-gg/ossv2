/**
 * Focus Room themes are intentionally independent from the site-wide Theme Studio.
 * Keep this palette local to Focus so changing global presets cannot alter Focus UI.
 */
export type FocusThemePreset = {
  id: "midnight" | "ocean" | "forest" | "rose" | "sunrise" | "mono";
  name: string;
  accent: string;
  d: { bg: string };
};

export const FOCUS_THEME_PRESETS: readonly FocusThemePreset[] = [
  { id: "midnight", name: "Midnight", accent: "#8b7cff", d: { bg: "#08080b" } },
  { id: "ocean", name: "Ocean", accent: "#46a6df", d: { bg: "#08080b" } },
  { id: "forest", name: "Forest", accent: "#56bd91", d: { bg: "#08080b" } },
  { id: "rose", name: "Rose", accent: "#e58bb3", d: { bg: "#08080b" } },
  { id: "sunrise", name: "Sunrise", accent: "#d98b45", d: { bg: "#08080b" } },
  { id: "mono", name: "Monochrome", accent: "#a3a3b3", d: { bg: "#08080b" } },
];
