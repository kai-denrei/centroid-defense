// waves.js — five hand-authored waves teaching one centroid archetype each.
// Coordinates are canvas pixels (origin top-left). Rig at (360, 360).
// Spawn config: { t, count, formation, center, spread, weight?, vx?, vy?, axis?, aim? }
//   t          — seconds after wave start when this spawn fires
//   count      — number of contacts in this spawn
//   formation  — 'cluster' (gaussian-ish disc) or 'line'
//   center     — [x, y] pixel anchor for the formation (negative or > canvas-size = off-edge)
//   spread     — px radius for cluster, total length for line
//   weight     — mass multiplier; heavy contacts pull centroid harder
//   vx, vy     — velocity in px/s. With aim:'rig', |v| is the speed magnitude
//   axis       — 'x' or 'y' for line formation orientation
//   aim        — 'rig' to override (vx,vy) so each contact homes at rig at speed |v|

// v1.1 tunes (per Gerald: ≥2 bombs/wave, sub-waves from different sides, slightly faster pace):
// - default contact speed bumped from 18 to 22 px/s
// - all waves carry ≥2 strikes; wave 5 carries 3
// - every wave spawns from at least two distinct bearings around the rig

export const WAVES = [
  {
    id: 1,
    name: 'TWIN PINCER',
    archetype: 'cluster',
    strikeBudget: 2,
    spawns: [
      { t: 0.0, count: 4, formation: 'cluster', center: [320, -30],  spread: 22, weight: 1, vy: 22, aim: 'rig' },
      { t: 1.0, count: 4, formation: 'cluster', center: [400, 750],  spread: 22, weight: 1, vy: 22, aim: 'rig' },
    ],
  },
  {
    id: 2,
    name: 'CROSSFIRE',
    archetype: 'linear',
    strikeBudget: 2,
    spawns: [
      // line from west, drifting east toward rig
      { t: 0.0, count: 4, formation: 'line', center: [-30, 360], spread: 160, weight: 1, vy: 22, axis: 'y', aim: 'rig' },
      // line from east, drifting west toward rig — 1.5s stagger gives the player two distinct strike windows
      { t: 1.5, count: 4, formation: 'line', center: [750, 360], spread: 160, weight: 1, vy: 22, axis: 'y', aim: 'rig' },
    ],
  },
  {
    id: 3,
    name: 'BIMODAL TRAP',
    archetype: 'bimodal',
    strikeBudget: 2,
    spawns: [
      // two clusters from the north, separated by ~240px. Naive centroid lies in the gap.
      // The trap: a centered strike kills nobody. Either cluster needs its own strike.
      { t: 0.0, count: 4, formation: 'cluster', center: [240, -30], spread: 22, weight: 1, vy: 22, aim: 'rig' },
      { t: 0.0, count: 4, formation: 'cluster', center: [480, -30], spread: 22, weight: 1, vy: 22, aim: 'rig' },
    ],
  },
  {
    id: 4,
    name: 'HEAVY MASS',
    archetype: 'weighted',
    strikeBudget: 2,
    spawns: [
      // light cluster from the west, heavy single from the east — different mass, opposite sides.
      // The lesson: weighted centroid pulls toward the heavy; commit a strike to it specifically.
      { t: 0.0, count: 4, formation: 'cluster', center: [-30, 300], spread: 30, weight: 1, vy: 22, aim: 'rig' },
      { t: 0.0, count: 1, formation: 'cluster', center: [750, 420], spread: 4,  weight: 4, vy: 22, aim: 'rig' },
    ],
  },
  {
    id: 5,
    name: 'DRIFTER',
    archetype: 'staggered',
    strikeBudget: 3,
    spawns: [
      // slow group from NW corner — gentle drift, ample lead-time
      { t: 0.0, count: 4, formation: 'cluster', center: [-30, 80],  spread: 26, weight: 1, vy: 16, aim: 'rig' },
      // fast group from SE corner — 2.5s stagger, 70% faster
      { t: 2.5, count: 4, formation: 'cluster', center: [750, 640], spread: 26, weight: 1, vy: 28, aim: 'rig' },
    ],
  },
];
