// base.js — Sea Base view (Mode B). Renders the rig from above-water
// during the build phase between waves. Pure Canvas 2D, mobile-friendly:
//
//   - water bg = static radial gradient (1 fillRect/frame)
//   - rig sprite = pre-rendered offscreen at boot, blitted each frame
//   - ripple particles = pool of 32 reused (no per-frame allocation),
//     each is 2 stroke arcs/frame
//   - drones = simple chevron triangles (3 lines + faint fade trail)
//
// Underwater creatures stay hidden. Only ripples on the surface (and during
// combat: turret tracers) hint at activity below. The "blind operator"
// tension that the radar mode owns is preserved in this view too.

import { RIG, SCOPE_R } from './contacts.js';

const TAU = Math.PI * 2;
const W = 720, H = 720;

// ── Palette (Mode B) ────────────────────────────────────────────────────────
const WATER_OUTER = '#0a1820';
const WATER_MID   = '#152832';
const WATER_INNER = '#1a3040';
const RIG_DECK    = '#3a4248';
const RIG_DECK_HIGHLIGHT = '#525a60';
const RIG_PANEL   = '#252b30';
const PHOSPHOR_HOT = '#88ff88';
const PHOSPHOR_MID = '#3a8c3a';
const AMBER = '#ffaa44';
const RIPPLE_COLOR = 'rgba(170, 200, 224';   // alpha appended at draw time

const RIG_RADIUS = 88;          // outer hex platform radius
const DRONE_ORBIT = 130;        // px from center
const DRONE_ANGULAR_SPEED = 0.40;  // rad/s clockwise

// ── Pre-rendered rig sprite ─────────────────────────────────────────────────
// Drawn once at boot to an offscreen canvas, blitted via drawImage each frame.
let rigSpriteCanvas = null;
function bakeRigSprite() {
  const c = document.createElement('canvas');
  // generous pad for outer glow
  const PAD = 24;
  const SZ = (RIG_RADIUS + PAD) * 2;
  c.width = c.height = SZ;
  const ctx = c.getContext('2d');
  const cx = SZ / 2, cy = SZ / 2;
  // outer hex platform — 6-sided polygon stroke
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = RIG_DECK;
  ctx.fillStyle = RIG_PANEL;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 - Math.PI / 2;
    const x = cx + Math.cos(a) * RIG_RADIUS;
    const y = cy + Math.sin(a) * RIG_RADIUS;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // four landing pylons at 0/90/180/270 — small rectangles between rig and water
  ctx.fillStyle = RIG_DECK;
  for (let i = 0; i < 4; i++) {
    const a = i * (TAU / 4);
    const x = cx + Math.cos(a) * (RIG_RADIUS - 12);
    const y = cy + Math.sin(a) * (RIG_RADIUS - 12);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.fillRect(-8, -3, 16, 6);
    ctx.restore();
  }
  // inner deck plate — slightly lighter hex inset
  ctx.fillStyle = RIG_DECK_HIGHLIGHT;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 - Math.PI / 2;
    const x = cx + Math.cos(a) * (RIG_RADIUS * 0.62);
    const y = cy + Math.sin(a) * (RIG_RADIUS * 0.62);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  // amber deck-light ring (faint glow around inner deck)
  ctx.strokeStyle = `rgba(255, 170, 68, 0.5)`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, RIG_RADIUS * 0.66, 0, TAU); ctx.stroke();
  // central antenna spire — small phosphor circle + line
  ctx.strokeStyle = PHOSPHOR_MID;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy - 18);
  ctx.stroke();
  // phosphor core dot at antenna base
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
  grad.addColorStop(0, PHOSPHOR_HOT);
  grad.addColorStop(0.5, PHOSPHOR_MID);
  grad.addColorStop(1, 'rgba(58,140,58,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, TAU); ctx.fill();
  ctx.fillStyle = PHOSPHOR_HOT;
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, TAU); ctx.fill();
  // small auto-turret marker at top of rig (north) — amber dot ring
  const tx = cx, ty = cy - RIG_RADIUS * 0.4;
  ctx.fillStyle = AMBER;
  ctx.shadowColor = AMBER; ctx.shadowBlur = 4;
  ctx.beginPath(); ctx.arc(tx, ty, 3, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  rigSpriteCanvas = c;
}

// ── Ripple particle pool ────────────────────────────────────────────────────
const RIPPLE_POOL_SIZE = 32;
const RIPPLE_SPAWN_RATE = 1.5;        // ripples/sec during build phase
const RIPPLE_MIN_R = 8;
const RIPPLE_MAX_R_LO = 22;
const RIPPLE_MAX_R_HI = 36;
const RIPPLE_DUR_LO = 1.8;
const RIPPLE_DUR_HI = 2.8;

