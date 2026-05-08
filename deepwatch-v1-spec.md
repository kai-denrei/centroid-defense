# DEEPWATCH — v1 PoC Spec

> Working codename. Replace if a better one lands.

## Premise

You are an operator on a research-extraction rig anchored on the surface of an ocean on a distant world. Something biomechanical lives below. You cannot see directly — only the phosphor sweep of a sonar PPI tells you what is approaching. You have a small budget of subsurface ordnance per wave and a point-defense turret that will not save you on its own. Where you place the strike, and *when* you commit it, is the whole game.

## Lineage

This PoC extends **kika-centroid** (the static perceptual centroid game) into a dynamic, time-pressured context. The core skill is the same — estimating the weighted spatial mean of a set of objects — but here the objects are moving, partially observed (sweep snapshots only), and the strike that lands at the centroid does so on a delay, so the player must lead. Damage falls off with distance from the true centroid, mirroring the kika scoring gradient — every strike contributes something, and there is always a better strike available. Reuse that gradient feel directly; it is the foundation.

## v1 Thesis

We are validating one thing: **is reading the sonar and committing a centroid strike satisfying enough to carry a tower defense?** If yes, the game has a future. If no, no amount of biomass economy or rig damage zones will save it. Build the minimum that exposes this loop honestly.

## Scope

### IN — v1
- One PPI sonar scope, fixed at center of screen.
- One threat type, one movement pattern (radial drift toward rig with mild jitter).
- Sweep + blip-and-decay rendering.
- One strike type (depth charge): commit, delay, detonate, falloff damage.
- 1–2 strikes per wave, hard budget.
- One auto-turret (point defense, fixed at rig, low DPS, no upgrades).
- Five hand-authored waves demonstrating the five formation archetypes.
- Phosphor-green CRT HUD, monochrome.
- Procedural audio: sweep ping, contact bleep with range-cadence, strike whoosh + boom.
- Rig has a single integrity meter (0–100). Game over at 0.

### OUT — defer to v2+
- Multiple tower types or tower placement.
- Biomass economy (rig HP is abstract for now).
- Rig structural zones / sectoral damage.
- Multiple threat types or behaviors.
- Surface threats / second sense layer.
- Upgrade tree, meta-progression, run structure.
- Detection vs breach two-phase lifecycle.
- Harpoon / biomass retrieval.
- Lore, narrative, story beats.

## Stack

- Single `index.html` + `main.js` + `audio.js` + `waves.js`. No build step. Open in browser, it runs.
- Canvas 2D for the PPI scope (trails, sweep, blips). HTML/CSS for the surrounding HUD chrome.
- Web Audio API for all sound, synthesized — no samples.
- No frameworks. No npm. If it grows past v1, port to React + Vite later.

This stack choice is deliberate. The aesthetic is instrument-grade minimalism; the codebase should match. A 200-line `main.js` is the goal, not a 2000-line one.

## Core Loop

1. Wave begins. Contacts spawn at scope edge.
2. Sweep rotates at fixed period (3 seconds clockwise). Each time the sweep crosses a contact, that contact emits a fresh blip; the blip then fades over ~1.5s.
3. Operator reads positions, velocities, and clusters from the trail of fading blips.
4. When a centroid moment appears (a tight cluster, a vulnerable formation), operator taps the scope.
5. A ghost reticle locks at the tap location. ~1.2s strike delay. Audio whoosh. Reticle pulses.
6. At T+1.2s, depth charge detonates. Damage applied to all contacts within blast radius, with falloff from true detonation point.
7. Surviving contacts continue toward rig. Auto-turret chips at any in close range.
8. Wave ends when all contacts are destroyed or have hit the rig. Show stats: strikes used, accuracy, rig integrity. Advance.

## The PPI Scope

### Layout
- Circular scope, radius ~320px, centered on canvas.
- Rig at center: small filled circle with a thin halo ring marking the auto-turret range (~60px).
- Concentric range rings at 25%, 50%, 75%, 100% of scope radius, faint phosphor green, ~8% opacity.
- Bearing ticks every 30° around the rim. Numeric labels at 0/90/180/270.

### Sweep
- Rotating line from center to rim, period **3.0s**, clockwise.
- Leading edge bright (`#88ff88` at full alpha), trailing into a wedge of fading phosphor over ~30° of arc behind it.
- Implement as a gradient swept polygon, not a single line — the trailing wedge sells the CRT feel.

### Contacts and blips
- A contact has: `{x, y, vx, vy, hp, weight, alive}`. `weight` is HP-proportional and feeds the centroid math (heavier creeps pull the centroid more — see kika weighted mode).
- A contact is invisible by default. When the sweep angle crosses the contact's bearing from origin, emit a **blip** at the contact's *current* position.
- A blip is a fading dot with size scaled by `weight`. Decay:

  ```js
  opacity = Math.exp(-age / TAU); // TAU = 1.5 seconds
  ```

