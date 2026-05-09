// scope.js — Canvas 2D rendering for the PPI scope.
// Scope is sacred: no CRT effects on the canvas, only on the HUD chrome.
// All draw functions take ctx + state-fragments; state mutation lives in main.js.

import { RIG, SCOPE_R, TURRET_R, STRIKE_RADIUS, STRIKE_DELAY } from './contacts.js';

const TAU = Math.PI * 2;
const W = 720, H = 720;

// Palette
const HOT = '#88ff88';
const MID = '#3a8c3a';
const DIM = '#0f2c0f';
const AMBER = '#ffaa44';
const RED = '#ff3322';

export function clearScope(ctx) {
  ctx.fillStyle = '#030604';
  ctx.fillRect(0, 0, W, H);
}

// Subtle phosphor smear — fades prior frame. Tuned low to keep clusters readable.
export function smearScope(ctx, alpha = 0.20) {
  ctx.fillStyle = `rgba(3, 6, 4, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

// Range rings, bearing ticks, rig + turret halo. Static-feeling layer.
export function drawScopeChrome(ctx) {
  // outer scope mask (faint outer glow ring)
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = MID;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(RIG.x, RIG.y, SCOPE_R, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // range rings 25 / 50 / 75%
  ctx.lineWidth = 1;
  ctx.strokeStyle = MID;
  ctx.globalAlpha = 0.20;
  for (const f of [0.25, 0.50, 0.75]) {
    ctx.beginPath();
    ctx.arc(RIG.x, RIG.y, SCOPE_R * f, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // bearing ticks every 30°, longer at 0/90/180/270
  ctx.strokeStyle = MID;
  for (let i = 0; i < 12; i++) {
    const a = i * (TAU / 12);                 // 0 = north (we use sin/cos with -cos for y, north-up)
    const major = (i % 3 === 0);
    const inner = SCOPE_R - (major ? 14 : 7);
    const outer = SCOPE_R;
    const dx = Math.sin(a), dy = -Math.cos(a);
    ctx.globalAlpha = major ? 0.7 : 0.3;
    ctx.beginPath();
    ctx.moveTo(RIG.x + dx * inner, RIG.y + dy * inner);
    ctx.lineTo(RIG.x + dx * outer, RIG.y + dy * outer);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // bearing labels
  ctx.fillStyle = MID;
  ctx.font = '600 11px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labelR = SCOPE_R - 28;
  const labels = [['000', 0], ['090', TAU / 4], ['180', TAU / 2], ['270', 3 * TAU / 4]];
  for (const [txt, a] of labels) {
    const dx = Math.sin(a), dy = -Math.cos(a);
    ctx.fillText(txt, RIG.x + dx * labelR, RIG.y + dy * labelR);
  }
  // turret halo (auto-turret range)
  ctx.strokeStyle = MID;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(RIG.x, RIG.y, TURRET_R, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // rig dot
  const grad = ctx.createRadialGradient(RIG.x, RIG.y, 0, RIG.x, RIG.y, 12);
  grad.addColorStop(0, HOT);
  grad.addColorStop(0.5, MID);
  grad.addColorStop(1, 'rgba(58,140,58,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(RIG.x, RIG.y, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = HOT;
  ctx.beginPath();
  ctx.arc(RIG.x, RIG.y, 3, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Sweep: rotating line + 30° trailing wedge of fading phosphor.
export function drawSweep(ctx, sweepAngle) {
  ctx.save();
  ctx.translate(RIG.x, RIG.y);
  // mathematical orientation: 0 = north (up). theta increases clockwise.
  // To rotate canvas so that "north" is up and angle grows clockwise, rotate by sweepAngle around origin.
  ctx.rotate(sweepAngle);
  // wedge gradient: 0 (rim of leading edge, theta=0 in rotated frame = up) trailing back ~30°.
  const wedgeArc = TAU / 12;        // 30°
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const a0 = -wedgeArc * t;
    const a1 = -wedgeArc * (t + 1 / steps);
    // angle in rotated frame: 0 = north (up). Visual: x = sin(theta), y = -cos(theta)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    const r = SCOPE_R;
    ctx.lineTo(Math.sin(a0) * r, -Math.cos(a0) * r);
    ctx.lineTo(Math.sin(a1) * r, -Math.cos(a1) * r);
    ctx.closePath();
    const alpha = 0.18 * (1 - t);
    ctx.fillStyle = `rgba(136, 255, 136, ${alpha})`;
    ctx.fill();
  }
  // leading edge line — bright, with white-ish tip
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -SCOPE_R);
  ctx.strokeStyle = HOT;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = HOT;
  ctx.shadowBlur = 8;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Blips: each as bloom (large faint) + core (small bright). Decay handled by caller.
// Parse '#rrggbb' (or short '#rgb') into "r,g,b" string for rgba() interpolation.
function hexToRgb(hex) {
  if (!hex || hex[0] !== '#') return '136,255,136';
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
const RGB_CACHE = new Map();
function rgbCached(hex) {
  if (!RGB_CACHE.has(hex)) RGB_CACHE.set(hex, hexToRgb(hex));
  return RGB_CACHE.get(hex);
}

export function drawBlips(ctx, blips, now) {
  for (const b of blips) {
    const age = now - b.t0;
    const TAU_DECAY = 1.5;
    const alpha = Math.exp(-age / TAU_DECAY);
    if (alpha < 0.02) continue;
    const scale = b.blipScale != null ? b.blipScale : 1.0;
    const r = (3 + b.weight * 1.4) * scale;
    const rgb = b.blipColor ? rgbCached(b.blipColor) : '136,255,136';
    // bloom
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 4.5);
    grad.addColorStop(0, `rgba(${rgb}, ${0.55 * alpha})`);
    grad.addColorStop(0.4, `rgba(${rgb}, ${0.18 * alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 4.5, 0, TAU);
    ctx.fill();
    // hot core — desaturate toward white for legibility
    ctx.fillStyle = `rgba(240, 255, 240, ${alpha})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.55, 0, TAU);
    ctx.fill();
  }
}

// Target reticle — set BEFORE launch (multi-phase commit). Distinct from the
// pending-strike crosshair so the player sees "this is where the missile WILL
// go if I press 発射" vs "missile is in the air, descending now."
// Style: green corner brackets + thin crosshair + faint blast-radius preview ring.
export function drawTargetReticle(ctx, target, now) {
  if (!target) return;
  const elapsed = now - (target.t0 || now);
  const pulse = 0.65 + 0.35 * Math.sin(elapsed * 6);
  ctx.save();
  ctx.translate(target.x, target.y);
  ctx.strokeStyle = `rgba(136, 255, 136, ${pulse})`;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = '#88ff88';
  ctx.shadowBlur = 6;
  // corner brackets
  const br = 18, brIn = 8;
  for (const [sx, sy] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
    ctx.beginPath();
    ctx.moveTo(sx * br, sy * brIn); ctx.lineTo(sx * br, sy * br); ctx.lineTo(sx * brIn, sy * br);
    ctx.stroke();
  }
  // thin crosshair
  ctx.beginPath();
  ctx.moveTo(-12, 0); ctx.lineTo(-3, 0);
  ctx.moveTo(3, 0); ctx.lineTo(12, 0);
  ctx.moveTo(0, -12); ctx.lineTo(0, -3);
  ctx.moveTo(0, 3); ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // faint blast-radius preview
  ctx.strokeStyle = `rgba(136, 255, 136, ${0.18 * pulse})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, STRIKE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // label
  ctx.fillStyle = `rgba(136, 255, 136, ${pulse})`;
  ctx.font = '600 9px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('TGT LOCK', br + 4, -br + 6);
  ctx.restore();
}

// Pending strike: amber crosshair pulsing once per 400ms.
export function drawPendingStrike(ctx, strike, now) {
  if (!strike) return;
  const elapsed = now - strike.t0;
  const pulseT = (elapsed % 0.4) / 0.4;
  const pulse = 0.6 + 0.4 * Math.sin(pulseT * TAU);
  ctx.save();
  ctx.strokeStyle = AMBER;
  ctx.fillStyle = AMBER;
  ctx.globalAlpha = pulse;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = 6;
  // crosshair
  const arm = 14;
  ctx.beginPath();
  ctx.moveTo(strike.x - arm, strike.y);
  ctx.lineTo(strike.x - 4, strike.y);
  ctx.moveTo(strike.x + 4, strike.y);
  ctx.lineTo(strike.x + arm, strike.y);
  ctx.moveTo(strike.x, strike.y - arm);
  ctx.lineTo(strike.x, strike.y - 4);
  ctx.moveTo(strike.x, strike.y + 4);
  ctx.lineTo(strike.x, strike.y + arm);
  ctx.stroke();
  // tiny center dot
  ctx.beginPath();
  ctx.arc(strike.x, strike.y, 1.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// Detonation rings: expand from blast point + flash, 600ms.
export function drawDetonations(ctx, dets, now) {
  for (const d of dets) {
    const age = now - d.t0;
    if (age > 0.6) continue;
    const t = age / 0.6;
    // expanding ring
    const r = STRIKE_RADIUS * (0.3 + t * 1.05);
    const a = 1 - t;
    ctx.save();
    ctx.strokeStyle = `rgba(255, 240, 200, ${a * 0.85})`;
    ctx.lineWidth = 2.5 - 1.5 * t;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, TAU);
    ctx.stroke();
    // bright core flash (first 120ms only)
    if (age < 0.12) {
      const ca = 1 - age / 0.12;
      const g2 = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, 32);
      g2.addColorStop(0, `rgba(255, 255, 220, ${ca})`);
      g2.addColorStop(1, 'rgba(255, 255, 220, 0)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 32, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
}

// True-centroid post-blast marker: 600ms amber square + ring. PM: amber, not green.
export function drawCentroidMarker(ctx, marker, now) {
  if (!marker) return;
  const age = now - marker.t0;
  if (age > 0.6) return;
  const t = age / 0.6;
  const a = (1 - t);
  ctx.save();
  ctx.translate(marker.x, marker.y);
  // square reticle
  ctx.strokeStyle = AMBER;
  ctx.globalAlpha = a;
  ctx.lineWidth = 1.4;
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = 8;
  const sq = 6;
  ctx.strokeRect(-sq, -sq, sq * 2, sq * 2);
  // labels
  ctx.fillStyle = AMBER;
  ctx.font = '600 9px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.fillText('TRUE C', sq + 4, -2);
  ctx.restore();
}

// Auto-turret tracers: brief lines from rig to target, fade over 100ms.
export function drawTurretTracers(ctx, tracers, now) {
  ctx.save();
  ctx.lineCap = 'round';
  for (const t of tracers) {
    const age = now - t.t0;
    if (age > 0.1) continue;
    const a = 1 - age / 0.1;
    ctx.strokeStyle = `rgba(220, 255, 220, ${a})`;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = HOT;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(RIG.x, RIG.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    // muzzle flash dot
    ctx.fillStyle = `rgba(220,255,220, ${a})`;
    ctx.beginPath();
    ctx.arc(RIG.x, RIG.y, 3 * a, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

// Game-over red wash on the scope.
export function drawGameOverFlash(ctx, intensity) {
  if (intensity <= 0) return;
  ctx.save();
  ctx.fillStyle = `rgba(255, 51, 34, ${0.35 * intensity})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

// Returns true if pixel (x, y) is inside the scope circle.
export function isInsideScope(x, y) {
  const dx = x - RIG.x, dy = y - RIG.y;
  return dx * dx + dy * dy <= SCOPE_R * SCOPE_R;
}

// ── Munition cam — always-on missile-POV feed ───────────────────────────────
// 5 visual states driven off game state:
//   STANDBY        — no strikes left this wave
//   CHARGING       — orbital window filling (state.gauge: 0..1)
//   ARMED          — at least 1 ready strike, target-lock enabled
//   IN-FLIGHT      — descending munition (zoom-in cinematic)
//   IMPACT-LINGER  — ~0.45s post-detonation aftermath
const CAM_VIEW_FAR = 240;     // px world-radius shown at zoom=0
const CAM_VIEW_NEAR = 50;     // px world-radius shown at zoom=1 (tighter for impact)
const IMPACT_LINGER = 0.55;

function camDims() {
  return (typeof window !== 'undefined' && window.__camDims) || { w: 200, h: 120 };
}

export function drawMissileCam(ctx, state, t, dims) {
  // dims optional — pass { w, h } to render the cam at a non-default size
  // (the seabase v2 launch takeover renders the cam fullscreen on the main
  // scope canvas).
  const { w: CAM_W, h: CAM_H } = dims || camDims();
  // base wipe — black no-feed
  ctx.fillStyle = '#020602';
  ctx.fillRect(0, 0, CAM_W, CAM_H);

  // 1) IMPACT-LINGER takes precedence — most recent linger that hasn't expired
  const linger = pickRecent(state.impactLingers, t, IMPACT_LINGER);
  if (linger) {
    drawCamImpactLinger(ctx, linger, t, CAM_W, CAM_H);
    return;
  }
  // 2) IN-FLIGHT — oldest pending strike (closest to detonation)
  const strike = state.pendingStrikes && state.pendingStrikes.length
    ? state.pendingStrikes.reduce((a, b) => a.t0 < b.t0 ? a : b)
    : null;
  if (strike) {
    drawCamInFlight(ctx, state, strike, t, CAM_W, CAM_H);
    return;
  }
  // 3) ARMED — at least 1 ready strike
  if (state.readyStrikes > 0) {
    drawCamArmed(ctx, t, CAM_W, CAM_H);
    return;
  }
  // 4) CHARGING — gauge filling for next reserved strike
  if (state.reservedStrikes > 0) {
    drawCamCharging(ctx, state.gauge, t, CAM_W, CAM_H);
    return;
  }
  // 5) STANDBY — no strikes left this wave
  drawCamStandby(ctx, t, CAM_W, CAM_H);
}

function pickRecent(arr, t, ttl) {
  if (!arr || !arr.length) return null;
  let best = null;
  for (const a of arr) if (t - a.t0 < ttl && (!best || a.t0 > best.t0)) best = a;
  return best;
}

function drawCamStandby(ctx, t, W, H) {
  drawCamStatic(ctx, 0.05, W, H);
  drawCamScanlines(ctx, t, W, H);
  ctx.font = '600 8px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.6)';
  ctx.fillText('CH3 · NO FEED', 4, 4);
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.45)';
  ctx.fillText('STANDBY', W - 4, H - 4);
  ctx.textAlign = 'left';
  ctx.fillText('NO ASSETS', 4, H - 4);
}

function drawCamCharging(ctx, gauge, t, W, H) {
  drawCamStatic(ctx, 0.07, W, H);
  drawCamScanlines(ctx, t, W, H);
  // orbital track viz: rotating dashed ellipse, tick marks
  ctx.save();
  ctx.translate(W / 2, H / 2);
  const rA = Math.min(W, H) * 0.32, rB = rA * 0.55;
  ctx.rotate(t * 0.6);
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.55)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.ellipse(0, 0, rA, rB, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // satellite glyph (orbiting)
  const orbitT = (gauge * Math.PI * 2);
  const sx = Math.cos(orbitT) * rA;
  const sy = Math.sin(orbitT) * rB;
  ctx.fillStyle = 'rgba(136, 255, 136, 0.85)';
  ctx.shadowColor = '#88ff88';
  ctx.shadowBlur = 6;
  ctx.fillRect(sx - 2, sy - 2, 4, 4);
  ctx.shadowBlur = 0;
  ctx.restore();
  // gauge bar at bottom
  const gx = 6, gy = H - 16, gw = W - 12, gh = 3;
  ctx.fillStyle = 'rgba(58, 140, 58, 0.30)';
  ctx.fillRect(gx, gy, gw, gh);
  ctx.fillStyle = 'rgba(255, 170, 68, 0.95)';
  ctx.fillRect(gx, gy, gw * gauge, gh);
  // labels
  ctx.font = '600 8px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.85)';
  ctx.fillText('CH3 · ORBITAL TELEMETRY', 4, 4);
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 170, 68, 0.85)';
  ctx.fillText(`ORBIT ${Math.round(gauge * 100)}%`, 4, H - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.7)';
  ctx.fillText('CHARGING', W - 4, H - 4);
}

function drawCamArmed(ctx, t, W, H) {
  drawCamStatic(ctx, 0.04, W, H);
  drawCamScanlines(ctx, t, W, H);
  // pulsing crosshair — TGT LOCK READY
  const pulse = 0.65 + 0.35 * Math.sin(t * 5);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = `rgba(255, 170, 68, ${pulse})`;
  ctx.lineWidth = 1;
  ctx.shadowColor = '#ffaa44';
  ctx.shadowBlur = 6;
  // big crosshair
  const arm = Math.min(W, H) * 0.22;
  ctx.beginPath();
  ctx.moveTo(-arm, 0); ctx.lineTo(-4, 0);
  ctx.moveTo(4, 0); ctx.lineTo(arm, 0);
  ctx.moveTo(0, -arm); ctx.lineTo(0, -4);
  ctx.moveTo(0, 4); ctx.lineTo(0, arm);
  ctx.stroke();
  // bracket corners
  const br = Math.min(W, H) * 0.30;
  for (const [sx, sy] of [[-br,-br],[br,-br],[-br,br],[br,br]]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy + Math.sign(-sy) * 8); ctx.lineTo(sx, sy);
    ctx.lineTo(sx + Math.sign(-sx) * 8, sy);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.restore();
  // labels
  ctx.font = '600 8px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.85)';
  ctx.fillText('CH3 · CHARGE OPTICS', 4, 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(255, 170, 68, ${0.5 + 0.5 * pulse})`;
  ctx.fillText('▶ ARMED', W - 4, 4);
  ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(255, 170, 68, 0.95)';
  ctx.fillText('TGT LOCK READY', 4, H - 4);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.7)';
  ctx.fillText('AWAITING TARGET', W - 4, H - 4);
}

// hit color tier — user spec:
//   100%  → white/cyan (FULL HIT)
//   ≥50%  → amber       (PARTIAL)
//   <50%  → red         (GLANCING)
// Empty in-radius (strike missed entirely) → red GLANCING with 0/0 readout.
function hitTier(killed, inRadius) {
  if (inRadius <= 0)              return { rgb: '255, 51, 34',   hex: '#ff3322', label: 'GLANCING' };
  const pct = killed / inRadius;
  if (pct >= 0.999)               return { rgb: '136, 224, 255', hex: '#88e0ff', label: 'FULL HIT' };
  if (pct >= 0.5)                 return { rgb: '255, 170, 68',  hex: '#ffaa44', label: 'PARTIAL' };
  return                                 { rgb: '255, 51, 34',   hex: '#ff3322', label: 'GLANCING' };
}

function drawCamImpactLinger(ctx, linger, t, W, H) {
  const age = t - linger.t0;
  const tProg = age / IMPACT_LINGER;        // 0..1
  const tier = hitTier(linger.killed || 0, linger.inRadius || 0);
  const fadeIn = Math.min(1, age / 0.10);   // 0.1s fade-in for the text
  const fadeOut = 1 - tProg;
  const alpha = fadeIn * fadeOut;

  // bright white-hot flash decay
  ctx.fillStyle = `rgba(255, 245, 200, ${0.55 * fadeOut})`;
  ctx.fillRect(0, 0, W, H);
  // expanding shock ring tinted by tier
  const ringR = Math.min(W, H) * (0.15 + tProg * 0.55);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.strokeStyle = `rgba(${tier.rgb}, ${fadeOut * 0.85})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = tier.hex;
  ctx.shadowBlur = 12 * fadeOut;
  ctx.beginPath(); ctx.arc(0, 0, ringR, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  drawCamStatic(ctx, 0.10 + 0.10 * fadeOut, W, H);
  drawCamScanlines(ctx, t, W, H);

  // BIG hit-count stamp — color-coded
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // big k/n number — rises slightly as it fades
  const yLift = -tProg * 4;
  ctx.font = '800 22px JetBrains Mono, ui-monospace, monospace';
  ctx.fillStyle = `rgba(${tier.rgb}, ${alpha})`;
  ctx.shadowColor = tier.hex;
  ctx.shadowBlur = 14 * fadeOut;
  ctx.fillText(`${linger.killed}/${linger.inRadius} HIT`, W / 2, H / 2 - 4 + yLift);
  // tier label below
  ctx.font = '700 10px JetBrains Mono, ui-monospace, monospace';
  ctx.shadowBlur = 6 * fadeOut;
  ctx.fillStyle = `rgba(${tier.rgb}, ${alpha * 0.9})`;
  ctx.fillText(tier.label, W / 2, H / 2 + 14 + yLift);
  ctx.shadowBlur = 0;

  // top label
  ctx.font = '600 8px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = `rgba(${tier.rgb}, 0.85)`;
  ctx.fillText('CH3 · IMPACT', 4, 4);
}

function drawCamInFlight(ctx, state, strike, t, CAM_W, CAM_H) {
  const age = t - strike.t0;
  const progress = Math.min(1, age / STRIKE_DELAY);
  // ease-in zoom curve — slow at first, fast near impact (feels like falling)
  const ez = progress * progress * (3 - 2 * progress);   // smoothstep
  const viewR = CAM_VIEW_FAR - (CAM_VIEW_FAR - CAM_VIEW_NEAR) * ez;
  const scale = (Math.min(CAM_W, CAM_H) / 2) / viewR;

  // subtle escalating cam shake
  const shakeIntensity = 0.6 + progress * 2.0 + (progress > 0.85 ? (progress - 0.85) * 12 : 0);
  const shakeX = (Math.random() - 0.5) * shakeIntensity;
  const shakeY = (Math.random() - 0.5) * shakeIntensity;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  // depth-tinted background (greener as we close)
  const grad = ctx.createRadialGradient(CAM_W / 2, CAM_H / 2, 0, CAM_W / 2, CAM_H / 2, CAM_H);
  grad.addColorStop(0, `rgba(20, ${52 + 36 * progress}, 20, 1)`);
  grad.addColorStop(1, '#020602');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CAM_W, CAM_H);

  // contact silhouettes — live updated, drift visible
  for (const c of state.contacts) {
    if (!c.alive) continue;
    const dx = c.x - strike.x, dy = c.y - strike.y;
    if (Math.hypot(dx, dy) > viewR * 1.3) continue;
    const sx = CAM_W / 2 + dx * scale;
    const sy = CAM_H / 2 + dy * scale;
    const baseR = (3 + c.weight * 1.4) * (0.7 + 1.6 * progress);
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 2.2);
    sg.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    sg.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(sx, sy, baseR * 2.2, 0, Math.PI * 2); ctx.fill();
    if (progress > 0.30) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 8 + sx);
      ctx.fillStyle = `rgba(140, 210, 140, ${(progress - 0.30) * (0.55 + 0.4 * pulse)})`;
      ctx.beginPath(); ctx.arc(sx, sy, baseR * 0.45, 0, Math.PI * 2); ctx.fill();
    }
  }

  // blast-radius dashed ring
  const blastRpx = STRIKE_RADIUS * scale;
  if (blastRpx > 4 && blastRpx < CAM_W * 0.7) {
    ctx.strokeStyle = `rgba(255, 170, 68, ${0.30 + 0.45 * progress})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.arc(CAM_W / 2, CAM_H / 2, blastRpx, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  drawCamCrosshair(ctx, CAM_W, CAM_H);
  drawCamStatic(ctx, 0.05 + 0.10 * (1 - progress), CAM_W, CAM_H);
  drawCamScanlines(ctx, t, CAM_W, CAM_H);

  // approach glitches in the last 30%
  if (progress > 0.7 && Math.random() < 0.12) {
    ctx.fillStyle = `rgba(255, 255, 220, ${0.04 + 0.10 * Math.random()})`;
    ctx.fillRect(0, 0, CAM_W, CAM_H);
  }
  // terminal flash on the final 1.5%
  if (progress >= 0.985) {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - (1 - progress) / 0.015})`;
    ctx.fillRect(0, 0, CAM_W, CAM_H);
  }

  ctx.restore();    // end shake transform — labels render unshaken

  // STAGE LABELS — ON, SET, LAUNCH (and IMPACT)
  drawCamLaunchStages(ctx, progress, CAM_W, CAM_H);

  const tgtCount = state.contacts.filter(c => c.alive && Math.hypot(c.x - strike.x, c.y - strike.y) <= STRIKE_RADIUS).length;
  drawCamHeader(ctx, { progress }, CAM_W, CAM_H);
  drawCamFooter(ctx, { progress, tgtCount }, CAM_W, CAM_H);
}

// 3-stage indicator across top: ON → SET → LAUNCH (and IMPACT in red at end)
function drawCamLaunchStages(ctx, progress, W, H) {
  ctx.save();
  ctx.font = '700 7px JetBrains Mono, ui-monospace, monospace';
  ctx.textBaseline = 'top';
  const stages = [
    { label: 'ON',     active: true },
    { label: 'SET',    active: true },
    { label: 'LAUNCH', active: true },
    { label: 'IMPACT', active: progress > 0.85 },
  ];
  let x = W / 2 - 60;
  const y = 14;
  for (const s of stages) {
    const isImpact = s.label === 'IMPACT';
    const c = s.active
      ? (isImpact ? 'rgba(255, 51, 34, 0.95)' : 'rgba(255, 170, 68, 0.85)')
      : 'rgba(58, 140, 58, 0.4)';
    ctx.fillStyle = c;
    ctx.textAlign = 'left';
    ctx.fillText('●', x, y);
    ctx.fillText(s.label, x + 6, y);
    x += 30;
  }
  ctx.restore();
}

function drawCamCrosshair(ctx, CAM_W, CAM_H) {
  const cx = CAM_W / 2, cy = CAM_H / 2;
  ctx.strokeStyle = 'rgba(255, 170, 68, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx - 11, cy); ctx.lineTo(cx - 3, cy);
  ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 11, cy);
  ctx.moveTo(cx, cy - 11); ctx.lineTo(cx, cy - 3);
  ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 11);
  ctx.stroke();
  // tick marks at corners
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.55)';
  for (const [x, y, dx, dy] of [
    [4, 4, 6, 0], [4, 4, 0, 6],
    [CAM_W - 4, 4, -6, 0], [CAM_W - 4, 4, 0, 6],
    [4, CAM_H - 4, 6, 0], [4, CAM_H - 4, 0, -6],
    [CAM_W - 4, CAM_H - 4, -6, 0], [CAM_W - 4, CAM_H - 4, 0, -6],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }
}

function drawCamStatic(ctx, intensity, CAM_W, CAM_H) {
  const dots = Math.floor(CAM_W * CAM_H * intensity / 6);
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(Math.random() * CAM_W);
    const y = Math.floor(Math.random() * CAM_H);
    const v = Math.random();
    if (v < 0.45) ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    else if (v < 0.78) ctx.fillStyle = 'rgba(20, 50, 20, 0.7)';
    else ctx.fillStyle = `rgba(${130 + Math.random() * 80 | 0}, ${200 + Math.random() * 55 | 0}, ${130 + Math.random() * 80 | 0}, ${0.4 + 0.5 * Math.random()})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

function drawCamScanlines(ctx, t, CAM_W, CAM_H) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 1; y < CAM_H; y += 2) ctx.fillRect(0, y, CAM_W, 1);
  const sweepY = ((t * 22) % (CAM_H + 24)) - 12;
  ctx.fillStyle = 'rgba(140, 220, 140, 0.05)';
  ctx.fillRect(0, sweepY, CAM_W, 5);
}

function drawCamHeader(ctx, info, CAM_W, CAM_H) {
  ctx.font = '600 8px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.85)';
  ctx.fillText('CH3 · CHARGE OPTICS', 4, 4);
  if (info && info.progress > 0.85) {
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 51, 34, 0.95)';
    ctx.fillText('// IMPACT', CAM_W - 4, 4);
  }
}

function drawCamFooter(ctx, info, CAM_W, CAM_H) {
  ctx.font = '600 9px JetBrains Mono, ui-monospace, monospace';
  ctx.textBaseline = 'bottom';
  if (info) {
    const depth = Math.round((1 - info.progress) * 1200);
    ctx.fillStyle = 'rgba(136, 255, 136, 0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(`DEPTH ${String(depth).padStart(4, '0')}M`, CAM_W - 4, CAM_H - 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = info.tgtCount > 0 ? 'rgba(255, 170, 68, 0.95)' : 'rgba(58, 140, 58, 0.7)';
    ctx.fillText(`TGT ${info.tgtCount}`, 4, CAM_H - 4);
  } else {
    ctx.fillStyle = 'rgba(58, 140, 58, 0.55)';
    ctx.textAlign = 'right';
    ctx.fillText('STANDBY', CAM_W - 4, CAM_H - 4);
    ctx.textAlign = 'left';
    ctx.fillText('NO MUNITION', 4, CAM_H - 4);
  }
}

// ─── FULLSCREEN MISSILE-CAM ──────────────────────────────────────────────
// Tuned for the main scope canvas (720×720). Reuses the small-cam logic
// for in-flight zoom + linger flash, but with proportional text/lines so
// the takeover reads as a real cinematic feed instead of a blown-up strip.
//
// All sizing derives from `u = min(W,H) / 24` — at 720 logical px this
// gives u=30 (≈ a comfortable line height for big readouts).

export function drawMissileCamFullscreen(ctx, state, t) {
  const W_ = W, H_ = H;
  // base wipe
  ctx.fillStyle = '#020602';
  ctx.fillRect(0, 0, W_, H_);

  const linger = pickRecent(state.impactLingers, t, IMPACT_LINGER);
  if (linger) {
    drawCamFullInFlightFrame(ctx, state, null, t, W_, H_, /*staticOnly*/ true);
    drawCamFullLinger(ctx, linger, t, W_, H_);
    return;
  }
  const strike = state.pendingStrikes && state.pendingStrikes.length
    ? state.pendingStrikes.reduce((a, b) => a.t0 < b.t0 ? a : b)
    : null;
  if (strike) {
    drawCamFullInFlightFrame(ctx, state, strike, t, W_, H_, /*staticOnly*/ false);
    return;
  }
  // No active strike or linger: caller shouldn't have routed here, but be
  // safe — render a static background so the canvas isn't undefined.
  drawCamFullStatic(ctx, 0.06, t, W_, H_);
}

function drawCamFullInFlightFrame(ctx, state, strike, t, W_, H_, staticOnly) {
  const u = Math.min(W_, H_) / 24;        // ≈30 px at 720
  const cx = W_ / 2, cy = H_ / 2;
  const progress = strike ? Math.min(1, (t - strike.t0) / STRIKE_DELAY) : 0;
  const ez = progress * progress * (3 - 2 * progress);

  // depth-tinted background — greener as we close
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, H_ * 0.7);
  grad.addColorStop(0, `rgba(20, ${52 + 36 * progress}, 20, 1)`);
  grad.addColorStop(1, '#020602');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W_, H_);

  // Cam shake escalates with proximity (only when in-flight, not on linger fade)
  if (!staticOnly && strike) {
    const shakeIntensity = (0.6 + progress * 2.4 + (progress > 0.85 ? (progress - 0.85) * 18 : 0)) * 1.2;
    const sx = (Math.random() - 0.5) * shakeIntensity;
    const sy = (Math.random() - 0.5) * shakeIntensity;
    ctx.save();
    ctx.translate(sx, sy);
  }

  if (strike) {
    const viewR = CAM_VIEW_FAR - (CAM_VIEW_FAR - CAM_VIEW_NEAR) * ez;
    const scale = (Math.min(W_, H_) / 2) / viewR;

    // contact silhouettes — scaled up, more visible
    for (const c of state.contacts) {
      if (!c.alive) continue;
      const dx = c.x - strike.x, dy = c.y - strike.y;
      if (Math.hypot(dx, dy) > viewR * 1.3) continue;
      const sx = cx + dx * scale;
      const sy = cy + dy * scale;
      const baseR = (10 + c.weight * 4.5) * (0.7 + 1.6 * progress);
      const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 2.2);
      sg.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
      sg.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
      sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(sx, sy, baseR * 2.2, 0, TAU); ctx.fill();
      if (progress > 0.30) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 8 + sx);
        ctx.fillStyle = `rgba(140, 210, 140, ${(progress - 0.30) * (0.55 + 0.4 * pulse)})`;
        ctx.beginPath(); ctx.arc(sx, sy, baseR * 0.45, 0, TAU); ctx.fill();
      }
    }

    // blast-radius dashed ring — generous size
    const blastRpx = STRIKE_RADIUS * scale;
    if (blastRpx > 12 && blastRpx < W_ * 0.7) {
      ctx.strokeStyle = `rgba(255, 170, 68, ${0.30 + 0.50 * progress})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath(); ctx.arc(cx, cy, blastRpx, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Big crosshair — generous, gold/amber
  drawCamFullCrosshair(ctx, cx, cy, u);
  // corner brackets
  drawCamFullCorners(ctx, W_, H_, u);

  // static + scanlines (denser at start, calmer near impact)
  drawCamFullStatic(ctx, 0.04 + 0.10 * (1 - progress), t, W_, H_);
  drawCamFullScanlines(ctx, t, W_, H_);

  // approach glitches in the last 30%
  if (!staticOnly && strike && progress > 0.7 && Math.random() < 0.12) {
    ctx.fillStyle = `rgba(255, 255, 220, ${0.04 + 0.10 * Math.random()})`;
    ctx.fillRect(0, 0, W_, H_);
  }
  // terminal flash on the final 1.5%
  if (!staticOnly && strike && progress >= 0.985) {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - (1 - progress) / 0.015})`;
    ctx.fillRect(0, 0, W_, H_);
  }

  if (!staticOnly && strike) ctx.restore();    // end shake transform

  // ── HEADER ───────────────────────────────────────────────────────────
  ctx.font = `600 ${Math.round(u * 0.55)}px JetBrains Mono, ui-monospace, monospace`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.85)';
  ctx.fillText('CH3 · CHARGE OPTICS', u * 0.6, u * 0.4);

  // stage chips — ON · SET · LAUNCH · IMPACT (right-aligned, big)
  if (strike) drawCamFullStageChips(ctx, progress, W_, H_, u);
  else {
    // linger phase — IMPACT highlighted
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 51, 34, 0.95)';
    ctx.font = `700 ${Math.round(u * 0.7)}px JetBrains Mono, ui-monospace, monospace`;
    ctx.fillText('// IMPACT', W_ - u * 0.6, u * 0.4);
  }

  // ── FOOTER ───────────────────────────────────────────────────────────
  if (strike) {
    const tgtCount = state.contacts.filter(c => c.alive
      && Math.hypot(c.x - strike.x, c.y - strike.y) <= STRIKE_RADIUS).length;
    const depth = Math.round((1 - progress) * 1200);
    // depth right
    ctx.font = `700 ${Math.round(u * 0.85)}px JetBrains Mono, ui-monospace, monospace`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(136, 255, 136, 0.92)';
    ctx.shadowColor = HOT;
    ctx.shadowBlur = 8;
    ctx.fillText(`DEPTH ${String(depth).padStart(4, '0')}M`, W_ - u * 0.6, H_ - u * 0.5);
    ctx.shadowBlur = 0;
    // tgt left
    ctx.textAlign = 'left';
    ctx.fillStyle = tgtCount > 0 ? 'rgba(255, 170, 68, 0.95)' : 'rgba(58, 140, 58, 0.7)';
    if (tgtCount > 0) { ctx.shadowColor = AMBER; ctx.shadowBlur = 8; }
    ctx.fillText(`TGT ${tgtCount}`, u * 0.6, H_ - u * 0.5);
    ctx.shadowBlur = 0;
  }
}

