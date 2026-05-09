// waves.js — DEEPWATCH v2 wave configs.
//
// Each spawn now references species (uniform array OR weighted object) from the
// bestiary instead of hard-coding `weight`. `useSpeciesSpeed: true` would scale
// velocity per species; default keeps wave-author velocity (vy field) for tight
// control over wave pacing.
//
// Species pools introduce per-contact RNG diversity within a single spawn —
// e.g. an "incoming swarm" with 70% Acidoplankton + 30% Sulfovermis produces a
// believable mixed shoal where individual blips have different blip color/scale,
// jitter, and biomass yield, but the formation centroid still reads cleanly.

export const WAVES = [
  {
    id: 1,
    name: 'TWIN PINCER',
    archetype: 'cluster',
    headliner: 'acidoplankton-tenuis',
    strikeBudget: 2,
    spawns: [
      // North: a mixed swarm-grade shoal — light, fast, easy first kill
      { t: 0.0, count: 5, formation: 'cluster', center: [320, -30], spread: 26, vy: 12, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.6, 'sulfovermis-gregarius': 0.4 } },
      // South: gelatinous mid-tier pelagic
      { t: 1.5, count: 4, formation: 'cluster', center: [400, 750], spread: 24, vy: 12, aim: 'rig',
        species: { 'sulfomedusa-abyssi': 0.7, 'chalcophyma-pulsans': 0.3 } },
    ],
  },
  {
    id: 2,
    name: 'CROSSFIRE',
    archetype: 'linear',
    headliner: 'acidonecton-vorax',
    strikeBudget: 2,
    spawns: [
      // West line: chitin-mantled cephalopodiforms
      { t: 0.0, count: 4, formation: 'line', center: [-30, 360], spread: 160, vy: 14, axis: 'y', aim: 'rig',
        species: { 'acidonecton-vorax': 1 } },
      // East line: pulser bells, irregular jitter
      { t: 2.0, count: 4, formation: 'line', center: [750, 360], spread: 160, vy: 14, axis: 'y', aim: 'rig',
        species: { 'chalcophyma-pulsans': 0.7, 'vitreonephes-glacialis': 0.3 } },
    ],
  },
  {
    id: 3,
    name: 'BIMODAL TRAP',
    archetype: 'bimodal',
    headliner: 'fluorapate-rigidum',
    strikeBudget: 2,
    spawns: [
      // Two pelagic clusters separated by ~240px — naive centroid lands in the gap
      { t: 0.0, count: 4, formation: 'cluster', center: [240, -30], spread: 24, vy: 18, aim: 'rig',
        species: { 'acidonecton-vorax': 0.6, 'fluorapate-rigidum': 0.4 } },
      { t: 0.0, count: 4, formation: 'cluster', center: [480, -30], spread: 24, vy: 18, aim: 'rig',
        species: { 'acidonecton-vorax': 0.6, 'chitinotherium-fossor': 0.4 } },
    ],
  },
  {
    id: 4,
    name: 'HEAVY MASS',
    archetype: 'weighted',
    headliner: 'barytolithus-reptans',
    strikeBudget: 2,
    spawns: [
      // Light swarm decoy from west
      { t: 0.0, count: 5, formation: 'cluster', center: [-30, 300], spread: 32, vy: 20, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.5, 'halophila-minima': 0.5 } },
      // Heavy benthic apex from east — pulls weighted centroid hard
      { t: 0.5, count: 1, formation: 'cluster', center: [750, 420], spread: 4, vy: 18, aim: 'rig',
        species: { 'barytolithus-reptans': 1 } },
    ],
  },
  {
    id: 5,
    name: 'DRIFTER',
    archetype: 'staggered',
    headliner: 'pyrithionyx-ferrosus',
    strikeBudget: 3,
    spawns: [
      // Slow lead group — drifters and mimics. The mimic appears small until close.
      { t: 0.0, count: 4, formation: 'cluster', center: [-30, 80], spread: 28, vy: 14, aim: 'rig',
        species: { 'vitreonephes-glacialis': 0.5, 'cryptocnidaria-mimica': 0.25, 'lampyronoctis-abyssalis': 0.25 } },
      // Fast follow group — predator-class iron-armored, with a single specialist
      { t: 2.5, count: 4, formation: 'cluster', center: [750, 640], spread: 26, vy: 24, aim: 'rig',
        species: { 'pyrithionyx-ferrosus': 0.75, 'acidocoryne-errans': 0.25 } },
    ],
  },
];
