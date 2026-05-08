---
role: qa
owner: Gerald (Jelaludo)
status: active
last-updated: 2026-05-08
---

# QA / Playtest

## Scope
Validate the spec's success criteria after the v1 build is playable. The build is "done" only when the criteria are tested honestly — not when the code compiles.

## Decisions
| Date | Decision | Rationale | Linked roles |
|---|---|---|---|
| 2026-05-08 | v1 success = 3 of 4 spec success criteria hold after one full 5-wave playthrough | Per spec. If <3 hold, the loop needs more work before adding biomass/towers/lore | [[pm]] |
| 2026-05-08 | Spec criteria 1–3 (skill-practice, perfect-strike-feel, audio-tension) are blocking-must-pass; criterion 4 (wave-3-trap) is nice-to-have | Solo playtester cannot validate first-timer reactions; criterion 4 informs wave 3 tuning, not v1 ship decision | [[pm]] |
| 2026-05-08 | "Wave 5 easier than wave 1" tested via subjective recall in single session; cold-replay validation deferred to v2 | v1 is a thesis check, not a study | [[pm]] |
| 2026-05-08 | QA accepts the build only after the 10-milestone build sequence completes and Gerald has played all 5 waves once cold | Forces honest validation, not "the code compiles" | [[dev]] |
| 2026-05-09 | v1.3 mobile QA gating metric: tap accuracy on Gerald's iPhone (build-seq milestone #8). Verified via 5 fixed-location taps on the scope clustering within ±5 logical-px | Tap precision is the bug Gerald reported; nothing else ships until this is verified on device | [[dev]] |
| 2026-05-09 | Every milestone in v1.3 build sequence is verified on Gerald's actual phone, not desktop devtools mobile emulation | iOS gesture-unlock and A2HS quirks do not reproduce in emulation; only the device tells the truth | [[dev]] |
| 2026-05-09 | v1.3 ship gate = full 5-wave cold playthrough on iPhone, installed as PWA from home screen, with airplane mode toggled mid-run to confirm offline works | Validates PWA install + service worker + offline.html as a single integrated test | [[dev]] |

## Dead Ends
| Date | What was tried | Why it failed / was rejected |
|---|---|---|

## Lessons

## Open Questions
- [ ] Can we test "wave 5 easier than wave 1 because eyes got better" in a single session, or does this require a rested replay? — owner: Gerald — since: 2026-05-08

## Assumptions
- Solo playtester (Gerald) is representative enough for v1 thesis check. v2 needs cold first-timers to validate wave-3 trap — status: untested — since: 2026-05-08

## Dependencies
Blocked by: [[dev]]
Feeds into: [[pm]]

## Session Log
- 2026-05-08 — INIT: locked success criteria — 3 of 4 spec criteria must hold
