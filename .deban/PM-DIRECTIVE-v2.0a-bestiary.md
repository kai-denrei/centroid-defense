---
doc: PM-DIRECTIVE-v2.0a-bestiary
project: DEEPWATCH (centroid-defense)
branch: deepdefense
date: 2026-05-09
status: binding
supersedes: none (extends PM-DIRECTIVE-v1 and PM-DIRECTIVE-v1.3-mobile where they were silent on the bestiary tab)
---

# DEEPWATCH v2.0a — Bestiary Tab v1 PM Directive (Binding)

## 1. Executive call

We are shipping a **specimen-codex pass** of the existing `#codex-modal` so Gerald can see the 19-species bestiary as art-plus-text, on the `deepdefense` branch only. The codex stays a single-screen modal with the existing phosphor-CRT chrome — we are not building a separate bestiary "page." The modal becomes a **tabbed list-view-only** layout: 5 category tabs at the top of the modal switch between scrollable lists of entries; each entry is a fixed-row composition with a thumbnail-on-left, taxon + stat strip + clinical note + specimen description on the right. The photographic specimen images are clinically framed (CRT amber border, monospace caption strip) so the stylistic richness of the art reads as "specimen reference plate," not "in-game graphics" — exactly the contrast Gerald asked for. Wave names are upgraded so each of the 5 wave-titles becomes the Latin binomial of that wave's headlining species; the legacy archetype name is preserved as a subtitle in the comms log and endcards (no information lost, more flavor surfaced). All bestiary art ships as `webp-only` at two pre-generated sizes (320w thumb, 768w detail), runtime-cached by the existing service worker with a separate `bestiary-img` cache key — install size unchanged. **Done** = Gerald opens the BESTIARY button on `deepdefense`, sees a 5-tab modal with all 19 species rendered (18 with art, 1 with a numbered "// IMAGE PENDING" stub), every entry shows the thumbnail + name + stat strip + description + clinical note in CRT register, locked species are a CSS-filtered silhouette of their thumb until first kill, and waves 1–5 announce themselves with binomial names (with subtitle archetype) in the comms log. No game-loop regression, no `main` push.

> **Correction to brief**: Gerald's prompt says "Megacidodon profundi (id 12) has NO image." The directory in fact contains `12MegacidodonProfundi.png` (notable: it's the only file missing the `_` separator in its filename). All 19 species have source PNGs. The "no image" handling stub is therefore **not needed** for v1 — but the dev should still implement the stub-renderer code path in case any future species ship without art. Image pipeline must tolerate the inconsistent filename (`12Megacidodon...` not `12_Megacidodon...`); the dev's transcoding script normalizes by leading number, not by exact filename.

## 2. Locked decisions

### Codex layout

