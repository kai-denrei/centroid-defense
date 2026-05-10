// containment.js — Containment Protocol mini-game.
//
// A modal overlay that opens between specific waves. A single
// autonomous drone patrols the arena edge. The player taps anywhere
// inside the arena to send the drone there, drawing a net wall behind
// it as it crosses the open water. Tap-and-release fast → fast drone,
// weak net. Press and hold → drone charges → slower drone, stronger
// net. Walls persist; the creature reflects off them and can ram them.
// Win when the creature's accessible area falls below CFG.win.areaPct
// (or its energy hits 0). Lose when the drone pool is exhausted or
// the 90s clock runs out.
//
// Self-contained: owns its own canvas, rAF loop, input handlers, and
// modal lifecycle. Host (main.js) just calls openContainment(opts).

const CFG = {
  arena: { w: 720, h: 400 },
  drone: {
    pool: 10,                 // total drone uses available this encounter
    patrolSpeed: 110,         // px/s walking the perimeter when idle
    fastSpeed: 460,           // px/s when fully fast (quick tap)
    slowSpeed: 140,           // px/s when fully slow (held to charge cap)
    fastNetHp: 25,            // weak net (quick tap)
    slowNetHp: 95,            // strong net (held to charge cap)
    chargeMs: 1200,           // hold duration to reach fully slow/strong
    radius: 7,                // visual marker radius
  },
  creature: {
    startEnergy: 100,
    radius: 18,
    drift: 60,                // px/s base drift speed
    jitter: 0.4,              // 0..1 brownian intensity
    drainCurve: [             // accessible-area-pct → energy-drain/sec
      { areaPct: 100, drain: 0.0 },
      { areaPct: 60,  drain: 0.4 },
      { areaPct: 30,  drain: 1.4 },
      { areaPct: 15,  drain: 3.5 },
      { areaPct: 5,   drain: 7.0 },
    ],
    ramDamage: 25,
    ramRadius: 22,
    ramCooldown: 1.2,
  },
  win: {
    energyAtOrBelow: 0,
    areaAtOrBelowPct: 22,
  },
  duration: 90,               // hard time limit (s)
  grid: { cols: 60, rows: 40 },
};

const TAU = Math.PI * 2;
const HOT = '#88ff88', MID = '#3a8c3a', AMBER = '#ffaa44', RED = '#ff3322';

// DOM refs
let modal = null;
let canvas = null, ctx = null;
let droneEl, areaEl, energyEl, timeEl, msgEl, creatureLabelEl;

let state = null;
let rafId = null;
let onResultFn = null;
let scaleFactor = 1;

// ─── Public API ──────────────────────────────────────────────────────────
export function openContainment({ round, creatureSlug = 'bloomjelly', onResult }) {
  onResultFn = onResult || (() => {});
  ensureDom();
  state = makeState(round, creatureSlug);
  if (creatureLabelEl) creatureLabelEl.textContent = creatureSlug.toUpperCase();
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'msg'; }
  modal.classList.remove('hide');
  fitArena();
  cancelAnimationFrame(rafId);
  loop(performance.now());
}

export function isContainmentActive() {
  return modal != null && !modal.classList.contains('hide');
}

function close() {
  cancelAnimationFrame(rafId);
  rafId = null;
  if (modal) modal.classList.add('hide');
}

// ─── DOM bootstrap ───────────────────────────────────────────────────────
function ensureDom() {
  if (modal) return;
  modal = document.getElementById('containment-modal');
  canvas = document.getElementById('containment-arena');
  ctx = canvas.getContext('2d');
  droneEl = document.getElementById('cm-drones');
  areaEl = document.getElementById('cm-area');
  energyEl = document.getElementById('cm-energy');
  timeEl = document.getElementById('cm-time');
  msgEl = document.getElementById('containment-msg');
  creatureLabelEl = document.getElementById('containment-creature');
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', () => { if (isContainmentActive()) fitArena(); });
}

function fitArena() {
  const r = canvas.getBoundingClientRect();
  const cssW = Math.max(120, Math.floor(r.width));
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cssW * dpr;
  canvas.height = (cssW * CFG.arena.h / CFG.arena.w) * dpr;
  scaleFactor = cssW / CFG.arena.w;
  ctx.setTransform(dpr * scaleFactor, 0, 0, dpr * scaleFactor, 0, 0);
}

