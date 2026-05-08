// main.js — game loop, state, input, transitions.

import {
  RIG, SCOPE_R, STRIKE_RADIUS,
  materializeSpawn, updateContacts, weightedCentroid,
  bearingFromRig, rangeFromRig, angleCrossed,
  pickTurretTarget, pruneBlips, applyBlast,
} from './contacts.js';
import { WAVES } from './waves.js';
import {
  clearScope, smearScope, drawScopeChrome, drawSweep, drawBlips,
  drawPendingStrike, drawDetonations, drawCentroidMarker, drawTurretTracers,
  drawGameOverFlash, isInsideScope, drawMissileCam,
} from './scope.js';
import {
  initHUD, updateHUD, setOrdnance, flickerOrdnance, logLine, clearLog,
  fmtTime, fmtBearing, fmtRange,
  showWaveEndcard, showRunCompleteCard, showGameOverCard, hideEndcard,
  hideIntro, showIntro,
} from './hud.js';
import {
  ensureAudio, resumeAudio, sweepPing, contactBleep,
  strikeWhoosh, detonation, gameOverTone, runCompleteChime,
} from './audio.js';

const TAU = Math.PI * 2;
const SWEEP_PERIOD = 3.0;
const STRIKE_DELAY = 1.2;
const TURRET_FIRE_INTERVAL = 0.4;
const TURRET_DPS_PER_SHOT = 8;
const BLEEP_NEAR = 0.18, BLEEP_FAR = 1.2;

const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const camCanvas = document.getElementById('missilecam');
const camCtx = camCanvas.getContext('2d');
const camRec = document.getElementById('cam-rec');
const camPane = document.getElementById('cam-pane');

// Canonical 720-logical-px coordinate space. Backing store = cssSize × dpr.
// On every resize, ctx.setTransform(dpr * scaleFactor, ...) once — game logic
// keeps using RIG (360,360), SCOPE_R 320, etc. unchanged.
const LOGICAL_SIZE = 720;
const MOBILE_BREAKPOINT = 900;
const MOBILE_TOP_PX = 40;
const MOBILE_LOG_PX = 28;
const MOBILE_CAM_PX = 68;
let scaleFactor = 1;        // cssSize / LOGICAL_SIZE
let dpr = 1;

function isMobile() { return window.innerWidth < MOBILE_BREAKPOINT; }

function fitCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Mobile: compute scope side from viewport - chrome - cam.
  // Set --scope-css-px CSS var; canvas styling reads it.
  if (isMobile()) {
    const camPending = state.pendingStrikes && state.pendingStrikes.length > 0;
    const camPx = camPending ? MOBILE_CAM_PX : 0;
    const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    const chrome = MOBILE_TOP_PX + MOBILE_LOG_PX + camPx + safeTop;
    const sideMax = Math.min(window.innerWidth, window.innerHeight - chrome);
    const cssSize = Math.max(240, Math.floor(sideMax));
    document.documentElement.style.setProperty('--scope-css-px', cssSize + 'px');
    document.documentElement.style.setProperty('--cam-h', camPending ? (MOBILE_CAM_PX + 'px') : '0px');
  }
  // Read the canvas's actual rendered CSS width.
  const cssSize = Math.floor(canvas.getBoundingClientRect().width) || LOGICAL_SIZE;
  canvas.width = cssSize * dpr;
  canvas.height = cssSize * dpr;
  scaleFactor = cssSize / LOGICAL_SIZE;
  ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0);
  // Cam dims: desktop = 200×120 fixed by CSS; mobile = current strip rect
  const camRect = camCanvas.getBoundingClientRect();
  const camW = Math.max(60, Math.floor(camRect.width)) || 200;
  const camH = Math.max(40, Math.floor(camRect.height)) || 120;
  camCanvas.width = camW * dpr;
  camCanvas.height = camH * dpr;
  camCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  window.__camDims = { w: camW, h: camH };
}
window.addEventListener('resize', fitCanvas);
window.addEventListener('orientationchange', () => setTimeout(fitCanvas, 50));
window.addEventListener('visibilitychange', () => { if (!document.hidden) fitCanvas(); });

