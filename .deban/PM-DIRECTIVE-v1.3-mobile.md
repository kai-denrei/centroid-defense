---
doc: PM-DIRECTIVE-v1.3-mobile
project: DEEPWATCH (centroid-defense)
date: 2026-05-09
status: binding
supersedes: PM-DIRECTIVE-v1.md (mobile concerns only; desktop calls in v1 directive remain binding for the 880×920 layout)
---

# DEEPWATCH v1.3 — Mobile PWA Directive (Binding)

## 1. Executive call

We are converting DEEPWATCH from a fixed-pixel desktop page into a **portrait-locked mobile PWA** that plays natively on a phone the way KikaCentroid does — viewport pinned to `device-width`, hand-rolled service worker with a versioned cache, full apple-touch + theme-color meta, installable to the home screen, offline-capable. We are explicitly **NOT** building a fluid responsive layout that morphs continuously across all widths. We are building **two layouts**: the existing 880×920 desktop grid (unchanged, locked under PM-DIRECTIVE-v1) and a new mobile-portrait layout that is its own composition. A single CSS media query at the desktop breakpoint switches between them. **Done** = Gerald can open `https://kai-denrei.github.io/centroid-defense/` on his iPhone in Safari, taps land on the right scope pixels, audio unlocks on first touch, the sweep + blips read at phone size, the page is installable via Share → Add to Home Screen, and a second cold launch with airplane mode on still boots the loop. The desktop 880×920 build at the same URL continues to work unchanged on a desktop browser. **Tap accuracy on a real phone is the gating success metric** — if taps don't land where Gerald's finger goes, nothing else matters.

## 2. Locked layout

### 2.1 Desktop (≥ 900px viewport width)

**No change from PM-DIRECTIVE-v1.** The 880×920 fixed grid stays exactly as it ships in v1.2. Canvas 720×720, top bar 48px, rails 80px, bottom strip 152px (comms + munition cam). Scope canvas at 1× (logical pixels = backing pixels). The mobile rewrite must not regress this.

**Gating media query**: everything mobile lives inside `@media (max-width: 899px)`. Above 900px, the existing v1.2 CSS wins and renders the grid as-is.

### 2.2 Mobile portrait (< 900px width, default)

**Orientation**: portrait-locked via manifest (`"orientation": "portrait"`). Landscape is **not supported** — show a brief "ROTATE TO PORTRAIT" overlay if `window.innerHeight < window.innerWidth` on a viewport narrower than 900px. Justification: the scope is a circle and the comms log is a horizontal strip; landscape phone is a different layout problem and we are not solving it in v1.3.

**Stack order, top to bottom** (all widths = `100dvw`, padding from `env(safe-area-inset-*)`):

| Region | Height | Type | Notes |
|---|---|---|---|
| Top bar | 40px | fixed | designation (compressed: `CASS-3 · W1 · T+00:00`), ordnance pips right-aligned, rig integrity as a thin 4px-tall horizontal bar **across the whole top bar bottom edge** (replaces the desktop left rail) |
| Scope | `min(100dvw, 100dvh - 40px - 96px - safe-areas)` square | fixed | the play surface — square, centered, dominates the screen |
| Comms strip | 28px | fixed | single-line scrolling status log (last entry only, fades in 200ms on new line) |
| Munition cam | 68px tall × 100dvw | fixed | full-width strip, only **visible during pending strike**. Hidden (display:none) otherwise so the scope can stretch into its space. |

When no strike pending: scope = `min(100dvw, 100dvh - 40px - 28px - safe-areas)`. When strike pending: scope shrinks to `min(100dvw, 100dvh - 40px - 28px - 68px - safe-areas)` over a 100ms ease so the cam slides in. Justification: the cam is a strike-only readout; reclaiming its real estate when idle gives the scope ~70 more vertical pixels — meaningful on a 6.1" phone.

**Right-rail decoratives (RPM, SWEEP P, contact count, strikes-used)**: **dropped on mobile.** They are decoration, not actionable. Contact count is shown briefly inside the scope (top-right corner of canvas, faint phosphor) when `count > 0`. SWEEP P and RPM are static values that don't earn the screen space they need on a phone.