// ─── State ───────────────────────────────────────────────────────────────
function makeState(round, creatureSlug) {
  return {
    round,
    creatureSlug,
    creature: {
      x: CFG.arena.w * 0.5,
      y: CFG.arena.h * 0.5,
      vx: 0, vy: 0,
      energy: CFG.creature.startEnergy,
      lastRamAt: 0,
    },
    lines: [],                // [{ ax, ay, bx, by, hp, hpMax, broken }]
    drone: {
      mode: 'patrol',         // 'patrol' | 'charging' | 'drawing'
      x: CFG.arena.w / 2, y: 0,
      edgePos: CFG.arena.w / 2,    // start at top-middle so first frame reads naturally
      // 'drawing'/'charging' state
      trailX: 0, trailY: 0,   // line start (where the drone left the edge)
      targetX: 0, targetY: 0, // where the drone is heading
      speed: 0, netHp: 0,     // committed once 'drawing' starts
      chargeStartedAt: 0,
    },
    pointerDown: false,
    dronePool: CFG.drone.pool,
    dronesUsed: 0,
    startedAt: performance.now() / 1000,
    lastT: performance.now() / 1000,
    accessiblePct: 100,
    settled: false,
    outcome: null,
    uiMode: 'tutorial',       // 'tutorial' | 'play' | 'settled'
  };
}

// ─── Loop ────────────────────────────────────────────────────────────────
function loop(nowMs) {
  rafId = requestAnimationFrame(loop);
  const t = nowMs / 1000;
  const dt = Math.min(0.05, t - state.lastT);
  state.lastT = t;
  if (state.uiMode === 'play' && !state.settled) {
    update(dt, t);
    if (!state.settled) checkOutcome(t);
  }
  render(t);
}