function drawCamFullCrosshair(ctx, cx, cy, u) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 170, 68, 0.65)';
  ctx.lineWidth = 2;
  ctx.shadowColor = AMBER;
  ctx.shadowBlur = 6;
  // crosshair arms — inner gap of 0.4u, arm length 1.5u
  const inner = u * 0.4, arm = u * 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - arm, cy); ctx.lineTo(cx - inner, cy);
  ctx.moveTo(cx + inner, cy); ctx.lineTo(cx + arm, cy);
  ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy - inner);
  ctx.moveTo(cx, cy + inner); ctx.lineTo(cx, cy + arm);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // center dot
  ctx.fillStyle = 'rgba(255, 170, 68, 0.8)';
  ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawCamFullCorners(ctx, W_, H_, u) {
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.65)';
  ctx.lineWidth = 2;
  const m = u * 0.5;        // margin from edge
  const k = u * 0.9;        // bracket arm length
  const corners = [
    [m, m, +k, 0], [m, m, 0, +k],
    [W_ - m, m, -k, 0], [W_ - m, m, 0, +k],
    [m, H_ - m, +k, 0], [m, H_ - m, 0, -k],
    [W_ - m, H_ - m, -k, 0], [W_ - m, H_ - m, 0, -k],
  ];
  for (const [x, y, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  }
}

