---
role: devops
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# DevOps

## Scope
How the project is served, run, and (eventually) shared. v1 is a static folder.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | Local play via `python3 -m http.server` or any static server | ES modules need http://, not file:// | [[arch]] |
| 2026-05-08 | No npm, no build, no CI yet | v1 thesis check; tooling is wasted before the loop is validated | |
| 2026-05-08 | If v1 deploys, target = standalone GitHub Pages under kai-denrei/centroid-defense; folding into kika-centroid as sister mode is a v2 question | Standalone deploy preserves repo independence while loop is unproven | [[arch]] |
| 2026-05-08 | No persistence/save state for v1; full reset on reload, full reset on game over | Spec is silent; PM-DIRECTIVE locks no-continue, no-save | [[pm]] |
| 2026-05-09 | v1.3 deploys as PWA on existing GitHub Pages URL `https://kai-denrei.github.io/centroid-defense/`. No new repo, no separate URL | Same canonical URL across versions; PWA install upgrades in place | [[pm]] |
| 2026-05-09 | Service worker hand-rolled (port KikaCentroid sw.js); no build step, no npm, no bundler. Static folder deploy unchanged | Preserves "open it and run" promise; matches Gerald-approved KikaCentroid pipeline | [[arch]] |
| 2026-05-09 | Cache version bump = single edit per release: `CACHE_VERSION` constant in sw.js + matching `?v=X.Y.Z` query strings on top-level `<script>` tags in index.html. Bumped in lockstep | KikaCentroid-proven release ritual; Option A from directive (internal imports unversioned) | [[dev]] |
| 2026-05-09 | localStorage may store: A2HS-hint-dismissal flag only. No score/run persistence in v1.3 (deferred to future) | One bit of state, scoped to UX hint suppression | [[pm]] |
| 2026-05-09 | Icon build pipeline: Node + canvas script in `scripts/build-icons.js` generates 5 PNGs from phosphor-PPI render. Fallback: one-shot manual canvas export. Icons committed to `icons/` | Reuses existing scope renderer; no AI-generated assets, no SVG-only (iOS rejects) | [[ux]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] If v1 ships, does it deploy as a separate static site (GitHub Pages) or fold into kika-centroid as a sister mode? — owner: Gerald — since: 2026-05-08

## Assumptions
- No persistence/save needed at v1. State resets on reload — status: untested — since: 2026-05-08

## Dependencies
Blocked by:
Feeds into: [[dev]]

## Session Log
- 2026-05-08 — INIT: static-folder, no-build, locally served
