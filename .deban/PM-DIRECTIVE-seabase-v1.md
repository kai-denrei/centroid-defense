---
doc: PM-DIRECTIVE-seabase-v1
project: DEEPWATCH (centroid-defense)
branch: seabase
date: 2026-05-09
status: binding
extends: PM-DIRECTIVE-v1, PM-DIRECTIVE-v1.3-mobile, PM-DIRECTIVE-v2.0a-bestiary (where they were silent on the alternating-view experiment)
---

# DEEPWATCH SEABASE EXPERIMENT v1 — PM Directive (Binding)

## 1. Executive call

We are testing a single architectural hypothesis: **the same canvas area
alternates between two visual modes — Mode A (the existing PPI radar, during
waves) and Mode B (a top-down Sea Base view, between waves) — and the
between-wave phase becomes a real build phase where the player spends biomass
on defenses.** This is a tower-defense rhythm grafted onto the existing skill-
action loop. We're shipping v1 as a deliberate visual demo with ONE
purchasable defense (drone) so Gerald can feel the alternating cadence
without committing to the full TD economy yet. Branch is `seabase`,
forked from `deepdefense` at `7d1cd43`. **Done** = (1) wave ends → 25s build
phase → next wave; (2) canvas visibly switches between radar and sea-base
look; (3) ripples animate procedurally on the water surface; (4) one
purchasable defense (drone, 20 biomass) that visibly orbits the base in
Mode B and gives a mild combat buff (turret fire rate +15% per drone) in
Mode A; (5) on a midrange phone, both views hold ≥30 fps.

## 2. Locked decisions

### View architecture

- **(2.1) Same canvas element, dispatched render**: `main.js` frame loop
  picks `drawScope(ctx, state, t)` when `state.phase === 'wave_running'`,
  else `drawBase(ctx, state, t)`. Single canvas, two render paths. No
  separate canvas per view — costs nothing to switch, transitions are free
  (just a render-path swap).
- **(2.2) Mode B is its own module** `base.js`. Exports `drawBase`,
  `seedRipples(state, t)`, `Drone` class, and the offscreen rig-sprite
  bake. Parallels `scope.js` for `drawScope`. Reasoning: rendering, particle
  pool, and entity classes for the base belong together; pollution into
  scope.js was rejected.
- **(2.3) No transition animation between views**. The view-swap is instant
  on phase change. Reasoning: a fade/morph between radar-green and water-
  teal sounds nice but doubles render cost during transitions and adds
  state machinery. v1 is a DEMO; ship the simplest version, add polish later.

### Phase machine

- **(2.4) New phase `build_phase`**: inserts between `wave_endcard` and the
  next wave. `wave_endcard` advance-prompt now goes to `build_phase` instead
  of `startWave(n+1)`.
- **(2.5) Build phase duration: 25 seconds, fixed**. Player can press
  [SPACE] or tap a "READY" button to skip the remainder. After wave 1 the
  phase fires — wave 1 itself has no preceding build phase (player has no
  biomass yet to spend, would just be a 25-second blank wait).
- **(2.6) Game-over and run-complete paths bypass build phase**. They go
  straight to their existing endcards. No build phase after the final wave
  (run is over).

### Sea Base visual

- **(2.7) Palette shift**: water = deep teal/blue (`#0a1820` outer, `#152832`
  mid, `#1a3040` inner near rig); rig structure = phosphor green details on
  metallic gray (`#3a4248`); ripples = pale cyan with 0.4–0.7 alpha
  (`#aac8d8`); turrets = amber (`#ffaa44`); drones = phosphor green
  (`#88ff88`). Gives Mode B clear distinct identity from Mode A's monochrome
  green CRT register, while keeping accent colors consistent (amber = lethal
  things, phosphor green = friendly things, red = critical).
- **(2.8) Rig sprite is programmatic** — drawn once at boot to an offscreen
  canvas, blitted each frame. Composition: outer hex platform ring (radius
  ~80px), inner deck plate, four landing pylons at cardinal points,
  central antenna spire, deck-light ring (faint amber glow). Pre-baked
  approach avoids re-rendering complex paths every frame.
- **(2.9) Water background**: static radial gradient drawn full-canvas each
  frame as one `fillRect` op (cheap). No animated water surface in v1 —
  ripples ARE the surface motion. Wave-line patterns / Perlin noise rejected
  for mobile perf.
- **(2.10) Ripple particle system** — pool of 32 reusable Ripple objects
  (avoids GC churn). Each ripple = expanding circle with alpha decay,
  ~2-3s lifetime, max radius ~25-35px. Spawned procedurally on the water
  surface at random positions (avoiding the rig deck) at a rate of 1.5/s
  during build phase to imply unseen creature activity. Each frame: 2
  stroke arcs per active ripple → ~15 active × 2 = 30 stroke ops/frame.
  Negligible cost.