function drawCamFullStageChips(ctx, progress, W_, H_, u) {
  ctx.save();
  ctx.font = `700 ${Math.round(u * 0.55)}px JetBrains Mono, ui-monospace, monospace`;
  ctx.textBaseline = 'top';
  const stages = [
    { label: 'ON',     active: true },
    { label: 'SET',    active: true },
    { label: 'LAUNCH', active: true },
    { label: 'IMPACT', active: progress > 0.85 },
  ];
  // right-anchored row
  const y = u * 0.45;
  let xRight = W_ - u * 0.6;
  for (let i = stages.length - 1; i >= 0; i--) {
    const s = stages[i];
    const isImpact = s.label === 'IMPACT';
    const c = s.active
      ? (isImpact ? 'rgba(255, 51, 34, 0.98)' : 'rgba(255, 170, 68, 0.92)')
      : 'rgba(58, 140, 58, 0.4)';
    ctx.fillStyle = c;
    if (s.active) {
      ctx.shadowColor = isImpact ? RED : AMBER;
      ctx.shadowBlur = isImpact ? 8 : 4;
    }
    ctx.textAlign = 'right';
    const w = ctx.measureText(s.label).width + u * 0.55;       // text + dot + spacing
    ctx.fillText(s.label, xRight, y);
    // dot to the left of the label
    ctx.beginPath();
    ctx.arc(xRight - ctx.measureText(s.label).width - u * 0.25, y + u * 0.25, u * 0.13, 0, TAU);
    ctx.fill();
    xRight -= w + u * 0.45;
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}

function drawCamFullStatic(ctx, intensity, t, W_, H_) {
  const dots = Math.floor(W_ * H_ * intensity / 40);
  for (let i = 0; i < dots; i++) {
    const x = Math.floor(Math.random() * W_);
    const y = Math.floor(Math.random() * H_);
    const v = Math.random();
    if (v < 0.45) ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    else if (v < 0.78) ctx.fillStyle = 'rgba(20, 50, 20, 0.7)';
    else ctx.fillStyle = `rgba(${130 + Math.random() * 80 | 0}, ${200 + Math.random() * 55 | 0}, ${130 + Math.random() * 80 | 0}, ${0.4 + 0.5 * Math.random()})`;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawCamFullScanlines(ctx, t, W_, H_) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
  for (let y = 1; y < H_; y += 4) ctx.fillRect(0, y, W_, 2);
  // sweeping band — VHS tracking line
  const sweepY = ((t * 80) % (H_ + 80)) - 40;
  ctx.fillStyle = 'rgba(140, 220, 140, 0.06)';
  ctx.fillRect(0, sweepY, W_, 18);
}

function drawCamFullLinger(ctx, linger, t, W_, H_) {
  const u = Math.min(W_, H_) / 24;
  const cx = W_ / 2, cy = H_ / 2;
  const age = t - linger.t0;
  const tProg = Math.min(1, age / IMPACT_LINGER);
  const tier = hitTier(linger.killed || 0, linger.inRadius || 0);
  const fadeIn = Math.min(1, age / 0.10);
  const fadeOut = 1 - tProg;
  const alpha = fadeIn * fadeOut;

  // bright white-hot flash (decays)
  ctx.fillStyle = `rgba(255, 245, 200, ${0.6 * fadeOut})`;
  ctx.fillRect(0, 0, W_, H_);

  // expanding shock ring
  const ringR = Math.min(W_, H_) * (0.10 + tProg * 0.45);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = `rgba(${tier.rgb}, ${fadeOut * 0.85})`;
  ctx.lineWidth = 4;
  ctx.shadowColor = tier.hex;
  ctx.shadowBlur = 30 * fadeOut;
  ctx.beginPath(); ctx.arc(0, 0, ringR, 0, TAU); ctx.stroke();
  // second ring for depth
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(${tier.rgb}, ${fadeOut * 0.45})`;
  ctx.beginPath(); ctx.arc(0, 0, ringR * 1.4, 0, TAU); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.restore();

  // BIG hit-count stamp + tier label — color-coded
  const yLift = -tProg * u * 0.4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(u * 3.0)}px JetBrains Mono, ui-monospace, monospace`;
  ctx.fillStyle = `rgba(${tier.rgb}, ${alpha})`;
  ctx.shadowColor = tier.hex;
  ctx.shadowBlur = 22 * fadeOut;
  ctx.fillText(`${linger.killed}/${linger.inRadius} HIT`, cx, cy - u * 0.3 + yLift);
  // tier label
  ctx.font = `700 ${Math.round(u * 1.2)}px JetBrains Mono, ui-monospace, monospace`;
  ctx.shadowBlur = 12 * fadeOut;
  ctx.fillStyle = `rgba(${tier.rgb}, ${alpha * 0.95})`;
  ctx.fillText(tier.label, cx, cy + u * 1.7 + yLift);
  // biomass earned
  if (linger.biomass) {
    ctx.font = `600 ${Math.round(u * 0.8)}px JetBrains Mono, ui-monospace, monospace`;
    ctx.fillStyle = `rgba(136, 255, 136, ${alpha * 0.9})`;
    ctx.shadowColor = HOT;
    ctx.shadowBlur = 8 * fadeOut;
    ctx.fillText(`+${linger.biomass} BIOMASS`, cx, cy + u * 2.9 + yLift);
  }
  ctx.shadowBlur = 0;
}