**Endcards on mobile**: **fullscreen modal**, not "cover the scope". Scope is the entire vertical center on phone; covering only the scope rect leaves the top bar and comms strip visible and looks broken. Endcard becomes a `position: fixed; inset: 0` overlay with the same amber-on-black readout content, vertically centered, dismissed by tap-anywhere or the persistent CONTINUE button at the bottom.

### 2.3 Scope sizing strategy

The scope `<canvas>` is sized **by CSS to fit the available square**, then internally rendered at backing-store resolution `cssSize × devicePixelRatio` (capped at 2 — see §5).

```css
#scope-frame { display: grid; place-items: center; }
#scope { width: var(--scope-css-px); height: var(--scope-css-px); display: block; }
```

JS computes `--scope-css-px = Math.floor(min(window.innerWidth, window.innerHeight - chromeHeight))` on `resize`, `orientationchange`, and `visibilitychange`. The internal canvas attribute width/height is set to `cssSize * dpr` (see §3.3 coordinate mapping).

Padding around the scope: 0 on phone. Bezel-to-bezel on mobile is correct — the scope IS the screen.

### 2.4 Munition cam on mobile

**Keep, but reposition and resize.** It becomes a **horizontal 100dvw × 68px strip** below comms, only visible during pending strike (see §2.2). Internal aspect changes from 200×120 (desktop) to ~360×68 on a 360-wide phone (≈ 5.3:1) — the existing draw functions are recomputed against `CAM_W` / `CAM_H` constants which become dynamic. The crosshair, depth readout, blast-radius ring, and contact silhouettes all redraw to the new aspect.

Rationale for keeping it: the cam is the strongest "feedback during the 1.2s suspense" beat in v1.2 and dropping it would amputate that learning loop. Cost: ~120 LOC of `drawMissileCam` need parameterization. Acceptable — see milestone 6.

## 3. Touch + audio model

### 3.1 Touch input

**Tap-to-commit stays.** PM v1 already locked this for desktop; mobile gets the same model. Hold-to-aim is rejected for mobile too — finger occlusion makes it worse, not better, and it adds a state machine for zero validated benefit. Cost: shaky finger commits. We accept this; the scope on phone is bigger relative to viewport than the desktop 720×720, so absolute tap targets are larger, not smaller.

**Event**: `pointerdown` on the canvas. We do not listen to `touchstart` separately — `pointerdown` covers mouse, pen, and touch on every modern browser. The existing `canvas.addEventListener('pointerdown', ...)` handler is correct in shape; only the coordinate mapping changes (§3.3).

**`touch-action: none`** on the canvas (already present). Add `touch-action: manipulation` on `body` to suppress double-tap-to-zoom on the chrome.

### 3.2 Audio gesture-unlock (iOS Safari)

iOS requires a synchronous user gesture to start AudioContext. The current `pointerdown` handler calls `ensureAudio(); resumeAudio();` — **this is correct but insufficient** because the intro overlay listens to `window` `click` and `keydown` and the first gesture often hits the intro, not the canvas.

**Binding fix**: unlock AudioContext on the **first** `pointerdown` OR `click` OR `touchend` on **`document`**, in capture phase, then remove the listener. This guarantees unlock on the very first user contact regardless of which element it hits.

```js
// pseudo — dev implements verbatim shape
function unlockAudioOnce() {
  ensureAudio(); resumeAudio();
  document.removeEventListener('pointerdown', unlockAudioOnce, true);
  document.removeEventListener('touchend', unlockAudioOnce, true);
  document.removeEventListener('click', unlockAudioOnce, true);
}
document.addEventListener('pointerdown', unlockAudioOnce, true);
document.addEventListener('touchend',    unlockAudioOnce, true);
document.addEventListener('click',       unlockAudioOnce, true);
```

All three events: belt and suspenders. iOS 17+ Safari is reliable on `pointerdown` but older Safari needs `touchend`, and the intro-overlay click path needs `click`. Dev does not omit any of the three.

### 3.3 Coordinate mapping (the critical bug fix)

