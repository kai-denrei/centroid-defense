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

// Box-Muller — sample from N(0,1). Used for per-contact speed noise +
// Gaussian cluster sampling. Note: this returns ONE sample; to get a 2D
// Gaussian cluster we sample r and θ independently (see materializeSpawn).
function gaussian01() {
  const u1 = Math.max(Math.random(), 1e-6);
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function makeContact(x, y, vx, vy, opts = {}) {
  // back-compat: opts may be a number (weight) or an object
  if (typeof opts === 'number') opts = { weight: opts };
  const speciesId = opts.speciesId || DEFAULT_SPECIES_ID;
  const sp = SPECIES_BY_ID[speciesId] || SPECIES_BY_ID[DEFAULT_SPECIES_ID];
  // ±15% HP variance for diversity within a wave
  const hpVar = 1 + (Math.random() - 0.5) * 0.30;
  const hp = Math.max(2, Math.round(sp.hp * hpVar));
  const weight = (opts.weight != null) ? opts.weight : sp.weight;
  // Per-individual stochastic motion params. Zero-mean / phase-random so the
  // group centroid remains a stable target despite individuals looking varied.
  const jitterAmp = sp.jitterAmp != null ? sp.jitterAmp : 1.0;
  return {
    x, y, vx, vy,
    speciesId,
    weight,
    hp, maxHp: hp,
    biomass: sp.biomass,
    abilities: sp.abilities,
    blipColor: sp.blipColor,
    blipScale: sp.blipScale,
    jitterAmp,
    // Sinusoidal swim wobble (perpendicular to motion). Amplitude ~9 px/s at
    // jitterAmp=1 → ~2.9 px peak displacement at 0.5 Hz. Random phase + freq
    // per contact so a school doesn't swim in lockstep.
    wobbleAmp: jitterAmp * 9,
    wobbleFreq: 0.30 + Math.random() * 0.40,           // 0.30 .. 0.70 Hz
    wobblePhase: Math.random() * Math.PI * 2,
    // Per-contact random-jitter re-roll period (was a fixed 1.0s constant)
    _jitterPeriod: 0.60 + Math.random() * 0.80,        // 0.60 .. 1.40 s
    alive: true,
    aliveAt: performance.now() / 1000,
    detected: false,
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
//
// v2.0.5 stochastic motion layers (each preserves group centroid):
//   - Cluster formation now Gaussian (Box-Muller). Denser core, occasional
//     outliers — naturalistic spread.
//   - Per-individual speed noise: gaussian(σ=0.10) clamped to [0.7, 1.3].
//     A 4-of-a-kind cluster has individuals at 80%-120% of nominal speed →
//     they spread apart over time but the centroid moves at nominal.
//   - Species-relative speed: in a mixed-species pool, each species' speed
//     is normalized to the pool's mean. Larger/slower species lag, smaller/
//     faster species lead within the same group. Mean = pool nominal.
//   - Spawn-time stagger: each contact pushed back along velocity by a
//     random 0..staggerJitter seconds. Visually they trickle in instead of
//     appearing en masse. Default 0.30s for clusters, 0 for lines.
export function materializeSpawn(spawn) {
  const out = [];
  const { count, formation, center, spread, vx = 0, vy = 18, axis = 'x', aim, species } = spawn;
  const [cx, cy] = center;
  // Default cluster gets a small spawn-time stagger; wave authors can override.
  const staggerJitter = (spawn.staggerJitter != null)
    ? spawn.staggerJitter
    : (formation === 'cluster' ? 0.30 : 0);
  // Pre-compute mean species speed across the pool so we can scale individuals
  // relative to the pool average rather than re-baselining the centroid.
  const speciesPoolIds = species
    ? (Array.isArray(species) ? species : Object.keys(species))
    : [spawn.speciesId || DEFAULT_SPECIES_ID];
  const poolMean = speciesPoolIds.reduce((s, id) => s + (SPECIES_BY_ID[id]?.speed || 18), 0) / speciesPoolIds.length;
  for (let i = 0; i < count; i++) {
    let x, y;
    if (formation === 'cluster') {
      // Gaussian (Box-Muller). σ ≈ 0.55 × spread → 99% within ~1.4× spread,
      // mean radius ≈ 0.69 × spread (comparable to uniform-disc 0.67×).
      const sigma = spread * 0.55;
      const r = Math.sqrt(-2 * Math.log(Math.max(Math.random(), 1e-6))) * sigma;
      const a = Math.random() * Math.PI * 2;
      x = cx + r * Math.cos(a);
      y = cy + r * Math.sin(a);
    } else if (formation === 'line') {
      const t = (count === 1) ? 0.5 : i / (count - 1);
      const off = (t - 0.5) * spread;
      x = (axis === 'x') ? cx + off : cx;
      y = (axis === 'y') ? cy + off : cy;
    } else {
      x = cx; y = cy;
    }
    // species pick (back-compat with spawn.weight / spawn.speciesId)
    const speciesId = species ? pickSpecies(species) : (spawn.speciesId || DEFAULT_SPECIES_ID);
    const sp = SPECIES_BY_ID[speciesId] || SPECIES_BY_ID[DEFAULT_SPECIES_ID];
    // Speed scaling chain: species-relative × per-individual gaussian noise.
    const speciesRel = sp.speed / poolMean;            // 1.0 if single-species pool
    const noise = Math.max(0.70, Math.min(1.30, 1 + gaussian01() * 0.10));
    const totalScale = speciesRel * noise;
    const baseSpeed = Math.hypot(vx, vy) || vy || sp.speed || 18;
    const speed = baseSpeed * totalScale;
    let cvx = vx * totalScale, cvy = vy * totalScale;
    if (aim === 'rig') {
      const v = toward(x, y, speed);
      cvx = v.vx; cvy = v.vy;
    }
    // Spawn-time stagger — push back along velocity so individuals "trickle in."
    if (staggerJitter > 0) {
      const dtBack = Math.random() * staggerJitter;
      x -= cvx * dtBack;
      y -= cvy * dtBack;
    }
    out.push(makeContact(x, y, cvx, cvy, { speciesId, weight: spawn.weight }));
  }
  return out;
}

// Update all live contacts. Apply jitter + sinusoidal wobble + motion +
// rig-collision detection. Returns rig damage this frame.
//
// Stochastic motion layers (zero-mean — centroid stays predictable):
//   1. Drift velocity (c.vx, c.vy) — per-contact constant from spawn (carries
//      species-relative + per-individual gaussian speed scaling already baked in)
//   2. Sinusoidal swim wobble — perpendicular to motion, sin(phase + 2π·freq·t)
//      Random phase + freq per contact → no lockstep. Peak displacement
//      ≈ wobbleAmp / (2π·freq). Visible swim sway.
//   3. Random jitter — uniform ±0.6×jitterAmp px/s, re-rolled at random
//      0.6-1.4s intervals per contact. High-frequency shimmer.
const RIG_HIT_RADIUS = 14;
const JITTER_PX_PER_S = 2 * 0.6;     // reduced from raw 2.0 — wobble carries the bulk now
export function updateContacts(contacts, dt, now) {
  let rigDamage = 0;
  for (const c of contacts) {
    if (!c.alive) continue;
    // (1) random jitter re-roll, period randomized per contact
    if (!c._jitterAt || now - c._jitterAt > c._jitterPeriod) {
      const amp = JITTER_PX_PER_S * (c.jitterAmp || 1);
      c._jx = (Math.random() - 0.5) * 2 * amp;
      c._jy = (Math.random() - 0.5) * 2 * amp;
      c._jitterAt = now;
      c._jitterPeriod = 0.60 + Math.random() * 0.80;
    }
    // (2) sinusoidal swim wobble — perpendicular to current motion
    let wobbleVx = 0, wobbleVy = 0;
    if (c.wobbleAmp) {
      const sp = Math.hypot(c.vx, c.vy) || 1;
      const perpX = -c.vy / sp, perpY = c.vx / sp;
      const phase = c.wobblePhase + 2 * Math.PI * c.wobbleFreq * (now - c.aliveAt);
      const w = c.wobbleAmp * Math.sin(phase);
      wobbleVx = perpX * w;
      wobbleVy = perpY * w;
    }
    c.x += (c.vx + c._jx + wobbleVx) * dt;
    c.y += (c.vy + c._jy + wobbleVy) * dt;
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
