---
doc: PM-DIRECTIVE-v1
project: DEEPWATCH (centroid-defense)
date: 2026-05-08
status: binding
---

# DEEPWATCH v1 — PM Directive (Binding)

## 1. Executive call

We are building a single-screen, single-loop PoC that proves one thesis: reading a phosphor sonar PPI and committing a delayed depth-charge strike at the weighted centroid of a moving cluster is satisfying enough to carry a tower-defense game. We are explicitly NOT building biomass economy, multiple tower types, multiple threat behaviors, upgrade trees, narrative, run structure, persistence, or anything that grows `main.js` past ~250 lines. **Done** = five hand-authored waves play start-to-finish in a static-served browser window, the post-blast true-centroid marker fires after every strike, audio cadence works without samples, and at least 3 of the 4 spec success criteria hold under Gerald's first cold playthrough. Ship the loop. Iterate from feedback, not from speculation.

## 2. Locked decisions

### From the spec's "Open Questions for the Builder"
- **Tap-to-commit, not hold-to-aim.** Single pointerdown inside the scope commits at the down-point. Period-correct instrument feel and zero state machinery; preserves spec default. Cost: less forgiving for shaky inputs — acceptable for v1, retune only if playtest shows commit-by-accident exceeds ~10% of strikes.
- **No predictive ghost-wedge ahead of the sweep.** The skill is reading the trail, not gaming the sweep timing. Cost: a slight learning-curve hit on wave 1, paid back as the operator's eyes train.
- **Strike delay is constant 1.2s.** Range-dependent delay defers to v2. Constant is one number to tune; range-dependent is two and an interaction surface. Cost: wave-1-edge strikes feel identical to point-blank, which is fine because depth-charge sink time being constant is also physically defensible.

### PM open questions
- **Wave 3 ships as authored** with cluster-separation 120px and spread 30px each. We accept the risk that it might be too obviously bimodal. If first cold playthrough doesn't produce a "wait — oh" reaction, we increase separation to 160px before declaring the wave broken. **Revisit after wave 1 playable.**
- **Wave 5 ships with 2 strikes and 2 staggered sub-clusters** — slow group leads fast group by ~2.5s. If playtest shows the player just stacks both strikes on the slow blob, tighten the stagger to ~1.5s in v1.1.
- **True-centroid feedback marker stays at 600ms.** Long enough for a held gaze, short enough to not pollute the next sweep. Retune only if playtesters report missing it or feeling flashed.
- **Auto-turret keeps 60px range, 0.4s interval, 8 dmg/shot (~20 DPS).** Locked. If the turret single-handedly clears wave 1, we cut DPS to 5/shot. The point is it cannot save you.

### Arch open questions
- **`main.js` is allowed up to 250 lines for v1.** If it exceeds 250 the dev refactors into the existing modules (`scope.js`, `contacts.js`, `hud.js`); does not invent new files. Going past 250 means the file split was wrong, not that the file should grow.

### Dev open questions
- **Strike commit accepts taps anywhere inside the scope circle only.** Taps outside the circle on the canvas do nothing and do not consume budget. Justification: the scope is the instrument; the chrome is not a play surface. Visual feedback on out-of-bounds tap: brief amber pip flicker on ordnance display, no commit.
- **The post-blast true-centroid marker is computed from contacts that were inside `RADIUS=80px` at T+1.2s** (the moment of detonation), weighted. If zero contacts were in radius, no marker is shown. Mathematically the centroid of an empty set is undefined; do not invent one.

### UX open questions
- **The post-blast true-centroid marker is rendered in amber (`#ffaa44`).** Same register as the strike reticle; the operator reads "your aim vs the answer" in one visual language. Green would conflict with active blips.
- **HUD scanlines opacity starts at 0.06.** Retune if Gerald reports readout-scan fatigue after wave 3.

### QA open questions
- **"Wave 5 easier than wave 1" is tested in a single session via subjective recall** for v1; cold-replay validation is v2's job. v1 is a thesis check, not a study.

### DevOps open questions
- **v1 deploys, if it deploys at all, as a separate static folder under `kai-denrei/centroid-defense` GitHub Pages.** Folding into kika-centroid as a sister mode is a v2 question once the loop is validated.

### Coordinate system
- **Wave config `center: [x, y]` is canvas pixels, not scope-local polar.** `(0, 0)` is the canvas top-left. The rig (and scope center) sits at the canvas-center pixel. Negative `y` values like `-50` mean "spawn 50px above the canvas top edge" — contacts drift in via positive `vy`. Justification: pixel-space spawns are debuggable in devtools without conversion; polar adds a transform layer for zero gain at v1.