- **(1) Modal layout shape**: **list-view-only**, single vertical scroll per tab. Justification: list+detail doubles the modal's complexity for zero gameplay value at v1; carousel adds a state machine and hides the scan-the-bestiary affordance; the existing renderer is already a list — we extend, we do not rewrite.
- **(2) Image position**: **thumbnail-on-left (96 × 96 css px), text-on-right** in a flex row. Justification: matches the "scientific specimen plate" idiom (image, then taxonomy + notes), keeps line-length controlled on mobile (≤ 360px wide minus 96 thumb = ~248px text column = readable), and reuses the existing 2-column entry grid with a third image column prepended.
- **(3) Stat block position**: **above the description, below the taxon line, as a single horizontal monospace strip** (`HP 22 · WT 1.5 · SPD 22 · BIO 3 · THREAT MED`). Justification: separating stats from the prose paragraph keeps the prose readable as prose; stats-as-strip parallels the topbar/HUD register; overlay-on-image was rejected because it forces image-relative positioning math at every viewport size.
- **(4) Stats to surface (ordered, exactly 6)**: **HP · WT (weight) · SPD · BIO (biomass) · THREAT · CLASS**. Scale is folded into the meta line under the taxon (existing). Abilities chips render as a separate dimmer row beneath the stat strip when non-empty (e.g. `▸ ARMORED · ERRATIC`). `blipColor` is not surfaced as a literal stat — instead a 6×6 phosphor square next to the threat tag previews the in-scope blip color (stat the player actually parses on the scope, not hex code).
- **(5) Locked-state visual**: **CSS-filtered silhouette of the thumbnail** (`filter: brightness(0) saturate(0) opacity(0.35); mix-blend-mode: screen` over a phosphor-green tinted background, plus the existing 0.42 entry opacity). The image is shown as a dim green ghost — readable as silhouette, taxon hidden behind a `// CONTACT NOT YET CATALOGUED` stub line, stats replaced with `— · — · — · — · — · —`. Justification: full-blur leaks too much shape; blank icon kills the visual rhythm of the tab; silhouette is the period-correct sonar-record aesthetic ("we have a return profile but no specimen photograph yet").
- **(6) Megacidodon profundi handling**: brief calls for handling this; in fact the file exists. **Render normally with the existing PNG**. The image-pending stub code path still ships (50 LOC, future-proof) but is not triggered for v1. If transcoding fails on the irregular filename, **fall back to the stub for that single species rather than blocking the whole modal**.
- **(7) Tab structure**: **5 tabs at the top of the modal**: `PELAGIC · BENTHIC · SWARM · APEX · SPECIALIST`. The current grouped-by-category list collapses into one tab at a time. Justification: 19 entries × ~140px each = ~2660px of scroll in one tab — too long for a phone modal; tabs cap each list to ≤ 6 entries, fit on one phone screen with minimal scroll, and surface Gerald's taxonomic structure as navigation rather than as a header inside one giant scroll. Default tab on open: **PELAGIC** (the intro tier).

### Wave name overrides

