# DeepWatch · Containment Protocol — CLI integration spec

**Version** 0.1 · **Status** draft · **Audience** coding agent (Claude Code or equivalent)

A command-line tool, `dwcp`, that scaffolds, configures, and validates the Containment Protocol mini-game inside an existing DeepWatch tower-defense codebase. The mini-game itself is engine-agnostic at the data layer; the CLI emits portable JSON/YAML plus a thin adapter the host engine (Unity/Godot/Phaser/etc.) consumes.

---

## 1. Scope

**In scope**
- Project scaffolding inside an existing host repo
- Bestiary authoring + validation (creature tuning, behavior weights, energy curves)
- Mini-game config (drone tier balance, win conditions, frequency)
- Net remnant persistence across encounters
- Headless simulation harness for balance testing
- Adapter interface stubs for the host TD game

**Out of scope**
- Rendering / shaders / VFX
- Audio
- Multi-drone (locked to single drone for v0)
- Drone return mechanic decision (left as a config flag, default both behaviors stubbed)
- Online / multiplayer concerns

---

## 2. Assumptions about host game

- Host has a notion of "between rounds" with hooks to insert a modal mini-game
- Host has a save system that can persist arbitrary serialized blobs per save slot
- Host has a research/currency reward channel
- Host can render a 16:9 sub-scene with input forwarding

The CLI does **not** assume a specific engine. It emits an `adapter/` folder with an abstract interface; the user implements the 4–6 hook methods in their engine of choice.

---

## 3. Install / invocation

```
npm install -g @deepwatch/dwcp     # or pipx, cargo — pick one runtime, see §11
dwcp --help
```

Configuration lives at `<host-repo>/containment/dwcp.config.yaml`. All commands run from the host repo root and respect that file once `dwcp init` has been run.

---

## 4. Command surface

```
dwcp init                              Scaffold containment/ folder + adapter stubs
dwcp creature add <slug>               Interactive creature authoring → bestiary entry
dwcp creature list [--tier N]          List bestiary, optionally filter
dwcp creature edit <slug>              Open entry in $EDITOR
dwcp creature validate [<slug>]        Schema + balance sanity check
dwcp tune drone [--tier <t>] [--key=value]   Adjust drone tier params
dwcp tune rules [--key=value]          Adjust top-level rules (win %, drone pool, etc.)
dwcp simulate <slug> [--runs N] [--seed S] [--policy <p>]
                                       Headless balance run; reports win-rate, avg
                                       drones used, avg net HP at capture
dwcp remnants inspect <save-slot>      Print persisted net remnants for a save
dwcp remnants clear <save-slot>        Wipe remnants for a save
dwcp validate                          Validate everything (config, bestiary, hooks)
dwcp build [--target <t>]              Emit a versioned bundle for the host to load
dwcp version
```

All commands return non-zero on failure with structured stderr (one error per line, parseable).

---

## 5. Generated file layout

`dwcp init` creates:

```
containment/
├── dwcp.config.yaml              # tool config + version pin
├── rules.yaml                    # top-level mini-game rules
├── drones.yaml                   # tier parameters
├── bestiary/
│   ├── _schema.json              # JSON-schema for creature entries
│   └── README.md
├── adapter/
│   ├── IContainmentHost.md       # interface contract (see §8)
│   ├── stubs.ts                  # or .cs / .gd depending on --engine
│   └── events.md                 # event payload reference
├── sim/
│   └── policies/                 # built-in AI policies for headless sim
│       ├── greedy-cuts.yaml
│       ├── perimeter-first.yaml
│       └── mixed.yaml
├── build/                        # emitted bundles (gitignored by default)
└── .dwcp/                        # local cache, run logs (gitignored)
```

`dwcp init --engine=unity|godot|phaser|generic` picks the adapter stub language. `generic` emits TypeScript with no engine bindings.

---

## 6. Schemas

### 6.1 `rules.yaml`

```yaml
schema_version: 1
encounter:
  trigger_probability: 0.30          # chance per between-round event
  min_round_index: 3                 # first round where it can appear
  scaling:
    - { round: 10, probability: 0.35 }
    - { round: 20, probability: 0.45 }
  duration_target_seconds: 110       # soft target, not enforced
  skippable: true
arena:
  aspect_ratio: [16, 9]
  unit_size: 1000                    # internal coordinate units along long axis
win_conditions:
  energy_at_or_below: 0
  area_at_or_below_pct: 20
loss_conditions:
  drone_pool_exhausted: true
  unrecoverable_breach: true         # post-breach drones < drones-needed-to-close
  thrash_breakout:
    energy_above_pct: 60
    area_below_pct: 8
drone_pool:
  base: 10
  per_creature_modifier: true        # creature can override
reward:
  base_research: 50
  bonus_curve:
    drones_unused_weight: 1.5
    avg_net_hp_remaining_weight: 1.0
  failure_consolation: 10
remnants:
  enabled: true
  persistence: per_creature_per_save # see §9
  decay_rounds: 3                    # remnants fade after N TD rounds
```