// ─── Update ──────────────────────────────────────────────────────────────
function update(dt, t) {
  // Creature drift + ramming (unchanged from prior version) ────────────
  const c = state.creature;
  const cfg = CFG.creature;
  c.vx += (Math.random() - 0.5) * cfg.jitter * 80 * dt;
  c.vy += (Math.random() - 0.5) * cfg.jitter * 80 * dt;
  const speed = Math.hypot(c.vx, c.vy) || 1;
  c.vx *= cfg.drift / Math.max(speed, cfg.drift * 0.2);
  c.vy *= cfg.drift / Math.max(speed, cfg.drift * 0.2);
  let nx = c.x + c.vx * dt;
  let ny = c.y + c.vy * dt;
  if (nx < cfg.radius) { nx = cfg.radius; c.vx = Math.abs(c.vx); }
  if (nx > CFG.arena.w - cfg.radius) { nx = CFG.arena.w - cfg.radius; c.vx = -Math.abs(c.vx); }
  if (ny < cfg.radius) { ny = cfg.radius; c.vy = Math.abs(c.vy); }
  if (ny > CFG.arena.h - cfg.radius) { ny = CFG.arena.h - cfg.radius; c.vy = -Math.abs(c.vy); }
  for (const ln of state.lines) {
    if (ln.broken) continue;
    if (segmentIntersects(c.x, c.y, nx, ny, ln.ax, ln.ay, ln.bx, ln.by)) {
      const lnx = ln.bx - ln.ax, lny = ln.by - ln.ay;
      const len = Math.hypot(lnx, lny) || 1;
      const nxn = -lny / len, nyn = lnx / len;
      const dotV = c.vx * nxn + c.vy * nyn;
      c.vx -= 2 * dotV * nxn;
      c.vy -= 2 * dotV * nyn;
      if (t - c.lastRamAt > cfg.ramCooldown) {
        ln.hp -= cfg.ramDamage;
        c.lastRamAt = t;
        if (ln.hp <= 0) ln.broken = true;
      }
      nx = c.x + c.vx * dt;
      ny = c.y + c.vy * dt;
      break;
    }
  }
  c.x = nx; c.y = ny;

  // Drone ──────────────────────────────────────────────────────────────
  const d = state.drone;
  if (d.mode === 'patrol') {
    d.edgePos += CFG.drone.patrolSpeed * dt;
    const p = edgePosToXY(d.edgePos);
    d.x = p.x; d.y = p.y;
  } else if (d.mode === 'charging') {
    // Drone hovers at trail start, charging up. Live-update target as the
    // pointer drags.  No movement yet — release commits.
    d.x = d.trailX; d.y = d.trailY;
  } else if (d.mode === 'drawing') {
    const remX = d.targetX - d.x, remY = d.targetY - d.y;
    const remDist = Math.hypot(remX, remY);
    const step = d.speed * dt;
    if (remDist <= step || remDist < 1) {
      // Reached target — finalize the line + return to patrol
      finalizeLine(d.trailX, d.trailY, d.x, d.y, d.netHp);
      const e = nearestEdgePos(d.x, d.y);
      d.edgePos = e;
      const ep = edgePosToXY(e);
      d.x = ep.x; d.y = ep.y;
      d.mode = 'patrol';
    } else {
      d.x += (remX / remDist) * step;
      d.y += (remY / remDist) * step;
      // Creature collision in flight: drone destroyed, line not laid
      if (Math.hypot(c.x - d.x, c.y - d.y) < cfg.ramRadius) {
        // teleport drone back to nearest edge — no line drawn, pool already
        // decremented (the launch is the cost regardless of outcome)
        const e = nearestEdgePos(d.x, d.y);
        d.edgePos = e;
        const ep = edgePosToXY(e);
        d.x = ep.x; d.y = ep.y;
        d.mode = 'patrol';
      }
    }
  }

  // Energy drain ───────────────────────────────────────────────────────
  c.energy = Math.max(0, c.energy - drainForArea(state.accessiblePct) * dt);

  // HUD writes
  if (droneEl) droneEl.textContent = String(state.dronePool);
  if (areaEl) areaEl.textContent = String(Math.round(state.accessiblePct));
  if (energyEl) energyEl.textContent = String(Math.round(c.energy));
  if (timeEl) {
    const remaining = Math.max(0, CFG.duration - (t - state.startedAt));
    timeEl.textContent = String(Math.round(remaining));
  }
}

function checkOutcome(t) {
  const c = state.creature;
  if (c.energy <= CFG.win.energyAtOrBelow) return finish('win', 'CREATURE PACIFIED');
  if (state.accessiblePct <= CFG.win.areaAtOrBelowPct) return finish('win', 'ZONE SEALED');
  const elapsed = t - state.startedAt;
  if (elapsed >= CFG.duration) return finish('loss', 'TIME EXPIRED');
  if (state.dronePool <= 0 && state.drone.mode === 'patrol') {
    return finish('loss', 'DRONE POOL EXHAUSTED');
  }
}

function finish(outcome, reason) {
  if (state.settled) return;
  state.settled = true;
  state.outcome = outcome;
  if (msgEl) {
    msgEl.textContent = `${outcome === 'win' ? 'CONTAINED' : 'BREACHED'} — ${reason} · TAP TO CONTINUE`;
    msgEl.className = 'msg ' + (outcome === 'win' ? 'win' : 'loss');
  }
}

function finalizeLine(ax, ay, bx, by, hp) {
  state.lines.push({ ax, ay, bx, by, hp, hpMax: hp, broken: false });
  state.accessiblePct = computeAccessiblePct();
}

// ─── Input ───────────────────────────────────────────────────────────────
function onPointerDown(ev) {
  ev.preventDefault();
  if (!state) return;
  if (state.uiMode === 'tutorial') {
    state.uiMode = 'play';
    const t = performance.now() / 1000;
    state.startedAt = t;
    state.lastT = t;
    return;
  }
  if (state.settled) {
    const out = {
      outcome: state.outcome,
      dronesUsed: state.dronesUsed,
      avgNetHp: avgRemainingNetHp(),
    };
    close();
    onResultFn(out);
    return;
  }
  if (state.dronePool <= 0) return;
  const d = state.drone;
  if (d.mode !== 'patrol') return;       // mid-action; ignore taps
  const { x, y } = pointerCoords(ev);
  state.pointerDown = true;
  d.mode = 'charging';
  d.chargeStartedAt = performance.now() / 1000;
  d.trailX = d.x; d.trailY = d.y;
  d.targetX = x; d.targetY = y;
}

