---
project: DEEPWATCH (centroid-defense)
created: 2026-05-08
status: active
mode: solo
stale_threshold_days: 30
---

# DEEPWATCH — Index

## Brief
Tower-defense game built around a single skill: reading a phosphor sonar PPI and committing a delayed depth-charge strike at the weighted centroid of a moving cluster. Validates whether sonar-reading + centroid-strike commit is satisfying enough to carry the genre. Extends `kika-centroid` into a dynamic, time-pressured context — same gradient feel, but the targets move and the strike lands on a 1.2s delay so the player must lead. v1 ships 5 hand-authored waves, one threat type, one strike type, one auto-turret, phosphor-green CRT aesthetic, vanilla JS no build step.

## Active Roles
- [[pm]] — owner: Gerald (Jelaludo) — design decisions, scope, open questions
- [[arch]] — owner: Gerald (Jelaludo) — file structure, module boundaries, math
- [[dev]] — owner: Gerald (Jelaludo) — implementation, vanilla JS + Canvas 2D + Web Audio
- [[ux]] — owner: Gerald (Jelaludo) — phosphor aesthetic, HUD chrome, audio cadence
- [[qa]] — owner: Gerald (Jelaludo) — playtest the 5 waves, success criteria
- [[devops]] — owner: Gerald (Jelaludo) — no build step, single-folder static site

## Key Decisions
<!-- Maintained by COMPACT. Empty at init. -->

## Open Questions (cross-role)
- Wave 5 lead-time tuning — does 1.2s delay actually create a meaningful timing choice when 2 strikes are available? See [[pm]], [[qa]].
- Bimodal trap (wave 3) — does the naive-centroid trap actually trip first-time players, or is it too obvious? See [[pm]], [[qa]].