const state = {
  phase: 'intro',
  wave: 0, waveStartedAt: 0,
  rigIntegrity: 100,
  strikesRemaining: 0, strikeBudgetThisWave: 0,
  contacts: [], blips: [],
  pendingStrikes: [], detonations: [], turretShots: [],
  centroidMarker: null,
  sweep: 0, prevSweep: 0,
  turretLastShotAt: 0,
  spawnQueue: [],
  waveStats: { strikesUsed: 0, bestAccuracyPx: null },
  runStats: { totalStrikes: 0, wavesCleared: 0, waves: [] },
  runStartTime: 0,
  gameOverFlashUntil: 0,
};

let lastFrameMs = performance.now();

function now() { return performance.now() / 1000; }
function logT(msg, opts) { logLine(`[${fmtTime(now() - state.runStartTime)}] ${msg}`, opts); }

function startRun() {
  state.rigIntegrity = 100;
  state.runStartTime = now();
  state.runStats = { totalStrikes: 0, wavesCleared: 0, waves: [] };
  state.pendingStrikes = [];
  clearLog();
  startWave(1);
}

function startWave(idx) {
  const w = WAVES[idx - 1];
  if (!w) return;
  Object.assign(state, {
    wave: idx, waveStartedAt: now(),
    strikesRemaining: w.strikeBudget, strikeBudgetThisWave: w.strikeBudget,
    contacts: [], blips: [], pendingStrikes: [], centroidMarker: null,
    detonations: [], turretShots: [], turretLastShotAt: 0,
    waveStats: { strikesUsed: 0, bestAccuracyPx: null },
    spawnQueue: w.spawns.map(s => ({ t: s.t, spec: s, fired: false })),
    phase: 'wave_running',
  });
  setOrdnance(w.strikeBudgetThisWave, state.strikesRemaining);
  hideEndcard();
  logT(`WAVE ${idx} INBOUND — ${w.name} · ${w.strikeBudget} DEPTH CHARGE${w.strikeBudget > 1 ? 'S' : ''} LOADED`);
}

function update(dt, t) {
  if (state.phase !== 'wave_running') return;
  // sweep advance
  state.prevSweep = state.sweep;
  state.sweep = (state.sweep + dt * (TAU / SWEEP_PERIOD)) % TAU;
  if (angleCrossed(state.prevSweep, state.sweep, 0)) sweepPing();
  // spawns due
  const elapsed = t - state.waveStartedAt;
  for (const sq of state.spawnQueue) {
    if (!sq.fired && elapsed >= sq.t) {
      const cs = materializeSpawn(sq.spec);
      state.contacts.push(...cs);
      sq.fired = true;
      logT(`CONTACT GROUP SPOTTED — ${cs.length} TARGET${cs.length > 1 ? 'S' : ''}`);
    }
  }
  // contact motion + rig collisions
  const rigDmg = updateContacts(state.contacts, dt, t);
  if (rigDmg > 0) {
    state.rigIntegrity = Math.max(0, state.rigIntegrity - rigDmg);
    logT(`HULL BREACH — INTEGRITY ${Math.round(state.rigIntegrity)}%`, { crit: true });
    if (state.rigIntegrity <= 0) return triggerGameOver(t);
  }
  // sweep crossings → blip + bleep; off-sweep range-cadence bleep
  for (const c of state.contacts) {
    if (!c.alive) continue;
    const norm = Math.min(1, rangeFromRig(c) / SCOPE_R);
    if (angleCrossed(state.prevSweep, state.sweep, bearingFromRig(c))) {
      state.blips.push({ x: c.x, y: c.y, t0: t, weight: c.weight, contactId: c.id });
      contactBleep(norm);
    }
    const period = BLEEP_NEAR + (BLEEP_FAR - BLEEP_NEAR) * norm;
    if (t - c.lastBleepAt > period) { contactBleep(norm); c.lastBleepAt = t; }
  }
  state.blips = pruneBlips(state.blips, t);
  // pending strikes → detonate (multiple in flight allowed)
  if (state.pendingStrikes.length) {
    const due = state.pendingStrikes.filter(ps => t - ps.t0 >= STRIKE_DELAY);
    state.pendingStrikes = state.pendingStrikes.filter(ps => t - ps.t0 < STRIKE_DELAY);
    for (const ps of due) detonate(ps, t);
  }
  // auto-turret
  if (t - state.turretLastShotAt >= TURRET_FIRE_INTERVAL) {
    const tgt = pickTurretTarget(state.contacts);
    if (tgt) {
      tgt.hp -= TURRET_DPS_PER_SHOT;
      state.turretShots.push({ x: tgt.x, y: tgt.y, t0: t });
      state.turretLastShotAt = t;
      if (tgt.hp <= 0) tgt.alive = false;
    }
  }
  // prune transient effects
  state.detonations = state.detonations.filter(d => t - d.t0 < 0.6);
  state.turretShots = state.turretShots.filter(s => t - s.t0 < 0.1);
  if (state.centroidMarker && t - state.centroidMarker.t0 > 0.6) state.centroidMarker = null;
  // wave-end check
  const allSpawned = state.spawnQueue.every(s => s.fired);
  const live = state.contacts.filter(c => c.alive).length;
  if (allSpawned && live === 0 && state.pendingStrikes.length === 0) finishWave(t, true);
}

