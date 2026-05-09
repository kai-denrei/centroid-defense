// contacts.js — contact spawn, motion, weighted centroid, damage falloff.
// Pixel-space: origin (0,0) at canvas top-left, rig at (360, 360).

export const RIG = { x: 360, y: 360 };
export const SCOPE_R = 320;        // outer scope radius (pixels)
export const TURRET_R = 60;        // auto-turret range (pixels)
export const STRIKE_RADIUS = 80;   // depth-charge blast radius (pixels)
export const STRIKE_MAX_DMG = 100;
export const STRIKE_K = 1.5;       // falloff exponent — k=1.5 rewards precision without making near-misses worthless
export const STRIKE_DELAY = 2.4;   // seconds — sink time for the missile cinematic

// Bestiary lookups for the species-driven Contact factory and weighted
// pool resolution in materializeSpawn.
import { SPECIES_BY_ID, DEFAULT_SPECIES_ID, pickSpecies } from './bestiary.js';

// Contact factory. v2: species-driven. Stats (hp, weight, speed, biomass,
// blipColor, jitterAmp, abilities) are pulled from the bestiary entry.
// Per-contact ±15% RNG variance on hp keeps killcount-based gameplay honest
// without making the centroid math unstable.

export function makeContact(x, y, vx, vy, opts = {}) {
  // back-compat: opts may be a number (weight) or an object
  if (typeof opts === 'number') opts = { weight: opts };
  const speciesId = opts.speciesId || DEFAULT_SPECIES_ID;
  const sp = SPECIES_BY_ID[speciesId] || SPECIES_BY_ID[DEFAULT_SPECIES_ID];
  // ±15% HP variance for diversity within a wave
  const hpVar = 1 + (Math.random() - 0.5) * 0.30;
  const hp = Math.max(2, Math.round(sp.hp * hpVar));
  const weight = (opts.weight != null) ? opts.weight : sp.weight;
  return {
    x, y, vx, vy,
    speciesId,
    weight,
    hp, maxHp: hp,
    biomass: sp.biomass,
    abilities: sp.abilities,
    blipColor: sp.blipColor,
    blipScale: sp.blipScale,
    jitterAmp: sp.jitterAmp != null ? sp.jitterAmp : 1.0,
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
// v2: spawn.species accepts an array (uniform pick) or object {id: weight}
//     (weighted pick). Each contact gets its own species roll → real diversity
//     within a single spawn (e.g., a swarm with 70% Acidoplankton + 30%
//     Sulfovermis). aim: 'rig' overrides per-contact velocity to head at rig.
export function materializeSpawn(spawn) {
  const out = [];
  const { count, formation, center, spread, vx = 0, vy = 18, axis = 'x', aim, species } = spawn;
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
    // species pick — falls back to spawn.weight if no species pool given (v1 compat)
    const speciesId = species ? pickSpecies(species) : (spawn.speciesId || DEFAULT_SPECIES_ID);
    const sp = SPECIES_BY_ID[speciesId] || SPECIES_BY_ID[DEFAULT_SPECIES_ID];
    // velocity: spawn.vy is the target speed magnitude; species speed can scale it
    // (default speedScale 1.0 leaves wave authoring intact, but apex/swarm tweak)
    const baseSpeed = Math.hypot(vx, vy) || vy || sp.speed || 18;
    const speedScale = (spawn.useSpeciesSpeed) ? (sp.speed / 18) : 1;
    const speed = baseSpeed * speedScale;
    let cvx = vx, cvy = vy;
    if (aim === 'rig') {
      const v = toward(x, y, speed);
      cvx = v.vx; cvy = v.vy;
    } else if (speedScale !== 1) {
      cvx *= speedScale; cvy *= speedScale;
    }
    out.push(makeContact(x, y, cvx, cvy, { speciesId, weight: spawn.weight }));
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
    // jitter re-roll — scaled by species jitterAmp so erratic specialists
    // (Acidocoryne, Leviathys) are genuinely harder to lead than schoolers
    if (!c._jitterAt || now - c._jitterAt > JITTER_PERIOD) {
      const amp = JITTER_PX_PER_S * (c.jitterAmp || 1);
      c._jx = (Math.random() - 0.5) * 2 * amp;
      c._jy = (Math.random() - 0.5) * 2 * amp;
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

// Apply a depth-charge blast. Returns {killed, inRadius, trueCentroid, biomass}.
// `armored` species (Barytolithus, Megacidodon, Architeuthys, ordnance-soak
// specialists) take reduced ordnance damage. Biomass total tallied for kills.
export function applyBlast(contacts, blastPos) {
  const inRadius = contacts.filter(c => c.alive && Math.hypot(c.x - blastPos.x, c.y - blastPos.y) <= STRIKE_RADIUS);
  let killed = 0;
  let biomass = 0;
  const killedSpeciesIds = [];
  for (const c of inRadius) {
    let dmg = strikeDamage(c, blastPos);
    const armored = c.abilities && (c.abilities.includes('armored') || c.abilities.includes('ordnance-soak'));
    if (armored) dmg *= 0.5;
    c.hp -= dmg;
    if (c.hp <= 0) {
      c.alive = false;
      killed++;
      biomass += c.biomass || 0;
      killedSpeciesIds.push(c.speciesId);
    }
  }
  return { killed, inRadius, trueCentroid: weightedCentroid(inRadius), biomass, killedSpeciesIds };
}
