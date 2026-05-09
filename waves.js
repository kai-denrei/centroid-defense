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

// Spawn-time and origin positions are jittered randomly within small windows
// at materialize time — see materializeSpawn() in contacts.js. The numbers
// below set the *deterministic* skeleton; per-run variance comes from RNG.
export const WAVES = [
  {
    id: 1,
    name: 'TWIN PINCER',
    archetype: 'cluster',
    headliner: 'acidoplankton-tenuis',
    strikeBudget: 2,
    spawns: [
      // North: a mixed swarm-grade shoal — light, fast, easy first kill
      { t: 0.0, count: 10, formation: 'cluster', center: [320, -30], spread: 38, vy: 12, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.55, 'sulfovermis-gregarius': 0.30, 'halophila-minima': 0.15 } },
      // South: gelatinous mid-tier pelagic
      { t: 1.5, count: 9, formation: 'cluster', center: [400, 750], spread: 36, vy: 12, aim: 'rig',
        species: { 'sulfomedusa-abyssi': 0.55, 'chalcophyma-pulsans': 0.30, 'vitreonephes-glacialis': 0.15 } },
      // East trickle — late stragglers, random species
      { t: 3.5, count: 5, formation: 'cluster', center: [750, 240], spread: 40, vy: 14, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.5, 'sulfovermis-gregarius': 0.5 } },
      // Late west pulse
      { t: 5.5, count: 4, formation: 'cluster', center: [-30, 480], spread: 30, vy: 14, aim: 'rig',
        species: { 'sulfomedusa-abyssi': 0.5, 'halophila-minima': 0.5 } },
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
      { t: 0.0, count: 8, formation: 'line', center: [-30, 360], spread: 240, vy: 14, axis: 'y', aim: 'rig',
        species: { 'acidonecton-vorax': 0.75, 'sulfovermis-gregarius': 0.25 } },
      // East line: pulser bells, irregular jitter
      { t: 1.8, count: 8, formation: 'line', center: [750, 360], spread: 240, vy: 14, axis: 'y', aim: 'rig',
        species: { 'chalcophyma-pulsans': 0.55, 'vitreonephes-glacialis': 0.30, 'sulfomedusa-abyssi': 0.15 } },
      // South ambush — small mixed cluster mid-wave
      { t: 4.0, count: 6, formation: 'cluster', center: [360, 750], spread: 32, vy: 16, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.6, 'halophila-minima': 0.4 } },
      // Late surprise — fast small north group
      { t: 5.5, count: 4, formation: 'cluster', center: [240, -30], spread: 26, vy: 22, aim: 'rig',
        species: { 'acidonecton-vorax': 0.7, 'pyrithionyx-ferrosus': 0.3 } },
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
      { t: 0.0, count: 8, formation: 'cluster', center: [240, -30], spread: 32, vy: 18, aim: 'rig',
        species: { 'acidonecton-vorax': 0.5, 'fluorapate-rigidum': 0.35, 'sulfomedusa-abyssi': 0.15 } },
      { t: 0.0, count: 8, formation: 'cluster', center: [480, -30], spread: 32, vy: 18, aim: 'rig',
        species: { 'acidonecton-vorax': 0.5, 'chitinotherium-fossor': 0.35, 'chalcophyma-pulsans': 0.15 } },
      // Late drift from south flank
      { t: 2.8, count: 6, formation: 'cluster', center: [-30, 480], spread: 36, vy: 16, aim: 'rig',
        species: { 'sulfomedusa-abyssi': 0.6, 'vitreonephes-glacialis': 0.4 } },
      // Reinforcement — east stragglers
      { t: 4.8, count: 4, formation: 'cluster', center: [750, 600], spread: 30, vy: 18, aim: 'rig',
        species: { 'acidonecton-vorax': 0.6, 'fluorapate-rigidum': 0.4 } },
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
      { t: 0.0, count: 9, formation: 'cluster', center: [-30, 300], spread: 38, vy: 20, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.45, 'halophila-minima': 0.40, 'sulfovermis-gregarius': 0.15 } },
      // Heavy benthic apex from east — pulls weighted centroid hard
      { t: 0.5, count: 3, formation: 'cluster', center: [750, 420], spread: 18, vy: 18, aim: 'rig',
        species: { 'barytolithus-reptans': 1 } },
      // North harassment — small fast pack
      { t: 2.0, count: 7, formation: 'cluster', center: [420, -30], spread: 32, vy: 22, aim: 'rig',
        species: { 'acidonecton-vorax': 0.6, 'pyrithionyx-ferrosus': 0.4 } },
      // Late south wave
      { t: 4.5, count: 5, formation: 'cluster', center: [200, 750], spread: 30, vy: 18, aim: 'rig',
        species: { 'sulfovermis-gregarius': 0.5, 'acidoplankton-tenuis': 0.5 } },
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
      { t: 0.0, count: 8, formation: 'cluster', center: [-30, 80], spread: 36, vy: 14, aim: 'rig',
        species: { 'vitreonephes-glacialis': 0.45, 'cryptocnidaria-mimica': 0.30, 'lampyronoctis-abyssalis': 0.25 } },
      // Fast follow group — predator-class iron-armored, with a single specialist
      { t: 2.0, count: 8, formation: 'cluster', center: [750, 640], spread: 32, vy: 24, aim: 'rig',
        species: { 'pyrithionyx-ferrosus': 0.65, 'acidocoryne-errans': 0.20, 'megacidodon-profundi': 0.15 } },
      // Mid-wave swarm reinforcement — random direction
      { t: 4.0, count: 7, formation: 'cluster', center: [120, 750], spread: 32, vy: 18, aim: 'rig',
        species: { 'acidoplankton-tenuis': 0.7, 'sulfovermis-gregarius': 0.3 } },
      // Final surge — north convergence
      { t: 6.0, count: 5, formation: 'cluster', center: [480, -30], spread: 28, vy: 20, aim: 'rig',
        species: { 'acidonecton-vorax': 0.6, 'pyrithionyx-ferrosus': 0.4 } },
    ],
  },
];
