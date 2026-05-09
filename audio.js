// audio.js — Web Audio synthesis only, no samples.
// Sweep ping (440Hz / 60ms), contact bleeps (range-mapped triangle), strike whoosh
// (sawtooth lowpass-swept down), detonation (filtered noise + 50Hz thump).

let ctx = null;
let masterGain = null;

export function ensureAudio() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  ctx = new Ctx();
  masterGain = ctx.createGain();
  masterGain.gain.value = 0.55;
  masterGain.connect(ctx.destination);
  return ctx;
}

export function isAudioReady() {
  return ctx && ctx.state === 'running';
}

export function resumeAudio() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// Generic envelope on a tone source.
function blip({ type = 'sine', freq = 440, attack = 0.005, decay = 0.06, gain = 0.18, end = null }) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (end != null) osc.frequency.exponentialRampToValueAtTime(Math.max(end, 1), ctx.currentTime + attack + decay);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + attack + decay);
  osc.connect(g).connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + attack + decay + 0.02);
}

export function sweepPing() {
  blip({ type: 'sine', freq: 440, decay: 0.06, gain: 0.07 });
}

// Contact bleep: triangle, frequency mapped to range. Closer = higher pitch.
// rangeNorm in [0, 1] where 0 = point-blank, 1 = scope edge.
export function contactBleep(rangeNorm) {
  const freq = 880 - (880 - 330) * Math.max(0, Math.min(1, rangeNorm));   // 880 close → 330 far
  blip({ type: 'triangle', freq, decay: 0.08, gain: 0.12 });
}

// Strike commit: descending sawtooth + lowpass, ~0.8s sweep 400→80Hz.
export function strikeWhoosh() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.85);
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, ctx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.85);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.05);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.05);
  osc.connect(lp).connect(g).connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 1.1);
}

// Detonation: filtered noise burst + 50Hz sine thump.
export function detonation() {
  if (!ctx) return;
  const dur = 0.28;
  // noise
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const n = ctx.createBufferSource();
  n.buffer = buf;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(2400, ctx.currentTime);
  lp.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + dur);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.45, ctx.currentTime);
  ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  n.connect(lp).connect(ng).connect(masterGain);
  n.start();
  n.stop(ctx.currentTime + dur + 0.02);
  // 50Hz thump
  const thump = ctx.createOscillator();
  const tg = ctx.createGain();
  thump.type = 'sine';
  thump.frequency.setValueAtTime(50, ctx.currentTime);
  tg.gain.setValueAtTime(0.0001, ctx.currentTime);
  tg.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.005);
  tg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  thump.connect(tg).connect(masterGain);
  thump.start();
  thump.stop(ctx.currentTime + 0.14);
}

// Game-over flicker tone.
export function gameOverTone() {
  blip({ type: 'sawtooth', freq: 110, end: 50, decay: 0.6, gain: 0.25 });
}

// Mechanical safety-switch click — short noise burst with bandpass.
export function safetyClick() {
  if (!ctx) return;
  const dur = 0.04;
  const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const n = ctx.createBufferSource();
  n.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 4;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.35, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  n.connect(bp).connect(g).connect(masterGain);
  n.start();
  n.stop(ctx.currentTime + dur + 0.01);
}

// Target-lock confirm — short triangle blip, lower than contactBleep.
export function targetLock() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [620, 880].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0 + i * 0.04);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.04);
    g.gain.exponentialRampToValueAtTime(0.10, t0 + i * 0.04 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.04 + 0.08);
    osc.connect(g).connect(masterGain);
    osc.start(t0 + i * 0.04);
    osc.stop(t0 + i * 0.04 + 0.10);
  });
}

// Launch button — heavy mechanical press + low thud.
export function launchPress() {
  if (!ctx) return;
  // mechanical click
  safetyClick();
  // sub-thud
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(70, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.18);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.30, ctx.currentTime + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.20);
  osc.connect(g).connect(masterGain);
  osc.start();
  osc.stop(ctx.currentTime + 0.22);
}

// Armed chime — rising 2-note triangle, fires when an orbital window opens.
export function armedChime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [392, 587].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0 + i * 0.10);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.10);
    g.gain.exponentialRampToValueAtTime(0.13, t0 + i * 0.10 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.10 + 0.22);
    osc.connect(g).connect(masterGain);
    osc.start(t0 + i * 0.10);
    osc.stop(t0 + i * 0.10 + 0.25);
  });
}

// Run-complete chime — one phrase, three notes.
export function runCompleteChime() {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  [392, 523, 659].forEach((f, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t0 + i * 0.18);
    g.gain.setValueAtTime(0.0001, t0 + i * 0.18);
    g.gain.exponentialRampToValueAtTime(0.16, t0 + i * 0.18 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.18 + 0.36);
    osc.connect(g).connect(masterGain);
    osc.start(t0 + i * 0.18);
    osc.stop(t0 + i * 0.18 + 0.4);
  });
}
