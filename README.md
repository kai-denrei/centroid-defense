# DEEPWATCH

> v1 PoC — phosphor-sonar tower defense built around reading a PPI and
> committing delayed depth-charge strikes at the weighted centroid of moving
> contacts. Extends [`kika-centroid`](https://github.com/Jelaludo/kika-centroid)
> into a dynamic, time-pressured context.

You operate a research-extraction rig anchored on the surface of an ocean on a
distant world. Something biomechanical lives below. You can't see directly —
only the phosphor sweep of a PPI sonar tells you what's approaching. Strikes
land on a 1.2 s delay, so you must lead the cluster.

## Play

- Open the deployed page (or `python3 -m http.server` from this folder).
- Press SPACE or click to begin.
- Tap inside the scope to commit a depth-charge strike at that point.
- The munition cam in the bottom-right shows what your strike is about to hit
  as the charge sinks.
- Five waves; press SPACE between waves.

## Stack

Vanilla JS + Canvas 2D + Web Audio. No build step, no npm.

```
index.html        — HUD chrome, CSS, layout grid
main.js           — game loop, state, input, transitions
scope.js          — PPI canvas render + munition cam
contacts.js       — contact spawn / motion / weighted centroid / damage
audio.js          — Web Audio: sweep ping, range-cadence bleeps, strike whoosh, detonation
waves.js          — five hand-authored wave configs
hud.js            — DOM updates (HUD, comms log, endcards)
```

## Spec

`deepwatch-v1-spec.md` — original v1 brief.
`.deban/` — project memory: PM directive, role decisions, dead ends, lessons.