- **(8) Headliners** (see lookup table §3 for full justifications):
  - W1 → `ACIDOPLANKTON TENUIS` (the larger pool of the swarm cluster — visually defines wave 1 as "the swarm wave")
  - W2 → `ACIDONECTON VORAX` (sole occupant of the W line; the iconic cephalopodiform)
  - W3 → `FLUORAPATE RIGIDUM` (the heavier benthic that anchors the bimodal trap's "real" mass cluster)
  - W4 → `BARYTOLITHUS REPTANS` (the single heavy that pulls weighted centroid east — the entire wave's lesson is its weight)
  - W5 → `PYRITHIONYX FERROSUS` (the predator-class headliner of the fast follow-group; thematically "drifter that hunts")
- **(9) Display**: **subtitle, both shown**. Comms log entry on wave start: `WAVE 4 · BARYTOLITHUS REPTANS · HEAVY MASS`. Topbar wave readout shows the binomial; endcard `ARCHETYPE` row continues to render the legacy archetype name. Justification: the binomial gives flavor; the archetype name is the *teaching label* that survives across runs and lets QA reference the lesson by name. Dropping the archetype label would force every playtest note to relearn the species-to-archetype mapping.

### Image / asset strategy

- **(10) WebP-only**: **confirmed**. WebP is universal in 2026 browsers; PNG fallback is dead weight. Source PNGs (~47MB) stay in `AquaticAcidBestiary/` (not deployed); only the transcoded webp pair ships.
- **(11) Lazy-load**: **lazy-load on tab activation** (not on modal open, not all at once). When the user opens a tab, fetch the 4–6 thumbs for that tab in parallel via `<img loading="lazy">`. Detail-size webp is **only loaded on hover/long-press** (deferred to v2.1 — see §5). Justification: precaching all 19 thumbs on first modal open is ~700KB at 320w; precaching all 19 details is ~2MB. Tab-scoped lazy is the middle ground. Service worker caches whatever was fetched, so subsequent tabs hit cache.
- **(12) Service worker**: **runtime-cache only, NOT in PRECACHE_URLS** — confirmed. Add a new cache bucket `dw-bestiary-${CACHE_VERSION}` populated on first fetch, CacheFirst thereafter. PRECACHE_URLS stays game-only (~30KB total). The dev adds the bestiary-img URL prefix to the existing image-destination handler; do not introduce a third runtime cache name.

### Text fields

- **(13) `description` (specimen visual)**: derived from the txt2img prompts. **Drop**: rendering directives (`8k detail`, `cinema camera`, `dramatic lighting`, `David Attenborough`, `shallow depth of field`, `motion blur`, `mid-strike posture`, all aspect-ratio / model notes), background descriptors that aren't the creature itself (`School of three or four visible`, `disturbing sediment cloud`, `hydrothermal vent silhouettes`), and any "specimen photography" framing. **Keep**: morphology (size, body shape, segments, limbs/tentacle counts), mineralogy (chitin-sulfur, barite, silica, pyrite, fluorapatite — the world-build vocabulary), pigment / color (oxidized copper green, sulfur-yellow, rust-red), surface texture nouns (lamellae, denticles, plating, gelatinous, translucent), and the *single* most distinctive behavior. Target length: **two sentences, ~50 words**, ending with a period. The dev does this once per species at extract time, not on the fly. Output goes into a new `description` field on each `BESTIARY[i]`, beside `note`.
- **(14) `note` (clinical operator)**: **keep all 19 as-is**. They are already in voice register (operator vocabulary, sonar-return language, tactical implication). Rewriting risks regression. Two adjustments only: (a) any `note` exceeding 240 chars gets a soft trim to ≤ 220 by deleting the second-most-redundant clause; (b) every `note` ends with the tactical implication, not the descriptive premise — they already do, this is just a sanity-check rule. The dev does NOT do creative rewrites.

## 3. Wave name lookup table

| # | Old name | New name (Latin binomial) | Subtitle (archetype, kept) | Why this species headlines |
|---|---|---|---|---|
| 1 | TWIN PINCER | **ACIDOPLANKTON TENUIS** | TWIN PINCER · CLUSTER | The northern cluster (5 contacts at 60% Acidoplankton + 40% Sulfovermis) is dominant by count; Acidoplankton is the iconic swarm-tier introduction and the player's first sonar return. Sulfomedusa from the south is the second tier, not the headliner. |
| 2 | CROSSFIRE | **ACIDONECTON VORAX** | CROSSFIRE · LINEAR | The W line is 100% Acidonecton — the cleanest possible "this species is what wave 2 is" signal. Iconic cephalopodiform body plan; the bestiary's flagship pelagic. Chalcophyma on the E side is mixed (70/30 with Vitreonephes), so it's a less coherent headliner. |
| 3 | BIMODAL TRAP | **FLUORAPATE RIGIDUM** | BIMODAL TRAP · BIMODAL | Both clusters mix Acidonecton (60%) with a benthic burrower; the W cluster's burrower is Fluorapate, which is the more visually distinctive (silica-spined burrower vs. chitin-shovel). Choosing a benthic over the pelagic majority signals "wave 3 is where things start crawling," which matches the difficulty step. |
| 4 | HEAVY MASS | **BARYTOLITHUS REPTANS** | HEAVY MASS · WEIGHTED | The single Barytolithus IS the lesson — its weight 3.5 (vs swarm 0.4) pulls the weighted centroid east despite the swarm having 5× the count. Naming the wave after the swarm or the formation would bury the actual mechanism. The directly-illustrative pick. |
| 5 | DRIFTER | **PYRITHIONYX FERROSUS** | DRIFTER · STAGGERED | The fast follow-group is 75% Pyrithionyx, which has `rig-targeting` ability (drawn directly to rig) — the *exact* reason wave 5 punishes greedy stack-strikes on the slow lead. The slow group is mixed (Vitreonephes + Cryptocnidaria + Lampyronoctis); no single headliner there. Pyrithionyx names the wave's actual threat. |

## 4. Codex layout spec (explicit)

### 4.1 Modal frame (unchanged)
- Reuses existing `#codex-modal .modal-frame` (90% viewport, max 720×640 desktop, fullscreen on mobile).
- Header `// BESTIARY · DEEPWATCH SCIENTIFIC SURVEY` and footer `SPECIES UNLOCK ON FIRST KILL · BIOMASS RETURNS PER UNIT VARIES BY MASS` — both stay.

### 4.2 Tab strip (NEW)
- Inserted between header and `#codex-body`.
- Container: `#codex-tabs`, height **32px**, `border-bottom: 1px solid var(--p-dim)`, `display: flex`, `padding: 0 14px`, `gap: 0`.
- Each tab: `<button class="codex-tab">PELAGIC</button>`. Width: `flex: 1` (5 tabs share width equally on phone; on desktop they shrink-wrap with `min-width: 88px`).
- Tab style: 11px monospace, letter-spacing 0.18em, color `var(--p-mid)`, no border, transparent background, `padding: 8px 0`. Active tab: color `var(--amber)`, `border-bottom: 2px solid var(--amber)`, `text-shadow: 0 0 6px rgba(255,170,68,0.4)`. Hover: color `var(--p-hot)`. Tab key navigation (←/→) optional, NICE-TO-HAVE.
- Active tab persisted in `localStorage` key `dw-codex-tab` so reopening returns to the last-viewed tier.

### 4.3 Entry row (REVISED grid)
Existing `.entry` grid changes from `grid-template-columns: 1fr 90px` to:

```
grid-template-columns: 96px 1fr 88px;
grid-template-areas:
  "thumb taxon  threat"
  "thumb meta   kills"
  "thumb stats  stats"
  "thumb abil   abil"
  "desc  desc   desc"
  "note  note   note";
gap: 4px 12px;
padding: 10px 0;
```

- **Thumb cell**: 96 × 96 css px (= 192 × 192 backing on dpr=2). Square crop. CRT amber 1px border (`border: 1px solid var(--amber-dim)`), 2px inner phosphor-green inset shadow. Below the thumb (still in the thumb cell, 4px gap): a 9px monospace caption in `var(--p-dim)` reading `// SPEC.${id-padded}` — "specimen number 04" register. On mobile (<640px modal), thumb shrinks to 80 × 80; below 380px viewport, thumb stacks above text (single column, thumb full-width 100%, max-height 200px).
- **Taxon cell**: italic, `var(--p-hot)`, font-size 12px (was 11). Genus + species rendered with the existing `<span class="genus">` / `<span class="species">`.
- **Meta cell**: `class · scale` only (drop the `· BIOMASS N` clause — biomass moves into the stat strip).
- **Threat cell**: existing threat tag, unchanged.
- **Kills cell**: `12 KILLED` or `— LOCKED —` (unchanged copy).
- **Stats cell** (NEW, single line): `HP 22 · WT 1.5 · SPD 22 · BIO 3 · THREAT MED · ${blipColorSquare}`. 10px monospace, `var(--p-mid)`, letter-spacing 0.10em. The `blipColorSquare` is a 6 × 6px inline-block with `background: ${blipColor}` and a 1px `var(--p-dim)` border — visual preview of in-scope return color.
- **Abilities cell** (NEW, conditional): if `abilities.length > 0`, render `▸ ${abilities.map(a => a.toUpperCase()).join(' · ')}` in 9px `var(--amber-dim)`, letter-spacing 0.16em. Skipped entirely when empty.
- **Description cell** (NEW): the specimen-visual prose extracted from txt2img. 11px `var(--p-mid)`, line-height 1.6, italic. Prefixed with `▶ SPECIMEN:`.
- **Note cell** (existing): the operator-clinical note. Kept as-is. Prefixed with `▶ FIELD NOTE:` so the two paragraphs are visually distinguished.

### 4.4 Locked entry (zero kills)
- Thumb: `filter: brightness(0) saturate(0) opacity(0.35) drop-shadow(0 0 4px var(--p-dim))`. Visual: green-tinted silhouette.
- Caption under thumb: `// SPEC.04 · UNCATALOGUED` (instead of plain spec number).
- Taxon: rendered but at `opacity: 0.5`; species italics still readable for taxonomic browsing.
- Stats line: `HP — · WT — · SPD — · BIO — · THREAT ?? · ▢` (color square becomes empty outline).
- Abilities: hidden entirely.
- Description: replaced with `// SPECIMEN PHOTOGRAPH PENDING — SUBMIT FIRST KILL FOR FULL CATALOGUE ENTRY`.
- Note: replaced with the existing `// CONTACT NOT YET CATALOGUED — STRIKE ONE TO UNLOCK` stub.
- Entire row opacity stays at 0.42 (existing rule).

### 4.5 Image-pending stub (Megacidodon fallback / future species)
If transcoding fails or webp file is missing for an unlocked species:
- Thumb cell renders a 96×96 box: solid `var(--bg)` background, 1px dashed `var(--amber-dim)` border, centered 10px monospace `// IMG · PENDING` in `var(--p-dim)`.
- Everything else (taxon, stats, prose) renders normally.
- A single `console.warn('[bestiary] missing webp for', id)` to make the missing asset noisy in devtools. Do NOT crash the modal.

### 4.6 Image asset spec (handed to dev)
Output directory: `bestiary-img/` (repo root, sibling to `icons/`).

| File | Dimensions | Quality | Approx size | Used in |
|---|---|---|---|---|
| `bestiary-img/thumb/${id}.webp` | 320 × 320 (square crop, centered on subject) | webp Q72 | ~28KB | List entry thumb |
| `bestiary-img/detail/${id}.webp` | 768 × 768 (or original aspect, max 768 long edge) | webp Q80 | ~110KB | Detail viewer (deferred to v2.1) |

Total v1 ship size: ~28KB × 19 = ~530KB thumbs (lazy-loaded per tab, never all at once on first open). Detail set (~2MB) generated this pass but not wired up in v1 — costs zero runtime weight and unblocks v2.1 immediately.

Source filename normalization: leading number → species index. Index 12 (`12MegacidodonProfundi.png`, no underscore) is the off-pattern case; transcoder regex must be `^(\d+)_?(.+)\.png$`. Output filename uses bestiary `id` (kebab-case), e.g. `megacidodon-profundi.webp`.

### 4.7 Wave-name display
- Topbar: existing `wave-num` continues to show the integer; add a sibling `<span id="wave-name-binomial">` that renders the Latin binomial in italic `var(--p-hot)` (font-size 11px, letter-spacing 0.06em).
- Comms log line on wave start: `WAVE ${n} · ${BINOMIAL.toUpperCase()} · ${ARCHETYPE_NAME}` — single line (existing log already accepts this length at 7-line max).
- Endcard `ARCHETYPE` row: stays as-is (the legacy `name` field). Add a new row above it: `SPECIES` showing the binomial. Two rows, separate concerns.
- Implementation: `WAVES[i].headliner = '${species-id}'` — a new field on each wave object that points into BESTIARY by id. The renderer composes the binomial at display time from `SPECIES_BY_ID[wave.headliner]`. We do **not** hard-code the Latin string into `waves.js`.

## 5. Out of scope (DO NOT BUILD in v2.0a)

The dev WILL be tempted by these. They are deferred. If implementation desire is overwhelming, file an issue; do not commit.

1. **Detail-image viewer / modal-on-modal / lightbox**. Tap a thumb → 768w detail full-screen. Compelling — but doubles modal complexity and adds a back-button state machine on mobile. Defer to v2.1; the detail webp files are pre-generated this pass so it's a 1-day add later.
2. **Sortable / filterable list** (sort by HP, filter by threat, etc.). It's a codex, not a database UI. Players read it 1–2 times per run.
3. **Animated thumb hover** (sweep highlight, pulse). Looks good for a screenshot, adds JS for negligible UX. Reject.
4. **Per-species kill statistics beyond count** (best accuracy on this species, total biomass earned from this species, fastest kill, etc.). Out of scope; the codex tracks "have I seen this thing yet," not analytics.
5. **Cross-references / "appears in waves: 1, 3"**. Cute but adds a derived index that has to stay synchronized with `waves.js`. Defer.
6. **Audio cue on tab switch / on entry expand**. The modal is silent on purpose; the scope keeps its audio register intact when the modal is open.

## 6. Build sequence

Each milestone is independently verifiable in a browser. Do not start N+1 until N renders correctly.

1. **Image transcoding script.** `scripts/build-bestiary-img.js` (Node + sharp): reads `AquaticAcidBestiary/*.png`, normalizes leading-number → bestiary id (regex `^(\d+)_?(.+)\.png$`), emits `bestiary-img/thumb/${id}.webp` (320 sq, Q72) and `bestiary-img/detail/${id}.webp` (768 long edge, Q80). Center-crop for thumbs, contain-fit for details. Logs each conversion with input → output size. Verify: 19 thumbs + 19 details on disk, total ~2.5MB, all 19 species ids represented (including `megacidodon-profundi`).

2. **Bestiary data extension.** Add `description` field to every entry in `bestiary.js` by extracting + de-prompt-ifying the txt2img prose per §2(13) rules. Add `headliner` field to each `WAVES[i]` per §3 table. No renderer changes yet. Verify: `console.log(BESTIARY.find(s => s.id === 'leviathys-sulfuratum').description)` prints a 2-sentence specimen description without rendering directives; `WAVES[3].headliner === 'barytolithus-reptans'`.

3. **Codex modal: tab strip + tab switching.** Add `#codex-tabs` HTML between header and body. Implement `setCodexTab(category)` that filters which group renders. Persist in `localStorage`. Wire keyboard arrows (NICE-TO-HAVE). Verify: 5 tabs render; clicking each tab shows only that category's entries; tab persists across modal close/reopen; default tab = PELAGIC on first open.

4. **Codex entry: thumb + revised grid.** Update CSS grid to the §4.3 template. Insert `<img class="thumb" loading="lazy" src="bestiary-img/thumb/${id}.webp" alt="${binomial}">` in each entry. Implement locked-state CSS filter and image-pending stub. Verify: each entry shows thumb + taxon + meta + threat + kills in correct grid positions; locked entries are silhouetted; unlocking (by killing one) reveals full thumb + stats.

5. **Codex entry: stats strip + abilities + description + field-note labels.** Add the `▶ SPECIMEN:` and `▶ FIELD NOTE:` two-paragraph layout. Render stats line per §4.3. Render abilities row when non-empty. Verify: every species shows its 6-stat strip, blip-color square is correct, abilities chips appear on the 9 species that have them, descriptions read as 2-sentence specimen prose, notes unchanged.

6. **Wave name overrides + service-worker bestiary cache + version bump.** Update `state.js` / wherever wave-start log is composed to read `WAVES[i].headliner` and emit `WAVE n · BINOMIAL · ARCHETYPE`. Update topbar wave-name span. Update endcard to show SPECIES + ARCHETYPE rows. Add `bestiary-img/*` URL handling to `sw.js` runtime cache (new cache bucket `dw-bestiary-${CACHE_VERSION}`). Bump build version on intro overlay to `v2.0.1-α`. Verify: a full 5-wave run logs the binomial wave names in comms; endcard shows both species + archetype; offline reload preserves bestiary thumbs; intro overlay reads `v2.0.1-α · deepdefense`.

After milestone 6: hand back to PM for first look. Do not start v2.1 detail-viewer or any deferred item without a fresh directive.

---

## 7. Items flagged for revisit after Gerald sees v1

- **Tab strip on a 360px-wide phone**: 5 tabs × 11px monospace × 0.18em letter-spacing may overflow. If `PELAGIC · BENTHIC · SWARM · APEX · SPECIALIST` doesn't fit, fallback is **2-letter abbreviations + dot** (`PEL · BEN · SWM · APX · SPC`) — still readable, period-correct register. Decide after first phone view.
- **Locked-state silhouette aesthetic**: the CSS-filter ghost might leak too much shape on the photographic art (not the same as silhouetting a vector icon). If Gerald says "I can guess what every species looks like before unlocking," fallback is full blur (`filter: blur(12px) brightness(0.4)`).
- **Detail viewer (v2.1)**: deferred but the detail webps ship in this pass. Greenlight v2.1 only after Gerald says he wants to look at the big art.
- **Description prose voice**: 2-sentence ≤50w specimen description is a spec, not a style; first read of the de-prompt-ified output may surface that the specimen prose competes with the field note instead of complementing. If so, we may flatten to a single combined paragraph, or drop the description entirely and rely on art + note. Gerald's first look decides.

---

**End of directive.** PM-DIRECTIVE-v1 and PM-DIRECTIVE-v1.3-mobile remain binding for the loop and the mobile chrome. This document is the source of truth for the v2.0a bestiary tab on the `deepdefense` branch. Bump intro-overlay build tag to `v2.0.1-α` when the dev's pass is complete.
