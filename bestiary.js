// bestiary.js — DEEPWATCH v2 species data.
//
// Worldbuilding constraint: sea pH ~3.5–4.5 (sulfuric/HCl outgassing).
// No carbonate shells. Mineralization options: silica, barite, fluorapatite,
// chitin-sulfur composites, elemental sulfur, soft hydrostatic skeletons.
// Chemosynthetic food web (sulfide / iron-oxidizing bacteria base). Body plans
// favor jet propulsion, ciliary drift, undulation — no calcified vertebrae.
//
// Stats are tuned for game scale (720-logical-px space, current STRIKE_RADIUS=80,
// STRIKE_MAX_DMG=100, STRIKE_K=1.5, RIG hit damage = weight*8). HP is the
// individual contact's pool; weight feeds centroid math AND rig-impact damage.

export const BESTIARY = [
  // ─── Pelagic / mid-water ────────────────────────────────────────────────
  {
    id: 'acidonecton-vorax',
    genus: 'Acidonecton', species: 'vorax',
    class: 'Cephalopodiform / soft-mantle',
    scale: '~1.2m mantle length',
    category: 'pelagic',
    weight: 1.5, hp: 22, speed: 22, biomass: 3,
    threat: 'medium',
    blipColor: '#88ff88', blipScale: 1.0,
    jitterAmp: 1.0,
    abilities: [],
    description: '1.2 m mantle jet-propelled cephalopodiform with six trailing tentacles tipped in chitinous hooks (no suckers). Mantle clad in overlapping chitin-sulfur lamellae in muted ochre and amber, iridescent at the edges; large forward-facing dark eyes with horizontal pupils; ventral siphon expels a pressurized water jet.',
    note: 'Mantle composition: chitin-sulfur lamellae. Susceptible to concussive ordnance. Sonar return: sharp, brief, multiple returns in cluster formations.',
  },
  {
    id: 'chalcophyma-pulsans',
    genus: 'Chalcophyma', species: 'pulsans',
    class: 'Cnidarian / pulse-jet',
    scale: '~0.8m bell',
    category: 'pelagic',
    weight: 1.2, hp: 18, speed: 18, biomass: 2,
    threat: 'low',
    blipColor: '#9adfff', blipScale: 0.95,
    jitterAmp: 1.4,                                   // pulse-and-drift = high jitter
    abilities: ['pulse-drift'],
    description: '60 cm pulsing bell, semi-translucent body in oxidized-copper green and verdigris with a dappled darker pattern, internal radial canals glowing faint cyan from cuprous pigment. Short white tendrils fringe the margin; propulsion is a contracting pulse from a single ventral aperture, no tentacles.',
    note: 'Copper-pigmented bell, cuprous-tolerant. Drifts then pulses; sonar return ripples in irregular pattern. Fragile but unpredictable trajectory.',
  },
  {
    id: 'vitreonephes-glacialis',
    genus: 'Vitreonephes', species: 'glacialis',
    class: 'Drifter / silica-spined',
    scale: '~0.6m diameter',
    category: 'pelagic',
    weight: 1.0, hp: 14, speed: 14, biomass: 2,
    threat: 'low',
    blipColor: '#cce6ff', blipScale: 0.85,
    jitterAmp: 0.6,
    abilities: ['refractive'],                         // sweep beam refracts oddly
    description: '80 cm translucent silica-spined drifter resembling a magnified diatom — a geometric internal lattice of crystalline silica struts with sharp radiating spines in a snowflake pattern. Almost invisible against the murk; visible mainly through caustic refraction and pale blue edge-glints.',
    note: 'Translucent silica spines refract sweep beam — sonar return is faint and shimmering. Slow drifter; little threat alone.',
  },
  {
    id: 'sulfomedusa-abyssi',
    genus: 'Sulfomedusa', species: 'abyssi',
    class: 'Medusoid / soft-bodied',
    scale: '~1.4m bell',
    category: 'pelagic',
    weight: 1.4, hp: 24, speed: 16, biomass: 3,
    threat: 'medium',
    blipColor: '#e8ff88', blipScale: 1.05,
    jitterAmp: 0.9,
    abilities: [],
    description: '90 cm soft-bodied medusoid with a near-transparent gelatinous bell and vivid sulfur-yellow internal mineralization in branching dendritic patterns visible through the body wall. Short feathery oral arms replace stinging tentacles; bioluminescent amber rim glows softly at the bell margin.',
    note: 'Sulfur-yellow internal mineralization visible through body wall. Soft, gelatinous, no rigid skeleton. Sonar return broad and diffuse.',
  },

  // ─── Benthic / bottom-dwelling ──────────────────────────────────────────
  {
    id: 'barytolithus-reptans',
    genus: 'Barytolithus', species: 'reptans',
    class: 'Benthic crawler / barite-armored',
    scale: '~2.0m carapace',
    category: 'benthic',
    weight: 3.5, hp: 70, speed: 9, biomass: 8,
    threat: 'high',
    blipColor: '#ffaa44', blipScale: 1.4,
    jitterAmp: 0.3,                                    // slow + deliberate
    abilities: ['armored'],                            // resists point-defense (turret deals half)
    description: '1.5 m heavy bottom-crawler armored in massive overlapping plates of pale crystalline barium sulfate, white with grey veining and a raw barite mineral texture. Six short stubby legs crawl beneath; small recessed eyes, blunt snout — slow but inexorable across yellow sulfur sediment.',
    note: 'Heavy barium-sulfate armor plates. Auto-turret rounds glance off. Slow but inexorable; commit ordnance early or be overrun by the time it reaches the rig.',
  },
  {
    id: 'fluorapate-rigidum',
    genus: 'Fluorapate', species: 'rigidum',
    class: 'Burrower / fluoride-mineralized',
    scale: '~1.0m length',
    category: 'benthic',
    weight: 2.0, hp: 36, speed: 14, biomass: 5,
    threat: 'medium',
    blipColor: '#d8ff66', blipScale: 1.1,
    jitterAmp: 0.4,
    abilities: [],
    description: '2 m segmented serpentine burrower; dorsal surface bristles with needle-like fluorapatite denticles in bone-white with greenish low-light fluorescence. Pale pink underside, multiple small mandibles around a circular mouth — half-emerges from sediment to take prey.',
    note: 'Long-bodied burrower with fluoride-mineralized denticles. Rigid spine produces clean sonar return. Resistant to acid-secreting predators in its niche.',
  },
  {
    id: 'chitinotherium-fossor',
    genus: 'Chitinotherium', species: 'fossor',
    class: 'Burrower / chitin-armored',
    scale: '~1.5m length',
    category: 'benthic',
    weight: 2.5, hp: 48, speed: 12, biomass: 6,
    threat: 'medium',
    blipColor: '#aaff88', blipScale: 1.2,
    jitterAmp: 0.5,
    abilities: [],
    description: '1.8 m digger with a thick russet-brown and charcoal chitinous body and massive forward-mounted shovel claws like an oversized mole-cricket. Six legs with greatly enlarged forelimbs; small dorsal eyes, no neck — surfaces near rig pylons trailing a sediment cloud.',
    note: 'Shovels through sediment; surfaces near rig pylons. Chitin-sulfur shell is thick but cracks under direct ordnance. Sonar return only when above sediment.',
  },
  {
    id: 'pyrithionyx-ferrosus',
    genus: 'Pyrithionyx', species: 'ferrosus',
    class: 'Predator / iron-sulfide armored',
    scale: '~1.8m length, prominent claws',
    category: 'benthic',
    weight: 2.8, hp: 54, speed: 16, biomass: 7,
    threat: 'high',
    blipColor: '#ffcc66', blipScale: 1.25,
    jitterAmp: 0.6,
    abilities: ['rig-targeting'],                      // prefers rig over centroid drift
    description: '1.4 m iron-clawed predator armored in metallic iron-pyrite plates with brassy-gold sheen and dark tarnish patches; cubic crystal growths line the spine. Two oversized forward claws of fused pyrite crystal glitter with cubic facets; eight short walking legs underneath.',
    note: 'Iron-sulfide armor plates targeting metallic structures. Drawn directly to rig pylons. Ordnance damage reduced — strike must be precise.',
  },

  // ─── Swarm / small contacts ─────────────────────────────────────────────
  {
    id: 'acidoplankton-tenuis',
    genus: 'Acidoplankton', species: 'tenuis',
    class: 'Swarm / microorganismic aggregate',
    scale: 'each ~5cm; aggregates form 0.4m masses',
    category: 'swarm',
    weight: 0.4, hp: 6, speed: 18, biomass: 1,
    threat: 'low',
    blipColor: '#88ff88', blipScale: 0.6,
    jitterAmp: 1.6,
    abilities: [],
    description: 'Dense swarm of microscopic translucent teardrops, each ~2 cm with a single beating cilium and faint pale-green internal pigmentation. Forms a loose mid-water cloud; individuals catch backlit highlights, cohesive collective motion despite no obvious coordination.',
    note: 'Slender acid-drifters. Individually trivial; in numbers they erode rig integrity through sheer biomass throughput. Light but fast.',
  },
  {
    id: 'halophila-minima',
    genus: 'Halophila', species: 'minima',
    class: 'Swarm / halophilic micro-fauna',
    scale: '~3cm; aggregates ~0.3m',
    category: 'swarm',
    weight: 0.3, hp: 4, speed: 20, biomass: 1,
    threat: 'low',
    blipColor: '#aaffaa', blipScale: 0.55,
    jitterAmp: 1.8,
    abilities: [],
    description: 'Swarm of ~1 cm halophilic ovoid bodies with two short flagella and crystalline salt deposits encrusting the dorsal surface like miniature gem-bearing seeds. Pale pink coloration glitters under incident light; densely packed, flowing in ribbon formations.',
    note: 'Smallest tier; tolerant of even pH 2.5 brines. Sonar return only when aggregated. Cluster-strike yields negligible biomass per unit but high totals.',
  },
  {
    id: 'sulfovermis-gregarius',
    genus: 'Sulfovermis', species: 'gregarius',
    class: 'Swarm / schooling worm-form',
    scale: '~15cm; schools form 0.8m blobs',
    category: 'swarm',
    weight: 0.6, hp: 10, speed: 16, biomass: 2,
    threat: 'low',
    blipColor: '#ddff88', blipScale: 0.75,
    jitterAmp: 1.2,
    abilities: ['schooling'],
    description: 'Schooling worm-form, each 15 cm long with bright sulfur-yellow segmented body and fine cilia along the lateral lines. Sinuous swimming motion; dozens move in coordinated formation oriented as one, soft luminous against the dark water column.',
    note: 'Schooling sulfur-worms. Biomass-rich when killed in clusters. Centroid is well-defined when school is tight; ordnance returns scale superlinearly.',
  },

  // ─── Apex / heavy ───────────────────────────────────────────────────────
  {
    id: 'megacidodon-profundi',
    genus: 'Megacidodon', species: 'profundi',
    class: 'Apex predator / megafauna',
    scale: '~6m length',
    category: 'apex',
    weight: 5.0, hp: 120, speed: 12, biomass: 18,
    threat: 'apex',
    blipColor: '#ff6644', blipScale: 1.7,
    jitterAmp: 0.4,
    abilities: ['armored'],
    description: '8 m deep-sea apex predator with an elongated body covered in dark grey chitinous plates, scarred, pitted, dully iridescent. Enormous gaping circular mouth lined with concentric rings of fluorapatite teeth; tiny recessed eyes; small lateral fins, large powerful caudal fluke.',
    note: 'Top predator of the upper column. Massive, slow, devastating on contact. Auto-turret damage halved. Direct ordnance commit required.',
  },
  {
    id: 'thalassotitan-corrosor',
    genus: 'Thalassotitan', species: 'corrosor',
    class: 'Megafauna / acid-secreting',
    scale: '~5m length',
    category: 'apex',
    weight: 4.0, hp: 90, speed: 14, biomass: 15,
    threat: 'apex',
    blipColor: '#ff8844', blipScale: 1.5,
    jitterAmp: 0.5,
    abilities: ['acid-aura'],                          // damages rig at proximity, not just contact
    description: '12 m colossal sea titan with a bulbous bloated body and leathery dark purple-grey skin glistening with secreted acid droplets that drip from numerous skin pores. Multiple stubby tentacle-limbs underneath; pale milky eyes; chemical haze distorts the water immediately around its body.',
    note: 'Secretes additional sulfuric acid in proximity to metallic structure. Damages rig integrity from range, not contact alone. Engage at maximum scope distance.',
  },
  {
    id: 'architeuthys-vitreus',
    genus: 'Architeuthys', species: 'vitreus',
    class: 'Apex cephalopodiform / silica-armored',
    scale: '~7m mantle, ~12m tentacles',
    category: 'apex',
    weight: 5.5, hp: 140, speed: 11, biomass: 22,
    threat: 'apex',
    blipColor: '#aaccff', blipScale: 1.8,
    jitterAmp: 0.6,
    abilities: ['armored'],
    description: '6 m mantle vast cephalopodiform sheathed in transparent silica armor plates that reveal internal organs and faintly green musculature beneath. Eight long sinuous tentacles studded with crystalline hooks; two enormous black eyes — predatory and intelligent.',
    note: 'Silica-armored mantle returns sonar with a hard, glittering signature. Scope-dominating size. Rare encounters but a single specimen ends a wave on its own if mishandled.',
  },
  {
    id: 'leviathys-sulfuratum',
    genus: 'Leviathys', species: 'sulfuratum',
    class: 'Mid-game miniboss / irregular morphology',
    scale: '~4m, asymmetric',
    category: 'apex',
    weight: 4.5, hp: 100, speed: 13, biomass: 16,
    threat: 'apex',
    blipColor: '#ffbb55', blipScale: 1.55,
    jitterAmp: 1.5,                                    // irregular movement
    abilities: ['erratic'],
    description: '10 m sulfurous leviathan with an irregular asymmetric body of multiple unequal lobes in sulfur-yellow and burnt-orange, dark patches of necrotic-looking tissue. Multiple irregular mouths and breathing apertures; locomotion via cilia mats and pulsing contractions, trailing strands of sulfur particulate.',
    note: 'Sulfur-yellow internal coloration. Irregular asymmetric body produces scattered sonar return — centroid hard to read in real time. Lead time miscalibrated for symmetric prey is wasted on this one.',
  },

  // ─── Strange / specialist ───────────────────────────────────────────────
  {
    id: 'lampyronoctis-abyssalis',
    genus: 'Lampyronoctis', species: 'abyssalis',
    class: 'Specialist / chemiluminescent decoy',
    scale: '~0.5m',
    category: 'specialist',
    weight: 0.8, hp: 12, speed: 16, biomass: 2,
    threat: 'low',
    blipColor: '#ffff88', blipScale: 1.3,              // BIG bright blip — looks dangerous
    jitterAmp: 0.8,
    abilities: ['decoy'],                              // bright sonar return for low actual threat
    description: '40 cm soft gelatinous form with intense chemiluminescent organs running in twin parallel rows along the body, glowing brilliant cyan-white. Body itself dark and barely visible — only the light organs prominent; long thin tentacles trail behind, also tipped with smaller light points.',
    note: 'Sulfur-based chemiluminescence pings strongly on sonar harmonics. Easily mistaken for an apex contact. Drawing strike commits to it is its survival strategy. Verify mass before committing.',
  },
  {
    id: 'cryptocnidaria-mimica',
    genus: 'Cryptocnidaria', species: 'mimica',
    class: 'Specialist / sonar mimic',
    scale: '~2.2m at full extension',
    category: 'specialist',
    weight: 2.5, hp: 50, speed: 13, biomass: 7,
    threat: 'high',
    blipColor: '#aaffaa', blipScale: 0.7,              // appears small until close
    jitterAmp: 0.7,
    abilities: ['mimic'],                              // grows in apparent size as approaches
    description: 'Camouflaging cnidarian appearing as a 30 cm pale jellyfish but with subtle wrongness — slightly too symmetrical, internal structures faintly visible suggesting a much larger body folded inside. Pale soft texture; a hint of larger darker mass barely visible behind/within the smaller form.',
    note: 'Mimics the sonar return of smaller cnidarian contacts. Reveals true mass only at close range. By the time the misread is corrected, lead-time has expired.',
  },
  {
    id: 'ferrobacterium-colossus',
    genus: 'Ferrobacterium', species: 'colossus',
    class: 'Specialist / colonial bacterial mat',
    scale: '~3m diffuse mat',
    category: 'specialist',
    weight: 1.0, hp: 80, speed: 8, biomass: 4,         // high HP / low biomass — soaks ordnance for poor return
    threat: 'medium',
    blipColor: '#ddaa88', blipScale: 1.4,
    jitterAmp: 0.3,
    abilities: ['ordnance-soak'],
    description: '5 m drifting bacterial mat — a thin sheet-like colonial structure of rust-red and ochre iron-oxidizing bacteria, rippling and undulating slowly through the water column like a living veil. Translucent at the edges, denser and more opaque at the centre; vast scale relative to other organisms.',
    note: 'Colonial iron-oxidizing bacterial mat drifting as a single organism. Vast surface area; absorbs ordnance with poor return. Low actual threat but distorts strike economy.',
  },
  {
    id: 'acidocoryne-errans',
    genus: 'Acidocoryne', species: 'errans',
    class: 'Specialist / erratic solitary',
    scale: '~1.5m, club-form',
    category: 'specialist',
    weight: 1.8, hp: 30, speed: 18, biomass: 5,
    threat: 'medium',
    blipColor: '#ffaa66', blipScale: 1.0,
    jitterAmp: 2.2,                                    // very high jitter — hard to lead
    abilities: ['erratic'],
    description: '70 cm solitary asymmetric club-form with a narrow stalk and bulbous head, mottled dull purple and grey-green like a bruise. A few short uneven appendages; no clear front or back — body twists at awkward angles mid-motion, disorienting biological geometry.',
    note: 'Solitary; erratic motion makes leading nearly impossible. Standard strike-delay lead-time miscalibrates. Engage when motion stalls, or commit and accept poor return.',
  },
];

// Lookup by id — used by contacts.js, waves.js, etc.
export const SPECIES_BY_ID = Object.fromEntries(BESTIARY.map(s => [s.id, s]));

// Default species for legacy code paths that don't specify one.
export const DEFAULT_SPECIES_ID = 'acidonecton-vorax';

// Weighted-random pick from a pool of species ids.
//   pool: Array<string>           — uniform random pick
//   pool: Object<id, weight>       — weighted pick
export function pickSpecies(pool) {
  if (!pool) return DEFAULT_SPECIES_ID;
  if (Array.isArray(pool)) return pool[Math.floor(Math.random() * pool.length)];
  const ids = Object.keys(pool);
  const total = ids.reduce((s, k) => s + pool[k], 0);
  let r = Math.random() * total;
  for (const id of ids) { r -= pool[id]; if (r <= 0) return id; }
  return ids[ids.length - 1];
}