function onPointerMove(ev) {
  if (!state || !state.pointerDown) return;
  if (state.drone.mode !== 'charging') return;
  const { x, y } = pointerCoords(ev);
  state.drone.targetX = x;
  state.drone.targetY = y;
}

function onPointerUp(ev) {
  if (!state || !state.pointerDown) return;
  state.pointerDown = false;
  const d = state.drone;
  if (d.mode !== 'charging') return;
  const heldMs = (performance.now() / 1000 - d.chargeStartedAt) * 1000;
  const ch = Math.min(1, heldMs / CFG.drone.chargeMs);     // 0..1
  d.speed = lerp(CFG.drone.fastSpeed, CFG.drone.slowSpeed, ch);
  d.netHp = lerp(CFG.drone.fastNetHp, CFG.drone.slowNetHp, ch);
  d.mode = 'drawing';
  state.dronePool--;
  state.dronesUsed++;
}

function pointerCoords(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: clamp((ev.clientX - r.left) / scaleFactor, 0, CFG.arena.w),
    y: clamp((ev.clientY - r.top) / scaleFactor, 0, CFG.arena.h),
  };
}

// ─── Geometry helpers ────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function arenaPerimeter() {
  return 2 * (CFG.arena.w + CFG.arena.h);
}

// Walk perimeter clockwise: top → right → bottom → left.
function edgePosToXY(edgePos) {
  const W = CFG.arena.w, H = CFG.arena.h;
  const peri = arenaPerimeter();
  let p = ((edgePos % peri) + peri) % peri;
  if (p < W) return { x: p, y: 0 };
  p -= W;
  if (p < H) return { x: W, y: p };
  p -= H;
  if (p < W) return { x: W - p, y: H };
  p -= W;
  return { x: 0, y: H - p };
}

// Project an interior point to the nearest edge and return its edgePos.
function nearestEdgePos(x, y) {
  const W = CFG.arena.w, H = CFG.arena.h;
  const dT = y, dB = H - y, dL = x, dR = W - x;
  const m = Math.min(dT, dB, dL, dR);
  if (m === dT) return x;                      // top
  if (m === dR) return W + y;                  // right
  if (m === dB) return W + H + (W - x);        // bottom
  return W + H + W + (H - y);                  // left
}

function drainForArea(pct) {
  const curve = CFG.creature.drainCurve;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i], b = curve[i + 1];
    if (pct <= a.areaPct && pct >= b.areaPct) {
      const t = (a.areaPct - pct) / Math.max(1e-6, a.areaPct - b.areaPct);
      return a.drain + (b.drain - a.drain) * t;
    }
  }
  return curve[curve.length - 1].drain;
}

function segmentIntersects(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
  const d1x = p2x - p1x, d1y = p2y - p1y;
  const d2x = p4x - p3x, d2y = p4y - p3y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;
  const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / denom;
  const s = ((p3x - p1x) * d1y - (p3y - p1y) * d1x) / denom;
  return t > 0 && t < 1 && s > 0 && s < 1;
}

