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
| 2026-05-09 | v1.3 file additions: `manifest.webmanifest`, `sw.js`, `offline.html`, `icons/` (5 PNGs), optional `scripts/build-icons.js`. No new game-logic modules | PWA scaffolding only; game code stays in the existing 7 files | [[devops]], [[dev]] |
| 2026-05-09 | Canonical render coordinate space stays 720×720 logical pixels; mobile applies `ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0)` once per resize | Zero changes to game logic, wave configs, or constants; render-time scale only | [[dev]] |
| 2026-05-09 | devicePixelRatio capped at 2: `Math.min(window.devicePixelRatio || 1, 2)` | dpr=3 on iPhone Pro is wasted pixel work indistinguishable at arm's length; dpr=1 visibly soft | [[dev]] |
| 2026-05-09 | Single mobile breakpoint at `@media (max-width: 899px)`; tablet falls into mobile bucket | Two layouts, not three; resist breakpoint creep until validated need | [[ux]], [[dev]] |
| 2026-05-09 | Service worker caches modules via `?v=CACHE_VERSION` query strings on top-level `<script>` tags only; internal `import` statements stay unversioned and SWR-cached | Avoids per-release rewrite of every import path; freshness bounded to one extra load on bump | [[devops]], [[dev]] |
| 2026-05-09 | `CACHE_VERSION` constant in sw.js + matching `?v=X.Y.Z` in index.html, bumped in lockstep on every deploy | KikaCentroid-proven pattern | [[devops]] |
| 2026-05-09 | Bestiary art pipeline: cwebp manual transcoding from `AquaticAcidBestiary/*.png` → `bestiary-img/thumb/{species-id}.webp` (320×320 sq center-crop, Q72) + `bestiary-img/detail/{species-id}.webp` (768 long-edge, Q80). webp-only (no PNG fallback in 2026 browsers) | Total ship size 332KB thumbs + 1.5MB details (down from ~47MB source). Manual one-shot conversion, source PNGs stay in repo for re-runs | [[devops]], [[ux]] |
| 2026-05-09 | New SW cache bucket `dw-bestiary-${CACHE_VERSION}` for codex art — separate from PRECACHE and RUNTIME, evictable independently. Routed via URL prefix `/bestiary-img/` in the existing `req.destination === 'image'` handler | Codex art is large (~1.8MB) but cold-tier — separating it from the game-loop cache lets us evict on its own cadence | [[devops]] |
| 2026-05-09 | Per-component versioning convention: `.comp-ver` CSS class with format `v.1.x`, placed next to panel section headers (e.g. `// LAUNCH CONTROL · v.1.1`). Bumped per-panel iteration; orthogonal to global build tag | Lets us check at a glance which iteration of a panel is running, without inspecting the build tag | [[ux]], [[dev]] |
| 2026-05-09 | `#launch-pane { width: 280px }` pinned on desktop | Layout stability constraint: prevents horizontal drift of internal fixed-position elements as flex:1 children reflow with content | [[ux]], [[dev]] |
| 2026-05-09 | Stochastic motion design constraint: every randomization layer must be zero-mean over a group, preserving group centroid as a hittable target. Layers: per-individual gaussian speed noise · species-relative pool scaling · sinusoidal swim wobble · Gaussian cluster sampling · spawn-time stagger · reduced random jitter | Centroid skill is the game; randomness that destroys centroid destroys the game. CDP-verified: 4-of-a-kind centroid wobble ~6 px against STRIKE_RADIUS 80 px | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-09 | `#launch-pane` flex container without explicit width, holding `#launch-readout` (flex:1, variable text width) + safety switch (fixed-width left edge) + 発射 button (fixed-width right edge) | Variable status text reflowed `#launch-readout`'s width → pane intrinsic width changed → comms-pane (flex:1 neighbour) absorbed delta → pane's left edge shifted → safety switch x drifted between phases. Fix: pin parent pane to a fixed width (`width: 280px`). General principle in lesson below |

## Lessons
- A flex container with both variable-width content (a flex:1 child) and a fixed-position UI element (an input control at one edge) must have its OWN width pinned, or the fixed UI will shift horizontally as the variable content reflows. — from dead end on 2026-05-09

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
- 2026-05-09 — bestiary art pipeline (cwebp thumb 320×320 Q72 + detail 768-edge Q80) · separate SW cache bucket dw-bestiary-${VER} · per-component .comp-ver versioning convention · launch-pane width pinned 280px (layout stability dead end → lesson) · zero-mean stochastic motion design constraint locked.
- 2026-05-08 — INIT: locked file structure, ES module imports, single-state-object pattern
