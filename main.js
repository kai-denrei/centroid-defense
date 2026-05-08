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

function frame(nowMs) {
  let dt = (nowMs - lastFrameMs) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastFrameMs = nowMs;
  const t = nowMs / 1000;
  update(dt, t);
  render(t);
  drawMissileCam(camCtx, state, t);
  camRec.style.visibility = state.pendingStrikes.length ? 'visible' : 'hidden';
  updateHUD(state);
  requestAnimationFrame(frame);
}

// INPUT
canvas.addEventListener('pointerdown', (ev) => {
  ensureAudio(); resumeAudio();
  if (state.phase !== 'wave_running') return;
  const r = canvas.getBoundingClientRect();
  const x = (ev.clientX - r.left) * (canvas.width / r.width);
  const y = (ev.clientY - r.top) * (canvas.height / r.height);
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
window.addEventListener('click', () => advanceFromPrompt());

function advanceFromPrompt() {
  ensureAudio(); resumeAudio();
  if (state.phase === 'intro') { hideIntro(); startRun(); }
  else if (state.phase === 'wave_endcard') { hideEndcard(); startWave(state.wave + 1); }
  else if (state.phase === 'run_complete' || state.phase === 'game_over') { hideEndcard(); startRun(); }
}

// BOOT
initHUD();
clearScope(ctx);
drawScopeChrome(ctx);
showIntro();
requestAnimationFrame(frame);

// debug hooks for harness inspection (no-op in production)
window.__dw = { state, startWave, advanceFromPrompt };