### 6.2 `drones.yaml`

```yaml
schema_version: 1
return_mechanic: snap_to_anchor      # OR: retract_along_line — TBD, both stubbed
tiers:
  trawl:
    speed_units_per_sec: 250
    net_hp: 100
    cost_drones: 1
  cruise:
    speed_units_per_sec: 500
    net_hp: 50
    cost_drones: 1
  sprint:
    speed_units_per_sec: 1000
    net_hp: 20
    cost_drones: 1
launch:
  from_surface_edge: true
  from_existing_net: true            # any net segment endpoint is a valid anchor
  from_remnant: true                 # see §9
mid_draw_invulnerability: false      # creature contact with drone == drone destroyed
```

### 6.3 Creature entry — `bestiary/<slug>.yaml`

```yaml
schema_version: 1
slug: bloomjelly
display_name: Bloomjelly
tier: 1                              # 1=easy ... 5=apex
sprite_ref: creatures/bloomjelly     # adapter resolves
size_units: 80                       # diameter or longest axis
energy:
  max: 100
  drain_curve:
    # piecewise: accessible_area_pct → drain per second
    - { area_pct: 100, drain: 0.0 }
    - { area_pct: 60,  drain: 0.3 }
    - { area_pct: 30,  drain: 1.2 }
    - { area_pct: 15,  drain: 3.0 }
    - { area_pct: 5,   drain: 6.0 }
behavior:
  drift:
    base_speed: 120
    jitter: 0.4                      # 0..1, brownian intensity
  avoidance:
    drone_repulsion_radius: 200
    drone_repulsion_strength: 0.6
  aggression:
    ram_cooldown_curve:
      - { area_pct: 100, seconds: 999 }
      - { area_pct: 50,  seconds: 6 }
      - { area_pct: 20,  seconds: 2.5 }
      - { area_pct: 5,   seconds: 1.0 }
    ram_damage: 25
  hunt:
    energy_threshold_pct: 30
    drone_charge_chance_per_sec: 0.05
overrides:
  drone_pool: null                   # null → use rules.yaml base
  reward_research: null
notes: |
  Soft contact creature. Low ram damage but very evasive in open water.
  Easy tier — used as the introductory encounter.
```

The `_schema.json` defines required fields, ranges, and enum values; `dwcp creature validate` enforces it plus balance heuristics (§10).

### 6.4 Remnants persistence blob — JSON

```json
{
  "schema_version": 1,
  "save_slot": "slot_a",
  "creature_slug": "bloomjelly",
  "captured_at_round": 7,
  "net_segments": [
    {
      "ax": 120, "ay": 0,
      "bx": 120, "by": 540,
      "tier": "cruise",
      "hp_remaining_pct": 0.62,
      "decay_rounds_left": 3
    }
  ]
}
```

Stored under host save-slot scope; one blob per (save, creature) pair when remnants are enabled.

---

## 7. Encounter lifecycle

```
[host: between rounds]
        │
        ▼
host calls IContainmentHost.shouldTrigger(round, state)
        │
        ▼  yes
host calls IContainmentHost.beginEncounter(creature_slug)
        │
        ▼
dwcp runtime:
  1. Load creature, rules, drones
  2. Hydrate remnants (if any) for this (save, creature)
  3. Spawn creature + place remnant net segments
  4. Loop:
      - poll input → drone launch (tier choice + heading)
      - simulate drone, creature, net HP
      - on enclosure → seal smaller side, remove from accessible area
      - check win/loss
  5. Emit IContainmentHost.onResult({ outcome, drones_used, avg_net_hp,
                                      research_awarded, remnants })
        │
        ▼
host applies reward, persists remnants, returns to TD loop
```

---

## 8. Adapter interface

`adapter/IContainmentHost.md` documents the 6 methods the host must implement. Stubs in `adapter/stubs.<ext>` are typed and unimplemented.

```ts
interface IContainmentHost {
  shouldTrigger(round: number, state: HostState): TriggerDecision;
  pickCreature(round: number, state: HostState): CreatureSlug;
  beginEncounter(slug: CreatureSlug): EncounterContext;
  loadRemnants(slug: CreatureSlug): RemnantBlob | null;
  saveRemnants(slug: CreatureSlug, blob: RemnantBlob): void;
  onResult(result: EncounterResult): void;
}
```

Event payloads (`adapter/events.md`): `DroneLaunched`, `DroneDestroyed`, `NetPlaced`, `NetDamaged`, `NetBroken`, `ZoneSealed`, `CreatureRammed`, `EncounterEnded`.

---

## 9. Remnants persistence model

Three modes, set in `rules.yaml`:

| Mode                       | Behavior                                                          |
| :------------------------- | :---------------------------------------------------------------- |
| `disabled`                 | Nets dissolve at encounter end. No persistence.                   |
| `per_creature_per_save`    | Default. Remnants saved per (save_slot, creature_slug). Reused on next encounter with that creature. |
| `global_per_save`          | Remnants pooled per save_slot regardless of creature. Useful if encounters share an arena identity. |

Decay: a remnant survives `decay_rounds` TD rounds before fading. Each net segment retains its remaining HP; it does **not** regenerate. A remnant segment can be used as a launch anchor.

Edge cases the runtime handles:
- Remnant geometry conflicts with creature spawn → spawn relocated to largest open region
- Remnant pre-encloses a sub-region at encounter start → that region begins sealed
- Pre-sealed area exceeds win-area threshold at start → encounter is auto-won with a flat low reward (anti-exploit)

---

## 10. Validation rules

`dwcp validate` runs:

**Schema** — every YAML/JSON parses and matches its schema; required fields present; enums valid.

**Balance heuristics** (warnings, not failures, unless `--strict`):
- Drain curve must be monotonic non-decreasing as area shrinks
- Ram cooldown curve must be monotonic non-increasing as area shrinks
- Energy max / max possible drain must give a theoretical minimum encounter time ≥ 20s
- Drone pool × max single-cut area must be ≥ 100% of arena (otherwise encounter is unwinnable)
- At least one tier's `net_hp` must exceed creature's burst-ram damage (otherwise no durable cage possible)

**Adapter** — adapter stub file exists and exports all 6 interface methods (string-match check; full type-check is the host's responsibility).

**Remnants** — persisted blobs match current schema_version; on mismatch, `dwcp validate` suggests a migration command.

---

## 11. Runtime choice

Pick one for v0:

- **Node/TypeScript** — easiest if host is web/Phaser; simulation harness in plain TS
- **Python** — easiest authoring + numpy for sim; weaker for engine adapters
- **Rust** — fastest sim; heaviest tooling overhead

Recommendation: **Node/TypeScript**, distributed via npm. Sim harness uses deterministic PRNG (seedable) so balance runs are reproducible.

---

## 12. Headless simulation

`dwcp simulate <slug> --runs 1000 --seed 42 --policy greedy-cuts` runs the encounter without rendering, using a built-in policy as the "player." Output:

```
creature: bloomjelly      runs: 1000     seed: 42     policy: greedy-cuts
─────────────────────────────────────────────────────────────────────────
win rate              : 71.4%
avg encounter time    : 84.2s   (σ 18.6)
avg drones used       : 6.8     (σ 1.4)
avg net hp remaining  : 47%
loss reasons          : drones_exhausted 71%  breach 22%  thrash 7%
─────────────────────────────────────────────────────────────────────────
suggest: trawl tier underused (1.2/run); consider buffing trawl HP or
         nerfing cruise HP to widen the speed/strength dial
```

Policies are declarative (YAML) — they describe heuristics like "always sprint when creature within N units" rather than being imperative code. This keeps balance work in the data layer.

---

## 13. Build output

`dwcp build` emits `containment/build/<version>/`:

```
manifest.json          # schema_version, dwcp version, content hash
rules.json             # compiled from yaml
drones.json
bestiary.json          # all creatures, indexed by slug
policies.json          # if --include-policies
```

Host loads `manifest.json` at startup. Hash mismatch on save load triggers a soft warning ("content updated since last save"); host decides whether to clear remnants.

---

## 14. Milestones

1. **M0 — scaffolding** · `init`, `validate`, schemas, adapter stubs. No runtime.
2. **M1 — bestiary tooling** · `creature add/edit/list/validate`, schema enforcement.
3. **M2 — runtime core** · simulate creature + drone + nets headlessly. No host.
4. **M3 — sim harness** · `simulate` command, policies, balance reports.
5. **M4 — remnants** · persistence layer, decay, pre-seal handling.
6. **M5 — adapter examples** · one working adapter for the host engine of choice.
7. **M6 — build pipeline** · `build` emits versioned bundles; manifest checking.

---

## 15. Open decisions deferred to implementation

- **Drone return mechanic** (`snap_to_anchor` vs `retract_along_line`) — implement both behind the flag, ship `snap_to_anchor` as default, A/B test later.
- **Reward scaling** — current curve is linear; may need diminishing returns at high efficiency.
- **Creature roster size** — start with 3 creatures (tier 1, 2, 3) for M5 playable build.
- **Localization** — `display_name` and `notes` may need a parallel i18n file; not in v0.

---

## 16. Non-goals reminder

This CLI manages **data and integration**, not gameplay code. Rendering, input wiring, and feel-tuning (camera shake on ram, drone trail VFX, water caustics) live in the host engine. The CLI's job is to make balance, content authoring, and persistence tractable from the command line.
