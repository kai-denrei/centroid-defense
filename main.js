// main.js — game loop, state, input, transitions.

import {
  RIG, SCOPE_R, STRIKE_RADIUS, STRIKE_DELAY,
  materializeSpawn, updateContacts, weightedCentroid,
  bearingFromRig, rangeFromRig, angleCrossed,
  pruneBlips, applyBlast,
} from './contacts.js';
import { WAVES } from './waves.js';
import {
  clearScope, smearScope, drawScopeChrome, drawSweep, drawBlips,
  drawPendingStrike, drawDetonations, drawCentroidMarker, drawTurretTracers,
  drawGameOverFlash, isInsideScope, drawMissileCam, drawMissileCamFullscreen,
  drawTargetReticle,
} from './scope.js';
import { drawBase, drawDrones, tickDrones, seedRipples, initRipplePool, makeDrone, dronePos } from './base.js';
import {
  initHUD, updateHUD, setOrdnance, flickerOrdnance, logLine, clearLog,
  fmtTime, fmtBearing, fmtRange,
  showWaveEndcard, showRunCompleteCard, showGameOverCard, hideEndcard,
  hideIntro, showIntro, openCodex, closeCodex, speciesById,
  closeBestiaryDetail, isBestiaryDetailOpen,
} from './hud.js';
import {
  ensureAudio, resumeAudio, sweepPing, contactBleep,
  strikeWhoosh, detonation, gameOverTone, runCompleteChime, armedChime,
  safetyClick, targetLock, launchPress,
} from './audio.js';

const TAU = Math.PI * 2;
const SWEEP_PERIOD = 3.0;
const TURRET_DPS_PER_SHOT = 8;
const BLEEP_NEAR = 0.18, BLEEP_FAR = 1.2;
const GAUGE_TIME = 6.0;        // seconds for one orbital window to fill
const IMPACT_LINGER = 0.55;    // seconds the cam shows post-detonation aftermath
const BUILD_PHASE_DURATION = 25.0;   // seconds between waves to spend biomass
const DRONE_COST = 20;
// Independent point-defense intervals. Each turret picks its own nearest
// live contact within its engagement range and fires; effective rate
// scales linearly with drone count.
const RIG_TURRET_INTERVAL = 0.55;
const DRONE_TURRET_INTERVAL = 0.95;
// Engagement ranges. Basic drones are last-line defense — they only see
// contacts close to the rig (upgrade tiers later may extend this). The rig
// central auto-turret has full scope range.
const DRONE_RANGE_BASIC = 130;
const RIG_RANGE = 320;          // = SCOPE_R; full board
// Rig-central turret muzzle position — anchored at the amber turret marker
// on the baked rig sprite (top of rig hex). Imported via const for clarity.
const RIG_TURRET_OFFSET_Y = -35;     // ≈ RIG_RADIUS * 0.4 (see base.js)

const canvas = document.getElementById('scope');
const ctx = canvas.getContext('2d');
const camCanvas = document.getElementById('missilecam');
const camCtx = camCanvas.getContext('2d');
const camRec = document.getElementById('cam-rec');
const camPane = document.getElementById('cam-pane');
const safetyBtn = document.getElementById('safety-switch');
const safetyImg = document.getElementById('safety-img');
const launchBtn = document.getElementById('launch-btn');
const launchLatinEl = document.getElementById('launch-latin');
const launchStatusEl = document.getElementById('launch-status');
const launchTargetEl = document.getElementById('launch-target');
// seabase v1 — build phase controls
const buildBiomassEl = document.getElementById('build-biomass');
const buildTimerEl = document.getElementById('build-timer');
const buildReadyBtn = document.getElementById('build-ready');
const deployDroneBtn = document.getElementById('deploy-drone');
// seabase v2 — in-wave rig view + view toggle
const rigMissileEl = document.getElementById('rig-missile-count');
const rigBiomassEl = document.getElementById('rig-biomass');
const viewToggleRig = document.getElementById('view-toggle-rig');     // on rig-pane → switch to radar
const viewToggleRadar = document.getElementById('view-toggle-radar'); // on launch-pane → switch to rig

