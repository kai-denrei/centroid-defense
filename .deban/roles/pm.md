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
- 2026-05-08 — INIT: scoped v1 thesis, locked tap-to-commit/1.2s/no-ghost-wedge defaults, surfaced 5 untested assumptions