### Build phase UI

- **(2.11) Build phase HUD reuses the launch-pane slot**. During
  `wave_running` the launch console (safety + 発射) shows; during
  `build_phase` a `#build-pane` panel shows in the same slot, hiding the
  launch console. CSS class `.phase-build` on `<body>` toggled by JS.
  Reasoning: keeps layout stable (no shifting elements between phases —
  see lesson learned from v2.0.7); same physical space serves both
  consoles.
- **(2.12) Build pane contents**:
  - Timer countdown (large, amber, blinking when ≤5s)
  - Available biomass (large, phosphor green)
  - One purchasable button: `DEPLOY DRONE · -20`
  - "READY" button (skip remainder of timer)
- **(2.13) Build pane caution-stripe frame** like the launch console —
  visual register continuity ("this is also a console you operate").

### Defenses (v1: one only)

- **(2.14) Drone**: cost 20 biomass. Multiple may be purchased per build
  phase if biomass allows. Drones persist across waves (no per-wave reset).
  Visible in Mode B as small phosphor-green chevrons orbiting the rig
  at radius ~110px, each at a randomized starting angle, all moving
  clockwise at ~0.4 rad/s.
- **(2.15) Drone combat effect**: each active drone reduces
  `TURRET_FIRE_INTERVAL` by `0.85^n` (compounding 15% per drone). Ceiling
  at min 0.10s interval (~10 drones for full effect). Drones do NOT appear
  in radar view — the radar is sub-surface; drones are above-water
  defenses. Justification: keeps radar clean; the combat effect is felt
  through faster turret fire, not visualized as additional sprites in
  the scope.
- **(2.16) Drone aesthetic**: simple chevron triangle (3 lines), 8px size,
  with a faint phosphor trail (1-frame trail buffer at low alpha). No
  detailed sprite — chevron reads as "drone" instantly without art weight.
- **(2.17) Future drones / defense types deferred**. v1 ships ONE
  purchasable to validate the loop. After Gerald sees v1, we scope v2:
  turret upgrades (range +20%, damage +20%, +1 turret slot), EMP buoy,
  sonar amplifier, repair drone, etc.

### Mobile perf budget

- **(2.18) Sea Base render budget**: ≤30 fps on a 2-year-old midrange
  Android (Pixel 6a or equivalent). Mode B runs only between waves, so
  perf budget is RELAXED vs combat. Per-frame draw calls target ≤80
  (water bg ×1, rig blit ×1, ripples ~30, drones ~10, turret sprites ×4,
  HUD numbers).
- **(2.19) Particle perf rules**:
  - No `ctx.filter` (slow on mobile, especially Safari)
  - `ctx.shadowBlur` only for ripple inner glow at ≤6px (cheap)
  - Object pool for ripples (no per-frame allocation)
  - No Perlin noise / wave shaders / per-pixel manipulation
  - No `getImageData` / `putImageData`
- **(2.20) Rig sprite pre-rendered** to an offscreen `<canvas>` at boot.
  Blitted each frame via `drawImage`. Single op per frame for all rig
  geometry.

### Aesthetic rules

- **(2.21) Mode B stays in the instrument-grade register**. No marketing
  polish, no skeuomorphic over-styling. The Sea Base reads as a tactical
  display the operator looks at, not a screensaver.
- **(2.22) Underwater creatures STAY hidden in Mode B**. Only the ripples
  + (during combat — but combat is in Mode A) turret tracers indicate
  their presence. Player never sees a creature sprite in Mode B. This
  protects the "blind operator" tension that the radar mode owns.
- **(2.23) No 3D-look styling**. Top-down flat reads as tactical map; any
  isometric / 3D effect would compete with the instrument register.

### State + data

- **(2.24) State additions**:
  - `state.phase` adds `'build_phase'` to existing enum
  - `state.buildPhaseStartedAt: number` (s) — when current build phase began
  - `state.buildPhaseDuration: number` (s) — fixed at 25
  - `state.drones: Array<Drone>` — persists across waves, cleared on `startRun`
  - `state.ripples: Array<Ripple>` — pool of 32, all start `alive: false`
- **(2.25) Drone schema**: `{ angle: number, orbitRadius: number, angularSpeed: number, deployedAt: number }`
- **(2.26) Ripple schema**: `{ x, y, t0, maxR, duration, alive }` — pooled

### Out of scope for seabase v1 (deferred)

The dev WILL be tempted by these. Defer.