// Canonical 720-logical-px coordinate space. Backing store = cssSize × dpr.
// On every resize, ctx.setTransform(dpr * scaleFactor, ...) once — game logic
// keeps using RIG (360,360), SCOPE_R 320, etc. unchanged.
const LOGICAL_SIZE = 720;
const MOBILE_BREAKPOINT = 900;
const MOBILE_TOP_PX = 40;
const MOBILE_LOG_PX = 28;
const MOBILE_LAUNCH_PX = 86;
const MOBILE_CAM_PX = 68;
let scaleFactor = 1;        // cssSize / LOGICAL_SIZE
let dpr = 1;

function isMobile() { return window.innerWidth < MOBILE_BREAKPOINT; }

function fitCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Mobile: scope size is constant (cam always visible). Compute from viewport.
  if (isMobile()) {
    const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    const chrome = MOBILE_TOP_PX + MOBILE_LOG_PX + MOBILE_LAUNCH_PX + MOBILE_CAM_PX + safeTop;
    const sideMax = Math.min(window.innerWidth, window.innerHeight - chrome);
    const cssSize = Math.max(220, Math.floor(sideMax));
    document.documentElement.style.setProperty('--scope-css-px', cssSize + 'px');
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
  // strike model:
  //   readyStrikes  — fully charged orbital assets, available to fire
  //   reservedStrikes — queued, will charge in sequence
  //   gauge         — 0..1 charge progress for the NEXT reserved strike
  //   safetyOff     — player toggled the launch safety; required for commit
  //   targetReticle — {x, y} | null — target locked on scope, awaiting LAUNCH press
  //   pendingStrikes — currently in flight, descending
  //   impactLingers — recently detonated, cam shows aftermath
  //   strikeBudgetThisWave kept for HUD display (total pips)
  strikeBudgetThisWave: 0,
  readyStrikes: 0, reservedStrikes: 0, gauge: 0,
  safetyOff: false, targetReticle: null,
  pendingStrikes: [], impactLingers: [],
  // v2 economy + codex
  biomass: 0,                      // total accumulated this run
  biomassThisWave: 0,
  codex: {},                       // { speciesId: kills }
  // seabase v1 — alternating Mode B (Sea Base) view + build phase between waves
  buildPhaseStartedAt: 0,
  drones: [],                      // persists across waves within a run
  ripples: initRipplePool(),       // pool of 32, all start inactive
  // seabase v2 — rig view is home during waves; player toggles to radar to fire.
  // After every detonation, viewMode auto-reverts to 'rig'.
  viewMode: 'rig',                 // 'rig' | 'radar' (only meaningful when wave_running)
  contacts: [], blips: [],
  detonations: [], turretShots: [],
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
  state.impactLingers = [];
  state.biomass = 0;
  state.codex = {};
  // Two starter drones — rig has minimum point-defense from the first wave.
  state.drones = [makeDrone(now()), makeDrone(now())];
  // mark all ripples inactive (the pool persists across runs)
  for (const r of state.ripples) r.alive = false;
  clearLog();
  startWave(1);
}

// Enter build phase between waves. wave_endcard advance flows here instead of
// directly to startWave(n+1). 25s timer, [SPACE]/READY skips remainder.
function startBuildPhase() {
  state.phase = 'build_phase';
  state.buildPhaseStartedAt = now();
  hideEndcard();
  document.body.classList.add('phase-build');
  logT(`BUILD PHASE — ${BUILD_PHASE_DURATION | 0}s · DEPLOY DEFENSES`);
}
function endBuildPhase() {
  document.body.classList.remove('phase-build');
  startWave(state.wave + 1);
}

// DEPLOY DRONE button — spends biomass, adds a drone, drone effect on
// turret rate is automatic via turretInterval(state).
function deployDrone() {
  if (state.phase !== 'build_phase') return flickerOrdnance();
  if (state.biomass < DRONE_COST) { flickerOrdnance(); return; }
  state.biomass -= DRONE_COST;
  state.drones.push(makeDrone(now()));
  logT(`DRONE DEPLOYED — ${state.drones.length} ACTIVE · BIOMASS ${state.biomass}`);
}

