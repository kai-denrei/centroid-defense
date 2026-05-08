// scope.js — Canvas 2D rendering for the PPI scope.
// Scope is sacred: no CRT effects on the canvas, only on the HUD chrome.
// All draw functions take ctx + state-fragments; state mutation lives in main.js.

import { RIG, SCOPE_R, TURRET_R, STRIKE_RADIUS } from './contacts.js';

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
export function drawBlips(ctx, blips, now) {
  for (const b of blips) {
    const age = now - b.t0;
    const TAU_DECAY = 1.5;
    const alpha = Math.exp(-age / TAU_DECAY);
    if (alpha < 0.02) continue;
    const r = 3 + b.weight * 1.4;            // weight scales blip size
    // bloom
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r * 4.5);
    grad.addColorStop(0, `rgba(136, 255, 136, ${0.55 * alpha})`);
    grad.addColorStop(0.4, `rgba(136, 255, 136, ${0.18 * alpha})`);
    grad.addColorStop(1, 'rgba(136, 255, 136, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 4.5, 0, TAU);
    ctx.fill();
    // core
    ctx.fillStyle = `rgba(220, 255, 220, ${alpha})`;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r * 0.55, 0, TAU);
    ctx.fill();
  }
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

// ── Munition cam — "video feed from the descending charge" ──────────────────
// Top-down view of the strike zone. View shrinks (zooms in) over the sink
// delay; contact silhouettes brighten as the charge closes; static thins.
// Cam dims are dynamic: desktop = 200×120, mobile = ~360×68 (wide strip).
// All draw geometry resolves against the dims passed in (window.__camDims).
const CAM_VIEW_FAR = 240;     // px world-radius shown at zoom=0
const CAM_VIEW_NEAR = 55;     // px world-radius shown at zoom=1
const STRIKE_DELAY = 1.2;

function camDims() {
  return (typeof window !== 'undefined' && window.__camDims) || { w: 200, h: 120 };
}

export function drawMissileCam(ctx, state, t) {
  const { w: CAM_W, h: CAM_H } = camDims();
  ctx.fillStyle = '#020602';
  ctx.fillRect(0, 0, CAM_W, CAM_H);
  // pick the strike closest to detonation (oldest in flight)
  const strike = state.pendingStrikes.length
    ? state.pendingStrikes.reduce((a, b) => a.t0 < b.t0 ? a : b)
    : null;
  if (!strike) {
    drawCamStatic(ctx, 0.10, CAM_W, CAM_H);
    drawCamScanlines(ctx, t, CAM_W, CAM_H);
    drawCamHeader(ctx, null, CAM_W, CAM_H);
    drawCamFooter(ctx, null, CAM_W, CAM_H);
    return;
  }
  const age = t - strike.t0;
  const progress = Math.min(1, age / STRIKE_DELAY);
  const viewR = CAM_VIEW_FAR - (CAM_VIEW_FAR - CAM_VIEW_NEAR) * progress;
  // scale uses the SHORTER dimension so the view fits no matter the aspect
  const scale = (Math.min(CAM_W, CAM_H) / 2) / viewR;

  // depth-tinted background
  const bg = ctx.createRadialGradient(CAM_W / 2, CAM_H / 2, 0, CAM_W / 2, CAM_H / 2, CAM_H);
  bg.addColorStop(0, `rgba(18, ${48 + 32 * progress}, 18, 1)`);
  bg.addColorStop(1, '#020602');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CAM_W, CAM_H);

  // contact silhouettes — drawn first so static + crosshair overlay them
  for (const c of state.contacts) {
    if (!c.alive) continue;
    const dx = c.x - strike.x, dy = c.y - strike.y;
    if (Math.hypot(dx, dy) > viewR * 1.3) continue;
    const sx = CAM_W / 2 + dx * scale;
    const sy = CAM_H / 2 + dy * scale;
    if (sx < -8 || sx > CAM_W + 8 || sy < -8 || sy > CAM_H + 8) continue;
    const baseR = (3 + c.weight * 1.4) * (0.7 + 1.6 * progress);
    // dark shadow halo
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, baseR * 2.2);
    sg.addColorStop(0, 'rgba(0, 0, 0, 0.85)');
    sg.addColorStop(0.55, 'rgba(0, 0, 0, 0.55)');
    sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sx, sy, baseR * 2.2, 0, Math.PI * 2);
    ctx.fill();
    // dim phosphor heat-signature core (fades in as the charge closes)
    if (progress > 0.35) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 8 + sx);
      ctx.fillStyle = `rgba(140, 210, 140, ${(progress - 0.35) * (0.5 + 0.4 * pulse)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, baseR * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // blast-radius ring — what dies when the charge lands
  const blastRpx = STRIKE_RADIUS * scale;
  if (blastRpx > 4 && blastRpx < CAM_W * 0.7) {
    ctx.strokeStyle = `rgba(255, 170, 68, ${0.30 + 0.45 * progress})`;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(CAM_W / 2, CAM_H / 2, blastRpx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawCamCrosshair(ctx, CAM_W, CAM_H);
  drawCamStatic(ctx, 0.05 + 0.10 * (1 - progress), CAM_W, CAM_H);
  drawCamScanlines(ctx, t, CAM_W, CAM_H);

  if (progress > 0.7 && Math.random() < 0.10) {
    ctx.fillStyle = `rgba(255, 255, 220, ${0.04 + 0.10 * Math.random()})`;
    ctx.fillRect(0, 0, CAM_W, CAM_H);
  }
  if (progress >= 0.985) {
    ctx.fillStyle = `rgba(255, 255, 255, ${1 - (1 - progress) / 0.015})`;
    ctx.fillRect(0, 0, CAM_W, CAM_H);
  }

  const tgtCount = state.contacts.filter(c => c.alive && Math.hypot(c.x - strike.x, c.y - strike.y) <= STRIKE_RADIUS).length;
  drawCamHeader(ctx, { progress }, CAM_W, CAM_H);
  drawCamFooter(ctx, { progress, tgtCount }, CAM_W, CAM_H);
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