1. Multiple defense types (turret upgrades, EMP buoys, sonar amplifiers,
   repair drones). v1 ships ONE purchasable; v2 expands.
2. Defense PLACEMENT UI (click on slot to place). v1 drones auto-orbit;
   placement-on-rig spots is v2.
3. Visible creature sprites in Mode B. The "blind operator" tension is the
   game's identity.
4. Animated water surface (Perlin / wave shaders). Static gradient + ripples
   only; mobile perf.
5. Mode-transition animation (fade, morph). Instant view-swap; transitions
   are v2 polish.
6. Drone visualization in radar view. Drones are above-water; radar shows
   sub-surface only.
7. Save state for purchased drones across runs. Run reset = drones reset.
8. Build phase before wave 1 (no biomass yet, blank wait).

## 3. Build sequence

Each milestone is independently verifiable in browser. Do not start N+1
until N renders correctly.

1. **Phase machine extension.** Add `build_phase` to `state.phase` enum.
   `wave_endcard` advance-prompt now transitions to `build_phase` (except
   after game-over / run-complete). `update(dt, t)` ticks
   `buildPhaseStartedAt`; auto-advances to next wave when 25s elapsed.
   [SPACE] / overlay click skips remainder. Verify: wave 1 → endcard →
   advance → enter build_phase → 25s timer counts down → auto wave 2.
   No render changes yet.

2. **Render dispatch.** `frame(t)` switches between `drawScope` and
   `drawBase` based on `state.phase`. `drawBase` is a stub — fills canvas
   with `#0a1820` and renders a green dot at center. Verify: canvas
   visibly changes between green-CRT (during wave) and dark-teal (during
   build phase).

3. **Sea Base visual: water gradient + rig sprite.** Pre-render rig
   sprite to offscreen canvas at module init. `drawBase` renders water
   radial gradient + blits the rig sprite at center. Verify: the base
   view shows a recognizable platform-on-water composition.

4. **Ripple particle system.** Implement Ripple class + pool of 32 +
   `seedRipples` spawner. Spawn rate 1.5/s during build_phase. Each
   ripple draws as 2 expanding stroke arcs with alpha decay over 2-3s.
   Verify: random ripples appear on the water surface, expand outward,
   fade. None inside the rig hex.

5. **Build phase HUD.** Add `#build-pane` HTML (sibling of launch-pane in
   bottombar). CSS hides launch-pane and shows build-pane when body has
   class `.phase-build`. Pane contents: timer, biomass readout,
   `DEPLOY DRONE · -20` button, READY button. Verify: pane appears
   during build_phase, timer counts down, biomass shows current count.

6. **Drone purchase + persistence + Mode B render.** DEPLOY DRONE button
   spends 20 biomass and adds a Drone to `state.drones[]`. `drawBase`
   renders all drones as orbiting chevrons. Verify: clicking the button
   while biomass ≥ 20 deducts 20 and a chevron appears orbiting the rig.

7. **Drone combat effect.** Apply `0.85^n` multiplier to
   `TURRET_FIRE_INTERVAL` based on `state.drones.length`. Verify in CDP:
   purchase 2 drones, start wave 2, observe turret fires at
   `0.4 / 0.85^2 ≈ 0.55s` interval.

8. **Mobile perf check.** CDP-driven probe: open page, run a 25s build
   phase, capture mean frame time and active particle count. Target:
   mean frame time ≤16ms (60fps) on desktop; ≤33ms (30fps) implied for
   mobile. Verify pool reuse: ripples fade and respawn from pool, no
   array growth.

After milestone 8: hand back to PM (Gerald) for first look. Do not
extend defense types or transition polish without a fresh directive.

## 4. Items flagged for revisit after Gerald's first look

- **Build-phase duration**: 25s is a guess. Too short → can't decide;
  too long → boring. Tune by playthrough.
- **Drone effect (turret rate +15%)**: may be too weak to feel, or too
  strong (auto-clears waves). Tune by playthrough.
- **Drone visualization in radar**: currently NOT shown in Mode A.
  Decision may flip if the absence breaks the "I bought drones, where
  are they?" feedback loop. Could surface as a small allies-count
  readout in the topbar.
- **Mode-transition polish**: instant swap may feel jarring after the
  cinematic launch sequence sets a polished register. Consider a
  300ms cross-fade in v2 if it matters.
- **Mode B audio register**: silent for v1; may want subtle ambient
  water-lap or sonar-pulse from base. Defer.

---

**End of directive.** Branch `seabase` is the source of truth. `main`
remains v1.5.0; `deepdefense` is the bestiary/stochastic-motion track;
`seabase` is the alternating-view + build-phase experiment. None
cross-merge without re-evaluation.
