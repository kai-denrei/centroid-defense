---
role: pm
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# Product Manager

## Scope
Owns the v1 thesis ("is the centroid-strike loop satisfying enough to carry a TD?"), scope boundaries (IN vs OUT in the spec), and open design questions. Resolves binding decisions when the spec leaves a default open. Solo project — PM and dev are the same human, but the role separation enforces deliberate scope decisions instead of feature creep.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | Tap-to-commit (not hold-to-aim) for v1 | Period-correct instrument feel; spec's stated default. Hold-to-aim deferred to v2 if playtest shows tap is too punishing | [[dev]], [[ux]] |
| 2026-05-08 | Strike delay constant 1.2s, not range-dependent | Simpler. Range-dependence is a v2 lever once the base loop is validated | [[dev]] |
| 2026-05-08 | No predictive sweep ghost-wedge | Diluting the skill. The whole point is reading the trail, not pre-planning against the sweep | [[ux]] |
| 2026-05-08 | Single canvas for the scope, HTML/CSS for HUD chrome | Per spec. CRT effects on chrome only — scope must stay legible | [[arch]], [[ux]] |
| 2026-05-08 | Reuse weighted-centroid math + soft-falloff scoring gradient from kika-centroid | The "you weren't wholly wasted but you can always do better" feel is the soul of the predecessor | [[dev]], [[arch]] |
| 2026-05-08 | PM-DIRECTIVE-v1 issued: all spec open questions resolved, all role open questions answered with binding defaults | Ship-bias on every coin-flip; revisit only after wave 1 playable | [[arch]], [[dev]], [[ux]], [[qa]], [[devops]] |
| 2026-05-08 | Wave 3 ships at 120px cluster separation, retunes to 160px only if cold playthrough fails to trap | Single-playtester risk acknowledged; tune by symptom, not speculation | [[qa]], [[dev]] |
| 2026-05-08 | Wave 5 ships with 2 strikes + ~2.5s sub-cluster stagger; tighten to 1.5s if player stacks both strikes | Lead-time skill is the wave 5 lesson; force the timing choice | [[dev]] |
| 2026-05-08 | True-centroid marker = 600ms amber, computed only over contacts inside RADIUS at T+delay | Empty set has no centroid; do not invent one. Amber = "your aim vs the answer" register | [[ux]], [[dev]] |
| 2026-05-08 | Auto-turret locked at 60px / 0.4s / 8 dmg (~20 DPS); cut to 5 dmg only if it carries wave 1 | Turret is a trickle-handler not a crutch; the spec is explicit | [[dev]] |
| 2026-05-08 | Success criteria 1–3 are blocking-must-pass for v2 greenlight; criterion 4 (wave 3 trap) is nice-to-have | Solo playtester can't validate first-timer reactions; don't kill build over it | [[qa]] |
| 2026-05-08 | Run-end / loss = full reset to wave 1, no continue, no save state, no restart-from-wave-N | Continue logic is meta-progression; OUT for v1 | [[dev]], [[ux]] |
| 2026-05-09 | PM-DIRECTIVE-v1.3-mobile issued: desktop 880×920 layout locked under v1; mobile is its own composition behind `@media (max-width:899px)` | Two layouts beats infinite-responsive; scope of v1.3 is "ship native phone PWA," not "make every breakpoint pretty" | [[arch]], [[dev]], [[ux]], [[devops]] |
| 2026-05-09 | Mobile portrait-locked via manifest; landscape shows "ROTATE TO PORTRAIT" overlay only | Scope is a circle; landscape phone is a different layout problem and not solved in v1.3 | [[ux]], [[dev]] |
| 2026-05-09 | Tap-to-commit stays on mobile (no hold-to-aim revisit yet); flagged for retest after first phone playthrough | Mobile-specific ergonomics may differ from desktop; do not preempt — gate on real-device feel | [[dev]] |
| 2026-05-09 | Mobile munition cam = full-width 68px strip, visible only during pending strike, scope shrinks to fit on slide-in | Strongest v1.2 feedback beat; reclaim space when idle for max scope size | [[ux]], [[dev]] |
| 2026-05-09 | Mobile drops right-rail decoratives (RPM, SWEEP P, contact count, strikes-used); integrity moves to top-bar bottom-edge horizontal strip | Decoration, not actionable; revisit only if Gerald reports missing readouts | [[ux]] |
| 2026-05-09 | Mobile endcards = fullscreen modals, not scope-only overlays | Scope-only would leave top bar + comms strip visible — looks broken | [[ux]], [[dev]] |
| 2026-05-09 | PWA scaffolding scope: hand-rolled SW (port KikaCentroid pattern), versioned cache, offline.html, 5 PNG icons, manifest. Update toast deferred to v1.4 | Pattern is proven and Gerald-approved; bump-and-reload sufficient for current deploy cadence | [[arch]], [[devops]] |
| 2026-05-09 | Out-of-scope for v1.3: haptics, gyro, push, Background Sync, app-store wrapper, leaderboard, settings UI, landscape, tablet breakpoint, audio settings | Each tempts the dev; defer all to v2+ | [[dev]] |
| 2026-05-09 | Mobile build sequence is 10 milestones, gated on phone-device verification (not desktop devtools emulation) at every step; milestone #8 is the gating tap-accuracy test | Forces honest validation against the actual device that surfaced the bug | [[dev]], [[qa]] |
| 2026-05-09 | PM-DIRECTIVE-v2.0a-bestiary issued (deepdefense branch only): codex tab gets 5-tab strip (PELAGIC/BENTHIC/SWARM/APEX/SPECIALIST), thumbs-on-left list-view, 6-stat strip + abilities chips + 2-paragraph specimen/field-note prose | Reuse existing modal; do not build a separate page; preserve CRT register while letting photographic art read as "specimen plate" | [[ux]], [[dev]] |
| 2026-05-09 | Wave names elevated to Latin binomials with archetype subtitle: W1 Acidoplankton tenuis · TWIN PINCER, W2 Acidonecton vorax · CROSSFIRE, W3 Fluorapate rigidum · BIMODAL TRAP, W4 Barytolithus reptans · HEAVY MASS, W5 Pyrithionyx ferrosus · DRIFTER | Binomial gives flavor; archetype is the cross-run teaching label QA references — drop neither | [[dev]], [[qa]] |
| 2026-05-09 | Bestiary art ships as webp-only (320w thumb + 768w detail), runtime-cached on first fetch under new `dw-bestiary` cache bucket, NOT in PRECACHE_URLS; lazy-loaded per-tab on tab activation | Universal webp support in 2026 makes PNG fallback dead weight; precaching all 19 thumbs bloats install for content the player visits 1–2x per run | [[dev]], [[devops]] |
| 2026-05-09 | Megacidodon profundi has art (file `12MegacidodonProfundi.png` exists, off-pattern filename); ships normally. Image-pending stub code path still implemented for future-proofing | Brief was wrong on the missing-image claim; verified on disk. Stub costs ~50 LOC and unblocks any future species shipping without art | [[dev]] |
| 2026-05-09 | Locked-species visual = CSS-filtered silhouette of the thumbnail (green-tinted ghost), NOT blur or blank icon; flagged for revisit if photographic silhouettes leak too much shape | Period-correct sonar-record aesthetic; best-of-three options for a single CSS filter rule | [[ux]] |
| 2026-05-09 | Detail-image viewer (lightbox / tap-thumb-to-zoom) deferred to v2.1; detail webps generated in this pass to unblock v2.1 immediately | Doubles modal complexity for a feature that's nice-to-have at v1; assets cost zero runtime weight when not wired up | [[dev]] |
| 2026-05-09 | Build version bumps to v2.0.1-α · deepdefense after dev's bestiary pass; do NOT push to main | deepdefense is exploratory v2-track; main is locked under v1 directives | [[devops]] |
| 2026-05-09 | Detail-image lightbox unblocked → shipped in v2.0.2-α (was deferred to v2.1) | Greenlit by Gerald: "clicking an unlocked beast should bring its image." Cost was UI-only — assets shipped in v2.0a | [[dev]], [[ux]] |
| 2026-05-09 | Per-component versioning convention: `v.1.x` tag next to panel headers, bumped per-panel iteration | Per Gerald: visible verification of which iteration of a panel is running, separate from the global build tag | [[ux]], [[arch]] |
| 2026-05-09 | Stochastic motion design boundary (v2.0.5-α): randomness layers must be zero-mean over a group; centroid stays the hittable target. Six concrete layers locked: per-individual gaussian speed noise, species-relative pool scaling, sinusoidal swim wobble, Gaussian cluster sampling, spawn-time stagger, reduced jitter | Centroid skill is the game; protecting it is the constraint that makes other randomness safe to add. Any future "interesting motion" feature must satisfy zero-mean | [[dev]], [[arch]] |
| 2026-05-09 | Vertical metal toggle replaces SAFE/ARM (v2.0.6-α); OFF/ON labels; satisfying mechanical click + 100ms metal-body thunk | Gerald supplied the PNG art. Real-hardware metaphor reads as more tactile than the abstract horizontal slider. Three-register audio bracket (click / beep / click+thud) preserved | [[ux]] |
| 2026-05-09 | Layout-stability fixes (v2.0.7-α) classified as dev/arch concerns, not PM scope changes | Gerald reported visual drift between phases and a horizontal scrollbar; these are CSS bugs (no gameplay impact), not feature-scope decisions | [[dev]], [[arch]] |
| 2026-05-09 | SW auto-reload removed from index.html (v2.0.3-α); freshness via NetworkFirst HTML + ?v= query bust on JS modules is sufficient | Gerald reported intermittent space/tap failure on reload; root cause was the auto-reload race window. Fix is removal, not retry | [[devops]], [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Does wave 3 (bimodal trap) actually trick first-time players, or is the gap too obviously empty? — owner: Gerald — since: 2026-05-08
- [ ] Wave 5 with 2 strikes — does the player split them across staggered groups (lead-time skill) or stack on the easier cluster (greedy)? — owner: Gerald — since: 2026-05-08
- [ ] Is post-blast true-centroid feedback marker (~600ms) long enough to teach without becoming clutter? — owner: Gerald — since: 2026-05-08
- [ ] Auto-turret DPS — at ~8/shot every 0.4s (~20 DPS), does it really not save the player? Need to verify it's a trickle-handler not a crutch — owner: Gerald — since: 2026-05-08

## Assumptions
- Sonar-reading is a transferable skill that improves wave-over-wave within one session — status: untested — since: 2026-05-08
- Phosphor monochrome aesthetic carries the tone better than color-coded threat highlighting — status: untested — since: 2026-05-08
- 1.2s strike delay is the right lead-budget — short enough to feel reactive, long enough to require prediction — status: untested — since: 2026-05-08
- Web Audio cadence (Aliens-tracker style) carries tension better than visual-only feedback — status: untested — since: 2026-05-08
- 200-line main.js target is achievable without sacrificing the loop — status: untested — since: 2026-05-08

## Dependencies
Blocked by:
Feeds into: [[arch]], [[dev]], [[ux]], [[qa]]

## Session Log
- 2026-05-09 — v2.0a bestiary directive issued (PM-DIRECTIVE-v2.0a-bestiary.md) → v2.0.2 lightbox unblock → input-race diagnosed and SW auto-reload removed → vertical-toggle UX directive → layout-stability fixes classified as CSS bugs not scope changes. deepdefense at v2.0.7-α.
- 2026-05-08 — INIT: scoped v1 thesis, locked tap-to-commit/1.2s/no-ghost-wedge defaults, surfaced 5 untested assumptions
