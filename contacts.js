// contacts.js — contact spawn, motion, weighted centroid, damage falloff.
// Pixel-space: origin (0,0) at canvas top-left, rig at (360, 360).

export const RIG = { x: 360, y: 360 };
export const SCOPE_R = 320;        // outer scope radius (pixels)
export const TURRET_R = 60;        // auto-turret range (pixels)
export const STRIKE_RADIUS = 80;   // depth-charge blast radius (pixels)
export const STRIKE_MAX_DMG = 100;
export const STRIKE_K = 1.5;       // falloff exponent — k=1.5 rewards precision without making near-misses worthless

// Contact factory. hp default = 20 light / 80 heavy (weight*20).
export function makeContact(x, y, vx, vy, weight = 1) {
  return {
    x, y, vx, vy,
    weight,
    hp: weight * 20,
    maxHp: weight * 20,
    alive: true,
    aliveAt: performance.now() / 1000,
    lastBleepAt: 0,
    id: Math.random().toString(36).slice(2, 8).toUpperCase(),
  };
}

// Build a wave's spawn list ahead of time. Wave config schema documented in waves.js.
// `toward(cx, cy, s)` returns a velocity vector pointing from spawn to rig at speed s,
// used by wave authors as a convenience — the engine does not auto-aim per PM directive.
export function toward(cx, cy, s) {
  const dx = RIG.x - cx, dy = RIG.y - cy;
  const m = Math.hypot(dx, dy) || 1;
  return { vx: s * dx / m, vy: s * dy / m };
}

// Materialize one spawn config into N contacts.
// `aim: 'rig'` overrides per-contact velocity so each contact heads at rig
// (path length differs across the formation, so outer contacts arrive later).
export function materializeSpawn(spawn) {
  const out = [];
  const { count, formation, center, spread, weight = 1, vx = 0, vy = 18, axis = 'x', aim } = spawn;
  const [cx, cy] = center;
  for (let i = 0; i < count; i++) {
    let x, y;
    if (formation === 'cluster') {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * spread;
      x = cx + Math.cos(a) * r;
      y = cy + Math.sin(a) * r;
    } else if (formation === 'line') {
      const t = (count === 1) ? 0.5 : i / (count - 1);
      const off = (t - 0.5) * spread;
      x = (axis === 'x') ? cx + off : cx;
      y = (axis === 'y') ? cy + off : cy;
    } else {
      x = cx; y = cy;
    }
    let cvx = vx, cvy = vy;
    if (aim === 'rig') {
      const speed = Math.hypot(vx, vy) || vy || 18;
      const v = toward(x, y, speed);
      cvx = v.vx; cvy = v.vy;
    }
    out.push(makeContact(x, y, cvx, cvy, weight));
  }
  return out;
}

// Update all live contacts. Apply jitter, motion, rig-collision detection.
// Returns rig-damage applied this frame (sum of HP of contacts that hit rig).
const RIG_HIT_RADIUS = 14;          // rig physical radius for collision
const JITTER_PX_PER_S = 2;          // per-axis velocity jitter magnitude
const JITTER_PERIOD = 1.0;          // re-roll jitter every 1s
export function updateContacts(contacts, dt, now) {
  let rigDamage = 0;
  for (const c of contacts) {
    if (!c.alive) continue;
    // jitter re-roll
    if (!c._jitterAt || now - c._jitterAt > JITTER_PERIOD) {
      c._jx = (Math.random() - 0.5) * 2 * JITTER_PX_PER_S;
      c._jy = (Math.random() - 0.5) * 2 * JITTER_PX_PER_S;
      c._jitterAt = now;
    }
    c.x += (c.vx + c._jx) * dt;
    c.y += (c.vy + c._jy) * dt;
    // rig collision
    const drx = c.x - RIG.x, dry = c.y - RIG.y;
    if (drx * drx + dry * dry < RIG_HIT_RADIUS * RIG_HIT_RADIUS) {
      c.alive = false;
      // light contacts deal 8/hit; heavy (weight 4) deals 32 — multiple hits to game-over
      rigDamage += c.weight * 8;
      c._hitRig = true;
    }
    // off-canvas south cull (counts as miss-and-gone, not rig hit)
    if (c.y > 760 || c.x < -40 || c.x > 760) {
      c.alive = false;
      c._exited = true;
    }
  }
  return rigDamage;
}