function startWave(idx) {
  const w = WAVES[idx - 1];
  if (!w) return;
  // first strike ready immediately, rest reserved and charging in sequence
  const ready = w.strikeBudget > 0 ? 1 : 0;
  const reserved = Math.max(0, w.strikeBudget - 1);
  Object.assign(state, {
    wave: idx, waveStartedAt: now(),
    strikeBudgetThisWave: w.strikeBudget,
    readyStrikes: ready, reservedStrikes: reserved, gauge: 0,
    safetyOff: false, targetReticle: null,
    contacts: [], blips: [], pendingStrikes: [], impactLingers: [],
    centroidMarker: null,
    detonations: [], turretShots: [], turretLastShotAt: 0,
    waveStats: {
      strikesUsed: 0, bestAccuracyPx: null,
      strikeKills: 0, strikeBiomass: 0, totalInRadius: 0,
      droneKills: 0, droneBiomass: 0,
    },
    biomassThisWave: 0,
    spawnQueue: w.spawns.map(s => ({ t: s.t, spec: s, fired: false })),
    phase: 'wave_running',
    viewMode: 'rig',                  // every wave begins on the rig — toggle to radar to engage
  });
  setOrdnance(state.strikeBudgetThisWave, state.readyStrikes, state.reservedStrikes, state.gauge);
  hideEndcard();
  // Headliner: binomial flavor name for the wave (the species the wave teaches)
  const headSp = w.headliner ? speciesById(w.headliner) : null;
  const binomial = headSp ? `${headSp.genus.toUpperCase()} ${headSp.species.toUpperCase()}` : '';
  if (binomial) {
    logT(`WAVE ${idx} · ${binomial} · ${w.name}`);
    logT(`${w.strikeBudget} ORBITAL ASSET${w.strikeBudget > 1 ? 'S' : ''} TASKED`);
  } else {
    logT(`WAVE ${idx} INBOUND — ${w.name} · ${w.strikeBudget} ORBITAL ASSET${w.strikeBudget > 1 ? 'S' : ''} TASKED`);
  }
}