## 3. Tunable defaults

| Parameter | Starting value | Retune trigger |
|---|---|---|
| Sweep period | 3.0s | Players report tension is flat or frantic |
| Blip decay TAU | 1.5s | Trails unreadable (too short) or smear into clutter (too long) |
| Max blips per contact | 3 | Velocity unreadable from trail (raise to 4) |
| Trail buffer alpha decay | 0.92/frame | Phosphor smear obscures tight clusters |
| Strike delay | 1.2s | Lead-time feels reactive (raise) or guessy (lower) |
| Blast radius | 80px | Wave 1 "tight blob" cannot be 1-shot at perfect aim |
| Damage falloff k | 1.5 | Near-misses feel either worthless (lower k) or rewarded equal to perfect (raise k) |
| Max damage | 100 | Single perfect strike on light contact does not 1-shot |
| Auto-turret range | 60px | Turret carries the wave (cut) or never fires (raise) |
| Auto-turret DPS | 8 dmg / 0.4s = 20 DPS | Turret saves the player on its own |
| Bleep period range | lerp(0.18s, 1.2s, range/MAX) | Tension cadence flatlines |
| True-centroid marker duration | 600ms | Players miss it (raise) or feel flashed (lower) |
| Sweep ping freq | 440Hz / 60ms decay | Drowns or vanishes against bleeps |
| Bleep frequency | 330Hz at edge → 880Hz at point-blank | Distance-cue inaudible |
| Strike whoosh sweep | 400Hz → 80Hz over 0.8s | Whoosh feels detached from delay |
| Detonation thump | 50Hz sine, 100ms | No body to the boom |
| Wave 3 cluster separation | 120px | Wave 3 doesn't trap first-time player → 160px |
| Wave 5 stagger | ~2.5s between sub-cluster waves | Player stacks both strikes on slow blob → 1.5s |
| HUD scanlines opacity | 0.06 | Gerald reports readout fatigue |
| Contact spawn `vy` (radial drift) | 18 px/s | Wave duration <20s (raise) or >60s (lower) |
| Contact jitter | ±2 px/s on `vx`/`vy`, re-rolled every 1s | Motion looks robotic (raise) or unreadable (lower) |

**General retune rule:** all tunables live as named constants at the top of their owning module. Retune only after a full 5-wave playthrough surfaces the symptom; do not retune mid-wave or pre-emptively.

## 4. Coordinate system + canvas dimensions

- **Canvas size: 720 × 720px.** Square. Scope radius 320px, padding 40px on every side. Inside this canvas: rig at pixel (360, 360); scope outer ring at radius 320 from rig; auto-turret halo at radius 60 from rig.
- **HUD chrome lives outside the canvas in HTML/CSS.** Suggested overall page layout: canvas centered, top bar ~48px tall above, bottom strip (status log) ~140px tall below, left rail (integrity) ~80px wide, right rail (contact count + sweep period) ~80px wide. Total page footprint ≈ 880 × 920px. Page is fixed-size, not responsive — v1 is desktop only.
- **Coordinate space is canvas pixels with origin (0, 0) at canvas top-left.** Y grows downward. Wave config `center: [320, -50]` means spawn at canvas-x=320, canvas-y=-50 (above the visible area). Drift direction is `vy > 0` (toward bottom is also toward rig from above; for spawns on other sides, sign `vx`/`vy` accordingly).
- **For the spec's example `center: [320, -50]` to drift toward rig at (360, 360),** a small `vx = +1` is required or the contact misses the rig. Wave authors set `vx` explicitly per spawn to point at rig; the engine does not auto-aim.

## 5. Wave-end / game-over flow

### State machine
States: `wave_running` → `wave_endcard` → (next wave) `wave_running` … → `run_complete` or `game_over`.

### Wave end (all contacts destroyed OR all hit rig)
1. Freeze the loop: stop spawning, stop sweep ping audio, freeze contact movement. Auto-turret halts. Existing blips finish their decay.
2. **Endcard overlay** fades in over 300ms over the scope: monospace amber readout. Lines:
   - `WAVE N COMPLETE` (or `WAVE N — RIG INTEGRITY CRITICAL` if rig hit)
   - `STRIKES USED: x / budget`
   - `ACCURACY: <best-strike's distance-from-true-centroid as %, where 0px = 100% and RADIUS = 0%>`
   - `RIG INTEGRITY: nn%`
   - `[SPACE] CONTINUE` (amber, blinking 1Hz)
3. **Press SPACE (or click anywhere) to advance.** No auto-advance. Justification: the readout is half the feedback loop; auto-timeout robs the operator of the moment. Cost: one extra input per wave — negligible.
4. On advance: clear endcard, reset wave state, spawn next wave.