function computeAccessiblePct() {
  const cols = CFG.grid.cols, rows = CFG.grid.rows;
  const cw = CFG.arena.w / cols, ch = CFG.arena.h / rows;
  const blocked = new Uint8Array(cols * rows);
  for (const ln of state.lines) {
    if (ln.broken) continue;
    rasterizeLine(blocked, cols, rows, cw, ch, ln.ax, ln.ay, ln.bx, ln.by);
  }
  const c = state.creature;
  let cx = clamp(Math.floor(c.x / cw), 0, cols - 1);
  let cy = clamp(Math.floor(c.y / ch), 0, rows - 1);
  if (blocked[cy * cols + cx]) return 100;
  const seen = new Uint8Array(cols * rows);
  const stack = [cy * cols + cx];
  seen[stack[0]] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop(); count++;
    const x = i % cols, y = (i - x) / cols;
    const candidates = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
    for (const [nx, ny] of candidates) {
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      const j = ny * cols + nx;
      if (seen[j] || blocked[j]) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return (count / (cols * rows)) * 100;
}

function rasterizeLine(blocked, cols, rows, cw, ch, ax, ay, bx, by) {
  let x0 = Math.floor(ax / cw), y0 = Math.floor(ay / ch);
  const x1 = Math.floor(bx / cw), y1 = Math.floor(by / ch);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 >= 0 && x0 < cols && y0 >= 0 && y0 < rows) blocked[y0 * cols + x0] = 1;
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function avgRemainingNetHp() {
  if (!state.lines.length) return 0;
  const sum = state.lines.reduce((s, ln) => s + (ln.broken ? 0 : ln.hp / ln.hpMax), 0);
  return sum / state.lines.length;
}

// ─── Render ──────────────────────────────────────────────────────────────
function render(t) {
  const W = CFG.arena.w, H = CFG.arena.h;
  ctx.fillStyle = '#0a1820';
  ctx.fillRect(0, 0, W, H);

  // grid hint
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 60; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = 60; y < H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();

  // arena border
  ctx.strokeStyle = 'rgba(58, 140, 58, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, W, H);

  // placed walls — thickness AND tint convey absolute strength so the
  // operator can distinguish a fast-cheap wall from a slow-strong one.
  for (const ln of state.lines) {
    const cond = ln.broken ? 0 : (ln.hp / ln.hpMax);
    // strengthRatio: 0 (fastNetHp) → 1 (slowNetHp)
    const denom = Math.max(1, CFG.drone.slowNetHp - CFG.drone.fastNetHp);
    const strength = Math.max(0, Math.min(1, (ln.hpMax - CFG.drone.fastNetHp) / denom));
    const baseW = 1.5 + 4 * strength;            // 1.5 .. 5.5 px
    const a = (0.45 + 0.45 * strength) * (0.4 + 0.6 * cond);
    if (ln.broken) {
      ctx.strokeStyle = 'rgba(255, 51, 34, 0.30)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
    } else {
      // weak = pure amber; strong = phosphor-tinged amber
      const r = Math.round(255 - 30 * strength);
      const g = Math.round(170 + 60 * strength);
      const b = Math.round(68 + 40 * strength);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
      ctx.lineWidth = baseW * (0.6 + 0.4 * cond);
      ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.6)`;
      ctx.shadowBlur = 4 + 6 * strength;
    }
    ctx.beginPath();
    ctx.moveTo(ln.ax, ln.ay); ctx.lineTo(ln.bx, ln.by);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
  }

  // drone — patrol/drawing/charging
  drawDrone(t);

  // creature
  drawCreature(t);

  // pre-tutorial / settled banners
  if (state.settled) drawSettled();
  if (state.uiMode === 'tutorial') drawTutorial(t);
}

function drawDrone(t) {
  const d = state.drone;
  // trail (drawing or charging preview)
  if (d.mode === 'drawing') {
    ctx.strokeStyle = `rgba(255, 245, 200, 0.85)`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(d.trailX, d.trailY); ctx.lineTo(d.x, d.y);
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (d.mode === 'charging') {
    // dashed preview from drone to current target — telegraphs intent
    ctx.strokeStyle = 'rgba(255, 170, 68, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.targetX, d.targetY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // body
  ctx.fillStyle = HOT;
  ctx.shadowColor = HOT; ctx.shadowBlur = 6;
  ctx.beginPath(); ctx.arc(d.x, d.y, CFG.drone.radius, 0, TAU); ctx.fill();
  ctx.shadowBlur = 0;
  // halo when charging — color shifts amber→phosphor as charge grows
  if (d.mode === 'charging') {
    const ch = Math.min(1, (performance.now() / 1000 - d.chargeStartedAt) * 1000 / CFG.drone.chargeMs);
    const tier = ch < 0.5
      ? `rgba(255, 170, 68, ${(0.5 + 0.5 * ch).toFixed(3)})`
      : `rgba(136, 255, 136, ${(0.6 + 0.4 * ch).toFixed(3)})`;
    ctx.strokeStyle = tier;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(d.x, d.y, CFG.drone.radius + 6, -Math.PI / 2, -Math.PI / 2 + TAU * ch);
    ctx.stroke();
    // dim outer ring as backdrop
    ctx.strokeStyle = 'rgba(58, 140, 58, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(d.x, d.y, CFG.drone.radius + 6, 0, TAU);
    ctx.stroke();
  }
}

function drawCreature(t) {
  const c = state.creature;
  const energyPct = c.energy / CFG.creature.startEnergy;
  const fade = 0.35 + 0.65 * energyPct;
  const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, CFG.creature.radius * 1.6);
  cg.addColorStop(0, `rgba(136, 255, 136, ${0.85 * fade})`);
  cg.addColorStop(0.6, `rgba(58, 140, 58, ${0.45 * fade})`);
  cg.addColorStop(1, 'rgba(58,140,58,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(c.x, c.y, CFG.creature.radius * 1.6, 0, TAU); ctx.fill();
  const pulse = 0.7 + 0.3 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(136, 255, 136, ${pulse * fade})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, CFG.creature.radius * 0.55, 0, TAU); ctx.fill();
  ctx.strokeStyle = `rgba(136, 255, 136, ${fade})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, CFG.creature.radius + 4, -Math.PI / 2, -Math.PI / 2 + TAU * energyPct);
  ctx.stroke();
}

function drawSettled() {
  const W = CFG.arena.w, H = CFG.arena.h;
  const isWin = state.outcome === 'win';
  ctx.fillStyle = isWin ? 'rgba(136, 255, 136, 0.18)' : 'rgba(255, 51, 34, 0.18)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = isWin ? HOT : RED;
  ctx.font = '900 36px JetBrains Mono, ui-monospace, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = isWin ? HOT : RED;
  ctx.shadowBlur = 14;
  ctx.fillText(isWin ? 'CONTAINED' : 'BREACHED', W / 2, H / 2);
  ctx.shadowBlur = 0;
}

function drawTutorial(t) {
  const W = CFG.arena.w, H = CFG.arena.h;
  ctx.fillStyle = 'rgba(2, 5, 2, 0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = HOT; ctx.shadowBlur = 12;
  ctx.fillStyle = HOT;
  ctx.font = '900 26px JetBrains Mono, ui-monospace, monospace';
  ctx.fillText('CONTAINMENT PROTOCOL', W / 2, 48);
  ctx.shadowBlur = 6;
  ctx.fillStyle = AMBER;
  ctx.font = '700 13px JetBrains Mono, ui-monospace, monospace';
  ctx.fillText(`TARGET · ${state.creatureSlug.toUpperCase()}  ·  TIER 1 · SOFT CONTACT`, W / 2, 76);
  ctx.shadowBlur = 0;

  const lines = [
    'A SINGLE DRONE PATROLS THE ARENA EDGE.',
    '',
    'TAP ANYWHERE INSIDE THE ARENA — THE DRONE',
    'BREAKS OFF AND HEADS THERE, DRAWING A NET WALL.',
    '',
    'QUICK TAP   →  FAST DRONE,  WEAK NET',
    'PRESS + HOLD →  SLOWER DRONE,  STRONGER NET',
    '',
    'WIN — REDUCE ACCESSIBLE AREA TO ≤ 22%, OR DRAIN',
    'THE CREATURE\'S ENERGY TO ZERO.',
    'LOSE — RUN OUT OF DRONES (10) OR EXCEED 90s.',
  ];
  ctx.font = '500 12px JetBrains Mono, ui-monospace, monospace';
  ctx.fillStyle = MID;
  let y = 118;
  for (const line of lines) {
    if (line) ctx.fillText(line, W / 2, y);
    y += 17;
  }

  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.font = '700 14px JetBrains Mono, ui-monospace, monospace';
  ctx.fillStyle = `rgba(255, 170, 68, ${pulse.toFixed(3)})`;
  ctx.shadowColor = AMBER; ctx.shadowBlur = 8;
  ctx.fillText('[ TAP TO BEGIN ]', W / 2, H - 32);
  ctx.shadowBlur = 0;
}