// Weighted centroid of an array of contacts. Returns null for empty input.
// Each contact's weight pulls the mean — heavier contacts dominate (wave 4 lesson).
export function weightedCentroid(contacts) {
  if (!contacts.length) return null;
  let sx = 0, sy = 0, sw = 0;
  for (const c of contacts) {
    sx += c.x * c.weight;
    sy += c.y * c.weight;
    sw += c.weight;
  }
  return sw > 0 ? { x: sx / sw, y: sy / sw } : null;
}

// Damage to one contact from a depth-charge blast at blastPos.
// Mirrors kika-centroid's gradient feel: every strike contributes something,
// but precision is rewarded. k=1.5 picks a middle that doesn't trivialize misses.
export function strikeDamage(contact, blastPos, RADIUS = STRIKE_RADIUS, MAX = STRIKE_MAX_DMG, k = STRIKE_K) {
  const dx = contact.x - blastPos.x;
  const dy = contact.y - blastPos.y;
  const d = Math.hypot(dx, dy);
  if (d > RADIUS) return 0;
  const t = 1 - d / RADIUS;
  return MAX * Math.pow(t, k);
}

// Bearing of contact from rig — 0 = north, increases clockwise.
// Used for sweep-crossing detection.
export function bearingFromRig(c) {
  return Math.atan2(c.x - RIG.x, -(c.y - RIG.y));
}

// Range of contact from rig (pixels).
export function rangeFromRig(c) {
  return Math.hypot(c.x - RIG.x, c.y - RIG.y);
}

// Angle-crossed test for sweep detection.
// Did the sweep moving (prev → cur) sweep past target? All inputs in radians.
const TAU = Math.PI * 2;
export function angleCrossed(prev, cur, target) {
  prev = ((prev % TAU) + TAU) % TAU;
  cur = ((cur % TAU) + TAU) % TAU;
  target = ((target % TAU) + TAU) % TAU;
  if (cur >= prev) return target > prev && target <= cur;
  return target > prev || target <= cur;     // wrapped through 0
}

// Auto-turret target: closest live contact within turret range, or null.
export function pickTurretTarget(contacts) {
  let best = null, bestD = Infinity;
  for (const c of contacts) {
    if (!c.alive) continue;
    const d = rangeFromRig(c);
    if (d <= TURRET_R && d < bestD) { best = c; bestD = d; }
  }
  return best;
}

// Prune blips: drop fully-faded ones, keep only newest 3 per contact.
const BLIP_TAU = 1.5;
export function pruneBlips(blips, now) {
  const live = blips.filter(b => Math.exp(-(now - b.t0) / BLIP_TAU) > 0.02);
  live.sort((a, b) => b.t0 - a.t0);     // newest first
  const counts = new Map();
  return live.filter(b => {
    const n = (counts.get(b.contactId) || 0) + 1;
    counts.set(b.contactId, n);
    return n <= 3;
  });
}

// Apply a depth-charge blast: damage contacts, return {killed, inRadius, trueCentroid}.
// Side effects are caller's responsibility (state.detonations push, sound, marker).
export function applyBlast(contacts, blastPos) {
  const inRadius = contacts.filter(c => c.alive && Math.hypot(c.x - blastPos.x, c.y - blastPos.y) <= STRIKE_RADIUS);
  let killed = 0;
  for (const c of inRadius) {
    c.hp -= strikeDamage(c, blastPos);
    if (c.hp <= 0) { c.alive = false; killed++; }
  }
  return { killed, inRadius, trueCentroid: weightedCentroid(inRadius) };
}
