"use client";
// Procedurally synthesised ambient soundscapes (Web Audio API) — no audio files, no autoplay: started only from a user gesture.
export const SOUNDS = [
  { id: "rain", label: "Gentle Rain" },
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean Waves" },
  { id: "wind", label: "Soft Wind" },
  { id: "white", label: "White Noise" },
  { id: "fire", label: "Fireplace" },
] as const;

function noise(ctx: AudioContext, kind: "white" | "pink" | "brown") {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    if (kind === "white") d[i] = w * 0.5;
    else if (kind === "pink") { b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  return src;
}

export type AmbientHandle = { setVolume: (v: number) => void; stop: () => void };

export function startAmbient(id: string, volume: number): AmbientHandle | null {
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
  const stops: (() => void)[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const filt = (type: BiquadFilterType, f: number, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const lfo = (rate: number, depth: number, target: AudioParam) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(target); o.start(); stops.push(() => o.stop()); };
  const layer = (kind: "white" | "pink" | "brown", nodes: AudioNode[], gain: number) => {
    const s = noise(ctx, kind); const g = ctx.createGain(); g.gain.value = gain;
    let prev: AudioNode = s; nodes.forEach((n) => { prev.connect(n); prev = n; }); prev.connect(g); g.connect(master); s.start(); stops.push(() => s.stop()); return g;
  };
  const blip = (fn: () => void, min: number, max: number) => { const loop = () => { fn(); timers.push(setTimeout(loop, min + Math.random() * (max - min))); }; loop(); };

  if (id === "white") layer("white", [], 0.5);
  if (id === "rain") { layer("white", [filt("highpass", 900), filt("lowpass", 9000)], 0.55); layer("pink", [filt("lowpass", 500)], 0.35); }
  if (id === "ocean") { const g = layer("brown", [filt("lowpass", 800)], 0.5); lfo(0.09, 0.35, g.gain); layer("pink", [filt("bandpass", 1500, 0.4)], 0.07); }
  if (id === "wind") { const bp = filt("bandpass", 600, 0.8); const g = layer("pink", [bp], 0.9); lfo(0.06, 300, bp.frequency); lfo(0.11, 0.3, g.gain); }
  if (id === "fire") {
    layer("brown", [filt("lowpass", 500)], 0.55);
    blip(() => { const s = noise(ctx, "white"); const g = ctx.createGain(); const f = filt("highpass", 1500 + Math.random() * 3000); s.connect(f); f.connect(g); g.connect(master); const t = ctx.currentTime; g.gain.setValueAtTime(0.5 * Math.random(), t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.08); s.start(t); s.stop(t + 0.2); }, 60, 420);
  }
  if (id === "forest") {
    layer("pink", [filt("lowpass", 1100)], 0.3);
    blip(() => { const o = ctx.createOscillator(); const g = ctx.createGain(); const t = ctx.currentTime; const base = 2200 + Math.random() * 1800; o.frequency.setValueAtTime(base, t); o.frequency.exponentialRampToValueAtTime(base * (1.1 + Math.random() * 0.4), t + 0.12); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.18); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25); }, 900, 4200);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return {
    setVolume: (v) => master.gain.setTargetAtTime(v, ctx.currentTime, 0.1),
    stop: () => { timers.forEach(clearTimeout); master.gain.setTargetAtTime(0, ctx.currentTime, 0.15); setTimeout(() => { stops.forEach((s) => { try { s(); } catch { /* ignore */ } }); void ctx.close(); }, 500); },
  };
}