function detonate(strike, t) {
  const { killed, trueCentroid } = applyBlast(state.contacts, strike);
  if (trueCentroid) {
    state.centroidMarker = { x: trueCentroid.x, y: trueCentroid.y, t0: t };
    const accPx = Math.hypot(trueCentroid.x - strike.x, trueCentroid.y - strike.y);
    state.waveStats.bestAccuracyPx = (state.waveStats.bestAccuracyPx == null)
      ? accPx : Math.min(state.waveStats.bestAccuracyPx, accPx);
  }
  state.detonations.push({ x: strike.x, y: strike.y, t0: t });
  detonation();
  logT(`DETONATION — ${killed} CONTACT${killed === 1 ? '' : 'S'} NEUTRALIZED`);
}

function triggerGameOver(t) {
  state.phase = 'game_over_freeze';
  state.gameOverFlashUntil = t + 0.8;
  gameOverTone();
  logT('CATASTROPHIC HULL FAILURE — RIG LOST', { crit: true });
}

function finishWave(t, allDestroyed) {
  state.phase = 'wave_endcard';
  const accPct = state.waveStats.bestAccuracyPx == null ? null
    : Math.max(0, 1 - state.waveStats.bestAccuracyPx / STRIKE_RADIUS) * 100;
  const w = WAVES[state.wave - 1];
  state.runStats.waves.push({
    wave: state.wave, name: w.name, budget: w.strikeBudget,
    strikesUsed: state.waveStats.strikesUsed, bestAcc: accPct,
    integrity: state.rigIntegrity,
  });
  state.runStats.wavesCleared = state.wave;
  if (state.wave >= WAVES.length) {
    runCompleteChime();
    state.phase = 'run_complete';
    showRunCompleteCard({ runStats: state.runStats, integrity: state.rigIntegrity });
    logT('EXTRACTION SECURED — ALL THREATS NEUTRALIZED');
  } else {
    showWaveEndcard({
      wave: state.wave, name: w.name, strikesUsed: state.waveStats.strikesUsed,
      strikeBudget: w.strikeBudget, accuracyPct: accPct,
      integrity: state.rigIntegrity, allDestroyed,
    });
    logT(`WAVE ${state.wave} CLEAR — STAND BY`);
  }
}

function render(t) {
  smearScope(ctx, 0.22);
  drawScopeChrome(ctx);
  drawSweep(ctx, state.sweep);
  drawBlips(ctx, state.blips, t);
  drawTurretTracers(ctx, state.turretShots, t);
  drawDetonations(ctx, state.detonations, t);
  drawCentroidMarker(ctx, state.centroidMarker, t);
  for (const ps of state.pendingStrikes) drawPendingStrike(ctx, ps, t);
  if (state.phase === 'game_over_freeze') {
    const remaining = Math.max(0, state.gameOverFlashUntil - t);
    drawGameOverFlash(ctx, remaining / 0.8);
    if (remaining <= 0) {
      state.phase = 'game_over';
      showGameOverCard({ wave: state.wave, runStats: state.runStats });
    }
  }
}

let prevCamPending = false;
function frame(nowMs) {
  let dt = (nowMs - lastFrameMs) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastFrameMs = nowMs;
  const t = nowMs / 1000;
  update(dt, t);
  // Toggle mobile cam strip on pending-strike state change → re-fit canvas
  const camPending = state.pendingStrikes.length > 0;
  if (camPending !== prevCamPending) {
    prevCamPending = camPending;
    if (isMobile()) {
      camPane.classList.toggle('hide', !camPending);
      fitCanvas();
    }
  }
  render(t);
  drawMissileCam(camCtx, state, t);
  camRec.style.visibility = camPending ? 'visible' : 'hidden';
  updateHUD(state);
  requestAnimationFrame(frame);
}

