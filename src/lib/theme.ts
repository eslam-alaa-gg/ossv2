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
export type TargetKey = "app" | "dashboard" | "cards" | "buttons" | "accent" | "progress" | "charts" | "nav" | "profile";
export type Theme = {
  preset: string; mode: "dark" | "light" | "system"; accent: string;
  glassOpacity: number; blur: number; borderOpacity: number; brightness: number; glow: number; cardOpacity: number;
  background: "solid" | "soft" | "ambient"; noise: boolean; mouseLight: boolean; radius: number;
  density: "compact" | "comfortable" | "spacious"; font: "inter" | "plex" | "cairo" | "manrope" | "serif" | "system" | "sniglet" | "kavoon" | "merienda" | "shantell" | "custom";
  animation: number; speed: number; reducedMotion: boolean; gradientPreset: string; gradient: GradientCfg;
  targets: Record<TargetKey, boolean>;
};
type Palette = { bg: string; bg2: string; g1: string; g2: string; fg: string; muted: string; faint: string; surface: string; card: string; border: string };
const dark: Palette = { bg:"#08080b",bg2:"#101018",g1:"#6d5dfc",g2:"#2f6bff",fg:"#f5f5f7",muted:"rgba(245,245,247,.62)",faint:"rgba(245,245,247,.38)",surface:"rgba(255,255,255,.07)",card:"rgba(255,255,255,.07)",border:"rgba(255,255,255,.11)" };
const light: Palette = { bg:"#f4f5fa",bg2:"#e9ecf6",g1:"#a9a0ff",g2:"#8cb5ff",fg:"#171824",muted:"rgba(23,24,36,.68)",faint:"rgba(23,24,36,.42)",surface:"rgba(255,255,255,.72)",card:"rgba(255,255,255,.78)",border:"rgba(25,30,50,.12)" };
export const PRESETS = [
 {id:"midnight",name:"Midnight",accent:"#8b7cff",light:false,d:dark,l:light},
 {id:"ocean",name:"Ocean",accent:"#46a6df",light:false,d:{...dark,g1:"#246b9b",g2:"#1c9ab4"},l:{...light,g1:"#9bd4f4",g2:"#75c5d4"}},
 {id:"forest",name:"Forest",accent:"#56bd91",light:false,d:{...dark,g1:"#24775a",g2:"#398c65"},l:{...light,g1:"#9dd7b7",g2:"#7bbf9a"}},
 {id:"rose",name:"Rose",accent:"#e58bb3",light:false,d:{...dark,g1:"#9b456f",g2:"#c45a82"},l:{...light,g1:"#f2b6ce",g2:"#e59ab9"}},
 {id:"sunrise",name:"Sunrise",accent:"#d98b45",light:true,d:{...dark,g1:"#9a6334",g2:"#bd7942"},l:{...light,g1:"#f4c38f",g2:"#f0a9a0"}},
 {id:"mono",name:"Monochrome",accent:"#a3a3b3",light:false,d:{...dark,g1:"#555566",g2:"#333344"},l:{...light,g1:"#b8bac9",g2:"#9295a8"}},
] as const;
export const DEFAULT_THEME: Theme = {
 preset:"midnight",mode:"dark",accent:"#8b7cff",glassOpacity:7,blur:16,borderOpacity:11,brightness:100,glow:15,cardOpacity:7,
 background:"ambient",noise:true,mouseLight:false,radius:20,density:"comfortable",font:"sniglet",animation:70,speed:100,reducedMotion:false,
 gradientPreset:"aurora",gradient:{kind:"linear",angle:135,stops:[{color:"#6d5dfc",pos:0},{color:"#2f6bff",pos:100}],intensity:35,opacity:18,blend:"soft-light",animated:false,animSpeed:30,animIntensity:25,animDirection:"alternate"},
 targets:{app:false,dashboard:false,cards:false,buttons:false,accent:false,progress:false,charts:false,nav:false,profile:false},
};
export const TARGET_KEYS: TargetKey[] = ["app","dashboard","cards","buttons","accent","progress","charts","nav","profile"];
export const ACCENT_PALETTE = ["#8b7cff","#6b9cff","#46a6df","#56bd91","#e58bb3","#d98b45","#e36b6b","#a3a3b3"];
export const GRADIENT_PRESETS = [
 {id:"aurora",name:"Aurora",kind:"linear" as const,angle:135,stops:[{color:"#6d5dfc",pos:0},{color:"#2f6bff",pos:100}]},
 {id:"ocean",name:"Ocean",kind:"linear" as const,angle:120,stops:[{color:"#1478a8",pos:0},{color:"#42b9ba",pos:100}]},
 {id:"sunset",name:"Sunset",kind:"linear" as const,angle:135,stops:[{color:"#db6b75",pos:0},{color:"#e6a04a",pos:100}]},
 {id:"soft-radial",name:"Soft radial",kind:"radial" as const,angle:45,stops:[{color:"#8b7cff",pos:0},{color:"#2f6bff",pos:100}]},
 {id:"mesh",name:"Mesh",kind:"mesh" as const,angle:0,stops:[{color:"#6d5dfc",pos:0},{color:"#2f6bff",pos:50},{color:"#36b7a5",pos:100}]},
];
export function normalizeHex(v:string) { const s=v.trim(); return /^#[0-9a-fA-F]{6}$/.test(s)?s.toLowerCase():null; }
function rgb(hex:string) { const h=hex.replace("#",""); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function rgba(hex:string,a:number) { const [r,g,b]=rgb(hex); return `rgba(${r},${g},${b},${Math.max(0,Math.min(1,a))})`; }
export function gradientCss(g:GradientCfg,intensity=100) {
 const stops=g.stops.map(s=>`${rgba(s.color,Math.max(.08,intensity/100))} ${s.pos}%`).join(", ");
 if(g.kind==="radial") return `radial-gradient(circle at ${g.angle%100}% 50%, ${stops})`;
 if(g.kind==="conic") return `conic-gradient(from ${g.angle}deg, ${stops})`;
 if(g.kind==="mesh") return `radial-gradient(60% 70% at 10% 15%, ${rgba(g.stops[0].color,intensity/100)}, transparent 75%), radial-gradient(60% 70% at 90% 85%, ${rgba(g.stops[g.stops.length-1].color,intensity/100)}, transparent 75%)`;
 return `linear-gradient(${g.angle}deg, ${stops})`;
}
export function chartColors(t:Theme) { return [t.accent, PRESETS.find(p=>p.id===t.preset)?.d.g2??"#2f6bff", "#4dbb9a", "#e6a04a", "#df789b"]; }
export function themeCss(t:Theme) {
 const preset = PRESETS.find(x=>x.id===t.preset) ?? PRESETS[0];
 const p = t.mode==="light" ? preset.l : preset.d;
 const [ar,ag,ab]=rgb(t.accent);
 const luminance=(.2126*ar+.7152*ag+.0722*ab)/255;
 const onAccent=luminance>.68?"#171824":"#ffffff";
 const font=t.font==="plex"?"'IBM Plex Sans',sans-serif":t.font==="cairo"?"'Cairo',sans-serif":t.font==="manrope"?"'Manrope',sans-serif":t.font==="serif"?"'Source Serif 4',serif":t.font==="system"?"ui-sans-serif,system-ui,sans-serif":t.font==="kavoon"?"'Kavoon',serif":t.font==="merienda"?"'Merienda',cursive":t.font==="shantell"?"'Shantell Sans',cursive":t.font==="custom"?"'UkiyoCustom',sans-serif":t.font==="inter"?"'Inter',sans-serif":"'Sniglet',cursive";
 const grad=t.targets.app?gradientCss(t.gradient,t.gradient.intensity):"none";
 const dur=Math.round(22000/Math.max(1,t.gradient.animSpeed));
 const paletteVars=(palette:Palette,mode:"dark"|"light")=>`--bg:${palette.bg};--bg2:${palette.bg2};--g1:${palette.g1};--g2:${palette.g2};--fg:${palette.fg};--muted:${palette.muted};--faint:${palette.faint};--surface:${rgba(t.accent,t.glassOpacity/100)};--card:${rgba("#ffffff",t.cardOpacity/100)};--card-hover:${rgba("#ffffff",Math.min(1,t.cardOpacity/100+.04))};--border:${rgba(mode==="light"?"#20243a":"#ffffff",t.borderOpacity/100)};--border-strong:${rgba(mode==="light"?"#20243a":"#ffffff",Math.min(1,t.borderOpacity/100+.12))};--hl:${rgba("#ffffff",.09)};--shadow:0 10px 40px rgba(0,0,0,${mode==="light"?.12:.38});--input:${rgba(mode==="light"?"#e6e8f0":"#000000",.28)};--overlay:rgba(0,0,0,.6);--pop:${mode==="light"?"rgba(255,255,255,.96)":"rgba(22,22,28,.92)"};`;
 const shared=`--accent:${t.accent};--accent-rgb:${ar},${ag},${ab};--on-accent:${onAccent};--radius:${t.radius}px;--radius-sm:${Math.round(t.radius*.6)}px;--radius-lg:${Math.round(t.radius*1.35)}px;--pad:${t.density==="compact"?"14px":t.density==="spacious"?"26px":"20px"};--gap:${t.density==="compact"?"12px":t.density==="spacious"?"24px":"18px"};--blur:${t.blur}px;--dur:${Math.round(220*t.speed/100)}ms;--lift:${1.8*t.animation/100}px;--font-sans:${font};--font-arabic:'Playpen Sans Arabic','Cairo',sans-serif;--grad:${grad};--grad-op:${t.gradient.opacity/100};--grad-blend:${t.gradient.blend};--grad-size:200% 200%;--grad-dur:${dur}ms;--grad-dir:${t.gradient.animDirection};`;
 const base=`:root{${shared}${paletteVars(p,t.mode==="light"?"light":"dark")}}`;
 const systemLight=t.mode==="system"?`html[data-mode="light"]{${paletteVars(preset.l,"light")}}`:"";
 return `${base}${systemLight}
html[data-mode="light"]{color-scheme:light}html[data-mode="dark"]{color-scheme:dark}
`;
}