// Initialize one Ripple slot in the pool (zeroed inactive object).
function makeRipple() {
  return { x: 0, y: 0, t0: 0, maxR: 0, duration: 0, alive: false };
}

// Allocate the pool once. Caller (state.ripples) holds these.
export function initRipplePool() {
  const pool = [];
  for (let i = 0; i < RIPPLE_POOL_SIZE; i++) pool.push(makeRipple());
  return pool;
}

// Activate a free pool slot. Returns true if spawned, false if pool full.
function spawnRipple(pool, t) {
  for (const r of pool) {
    if (!r.alive) {
      // Random position in water annulus around rig (avoid the rig deck).
      const a = Math.random() * TAU;
      const dist = (RIG_RADIUS + 18) + Math.random() * (SCOPE_R - RIG_RADIUS - 26);
      r.x = RIG.x + Math.cos(a) * dist;
      r.y = RIG.y + Math.sin(a) * dist;
      r.t0 = t;
      r.maxR = RIPPLE_MAX_R_LO + Math.random() * (RIPPLE_MAX_R_HI - RIPPLE_MAX_R_LO);
      r.duration = RIPPLE_DUR_LO + Math.random() * (RIPPLE_DUR_HI - RIPPLE_DUR_LO);
      r.alive = true;
      return true;
    }
  }
  return false;
}

// Targeted ripple — used by drone tracers to leave an impact splash where
// the contact (still hidden underwater) was struck. `small=true` shrinks
// the ripple so an impact reads as a tighter splash than ambient water.
function spawnRippleAt(pool, x, y, t, small) {
  if (!pool) return false;
  for (const r of pool) {
    if (!r.alive) {
      r.x = x; r.y = y; r.t0 = t;
      r.maxR = small
        ? (RIPPLE_MIN_R + Math.random() * 6)
        : (RIPPLE_MAX_R_LO + Math.random() * (RIPPLE_MAX_R_HI - RIPPLE_MAX_R_LO));
      r.duration = small
        ? (0.6 + Math.random() * 0.4)
        : (RIPPLE_DUR_LO + Math.random() * (RIPPLE_DUR_HI - RIPPLE_DUR_LO));
      r.alive = true;
      return true;
    }
  }
  return false;
}

let _ripplePending = 0;
// Procedurally seeds new ripples at RIPPLE_SPAWN_RATE per second. Call each
// frame during build_phase. Does nothing during waves (so radar render path
// doesn't accumulate budget).
export function seedRipples(state, dt, t) {
  if (!state.ripples) return;
  _ripplePending += dt * RIPPLE_SPAWN_RATE;
  while (_ripplePending >= 1) {
    spawnRipple(state.ripples, t);
    _ripplePending -= 1;
  }
}

function drawRipples(ctx, ripples, t) {
  for (const r of ripples) {
    if (!r.alive) continue;
    const age = t - r.t0;
    if (age >= r.duration) { r.alive = false; continue; }
    const tProg = age / r.duration;
    const radius = r.maxR * tProg;
    const alpha = (1 - tProg) * 0.7;
    // outer ring
    ctx.strokeStyle = `${RIPPLE_COLOR}, ${alpha.toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, radius, 0, TAU); ctx.stroke();
    // inner ring (slightly behind, dimmer) — only after ripple has expanded
    if (radius > 8) {
      ctx.strokeStyle = `${RIPPLE_COLOR}, ${(alpha * 0.45).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(r.x, r.y, radius * 0.62, 0, TAU); ctx.stroke();
    }
  }
}

// ── Drone class ─────────────────────────────────────────────────────────────
export function makeDrone(t) {
  return {
    angle: Math.random() * TAU,
    orbitRadius: DRONE_ORBIT + (Math.random() - 0.5) * 8,
    angularSpeed: DRONE_ANGULAR_SPEED + (Math.random() - 0.5) * 0.08,
    deployedAt: t,
  };
}

// Compute world-space drone position. Used by both render and drone-tracer.
function dronePos(d) {
  return {
    x: RIG.x + Math.cos(d.angle) * d.orbitRadius,
    y: RIG.y + Math.sin(d.angle) * d.orbitRadius,
  };
}

