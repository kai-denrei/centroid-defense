---
role: dev
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# Developer

## Scope
Implementation of the v1 PoC files. Vanilla JS, Canvas 2D, Web Audio. Reuse centroid math + falloff feel from kika-centroid (`/Users/minikai/Documents/Dev/KikaCentroid/game.js`).

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | Weighted centroid formula: `cx = Σ(wᵢ·xᵢ)/Σwᵢ, cy = Σ(wᵢ·yᵢ)/Σwᵢ` | Standard. Heavy outliers pull the centroid as the spec requires (wave 4 lesson) | [[arch]] |
| 2026-05-08 | Damage falloff: `MAX_DMG * (1 - d/RADIUS)^k`, k=1.5, RADIUS=80, MAX=100 | Per spec. Mirrors kika's gradient feel — every strike contributes, but precision is rewarded | [[arch]] |
| 2026-05-08 | Sweep: 3.0s period clockwise, ~30° trailing wedge gradient, leading edge `#88ff88` | Per spec | [[ux]] |
| 2026-05-08 | Blip decay: `opacity = exp(-age/1.5)`, max 3 blips per contact visible | Per spec. Trail is the only velocity cue — no vector arrows | [[ux]] |
| 2026-05-08 | Per-frame canvas trail buffer at 0.92 alpha decay for phosphor smear | Per spec. Tunable | [[ux]] |
| 2026-05-08 | Bleep cadence: `period = lerp(0.18, 1.2, range/MAX_RANGE)` per contact, off-sweep | Aliens motion-tracker tempo. Carries tension audio-first | [[ux]] |
| 2026-05-08 | Sweep-crossing detection via stored prev-sweep-angle and contact-bearing comparison; account for 0/2π wraparound | Standard. Trigger blip + bleep on the cross | |
| 2026-05-08 | Strike delay 1.2s, blast radius 80px, max damage 100, k=1.5 | Per spec | |
| 2026-05-08 | Auto-turret: 60px range, 0.4s fire interval, 8 dmg/shot, 100ms tracer fade | Per spec — trickle-handler, not a crutch | [[pm]] |
| 2026-05-08 | v1.1: multiple strikes can be in flight simultaneously (`pendingStrikes[]`) | Player has 2-3 strikes per wave with multi-side spawns; queueing each behind the 1.2s delay would force serial commits and waste the budget | [[pm]] |
| 2026-05-08 | v1.1: contact rig damage = weight*8 (was max(8, weight*12)) | Original 12/hit drained 100 HP in 8 hits — wave 2 with 8+ contacts game-overed before wave 3 | [[pm]] |
| 2026-05-08 | v1.1: default contact speed vy=22 (was 18); wave 5 slow=16 fast=28 | Per Gerald: "slightly faster pace" | [[pm]] |
| 2026-05-08 | v1.2: munition cam 200×120 in bottom-right, view radius shrinks 240→55px over delay, contact shadows + heat cores, blast-radius dashed ring | Player needed actionable feedback on what the bomb hits during the 1.2s suspense; live-updated contact positions reveal whether they led the cluster correctly | [[ux]], [[pm]] |
| 2026-05-08 | Strike commit accepts taps inside scope circle ONLY; out-of-bounds tap does nothing, does not consume budget | Scope = play surface, chrome = readout. Visual feedback on out-of-bounds: brief amber pip flicker, no commit | [[ux]] |
| 2026-05-08 | Post-blast true-centroid marker computed over contacts inside RADIUS=80 at T+1.2s, weighted; if zero contacts in radius, no marker | Centroid of empty set is undefined; do not invent one | [[pm]] |
| 2026-05-08 | Wave config center is canvas pixels (origin top-left, y-down). Wave authors set vx/vy explicitly per spawn to point at rig (360, 360) | Engine does not auto-aim; pixel-space spawns are debuggable | [[arch]] |
| 2026-05-08 | Build sequence is 10 milestones (static scope → sweep → blip → motion → strike → centroid feedback → audio → HUD → all 5 waves + endcards). Each milestone independently verifiable. Do not start N+1 until N renders correctly | Forces visible checkpoints; prevents big-bang integration | [[qa]] |
| 2026-05-08 | Wave-end advance = press SPACE (or click). No auto-advance | Endcard readout is half the feedback loop; auto-timeout robs the moment | [[ux]] |
| 2026-05-08 | Game over (rig=0) = freeze + 800ms red flicker + endcard + SPACE for new run from wave 1. No mid-run continue | v1 runs are short; continue logic is meta-progression | [[ux]] |
| 2026-05-09 | v1.3 viewport meta = `width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover` (KikaCentroid pattern). Replaces `width=900` | The `width=900` pin is the root cause of broken touch coords on phone — fix at the source | [[arch]], [[ux]] |
| 2026-05-09 | Canvas is sized in CSS to fit available square (`min(100dvw, 100dvh - chrome)`); backing store = `cssSize × dpr`; `ctx.setTransform(dpr * scaleFactor, ...)` once per resize. All draw code keeps 720-logical-px constants | One source of truth for coordinates; render-time scale is the only mobile-specific math | [[arch]] |
| 2026-05-09 | Tap mapping on mobile: `cssX = ev.clientX - rect.left`, `x = cssX / scaleFactor` → 720-logical-px space; `isInsideScope(x,y)` unchanged | Coordinate fix is purely in the input handler; scope geometry constants are immutable | [[arch]] |
| 2026-05-09 | AudioContext unlock: document-level capture-phase listeners on `pointerdown` + `touchend` + `click`, single-shot, removes itself on first fire | iOS Safari needs all three across its versions; capture phase fires before any element handler regardless of which UI element catches the first tap | [[ux]] |
| 2026-05-09 | `pointerdown` on canvas remains the strike-commit event; no separate `touchstart` listener | pointerdown covers mouse/pen/touch on every modern browser; `touch-action: none` on canvas already prevents synthetic event interference | [[ux]] |
| 2026-05-09 | Mobile munition cam parameterizes `CAM_W`/`CAM_H` in scope.js; on mobile dims = `viewportWidth × 68`. Cam visibility toggled by `state.pendingStrikes.length > 0` with 100ms ease | Existing draw functions adapt to passed-in dims; ~120 LOC parameterization, no logic rewrite | [[ux]] |
| 2026-05-09 | Service worker port: KikaCentroid `sw.js` verbatim with `CACHE_VERSION='v1.3.0'`, `dw-precache-` / `dw-runtime-` cache names, DEEPWATCH precache list (8 modules + index + manifest + offline + 5 icons) | Hand-rolled, no Workbox, no build step — preserves "open it and run" promise | [[arch]], [[devops]] |
| 2026-05-09 | SW caching matrix: NetworkFirst for HTML+manifest, StaleWhileRevalidate for JS, CacheFirst for icons, pass-through for cross-origin (Google Fonts) | KikaCentroid-proven mapping; Google Font is offline-soft-fail (system mono fallback) | [[arch]] |
| 2026-05-09 | Icons: 5 PNGs (192, 512, maskable-512, apple-touch-180, favicon-32) generated programmatically from a phosphor-PPI render via `scripts/build-icons.js` (Node + canvas). Fallback: one-shot `canvas.toDataURL()` from running game | Pixel-honest icon matches the in-game scope; no AI-generated assets | [[ux]] |
| 2026-05-09 | iOS A2HS: detect non-standalone Safari → show dismissible "TAP SHARE → ADD TO HOME SCREEN" hint on intro overlay, persisted in localStorage. Android: capture `beforeinstallprompt`, expose INSTALL button | KikaCentroid pattern, both platforms | [[ux]] |
| 2026-05-09 | Build sequence v1.3 is 10 milestones, gated on real-phone verification at every step (not desktop devtools mobile emulation). Milestone #8 (tap-accuracy on phone) is the gating success metric | Devtools emulation does not reproduce the iOS gesture-unlock or A2HS quirks; only the actual device tells the truth | [[qa]] |
| 2026-05-09 | Performance fallback order (only if 60fps not held on midrange Android): drop `smearScope` first, then blip bloom. No adaptive logic in v1.3 — hard-coded fallbacks only | Adaptive perf logic is meta-engineering; cut features in known order if and when needed | [[arch]] |
| 2026-05-09 | v2.0a (deepdefense): bestiary art transcoded by `scripts/build-bestiary-img.js` (Node + sharp). Filename normalization regex `^(\d+)_?(.+)\.png$` handles off-pattern `12MegacidodonProfundi.png`. Output: `bestiary-img/thumb/${id}.webp` (320 sq Q72) + `bestiary-img/detail/${id}.webp` (768 max Q80) | Off-pattern filename was the only gotcha; output files use bestiary id (kebab-case), not source filename | [[pm]] |
| 2026-05-09 | v2.0a: codex grid changes from `1fr 90px` to `96px 1fr 88px` with named grid-areas (thumb/taxon/threat/meta/kills/stats/abil/desc/note). Image inserted as `<img loading="lazy" src="bestiary-img/thumb/${id}.webp">` per entry | Reuses existing modal/CSS — minimum disruption to the renderer | [[ux]], [[pm]] |
| 2026-05-09 | v2.0a: 5-tab strip (`#codex-tabs`) inserted between modal header and `#codex-body`; active tab in localStorage key `dw-codex-tab`; default tab = PELAGIC; `setCodexTab(category)` filters the rendered group | One tab visible at a time replaces the always-show-all-categories layout; codepath simpler than detail+list | [[ux]], [[pm]] |
| 2026-05-09 | v2.0a: `description` (specimen visual prose) added as new field on every BESTIARY entry. Extracted from txt2img by stripping rendering directives (8k, cinema, lighting, "specimen photography", aspect notes) and background descriptors; keep morphology + mineralogy + pigment + texture + one distinctive behavior; target 2 sentences ~50 words | Single source of truth for visual prose; do not on-the-fly de-prompt-ify | [[pm]] |
| 2026-05-09 | v2.0a: `note` field kept verbatim across all 19 species; soft-trim only if >240 chars (down to ≤220), no creative rewrites | Existing operator-clinical voice is in register; rewriting risks regression | [[pm]] |
| 2026-05-09 | v2.0a: `WAVES[i].headliner = 'species-id'` new field; renderer composes binomial via `SPECIES_BY_ID[wave.headliner]` at display time. Latin string NOT hard-coded into waves.js | Single source of truth (BESTIARY) for taxonomy; wave config stays clean | [[pm]] |
| 2026-05-09 | v2.0a: bestiary-img runtime cached under new bucket `dw-bestiary-${CACHE_VERSION}`, NOT in PRECACHE_URLS; CacheFirst on `bestiary-img/*` URL prefix added to existing image-destination handler | PRECACHE_URLS stays game-only (~30KB); avoids ~530KB install bloat for content visited 1–2x per run | [[devops]] |
| 2026-05-09 | v2.0a: detail webps generated this pass but NOT wired into UI; lightbox / detail viewer deferred to v2.1 | Asset cost is zero when not loaded; unblocks v2.1 day-of-greenlight | [[pm]] |
| 2026-05-09 | v2.0a build sequence: 6 milestones (transcode → data extension → tab strip → thumb+grid → stats+prose → wave-name overrides + sw cache + version bump). Each independently verifiable in browser | Same ship-bias gating pattern as prior directives; 6 milestones because the work is additive on existing modal | [[pm]] |
| 2026-05-09 | v2.0a: build version on intro overlay bumps to `v2.0.1-α · deepdefense` after dev pass; do NOT push to main, do NOT bump CACHE_VERSION on main | deepdefense is exploratory v2-track; main locked under v1 directives | [[devops]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-08 | Wave 2 with `vx: 0, vy: 18` line abreast (literal spec reading) | 4 of 8 contacts pass beside rig (lateral offset > rig hit radius and > turret range) and drift off-canvas south, dealing zero damage. Wave 2 was trivial: integrity stayed at 100% with or without strike. Fix: added `aim: 'rig'` to wave configs so contacts home at rig at speed |v|. Outer contacts still arrive later (longer path) so the line shape is preserved during travel. CDP smoke confirmed wave 2 now ends with integrity 28% after a single strike — proper rig pressure restored |
| 2026-05-08 | Headless Chrome with `--virtual-time-budget` for gameplay smoke testing | Virtual-time mode throttles requestAnimationFrame; sweep barely advanced and contacts never moved during waits. State snapshots returned 0-contacts with fresh-looking sweep angle, masking the real wave behavior. Switched to CDP-driven test (real-time clock) via WebSocket; gave correct picture immediately |
| 2026-05-08 | CDP test attaching to `tabs[0]` from `/json/list` | Headless Chrome creates extension `background_page` and `service_worker` tabs that show up before the actual `page` tab in the list. CDP eval and Page.captureScreenshot hang silently when sent to the wrong target. Fix: `tabs.find(t => t.type === 'page')`. Cost a build cycle of confused debugging |

## Lessons
- A spawn config with `vx: 0` and a non-axially-spawned formation (line abreast across x) means most contacts will pass the rig with lateral offset, dealing no damage and creating no pressure — the wave is trivial. Always verify wave configs produce rig pressure on a no-strike playthrough. — from dead end on 2026-05-08
- Chrome `--virtual-time-budget` is unsuitable for verifying RAF-driven game loops; use real-time CDP-driven tests instead. — from dead end on 2026-05-08
- Headless Chrome `/json/list` returns extension and service-worker targets before the actual page; always `find(t => t.type === 'page')` when picking a CDP debug target. Wrong target = silent hang on Page.captureScreenshot. — from dead end on 2026-05-08

## Open Questions
- [ ] Should the strike commit be locked to inside-scope-circle only? Or accept any tap on the canvas? — owner: Gerald — since: 2026-05-08
- [ ] How to handle wave 3's bimodal trap fairly — should the centroid feedback marker still appear in the gap (which is "correct" mathematically but hits nothing)? Yes per spec, that's the lesson — owner: Gerald — since: 2026-05-08

## Assumptions
- Web Audio AudioContext requires user gesture to start; first click commits this — status: untested — since: 2026-05-08
- Tap on touch devices works through the same canvas pointer event path — status: untested — since: 2026-05-08

## Dependencies
Blocked by: [[arch]], [[pm]]
Feeds into: [[qa]]

## Session Log
- 2026-05-08 — v1.2 MUNITION CAM: per Gerald — added 200×120 video feed in bottom-right of comms strip showing top-down view from the descending charge. Strike-zone view radius shrinks 240→55px over the 1.2s delay (zoom-in), contact silhouettes brighten with phosphor heat-cores as the charge closes, dashed amber ring marks blast radius, depth countdown 1200M→0000M, TGT N counter, REC indicator pulses red on the header. Standby state ("NO MUNITION") between strikes. Restructured bottombar into flex row (comms-pane | cam-pane); MAX_LINES dropped 12→7 to fit narrower comms pane. drawMissileCam lives in scope.js (canvas work). +120 LOC scope.js, +1 LOC main.js. CDP smoke: zoom progression visible across cam-zoom-early/mid/late shots, REC indicator toggles correctly, returns to standby after detonation.
- 2026-05-08 — v1.1 PATCH: per Gerald — strike budget ≥2 per wave, contacts spawn from ≥2 distinct sides per wave, default vy bumped 18→22 for slightly faster pace. Refactored `pendingStrike` → `pendingStrikes[]` so the player can chain strikes inside the 1.2s delay window (otherwise multi-side waves are unsolvable with 2 charges). Tuned rig damage from 12 to weight*8 to keep runs survivable past wave 2. CDP smoke confirms: multi-side spawn dispersion (N+S, W+E), state machine intact through wave 3 game-over, no errors.
- 2026-05-08 — BUILD: scaffolded v1 across 7 files (index.html + 6 ES modules), CDP-verified wave 1 + wave 2 end-to-end, found and fixed `vx:0` line-abreast dead end with `aim:'rig'` convergence. main.js at 256 lines (within 6 of 250 cap). Run via `python3 -m http.server` from project root; open browser at the served URL. No console errors in headless smoke.
- 2026-05-08 — INIT: locked centroid math, falloff formula, sweep/blip/bleep parameters
