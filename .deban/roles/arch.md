---
role: arch
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# Architecture

## Scope
File-structure and module boundaries for the v1 PoC. No frameworks, no build step, no npm. Single static folder, opens in a browser.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | Vanilla JS, Canvas 2D for scope, HTML/CSS for HUD chrome, Web Audio for sound | Per spec. Aesthetic is instrument-grade; codebase should match | [[dev]], [[ux]] |
| 2026-05-08 | File split: index.html, main.js, scope.js, audio.js, waves.js, contacts.js, hud.js | Per spec. main.js holds loop+state; scope.js owns canvas render; contacts.js owns spawn+motion+centroid | [[dev]] |
| 2026-05-08 | ES modules via `<script type="module">` — no bundler | Modern browsers support it; keeps "no build step" promise honest | [[dev]], [[devops]] |
| 2026-05-08 | Game state held in a single mutable object passed to render/update | Simplest mental model at v1 scale. No Redux, no signals, no FSM library | [[dev]] |
| 2026-05-08 | Time-driven loop using requestAnimationFrame + dt clamping | Standard pattern. dt clamp prevents tab-switch warp | [[dev]] |
| 2026-05-08 | Canvas locked at 720×720px; rig at pixel (360, 360); scope outer ring at radius 320 | Square canvas avoids responsive math; spec implied ~640×720, locked to 720 for rig-centered symmetry | [[dev]], [[ux]] |
| 2026-05-08 | Wave config `center: [x, y]` is canvas pixels with origin (0, 0) at canvas top-left, y-down | Pixel-space spawns are debuggable in devtools without polar conversion; zero gain from polar at v1 | [[dev]] |
| 2026-05-08 | main.js soft-cap = 250 lines; overflow refactors into existing modules, no new files | A 200-line target accommodates state-machine reality at v1 scale; new files = wrong boundaries, not natural growth | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] If main.js exceeds 200 lines, does that mean we under-scoped the file split, or that the loop+state really is that big? — owner: Gerald — since: 2026-05-08

## Assumptions
- ES modules with relative imports work without CORS issues when served via a local file:// — status: untested — since: 2026-05-08
- Note: file:// + ES modules is blocked on most browsers. May need `python3 -m http.server` or similar for local play
- Canvas 2D performance is sufficient for sweep + ~20 contacts + blip trails at 60fps — status: untested — since: 2026-05-08

## Dependencies
Blocked by: [[pm]]
Feeds into: [[dev]]

## Session Log
- 2026-05-08 — INIT: locked file structure, ES module imports, single-state-object pattern
