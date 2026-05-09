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
| 2026-05-09 | SW `controllerchange → location.reload()` REMOVED in v2.0.3-α | Cache freshness via NetworkFirst HTML + `?v=X.Y.Z` query bust on JS modules is sufficient on its own. Auto-reload created a race window where user input mid-deploy got eaten by the navigation. See dead end below | [[dev]], [[arch]] |
| 2026-05-09 | Cache versioning ritual: bump `CACHE_VERSION` in sw.js + matching `?v=X.Y.Z` on `<script src="main.js">` in index.html. Per-deploy. Internal ES module `import` paths stay unversioned (browser resolves them relative to importing module URL) | KikaCentroid-proven; freshness bounded to one extra load per bump | [[dev]] |
| 2026-05-09 | New SW cache bucket `dw-bestiary-${CACHE_VERSION}` for codex art (v2.0a). Diff-on-activate handler ports old buckets across version transitions. Routed by URL prefix `/bestiary-img/` | Codex art is large but cold-tier; isolating it lets us evict independently from game-loop assets | [[arch]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|
| 2026-05-09 | `navigator.serviceWorker.addEventListener('controllerchange', () => location.reload())` for SW update propagation, added in v1.4.2 | Raced user input on first reload after deploy: SW activated mid-input → page reloaded → input "lost." Bug was intermittent because once user was on the latest SW, controllerchange stopped firing on plain reloads — reappeared on every deploy. Replaced with no-handler approach in v2.0.3-α; cache freshness retained via NetworkFirst HTML + `?v=` query strings |

## Lessons
- For PWA cache freshness on rapidly-iterating short-session apps, NetworkFirst HTML + `?v=X.Y.Z` query-bust on JS modules is sufficient on its own. Adding `controllerchange → location.reload()` on top of `skipWaiting()` creates a race with user input that's worse than the staleness it was meant to fix. — from dead end on 2026-05-09

## Open Questions
- [ ] If v1 ships, does it deploy as a separate static site (GitHub Pages) or fold into kika-centroid as a sister mode? — owner: Gerald — since: 2026-05-08

## Assumptions
- No persistence/save needed at v1. State resets on reload — status: untested — since: 2026-05-08

## Dependencies
Blocked by:
Feeds into: [[dev]]

## Session Log
- 2026-05-09 — SW controllerchange auto-reload removed (input-race dead end → lesson) · cache versioning ritual locked · bestiary cache bucket added. deepdefense iterations v2.0.2 → v2.0.7.
- 2026-05-08 — INIT: static-folder, no-build, locally served
