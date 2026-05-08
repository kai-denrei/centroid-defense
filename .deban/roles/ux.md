---
role: ux
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# UX / Aesthetic

## Scope
Phosphor-green CRT instrument-grade aesthetic. HUD chrome, scope visuals, audio cadence, voice register. Resist neon-arcade prettiness. This is an instrument, not a poster.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | Palette: phosphor green primary (#88ff88 / #3a8c3a / #0f2c0f), amber secondary (#ffaa44), red strictly critical (#ff3322), background near-black (#050a05) | Per spec. White almost never. No serif | [[dev]] |
| 2026-05-08 | Monospace font: `JetBrains Mono` with system mono fallback; load from Google Fonts CDN | Free, ships, period-correct enough. VT323 is too on-the-nose for v1 | |
| 2026-05-08 | CRT effect (subtle scanlines, faint chromatic aberration on text) on HUD only — never on scope canvas | Scope legibility is paramount; CRT styling lives in CSS on chrome elements | [[dev]] |
| 2026-05-08 | Voice register for status log: clinical, impersonal, military-industrial. Never edgy | Horror from the casualness. Per spec | |
| 2026-05-08 | HUD layout: top bar (rig designation + wave + system time), top-right (ordnance pips), left rail (integrity bar), right rail (contact count + sweep period), bottom strip (status log) | Per spec | [[dev]] |
| 2026-05-08 | Post-blast true-centroid marker rendered in amber (#ffaa44), 600ms duration | Same register as strike reticle — operator reads "your aim vs the answer" in one visual language; green would conflict with active blips | [[dev]] |
| 2026-05-08 | HUD scanlines starting opacity = 0.06; retune only if Gerald reports readout-scan fatigue after wave 3 | Subtle by default; tune by symptom | |
| 2026-05-08 | Page footprint = 880×920px fixed (canvas 720×720 + 48px top bar + 140px bottom strip + 80px rails). Desktop only for v1 | Responsive math is wasted before the loop is validated | [[arch]] |
| 2026-05-08 | Wave-end endcard fades in over 300ms, blocks loop, advances on SPACE/click. No auto-advance | The readout IS feedback; auto-timeout robs the moment | [[dev]] |
| 2026-05-08 | Run-complete and game-over share the endcard pattern; SPACE = new run from wave 1, full integrity | One restart path; no continue logic | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Do scanlines on the HUD chrome make readouts harder to scan during play? Tune opacity in playtest — owner: Gerald — since: 2026-05-08
- [ ] Should the post-blast true-centroid marker be amber or green? Spec doesn't say — owner: Gerald — since: 2026-05-08

## Assumptions
- Players can read multi-element HUD chrome while still keeping focus on the scope center — status: untested — since: 2026-05-08
- Phosphor smear on the trail buffer doesn't make tight clusters unreadable — status: untested — since: 2026-05-08

## Dependencies
Blocked by: [[pm]]
Feeds into: [[qa]]

## Session Log
- 2026-05-08 — INIT: locked palette, font choice, CRT-on-chrome-only rule, voice register