// Drone muzzle tracers — for each recent state.turretShot, find the drone
// closest to the target and draw a brief tracer line + muzzle flash. Also
// spawns a ripple at the target position so the strike location reads
// underwater (the contact itself stays hidden).
function drawDroneTracers(ctx, drones, turretShots, ripples, t) {
  if (!drones || !drones.length || !turretShots || !turretShots.length) return;
  for (const shot of turretShots) {
    const age = t - shot.t0;
    if (age > 0.12) continue;
    // pick nearest drone to the shot's target — visually believable
    let best = null, bestD = Infinity;
    for (const d of drones) {
      const p = dronePos(d);
      const dist = Math.hypot(p.x - shot.x, p.y - shot.y);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    if (!best) continue;
    const p = dronePos(best);
    const fade = 1 - age / 0.12;
    // tracer line — amber, fades fast
    ctx.strokeStyle = `rgba(255, 170, 68, ${(fade * 0.85).toFixed(3)})`;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 6 * fade;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(shot.x, shot.y);
    ctx.stroke();
    // muzzle flash at drone
    ctx.fillStyle = `rgba(255, 245, 200, ${(fade * 0.95).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, TAU); ctx.fill();
    // impact splash at target
    ctx.fillStyle = `rgba(255, 170, 68, ${(fade * 0.55).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(shot.x, shot.y, 4, 0, TAU); ctx.fill();
    ctx.shadowBlur = 0;
    // First frame of the shot: spawn a ripple at the target so the impact
    // leaves a visible water trace after the tracer fades. Single ripple
    // per shot — `_lastRippleSpawnedAt` keyed on shot identity.
    if (!shot._rigRippleSpawned) {
      spawnRippleAt(ripples, shot.x, shot.y, t, /*small=*/ true);
      shot._rigRippleSpawned = true;
    }
  }
}

function drawDrones(ctx, drones, t, dt) {
  if (!drones || !drones.length) return;
  ctx.save();
  ctx.translate(RIG.x, RIG.y);
  for (const d of drones) {
    d.angle = (d.angle + d.angularSpeed * dt) % TAU;
    const x = Math.cos(d.angle) * d.orbitRadius;
    const y = Math.sin(d.angle) * d.orbitRadius;
    const heading = d.angle + Math.PI / 2;     // tangent to orbit (forward direction)
    // chevron: 3 short lines forming a triangle pointing along heading
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.strokeStyle = PHOSPHOR_HOT;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = PHOSPHOR_HOT;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(-4, 4);
    ctx.lineTo(4, 4);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // faint trail behind (single ghost chevron one step back)
    const trailA = d.angle - d.angularSpeed * 0.18;
    const tx = Math.cos(trailA) * d.orbitRadius;
    const ty = Math.sin(trailA) * d.orbitRadius;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(trailA + Math.PI / 2);
    ctx.strokeStyle = `rgba(136, 255, 136, 0.18)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -4); ctx.lineTo(-3, 3); ctx.lineTo(3, 3);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

// ── Top-level render ────────────────────────────────────────────────────────
export function drawBase(ctx, state, t, dt) {
  // (1) water gradient — single fillRect, mobile-cheap
  if (!drawBase._waterGrad) {
    const g = ctx.createRadialGradient(RIG.x, RIG.y, 30, RIG.x, RIG.y, SCOPE_R + 60);
    g.addColorStop(0, WATER_INNER);
    g.addColorStop(0.55, WATER_MID);
    g.addColorStop(1, WATER_OUTER);
    drawBase._waterGrad = g;
  }
  ctx.fillStyle = drawBase._waterGrad;
  ctx.fillRect(0, 0, W, H);

  // (2) faint outer scope-ring outline (so the play-area is still readable)
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(RIG.x, RIG.y, SCOPE_R, 0, TAU);
  ctx.stroke();

  // (3) ripples (water-surface motion — implies sub-surface activity)
  drawRipples(ctx, state.ripples || [], t);

  // (4) rig sprite — pre-rendered, single drawImage
  if (!rigSpriteCanvas) bakeRigSprite();
  const sz = rigSpriteCanvas.width;
  ctx.drawImage(rigSpriteCanvas, RIG.x - sz / 2, RIG.y - sz / 2);

  // (5) drones (allies — orbiting the rig)
  drawDrones(ctx, state.drones || [], t, dt);

  // (6) drone muzzle tracers — show point-defense engaging hidden contacts
  drawDroneTracers(ctx, state.drones || [], state.turretShots || [], state.ripples, t);

  // (7) corner readout — clinical register, tells the operator what they're seeing
  ctx.font = '600 9px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(58, 140, 58, 0.65)';
  ctx.fillText('// SURFACE OBSERVATION · CASS-3 · TOP-DOWN', 12, 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = `rgba(255, 170, 68, 0.7)`;
  ctx.fillText(state.phase === 'build_phase' ? 'BUILD PHASE' : 'WAVE ACTIVE', W - 12, 12);
}