function update(dt, t) {
  // Drone orbits advance regardless of which view is active so positions
  // stay consistent during cam takeover.
  tickDrones(state.drones, dt);
  // Ripples animate whenever we're showing the sea-base (build phase OR in-wave rig view).
  if (isRigView()) seedRipples(state, dt, t);
  // Build phase tick — auto-advance after BUILD_PHASE_DURATION
  if (state.phase === 'build_phase') {
    if (t - state.buildPhaseStartedAt >= BUILD_PHASE_DURATION) endBuildPhase();
    return;
  }
  if (state.phase !== 'wave_running') return;
  // orbital gauge — fills for next reserved strike, auto-promotes to ready
  if (state.reservedStrikes > 0) {
    state.gauge = Math.min(1, state.gauge + dt / GAUGE_TIME);
    if (state.gauge >= 1) {
      state.readyStrikes++;
      state.reservedStrikes--;
      state.gauge = 0;
      armedChime();
      logT(`ORBITAL WINDOW OPEN — ASSET ${state.runStats.totalStrikes + state.readyStrikes} ARMED`);
    }
  }
  setOrdnance(state.strikeBudgetThisWave, state.readyStrikes, state.reservedStrikes, state.gauge);
  // prune expired impact lingers
  if (state.impactLingers.length) {
    state.impactLingers = state.impactLingers.filter(l => t - l.t0 < IMPACT_LINGER);
  }
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
      state.blips.push({
        x: c.x, y: c.y, t0: t, weight: c.weight, contactId: c.id,
        blipColor: c.blipColor, blipScale: c.blipScale,
      });
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
  // Point-defense — rig central turret + each drone fires independently at
  // its own nearest live contact within range. Armored species (Barytolithus,
  // Megacidodon, Architeuthys, Ferrobacterium-soak) take 50% turret damage.
  // Drones are last-line defense (DRONE_RANGE_BASIC); rig central reaches
  // the full scope.
  if (t - state.turretLastShotAt >= RIG_TURRET_INTERVAL) {
    if (firePointDefense(t, RIG.x, RIG.y + RIG_TURRET_OFFSET_Y, 'rig', null, RIG_RANGE)) {
      state.turretLastShotAt = t;
    }
  }
  for (const d of state.drones) {
    if (t - (d.lastShotAt || 0) < DRONE_TURRET_INTERVAL) continue;
    const dp = dronePos(d);
    firePointDefense(t, dp.x, dp.y, 'drone', d, DRONE_RANGE_BASIC);
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

// Single shared point-defense fire path: pick the nearest live contact
// within `range` of (originX, originY), apply armored-aware damage, push a
// turretShot record (with the frozen origin so renderers draw from where
// it actually fired), update the optional firing drone's facing + throttle.
function firePointDefense(t, originX, originY, source, drone, range) {
  let best = null, bestD = Infinity;
  for (const c of state.contacts) {
    if (!c.alive) continue;
    const dist = Math.hypot(c.x - originX, c.y - originY);
    if (dist > range) continue;
    if (dist < bestD) { bestD = dist; best = c; }
  }
  if (!best) return false;
  const armored = best.abilities && (best.abilities.includes('armored') || best.abilities.includes('ordnance-soak'));
  const dmg = armored ? TURRET_DPS_PER_SHOT * 0.5 : TURRET_DPS_PER_SHOT;
  best.hp -= dmg;
  state.turretShots.push({ ox: originX, oy: originY, x: best.x, y: best.y, t0: t, source });
  // Cumulative shot tally (survives the per-frame prune). Used by tests +
  // any future HUD wanting to display lifetime fire counts.
  state.shotsFired = state.shotsFired || { rig: 0, drone: 0 };
  state.shotsFired[source] = (state.shotsFired[source] || 0) + 1;
  if (drone) {
    drone.facing = Math.atan2(best.y - originY, best.x - originX);
    drone.lastShotAt = t;
  }
  if (best.hp <= 0) {
    best.alive = false;
    const bio = best.biomass || 0;
    state.biomass += bio;
    state.biomassThisWave += bio;
    // Both the rig-central turret and per-drone turrets count as
    // "automated point defense" for the wave breakdown.
    state.waveStats.droneKills = (state.waveStats.droneKills || 0) + 1;
    state.waveStats.droneBiomass = (state.waveStats.droneBiomass || 0) + bio;
    if (best.speciesId) state.codex[best.speciesId] = (state.codex[best.speciesId] || 0) + 1;
  }
  return true;
}

function detonate(strike, t) {
  const { killed, inRadius, trueCentroid, biomass, killedSpeciesIds } = applyBlast(state.contacts, strike);
  const inCount = inRadius.length;
  if (trueCentroid) {
    state.centroidMarker = { x: trueCentroid.x, y: trueCentroid.y, t0: t };
    const accPx = Math.hypot(trueCentroid.x - strike.x, trueCentroid.y - strike.y);
    state.waveStats.bestAccuracyPx = (state.waveStats.bestAccuracyPx == null)
      ? accPx : Math.min(state.waveStats.bestAccuracyPx, accPx);
  }
  // strike-kill bookkeeping (tracked separately from drone kills for the
  // wave-end breakdown).
  state.waveStats.strikeKills = (state.waveStats.strikeKills || 0) + killed;
  state.waveStats.strikeBiomass = (state.waveStats.strikeBiomass || 0) + biomass;
  state.waveStats.totalInRadius = (state.waveStats.totalInRadius || 0) + inCount;
  state.biomass += biomass;
  state.biomassThisWave += biomass;
  for (const id of killedSpeciesIds) {
    state.codex[id] = (state.codex[id] || 0) + 1;
  }
  state.detonations.push({ x: strike.x, y: strike.y, t0: t });
  state.impactLingers.push({ x: strike.x, y: strike.y, t0: t, killed, inRadius: inCount, biomass });
  detonation();
  const pct = inCount > 0 ? Math.round(100 * killed / inCount) : 0;
  logT(`DETONATION — ${killed}/${inCount} HIT (${pct}%) · +${biomass} BIOMASS`);
  // Friendly fire — drones inside the strike radius are destroyed. The
  // operator pays a real cost for sloppy targeting near the rig.
  if (state.drones && state.drones.length) {
    const before = state.drones.length;
    state.drones = state.drones.filter(d => {
      const p = dronePos(d);
      return Math.hypot(p.x - strike.x, p.y - strike.y) > STRIKE_RADIUS;
    });
    const lost = before - state.drones.length;
    if (lost > 0) {
      logT(`DRONE LOSS — ${lost} ASSET${lost > 1 ? 'S' : ''} CAUGHT IN FRIENDLY BLAST`, { crit: true });
    }
  }
  // Auto-revert to rig view after every detonation (seabase v2 design).
  if (state.phase === 'wave_running') state.viewMode = 'rig';
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
  const ws = state.waveStats;
  const strikeKills = ws.strikeKills || 0;
  const strikeBiomass = ws.strikeBiomass || 0;
  const droneKills = ws.droneKills || 0;
  const droneBiomass = ws.droneBiomass || 0;
  const hits = strikeKills + droneKills;
  const inRad = ws.totalInRadius || 0;
  const biomassEarned = strikeBiomass + droneBiomass;
  const headSp = w.headliner ? speciesById(w.headliner) : null;
  const binomial = headSp ? `${headSp.genus} ${headSp.species}` : null;
  state.runStats.waves.push({
    wave: state.wave, name: w.name, budget: w.strikeBudget,
    binomial,
    strikesUsed: ws.strikesUsed, bestAcc: accPct,
    hits, inRadius: inRad,
    strikeKills, strikeBiomass, droneKills, droneBiomass,
    biomass: biomassEarned,
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
      wave: state.wave, name: w.name, binomial,
      strikesUsed: ws.strikesUsed, strikeBudget: w.strikeBudget,
      accuracyPct: accPct,
      hits, inRadius: inRad,
      strikeKills, strikeBiomass, droneKills, droneBiomass,
      biomassEarned,
      biomassTotal: state.biomass,
      integrity: state.rigIntegrity, allDestroyed,
    });
    logT(`WAVE ${state.wave} CLEAR — STRIKES ${strikeKills} (+${strikeBiomass}) · DRONES ${droneKills} (+${droneBiomass}) · TOTAL ${state.biomass}`);
  }
}

// Renders Mode A (radar, during waves) — the existing PPI sonar.
function renderRadar(t, dt) {
  smearScope(ctx, 0.22);
  drawScopeChrome(ctx);
  drawSweep(ctx, state.sweep);
  drawBlips(ctx, state.blips, t);
  // Drones are real allied units on the board — show them on the radar
  // too, not just rig view, so all three views read the same state.
  drawDrones(ctx, state.drones || [], t, dt || 0);
  drawTurretTracers(ctx, state.turretShots, t);
  drawDetonations(ctx, state.detonations, t);
  drawCentroidMarker(ctx, state.centroidMarker, t);
  drawTargetReticle(ctx, state.targetReticle, t);
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

// Render dispatch — three modes during waves:
//   - cam:    main scope is taken over by the missile cam (in-flight + linger)
//   - rig:    sea-base view; the home during waves
//   - radar:  PPI scope; opt-in via the toggle to fire missiles
// Build_phase always uses rig; non-wave phases (intro, endcard, game_over)
// keep the radar's frozen state behind their overlays.
function isRigView() {
  return state.phase === 'build_phase'
      || (state.phase === 'wave_running' && state.viewMode === 'rig');
}
function isCamView() {
  return state.phase === 'wave_running'
      && (state.pendingStrikes.length > 0 || state.impactLingers.length > 0);
}
let _prevRenderMode = null;
function render(t, dt) {
  let mode;
  if (isCamView()) mode = 'cam';
  else if (isRigView()) mode = 'rig';
  else mode = 'radar';
  // Full-clear on mode switch — renderRadar uses smearScope (partial fade),
  // so without this the rig water gradient or cam frame would bleed through.
  if (mode !== _prevRenderMode) {
    clearScope(ctx);
    _prevRenderMode = mode;
  }
  if (mode === 'cam') drawMissileCamFullscreen(ctx, state, t);
  else if (mode === 'rig') drawBase(ctx, state, t, dt);
  else renderRadar(t, dt);
}

// View toggle — only meaningful during wave_running. Build_phase always rig;
// non-wave phases ignore.
function toggleView() {
  if (state.phase !== 'wave_running') return;
  state.viewMode = state.viewMode === 'rig' ? 'radar' : 'rig';
  // safety always re-engages on view exit so the player must re-arm each visit
  if (state.viewMode === 'rig') {
    state.safetyOff = false;
    state.targetReticle = null;
  }
  safetyClick();
}

// Keep #body class in sync each frame so CSS can swap pane visibility cheaply.
function syncViewClass() {
  const inWaveRig = state.phase === 'wave_running' && state.viewMode === 'rig';
  document.body.classList.toggle('view-rig', inWaveRig);
}

function frame(nowMs) {
  let dt = (nowMs - lastFrameMs) / 1000;
  if (dt > 0.05) dt = 0.05;
  lastFrameMs = nowMs;
  const t = nowMs / 1000;
  update(dt, t);
  render(t, dt);
  drawMissileCam(camCtx, state, t);
  camRec.style.visibility = state.pendingStrikes.length ? 'visible' : 'hidden';
  syncViewClass();
  updateLaunchConsole();
  updateBuildConsole(t);
  updateRigConsole();
  updateHUD(state);
  requestAnimationFrame(frame);
}

// Rig pane HUD — missile count + biomass readout. Cheap text writes.
function updateRigConsole() {
  if (!rigMissileEl) return;
  const total = state.readyStrikes + state.reservedStrikes + (state.gauge > 0 ? 0 : 0);
  if (rigMissileEl.textContent !== String(state.readyStrikes)) {
    rigMissileEl.textContent = String(state.readyStrikes);
  }
  rigMissileEl.classList.toggle('zero', state.readyStrikes <= 0);
  if (rigBiomassEl && rigBiomassEl.textContent !== String(state.biomass | 0)) {
    rigBiomassEl.textContent = String(state.biomass | 0);
  }
}

// Build-pane HUD updates — runs every frame, cheap (DOM text writes only).
function updateBuildConsole(t) {
  if (!buildBiomassEl) return;
  buildBiomassEl.textContent = String(state.biomass | 0);
  if (state.phase === 'build_phase') {
    const remaining = Math.max(0, BUILD_PHASE_DURATION - (t - state.buildPhaseStartedAt));
    const sec = Math.ceil(remaining);
    if (buildTimerEl.textContent !== String(sec)) buildTimerEl.textContent = String(sec);
    buildReadyBtn.classList.toggle('urgent', remaining <= 5);
    deployDroneBtn.classList.toggle('no-funds', state.biomass < DRONE_COST);
  }
}

// Launch console visual state machine. Drives:
//   - safety switch aria-pressed + .locked class
//   - launch button .ready / .armed / disabled state
//   - launch-status text + class
//   - launch-target text + class
function updateLaunchConsole() {
  const ready = state.readyStrikes > 0;
  const armed = state.safetyOff;
  const hasTarget = !!state.targetReticle;
  // safety switch — vertical toggle: ON image when armed, OFF when safe
  safetyBtn.setAttribute('aria-pressed', armed ? 'true' : 'false');
  safetyBtn.classList.toggle('locked', !ready && !armed);
  if (safetyImg) {
    const target = armed ? 'icons/switch-on.png' : 'icons/switch-off.png';
    if (!safetyImg.src.endsWith(target)) safetyImg.src = target;
  }
  // launch button — three explicit visual states:
  //   default (grey)   — not ready, OR safety still ON (player should arm)
  //   .target (orange) — armed, no target locked → "発射 TARGET"
  //   .armed  (red)    — armed + target locked → "発射 LAUNCH"
  launchBtn.classList.toggle('target', ready && armed && !hasTarget);
  launchBtn.classList.toggle('armed', ready && armed && hasTarget);
  launchBtn.disabled = !(ready && armed && hasTarget);
  // Latin sub-label switches between TARGET (awaiting designation) and
  // LAUNCH (commitable). Kanji 発射 stays static — it's the verb either way.
  if (launchLatinEl) {
    const latin = (ready && armed && !hasTarget) ? 'TARGET' : 'LAUNCH';
    if (launchLatinEl.textContent !== latin) launchLatinEl.textContent = latin;
  }
  // status readout
  let status, statusClass;
  if (state.pendingStrikes.length && !ready && state.reservedStrikes === 0 && state.gauge === 0) {
    status = 'IN FLIGHT'; statusClass = 'armed';
  } else if (!ready && state.reservedStrikes > 0) {
    status = `ORBIT ${Math.round(state.gauge * 100)}%`; statusClass = 'charging';
  } else if (ready && !armed) {
    status = 'READY · FLIP TO ON'; statusClass = 'ready';
  } else if (ready && armed && !hasTarget) {
    status = 'AWAITING TARGET'; statusClass = 'armed';
  } else if (ready && armed && hasTarget) {
    status = 'LAUNCH AUTHORIZED'; statusClass = 'locked';
  } else {
    status = 'STANDBY'; statusClass = '';
  }
  if (launchStatusEl.textContent !== status) launchStatusEl.textContent = status;
  launchStatusEl.className = 'status ' + statusClass;
  // target readout
  if (hasTarget) {
    const { x, y } = state.targetReticle;
    const b = bearingFromRig({ x, y });
    const r = Math.hypot(x - RIG.x, y - RIG.y);
    launchTargetEl.textContent = `TGT ${fmtBearing(b)}/${fmtRange(r)}`;
    launchTargetEl.className = 'target set';
  } else {
    launchTargetEl.textContent = 'NO TARGET';
    launchTargetEl.className = 'target';
  }
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

// Canvas tap: set / move the target reticle ONLY. Does not commit.
// Multi-phase launch (safety → target → button) — tap is step (c) of the ritual.
// Safety must be OFF and a missile must be ready, otherwise we flicker the ord pips.
canvas.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();         // suppress synthesized mouse events on iOS
  if (state.phase !== 'wave_running') return;
  const r = canvas.getBoundingClientRect();
  const x = (ev.clientX - r.left) / scaleFactor;
  const y = (ev.clientY - r.top) / scaleFactor;
  if (!isInsideScope(x, y)) return;                         // tap on scope chrome → ignore
  if (state.readyStrikes <= 0 || !state.safetyOff) {
    flickerOrdnance();                                       // no missile, or safety still ON
    return;
  }
  state.targetReticle = { x, y, t0: now() };
  targetLock();
  logT(`TARGET LOCK — ${fmtBearing(bearingFromRig({x,y}))}/${fmtRange(Math.hypot(x - RIG.x, y - RIG.y))}`);
});

// 発射 launch — commit a strike at the locked target.
// Required: safety OFF, target set, ≥1 ready missile, wave_running.
function commitLaunch() {
  if (state.phase !== 'wave_running') return;
  if (!state.safetyOff || !state.targetReticle || state.readyStrikes <= 0) {
    flickerOrdnance();
    return;
  }
  const { x, y } = state.targetReticle;
  state.pendingStrikes.push({ x, y, t0: now() });
  state.readyStrikes -= 1;
  state.waveStats.strikesUsed += 1;
  state.runStats.totalStrikes += 1;
  state.targetReticle = null;
  state.safetyOff = false;            // auto-reset — every shot earns its own arming ritual
  setOrdnance(state.strikeBudgetThisWave, state.readyStrikes, state.reservedStrikes, state.gauge);
  strikeWhoosh();
  launchPress();
  logT(`MUNITION RELEASED — TGT ${fmtBearing(bearingFromRig({x,y}))}/${fmtRange(Math.hypot(x - RIG.x, y - RIG.y))}`);
}

// Toggle the safety. Locked while charging — must wait for ≥1 ready missile.
function toggleSafety() {
  if (state.phase !== 'wave_running') return;
  if (state.readyStrikes <= 0 && !state.safetyOff) {
    flickerOrdnance();                 // can't arm with no missile loaded
    return;
  }
  state.safetyOff = !state.safetyOff;
  if (!state.safetyOff) state.targetReticle = null;     // safety re-engaged → target cleared
  safetyClick();
}
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

// Launch console controls — pointerdown for iOS reliability + stopPropagation
// so taps inside the console don't bubble to the overlay-advance / canvas paths.
safetyBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  toggleSafety();
});
launchBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault();
  ev.stopPropagation();
  if (launchBtn.disabled) { flickerOrdnance(); return; }
  commitLaunch();
});