- Keep the last **3** blips per contact visible simultaneously (older ones fade naturally past visibility). This trail is the only velocity cue the player gets. Do not draw a vector arrow; force the player to integrate the trail visually. That work *is* the skill.

### Phosphor styling
- Blips are not crisp circles. Use a radial gradient with a hot core and a soft halo.
- Add a subtle bloom by drawing each blip twice: once large and faint, once small and bright.
- Optional: a 1-frame trail buffer with 0.92 alpha decay per frame for an extra phosphor smear. Tune to taste — too much and centroids become unreadable; too little and it looks like a generic radar.

## Strike Mechanic

### Commit
- Tap (or click) anywhere inside the scope. If strike budget > 0, commit a strike at that point.
- Show a **ghost reticle** at the tap point: thin crosshair, pulsing once per 400ms, color `#ffaa44` (amber — secondary HUD register).
- Reticle stays locked at the tap point. It does not track anything. The player committed; the world keeps moving.

### Delay
- **1.2 seconds** between commit and detonation. Tunable. This is the lead-estimation budget.
- During delay, audio plays a descending whoosh (depth charge sinking).

### Detonation
- At T+delay, blast originates at the reticle point. Visualize: bright flash, expanding ring, brief screen flicker (modest — do not overdo it).
- Compute damage to each contact:

  ```js
  function strikeDamage(contact, blastPos, MAX_DMG = 100, RADIUS = 80, k = 1.5) {
    const d = Math.hypot(contact.x - blastPos.x, contact.y - blastPos.y);
    if (d > RADIUS) return 0;
    const t = 1 - d / RADIUS;
    return MAX_DMG * Math.pow(t, k);
  }
  ```

  `k = 1.5` makes precision feel rewarded without making near-misses worthless. Tune.

### True centroid feedback (post-blast)
- Right after detonation, briefly draw a marker (~600ms) at the *true weighted centroid* of the contacts that were in blast radius at T+delay. This shows the player how close they were to perfect. Same feedback loop as kika — see your error, recalibrate. Critical for skill development. Do not skip this.

### Budget
- Display remaining strikes as ordnance pips in the HUD chrome (top-right, amber). 1 or 2 per wave depending on wave config.

## Auto-Turret

- Fixed at rig center. Range ~60px. Targets the closest contact within range, fires every 0.4s, deals modest damage (~8 per shot).
- Visualize as a thin tracer line + small muzzle flash. Tracer fades over 100ms.
- Purpose: handle the trickle so strike economy stays *strategic* rather than a frantic must-hit-everything panic. Do not buff this. The point is that it cannot save you on its own.

## Waves

Five waves, hand-authored. Each wave teaches one centroid archetype. All numbers are starting points, tune in playtest.

| # | Archetype | Composition | Strike budget | Lesson |
|---|-----------|-------------|---------------|--------|
| 1 | Tight blob | 6 equal-weight contacts spawning in a ~40px cluster, drifting in together | 1 | Establish: a tight cluster is the ideal centroid moment. |
| 2 | Linear formation | 8 contacts in a line abreast, drifting in parallel | 1 | Centroid lies along the line — easy to overshoot perpendicular. |
| 3 | Bimodal trap | Two clusters of 4, separated by ~120px, drifting in together | 1 | Naive centroid lands in the *gap*. Strike must engage one cluster, not the average. |
| 4 | Heavy outlier | 5 light contacts (`weight=1`) + 1 heavy (`weight=4`) in a loose group | 1 | Weighted centroid pulled hard toward the heavy. Player must read mass, not just position. |
| 5 | Drifter | 8 contacts in two staggered waves, with one slow sub-cluster and one fast sub-cluster | 2 | Lead-time matters. Two strikes, two timing choices. |

Wave config schema:

```js
{
  id: 3,
  name: "Bimodal trap",
  strikeBudget: 1,
  spawns: [
    { t: 0.0, count: 4, formation: "cluster", center: [320, -50], spread: 30, weight: 1, vy: 18 },
    { t: 0.0, count: 4, formation: "cluster", center: [440, -50], spread: 30, weight: 1, vy: 18 },
  ],
}
```

## Audio

All synthesized via Web Audio. No samples. Three pieces:

### Sweep ping
- Once per sweep rotation, at the moment the sweep crosses bearing 0°.
- Short sine burst, ~440Hz, 60ms decay envelope, low gain. Establishes rhythm.