**The current bug**: `width=900` viewport meta forces the 880-px desktop layout to render on a 360-px phone, scaled by ~0.4. Taps at CSS pixel `(x, y)` are converted to canvas pixels via `(ev.clientX - r.left) * (canvas.width / r.width)`, which is correct *only if* the canvas's CSS rect is what the user is touching. With the broken viewport, the scaling is double-applied (once by the OS zoom-out, once by the CSS-to-canvas math) and taps land on wrong pixels. Combined with HUD chrome occupying half the visual area, finger taps on the scope hit margins.

**Mobile fix**:

1. **Viewport meta** changes to KikaCentroid's pattern:
   `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">`
2. **Canvas backing store** is set to `cssSize × dpr`:
   ```js
   const dpr = Math.min(window.devicePixelRatio || 1, 2); // cap at 2
   canvas.width  = cssSize * dpr;
   canvas.height = cssSize * dpr;
   canvas.style.width  = cssSize + 'px';
   canvas.style.height = cssSize + 'px';
   ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // all draw code uses logical px
   ```
3. **All scope draw code keeps its current `RIG = {x:360, y:360}`, `SCOPE_R=320` constants** — these are now the **logical-pixel canonical coordinates** of a 720×720 scope. On phone, `cssSize` is whatever fits, and we multiply: `scaleFactor = cssSize / 720`. We do NOT change the constants. Instead, the canvas context is scaled once at the top of every render frame:
   ```js
   ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0);
   ```
   So `drawSweep`, `drawBlips`, etc. continue to draw against a 720-logical-pixel coordinate space and the GPU/canvas does the scale. Zero changes to game logic.
4. **Tap mapping**:
   ```js
   const r = canvas.getBoundingClientRect();
   const cssX = ev.clientX - r.left;
   const cssY = ev.clientY - r.top;
   const x = cssX / scaleFactor;  // → 0..720 logical-px
   const y = cssY / scaleFactor;
   ```
   `isInsideScope(x, y)` keeps using the 720-space constants. Wave configs, contact spawn coords, strike coords — all unchanged.

This is the binding pattern. Dev does not introduce a separate mobile coordinate system. The 720-logical-px space is canonical; everything else is a render-time scale.

**Resize handling**: a single `function fitCanvas()` on `load`, `resize`, `orientationchange`, `visibilitychange`. Recomputes `cssSize`, `scaleFactor`, sets canvas attributes, sets `ctx.setTransform(...)`. No per-frame transform thrash.

## 4. PWA scaffolding

### 4.1 Manifest (`manifest.webmanifest`, repo root)

```json
{
  "name": "DEEPWATCH",
  "short_name": "DEEPWATCH",
  "description": "Sonar PPI tower defense. Read the centroid. Commit the strike.",
  "start_url": "./?src=pwa",
  "scope": "./",
  "id": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait",
  "background_color": "#050a05",
  "theme_color": "#050a05",
  "categories": ["games"],
  "lang": "en",
  "dir": "ltr",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Locked: `theme_color = #050a05` (matches body bg, keeps iOS status bar dark). `categories = ["games"]` only — `"education"` is a stretch for DEEPWATCH and we don't claim it. `start_url = ./?src=pwa` so we can attribute installs in analytics later (no analytics in v1.3, but we'll thank ourselves in v2).

### 4.2 Icons spec