// INPUT
// AudioContext gesture-unlock: iOS Safari needs all three events; capture phase
// fires before any element handler, regardless of which UI element catches the
// first tap. Single-shot, removes itself on first fire.
function unlockAudioOnce() {
  ensureAudio(); resumeAudio();
  document.removeEventListener('pointerdown', unlockAudioOnce, true);
  document.removeEventListener('touchend',    unlockAudioOnce, true);
  document.removeEventListener('click',       unlockAudioOnce, true);
}
document.addEventListener('pointerdown', unlockAudioOnce, true);
document.addEventListener('touchend',    unlockAudioOnce, true);
document.addEventListener('click',       unlockAudioOnce, true);

canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();         // suppress synthesized mouse events on iOS
  if (state.phase !== 'wave_running') return;
  // Map CSS-pixel client coords → 720-logical-px space (scope.js + contacts.js
  // constants are all in 720-space; tap is the only mobile-specific math).
  const r = canvas.getBoundingClientRect();
  const x = (ev.clientX - r.left) / scaleFactor;
  const y = (ev.clientY - r.top) / scaleFactor;
  if (!isInsideScope(x, y) || state.strikesRemaining <= 0) return flickerOrdnance();
  state.pendingStrikes.push({ x, y, t0: now() });
  state.strikesRemaining -= 1;
  state.waveStats.strikesUsed += 1;
  state.runStats.totalStrikes += 1;
  setOrdnance(state.strikeBudgetThisWave, state.strikesRemaining);
  strikeWhoosh();
  logT(`STRIKE COMMITTED — TGT ${fmtBearing(bearingFromRig({x,y}))}/${fmtRange(Math.hypot(x - RIG.x, y - RIG.y))}`);
});
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Space' || ev.code === 'Enter') { ev.preventDefault(); advanceFromPrompt(); }
});

// Intro/endcard dismissal: bind pointerdown directly to the overlay elements.
// iOS Safari does not reliably fire `click` on bare <div>s — pointerdown does.
function bindOverlayAdvance(el) {
  el.addEventListener('pointerdown', (ev) => {
    // ignore taps on the install button or A2HS hint; they have their own handlers
    if (ev.target.closest && ev.target.closest('#install-btn, #ios-a2hs')) return;
    ev.preventDefault();
    advanceFromPrompt();
  });
}
bindOverlayAdvance(document.getElementById('intro'));
bindOverlayAdvance(document.getElementById('endcard'));

function advanceFromPrompt() {
  if (state.phase === 'intro') { hideIntro(); startRun(); }
  else if (state.phase === 'wave_endcard') { hideEndcard(); startWave(state.wave + 1); }
  else if (state.phase === 'run_complete' || state.phase === 'game_over') { hideEndcard(); startRun(); }
}

// BOOT
initHUD();
if (isMobile()) camPane.classList.add('hide');
fitCanvas();
clearScope(ctx);
drawScopeChrome(ctx);
showIntro();
setupInstallUI();
requestAnimationFrame(frame);

// ─── Install prompts ───────────────────────────────────────────────────────
// Android: capture beforeinstallprompt, expose INSTALL button on intro overlay.
// iOS Safari: never fires that event — show a dismissible Share→A2HS hint.
function setupInstallUI() {
  const installBtn = document.getElementById('install-btn');
  const iosHint = document.getElementById('ios-a2hs');
  const iosDismiss = document.getElementById('ios-a2hs-dismiss');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    deferredPrompt = ev;
    installBtn.classList.add('show');
  });
  installBtn.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    installBtn.classList.remove('show');
  });

  if (isIOS && !isStandalone && !localStorage.getItem('dw-a2hs-dismissed')) {
    iosHint.classList.add('show');
  }
  iosDismiss.addEventListener('click', (ev) => {
    ev.stopPropagation();
    iosHint.classList.remove('show');
    try { localStorage.setItem('dw-a2hs-dismissed', '1'); } catch (_) {}
  });
}

// debug hooks for harness inspection (no-op in production)
window.__dw = { state, startWave, advanceFromPrompt };