// Build-phase controls: DEPLOY DRONE buys a drone if funds permit;
// READY button skips remaining timer and starts the next wave.
deployDroneBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  deployDrone();
});
buildReadyBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  if (state.phase === 'build_phase') endBuildPhase();
});

// View toggle — both buttons share the same handler. One lives on the
// rig-pane (rig→radar), the other on the launch-pane (radar→rig).
function bindViewToggle(btn) {
  if (!btn) return;
  btn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    toggleView();
  });
}
bindViewToggle(viewToggleRig);
bindViewToggle(viewToggleRadar);

// Codex modal toggle (v2 bestiary).
const codexBtn = document.getElementById('codex-btn');
const codexClose = document.getElementById('codex-close');
const codexModal = document.getElementById('codex-modal');
codexBtn.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  openCodex(state.codex);
});
codexClose.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  closeCodex();
});
codexModal.addEventListener('pointerdown', (ev) => {
  if (ev.target === codexModal) { ev.preventDefault(); closeCodex(); }
});

// Bestiary detail lightbox (v2.0.2). Opened by clicking an unlocked thumb.
const bestiaryDetail = document.getElementById('bestiary-detail');
const bestiaryDetailClose = document.getElementById('bestiary-detail-close');
bestiaryDetailClose.addEventListener('pointerdown', (ev) => {
  ev.preventDefault(); ev.stopPropagation();
  closeBestiaryDetail();
});
bestiaryDetail.addEventListener('pointerdown', (ev) => {
  // backdrop tap closes; clicks on the frame are absorbed by descendants
  if (ev.target === bestiaryDetail) { ev.preventDefault(); closeBestiaryDetail(); }
});
window.addEventListener('keydown', (ev) => {
  if (ev.code === 'Escape' && isBestiaryDetailOpen()) {
    ev.preventDefault();
    closeBestiaryDetail();
  }
});

function advanceFromPrompt() {
  if (state.phase === 'intro') { hideIntro(); startRun(); }
  else if (state.phase === 'wave_endcard') {
    // After every wave except the final, transition through build phase.
    // Game-over and run-complete bypass build phase via their own paths.
    hideEndcard();
    startBuildPhase();
  }
  else if (state.phase === 'build_phase') { endBuildPhase(); }
  else if (state.phase === 'run_complete' || state.phase === 'game_over') { hideEndcard(); startRun(); }
}

// BOOT
initHUD();
fitCanvas();
clearScope(ctx);
drawScopeChrome(ctx);
showIntro();
setupInstallUI();
// Consume any pre-init dismissal that landed in the script-load gap.
// The inline <script> in index.html buffers a tap/[SPACE] that occurs
// before this module evaluates so the user never loses an intro press.
if (window.__dwIntroPending) {
  window.__dwIntroPending = false;
  advanceFromPrompt();
}
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