Source: a programmatic phosphor PPI render — green concentric rings + sweep wedge + center dot, on near-black background. Generate with a small standalone script `scripts/build-icons.js` (Node + canvas) committed to repo. **Not AI-generated** — we have the renderer already (it's the scope itself); reusing it produces a pixel-honest icon that matches the in-game scope. Icons committed to `icons/`:

| File | Size | Purpose |
|---|---|---|
| `icons/icon-192.png` | 192×192 | manifest `any` |
| `icons/icon-512.png` | 512×512 | manifest `any` (Android splash + general) |
| `icons/icon-maskable-512.png` | 512×512 | manifest `maskable` (safe-zone padded — concentric rings centered in 80% inner zone, outer 10% bleed phosphor-dim solid) |
| `icons/apple-touch-icon-180.png` | 180×180 | iOS home screen |
| `icons/favicon-32.png` | 32×32 | browser tab |

If the icon-build script is more friction than it's worth, **fallback**: hand-export from the running game canvas via `canvas.toDataURL()` once, save as PNGs. Either way, ship five PNG files. Do not ship SVG-only icons (iOS Safari will reject for A2HS).

### 4.3 Service worker (`sw.js`, repo root)

**Hand-rolled, port the KikaCentroid pattern verbatim** with these substitutions:

- `CACHE_VERSION = 'v1.3.0'` (semver — bump on every deploy)
- `PRECACHE = 'dw-precache-${CACHE_VERSION}'`
- `RUNTIME = 'dw-runtime-${CACHE_VERSION}'`
- `PRECACHE_URLS`:
  ```js
  [
    './',
    './index.html',
    `./main.js?v=${ASSET_VER}`,
    `./scope.js?v=${ASSET_VER}`,
    `./contacts.js?v=${ASSET_VER}`,
    `./hud.js?v=${ASSET_VER}`,
    `./audio.js?v=${ASSET_VER}`,
    `./waves.js?v=${ASSET_VER}`,
    './offline.html',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-maskable-512.png',
    './icons/apple-touch-icon-180.png',
    './icons/favicon-32.png',
  ]
  ```

**ES modules note**: SW caches the `?v=X.Y.Z` URLs. `index.html` `<script type="module" src="./main.js?v=1.3.0">` etc. must include the same query string. The internal `import` statements inside `main.js` etc. are **without `?v=`** (relative imports between modules) — the browser resolves them against the importing module's URL, and the SW matches on URL **including** query string. To keep SW caching honest we have two options:

- **Option A (locked)**: leave internal `import` paths as `./contacts.js`, `./scope.js` etc. The HTML's top-level `?v=X.Y.Z` busts only `main.js`. Internal modules are SWR-cached by the SW from network on first load and revalidated on subsequent loads. On version bump, `main.js?v=N` cache-misses → network → which causes the browser's module loader to re-fetch internal imports (because main.js is new) → SW SWR returns cached then revalidates. **Cache freshness is eventual but bounded to one extra load.** Acceptable for v1.3.
- Option B: rewrite all internal imports to use `?v=X.Y.Z` query strings on every release. Higher overhead per release; rejected.

Locked: Option A.

### 4.4 SW caching matrix

| Asset class | Strategy | Justification |
|---|---|---|
| HTML navigation (`./`, `./index.html`) | NetworkFirst (3s timeout) → cache → `offline.html` | Always fetch fresh shell when online; never serve stale game page if a build is rolling |
| `manifest.webmanifest` | NetworkFirst → cache | Android Chrome re-reads periodically; install metadata changes propagate |
| `*.js` (scope, contacts, hud, audio, waves, main) | StaleWhileRevalidate from precache | Fast load, eventual freshness — paired with `?v=` busting on version bumps |
| Icons (`icons/*.png`) | CacheFirst with runtime cache | Static, versioned via filename (rename on change) |
| Cross-origin (e.g. Google Fonts) | Pass-through (no SW intercept) | Don't own the cache headers; let browser handle |

**`<link>` to JetBrains Mono Google Font is allowed offline-soft-fail**: if it doesn't load, the system `ui-monospace, SF Mono, Menlo, Consolas, monospace` fallback in the existing CSS takes over. The page still works.

### 4.5 Offline fallback (`offline.html`)

Editorial-styled, **kept**. Port KikaCentroid's `offline.html` near-verbatim with DEEPWATCH chrome (phosphor green palette, monospace, `#050a05` background, "DEEPWATCH — RIG OFFLINE" headline, `[RETRY]` link to `./`). ~50 lines of inline CSS, no JS, no external assets except the favicon. Justification: 5 minutes of work, real polish payoff for the install demo.

### 4.6 SW registration in HTML

Bottom of `<body>`, after `<script type="module" src="./main.js?v=1.3.0">`:

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
</script>
```

No update toast in v1.3 (KikaCentroid has one; we defer it). Bumping `CACHE_VERSION` + reloading is sufficient for our deploy cadence.

### 4.7 iOS A2HS hint

**Capture `beforeinstallprompt` on Android** → stash event → when the player taps a "INSTALL" button in the intro overlay, fire `prompt()`. The button is hidden if event never fires (i.e., on iOS or already-installed).

**iOS Safari** does not support `beforeinstallprompt`. Detect iOS Safari + non-standalone (`navigator.standalone === false || !window.matchMedia('(display-mode: standalone)').matches`), and show a **dismissible one-line hint** on the intro overlay only: `TAP SHARE → ADD TO HOME SCREEN`. Dismissal persists in `localStorage`. KikaCentroid does this exact thing — copy the pattern.

## 5. Aesthetic + perf rules

### 5.1 Aesthetic preservation

Phosphor green CRT aesthetic from PM v1 is **locked for mobile**. Specific concessions:

- **HUD scanlines**: kept on the top bar and comms strip on mobile. Same `0.06` opacity. They scale with the chrome size (CSS `repeating-linear-gradient` is resolution-independent — no pixel work).
- **Scope smear (per-frame fade buffer)**: kept. The `smearScope(ctx, 0.22)` call works identically at any scale because it fills the canvas with semi-transparent black; cost is one fillRect per frame.
- **Bloom on blips**: kept. Radial gradients render fine at small CSS sizes; on a phone the scope is ~360px CSS = 720 logical-px = identical render to desktop.
- **Munition cam**: scanlines, static, sweep band all kept. Aspect changes from 5:3 to ~5.3:1 — visually fine; the sweep band reads better on a wider strip.

What gives way: **right-rail decoratives** (RPM, SWEEP P) drop entirely on mobile. They were always decoration. The integrity bar moves to a thin horizontal strip across the top bar bottom edge — same data, different layout.

What stays sacred: **the scope is the entire screen on phone**. No padding, no margins, no chrome inside the scope rect. Bezel-to-bezel.

### 5.2 devicePixelRatio call

**Cap dpr at 2.** `const dpr = Math.min(window.devicePixelRatio || 1, 2);`

Rationale: iPhone Pro models ship dpr=3. At dpr=3 on a 400-CSS-px scope, we render to a 1200×1200 backing store — 2.25× the pixel work of dpr=2 (800×800) for a difference indistinguishable on a 6.1" screen at arm's length. dpr=1 would be visibly soft on the sweep edge and bearing tick labels. dpr=2 is the sweet spot.

Cost: iPhone Pro users get slightly soft text vs. native-resolution. Acceptable; nobody is reading dense text on the scope.

### 5.3 Frame rate target

**60fps target, 30fps acceptable floor.** If `requestAnimationFrame` callbacks consistently exceed 16.6ms on a 2-year-old midrange Android (test: Pixel 6a or equivalent), drop the trail buffer first (replace `smearScope(ctx, 0.22)` with `clearScope(ctx)`). If still too slow, drop blip bloom (skip the radial-gradient pass). Do not preemptively cut.

We do not ship adaptive quality logic in v1.3. Hard-coded "60 if it can, glass if it can't" is fine. Mobile Safari throttles RAF on background tabs anyway; our `dt` clamp at 0.05s already handles tab-switch resume.

### 5.4 Scope smear on mobile

**Kept.** It's one fillRect/frame, negligible. Phosphor smear is a load-bearing aesthetic element — without it the scope reads like a generic radar.

## 6. Out of scope (DO NOT BUILD in v1.3)

The dev WILL be tempted by these. They are **deferred**. If implementation desire is overwhelming, file an issue; do not commit.

- **Haptic feedback on strike commit / detonation** (`navigator.vibrate`). Tempting but iOS Safari ignores it and we don't need an Android-only feature in v1.3.
- **Gyro / device-orientation tilt-to-aim**. Cool, wrong game. Tap-to-commit is locked.
- **Push notifications** (Notification API + Push API + SW push handler). DEEPWATCH has nothing to push. Defer to v3+.
- **Background Sync** for queueing offline runs. There's nothing to sync — no backend.
- **Native app store wrapper** (Capacitor, Tauri, etc.). PWA is the deploy target.
- **Leaderboard / score persistence** beyond a single localStorage best-run. v1 PM directive locked no persistence; v1.3 inherits this.
- **Update toast / "new version available" UI** (KikaCentroid has it). Defer to v1.4 once we know our deploy cadence.
- **Landscape support**. Portrait-locked. Show a rotate hint, don't lay it out.
- **Tablet-specific layout** (768–899px range). Falls into the mobile bucket; the scope just gets bigger. We do not introduce a third breakpoint.
- **Audio settings UI** (volume slider, mute). Master gain is hard-coded at 0.55. Phone OS volume is the user's lever.
- **Settings / options menu** of any kind. There are no settings to set.

## 7. Build sequence

Each milestone is independently verifiable on Gerald's phone. He should be able to open the GitHub Pages URL after every milestone deploy and confirm the specific behavior listed. Do not start N+1 until N renders correctly **on his phone**, not just in desktop devtools mobile emulation.

1. **Viewport + scaling fix only.** Replace viewport meta with KikaCentroid pattern. Add `fitCanvas()` resize handler. Implement dpr-aware backing store + `ctx.setTransform(dpr * scaleFactor, ...)` + tap coord mapping (§3.3). **No layout changes yet** — the existing 880-grid wraps awkwardly, but inside-scope taps now land on correct logical pixels. Verify on phone: tap a fixed location 5 times; logged tap coords cluster within ±5 logical px.

2. **Mobile media query + portrait stack.** Add `@media (max-width: 899px)` rules. Top bar (40px), scope (square, fills available), comms strip (28px), munition cam (hidden when no strike). Drop right rail. Move integrity to top-bar bottom-edge strip. Endcards become fullscreen modals. Verify on phone: scope dominates, no horizontal scroll, no clipped chrome, intro/endcard overlay covers the whole viewport.

3. **Audio gesture-unlock hardening.** Document-level capture-phase listeners on `pointerdown`/`touchend`/`click`, single-shot. Verify on phone: first tap on intro produces `sweepPing` audio within 500ms. Toggle airplane mode mid-game; audio keeps working.

4. **Munition cam reflow.** Parameterize `CAM_W`/`CAM_H` in `scope.js`, recompute draw geometry against passed-in dims. On mobile, dims are `viewportWidth × 68`. Show/hide on `state.pendingStrikes.length > 0`, with 100ms ease that resizes the scope. Verify on phone: commit a strike, cam slides in below comms, scope shrinks slightly, cam shows live zoom + crosshair + blast ring at the new aspect.

5. **Manifest + icons + theme.** Add `manifest.webmanifest`. Add five PNG icons (build script or one-shot canvas export). Add apple-touch + theme-color + apple-mobile-web-app-* meta tags. Verify: Lighthouse PWA audit passes "installable" check; Safari Share → Add to Home Screen produces an icon with the right glyph; tapping the icon opens fullscreen with phosphor status bar.

6. **Service worker + offline.html.** Port KikaCentroid `sw.js` with DEEPWATCH precache list. Add `offline.html`. Register SW from `index.html`. Bump `CACHE_VERSION = 'v1.3.0'`, append `?v=1.3.0` to script tag. Verify: load page, inspect Application → Service Workers, confirm activated. Toggle airplane mode, reload — game still loads from cache. Hit `./does-not-exist` → offline.html shows.

7. **iOS A2HS hint + Android install button.** `beforeinstallprompt` capture for Android; iOS detection + dismissible Share-hint banner on intro. Verify on iPhone Safari: hint shows once, dismissal persists across reloads. Verify on Android Chrome (or BrowserStack): "INSTALL" button appears in intro, tapping it produces native install dialog.

8. **Touch playthrough on Gerald's phone.** Cold open the GitHub Pages URL on iPhone. Play wave 1. Confirm: taps land on the cluster, not on margins; sweep ping audible on first tap; integrity bar updates; wave 1 endcard appears as fullscreen overlay; tap-to-continue advances to wave 2. **This is the gating success milestone.** If anything fails, do not ship; iterate.

9. **Full 5-wave cold playthrough on phone**, installed as PWA from home screen. Airplane mode on, launch from home screen icon, complete or game-over all 5 waves. Verify: every wave plays; no missing assets; audio works throughout; endcards readable; restart from game-over loops back to wave 1.

10. **Ship.** Bump `CACHE_VERSION` final, push to `main`, GitHub Pages auto-deploys. Notify Gerald via Telegram with the URL.

---

## 8. Decision summary (binding)

| # | Decision | One-line justification |
|---|---|---|
| Orientation | Portrait-locked (manifest + rotate-hint overlay) | Scope is a circle; landscape phone is a different layout problem we're not solving |
| Mobile breakpoint | Single media query at `max-width: 899px` | Two layouts, not infinite responsive — desktop locked under v1, mobile is its own composition |
| Scope sizing | Square, `min(100dvw, 100dvh - chrome)` | Bezel-to-bezel; the scope IS the screen on phone |
| Munition cam | Keep, full-width 68px strip, only-during-strike | Strongest feedback beat in v1.2; reclaim space when idle |
| Right rail | Drop on mobile | Decoration, not actionable |
| Integrity bar | Thin horizontal strip across top bar bottom | Replaces vertical rail; same data, different geometry |
| Endcards | Fullscreen modal on mobile | Covering only scope rect leaves chrome visible — looks broken |
| Desktop | Unchanged 880×920 grid | Locked under PM-DIRECTIVE-v1; mobile lives below 900px |
| Touch input | `pointerdown`, tap-to-commit | Keep v1 model; pointerdown covers all input devices |
| Audio unlock | Document-level capture on `pointerdown`/`touchend`/`click`, single-shot | iOS Safari needs all three; capture phase fires before any element handler |
| Coord mapping | Canonical 720-logical-px space, `ctx.setTransform(dpr * scaleFactor, ...)` once on resize | Zero changes to game logic; render-time scale only |
| dpr | Cap at 2 | dpr=3 is wasted pixels on 6.1"; dpr=1 is visibly soft |
| Service worker | Hand-rolled, port KikaCentroid pattern | Pattern is proven; no Workbox, no build step |
| Cache versioning | `CACHE_VERSION = 'v1.3.0'` constant + `?v=1.3.0` query strings on top-level script | KikaCentroid pattern, lockstep |
| Internal imports | Plain `./contacts.js` (no `?v=`), SWR-cached | Eventual freshness bounded to one extra load on bump; acceptable |
| Icons | Programmatic phosphor render via Node script (or one-shot canvas export); 5 PNGs | Not AI-generated — reuse the renderer for pixel-honest icons |
| offline.html | Kept, port KikaCentroid pattern | 50 lines, real polish payoff |
| iOS A2HS hint | Show on intro for non-standalone Safari, dismissable, persisted | KikaCentroid pattern works |
| Android install | Capture `beforeinstallprompt`, expose INSTALL button | Native prompt UX |
| Frame rate | 60fps target, 30fps floor; cut smear → bloom in that order if needed | No adaptive logic in v1.3 |
| Scope smear | Kept on mobile | One fillRect, load-bearing aesthetic |
| Update toast | Defer to v1.4 | Bump-and-reload is fine for our cadence |
| Landscape | Not supported, rotate-hint only | Out of scope |

## 9. Items flagged for revisit after first phone test

- **Phone test as gating milestone (build seq #8)**: if taps still feel imprecise after viewport + scale fix, we revisit hold-to-aim for mobile only. The PM v1 tap-lock is desktop-derived; mobile finger imprecision is a different ergonomic problem and we should re-test it.
- **Scope size when munition cam visible**: 100ms ease that shrinks the scope is a guess — if it feels jarring or causes blip-trail discontinuity, we lock the scope at the strike-pending size full-time and accept 68px less scope when idle.
- **Right rail drop**: if Gerald reports missing the contact-count or strikes-used readout on mobile, we add a single faint readout inside the scope rim (12px monospace, dim phosphor). Revisit only if asked.
- **dpr cap at 2 on iPhone Pro**: if Gerald visibly notices softness, we ship `dpr=3` and accept the perf cost on Pro models specifically (`const dpr = /iPhone.*Pro/.test(navigator.userAgent) ? 3 : 2` is gross but tractable).

---

**End of directive.** PM-DIRECTIVE-v1 remains binding for the desktop 880×920 layout. This document is the source of truth for every mobile-PWA decision. Both are binding for v1.3.