### Run complete (wave 5 cleared with rig > 0)
- Endcard reads `EXTRACTION SECURED — DEEPWATCH OPS NOMINAL` plus per-wave summary table (5 rows: wave, strikes used, best-accuracy, end-integrity).
- Bottom: `[SPACE] NEW RUN`. SPACE resets to wave 1 with full integrity. No score persistence in v1.

### Game over (rig integrity hits 0 mid-wave)
- Loop freezes immediately on the integrity-hits-0 frame. 800ms beat with red flicker on the scope.
- Endcard reads `RIG LOST — WAVE N` plus current-run summary (waves cleared, total strikes used).
- Bottom: `[SPACE] NEW RUN`. SPACE resets to wave 1 with full integrity.
- **No mid-run continue, no save state, no restart-from-wave-N.** v1 runs are short; if the player loses, they replay. Justification: continue logic is meta-progression; that is OUT for v1.

## 6. What success looks like

The PoC has succeeded if, after one full 5-wave cold playthrough by Gerald:
1. **(BLOCKING)** The sonar-reading skill feels meaningfully practiced — wave 5 is easier than wave 1 because the operator's eyes got better. *The thesis lives or dies here.*
2. **(BLOCKING)** At least one strike feels *perfect* — the post-blast true-centroid marker overlaps the reticle and the player knows they nailed it. *The kika gradient feel must port forward.*
3. **(BLOCKING)** The audio cadence carries the wave-end tension without continuous scope-watching. *Aliens-tracker hypothesis test.*
4. **(NICE-TO-HAVE)** The bimodal-trap wave actually traps a first-time player ("wait — oh"). *Hard to validate solo; a single playtester is not a sample. Don't kill the build over this one.*

If criteria 1–3 hold, build v2. If any of 1–3 fail, the loop needs more work before adding biomass, towers, or lore. Criterion 4 informs wave 3 tuning, not the v1 ship decision.

## 7. Build sequence (milestones)

The dev follows this order. Each milestone is independently verifiable by opening the page in a browser and looking. Do not start milestone N+1 until N renders correctly.

1. **Static scope render.** index.html + main.js + scope.js. Black canvas, phosphor circle, range rings, bearing ticks, rig dot, turret-range halo. No motion. Verify: scope looks like a sonar at rest.
2. **Sweep rotation.** 3.0s clockwise sweep with 30° trailing wedge gradient. Verify: sweep visually convincing, leading edge distinguishable from trail.
3. **One contact, hard-coded position, sweep-triggered blip.** contacts.js stub — single contact at fixed pixel, no motion. When sweep crosses its bearing, emit a blip with exp(-age/1.5) decay, max 3 visible. Verify: ping-and-fade cadence reads correctly.
4. **Contact motion + waves.js plumbing.** Wave 1 only: 6 contacts spawn at top edge, drift toward rig with `vy=18` and small jitter. Sweep-triggered blips on each. Auto-turret fires when in range. Wave ends when all contacts dead or hit rig. No strike yet. Verify: wave 1 plays start-to-finish without input.
5. **Strike commit + delay + detonation + falloff damage.** Click in scope → ghost reticle (amber, pulsing) → 1.2s wait → blast (flash + ring). Damage applied via spec formula. Verify: clicking on wave 1's blob actually kills contacts.
6. **Post-blast true-centroid marker.** 600ms amber dot at the weighted centroid of contacts inside `RADIUS=80` at T+1.2s. Verify: marker visibly differs from reticle when player misses, overlaps when player nails it.
7. **Audio: sweep ping + contact bleeps.** audio.js. Sweep ping on 0° crossing, contact bleeps on sweep crossing + range-cadence off-sweep. Verify: tension cadence accelerates as contacts close.
8. **Audio: strike whoosh + detonation.** Verify: 1.2s sweep audio matches the visual delay.
9. **HUD chrome + status log.** hud.js. Top bar, ordnance pips, integrity bar, contact count, scrolling status log with the spec's voice register. Wave-end and game-over endcards. Verify: every spec HUD element renders, log scrolls clinical lines.
10. **Wave 2 through 5 + run completion + game-over flow.** Add the four remaining wave configs to waves.js. Wire up state transitions per section 5 above. Verify: full 5-wave cold playthrough is possible end-to-end, including loss-and-restart.

After milestone 10: hand to QA (Gerald) for the success-criteria check. Do not add features. Tune only.

---

**End of directive.** Spec is the source of truth where it speaks; this directive is the source of truth where the spec was silent. Both are binding for v1.