### Contact bleep
- Per contact, on each sweep crossing.
- Short triangle blip, frequency mapped to range: closer = higher pitch (~880Hz at point-blank, ~330Hz at scope edge).
- Cadence accelerates naturally because closer contacts get hit more often by sweep — but boost this with a *secondary range bleep* off-sweep that fires faster as the contact closes:

  ```js
  bleepPeriod = lerp(0.18, 1.2, range / MAX_RANGE); // closer = faster
  ```

- This is the Aliens motion-tracker tempo. Get it right and the audio carries the entire tension arc of a wave. The visual is almost secondary.

### Strike audio
- On commit: low descending whoosh (sawtooth + lowpass, ~0.8s sweep from 400Hz to 80Hz).
- On detonation: short noise burst with sharp attack, lowpass-filtered, ~250ms decay. Add a low-frequency thump (sine at 50Hz, 100ms). No reverb on v1.

## HUD Chrome

The scope is sacred. Surround it with utilitarian period-correct readouts. CRT scanlines and grime go on the HUD chrome only — never on the scope itself.

Suggested HUD layout:
- **Top bar:** rig designation (e.g. `EXTRACTION PLATFORM CASS-3`), wave number, system time (counts up).
- **Top-right:** ordnance pips (remaining strikes), amber.
- **Left rail:** rig integrity bar, vertical, phosphor green → amber → red as it depletes.
- **Right rail:** contact count, sweep period readout, RPM display.
- **Bottom strip:** scrolling status log, monospace, amber. Lines like:
  - `[T+00:14] CONTACT 047 BEARING 312 RANGE 1820`
  - `[T+00:18] STRIKE COMMITTED — TARGET 047/318/1640`
  - `[T+00:19] DETONATION — 4 CONTACTS NEUTRALIZED`
  - `[T+00:23] HULL BREACH — INTEGRITY 84%`

Voice register: clinical, impersonal, military-industrial. Never edgy. The horror comes from the casualness of the comms language against the situation.

## Aesthetic Constraints

- **Phosphor green primary** (`#88ff88` hot, `#3a8c3a` mid, `#0f2c0f` dim) on near-black (`#050a05`).
- **Amber secondary** for strike reticle, ordnance, status log (`#ffaa44`).
- **Red strictly critical** — only for hull breach warnings, depleting integrity bar bottom 25% (`#ff3322`).
- White: almost never. Maybe 1-pixel highlights on the sweep leading edge.
- **Monospace everywhere.** Suggested: `JetBrains Mono`, `IBM Plex Mono`, or a free CRT font like `VT323`. Whatever ships — just not a sans-serif and never a serif.
- **CRT effect on HUD only** — subtle scanlines, faint chromatic aberration on text. Do *not* apply these to the scope canvas; legibility there is paramount.
- Resist neon-arcade prettiness. This is an instrument, not a poster.

## Success Criteria

The PoC has succeeded if, after playing all 5 waves once:
1. The sonar reading skill feels meaningfully *practiced* — wave 5 is easier than wave 1 not because of upgrades but because the operator's eyes got better.
2. At least one strike feels *perfect* — the player sees the post-blast true-centroid marker overlap their reticle and knows they nailed it.
3. The audio cadence carries the wave-end tension without the player needing to look at the scope continuously.
4. The bimodal-trap wave actually traps a first-time player. (Test: wave 3 should produce a "wait — oh" reaction.)

If three of four hold, build v2. If fewer, the loop needs more work before adding biomass, towers, or lore.

## Suggested File Structure

```
deepwatch-v1/
  index.html         # canvas + HUD layout + CSS
  main.js            # game loop, state, render
  scope.js           # PPI rendering: sweep, blips, strike, auto-turret viz
  audio.js           # Web Audio: sweep ping, bleeps, strike sounds
  waves.js           # the 5 wave definitions
  contacts.js        # contact spawn + movement + centroid math
  hud.js             # status log, ordnance pips, integrity bar
```

## Open Questions for the Builder

These are not blockers — pick a default and ship. Note the choice in code comments.

1. **Tap-to-commit or hold-to-aim?** Default: tap-to-commit. Hold-to-aim is more forgiving and probably better for skill development, but tap is closer to the period-correct feel. Try tap first.
2. **Should the scope show the sweep's *future* arc faintly?** A predictive ghost wedge ahead of the sweep would help players time strikes against incoming sweep crossings. Probably no for v1 — it dilutes the skill.
3. **Strike delay constant or scope-distance-dependent?** Constant 1.2s is simpler. Range-dependent (charge sinks slower in deep water) is more interesting. Defer to v2.

## Reference

- `kika-centroid` — the perceptual ancestor. Reuse the weighted-centroid math, the post-action true-centroid feedback marker, and the soft falloff scoring curve. The visual gradient that says "you can always do better, but you weren't wholly wasted" is the soul of that game and it must be the soul of this one.

---

Build it tight. Ship the loop. Defer everything else.
