// containment.js — Containment Protocol mini-game (M0).
//
// A modal overlay that opens between specific waves. Player launches
// drones that draw nets across an arena to enclose a drifting creature.
// When the creature's accessible area shrinks below CFG.win.areaPct (or
// its energy hits 0) → WIN. When the drone pool is empty or the time
// runs out → LOSS. Result is reported via the onResult callback.
//
// Self-contained: owns its own canvas, rAF loop, input handlers, and
// modal lifecycle. Host (main.js) just calls openContainment(opts).

const CFG = {
  arena: { w: 720, h: 400 },
  drone: {
    speedPx: 360,           // px/s along its line
    netHp: 60,              // wall HP (creature ram damage = 25)
    pool: 10,               // total drones available this encounter
  },
  creature: {
    startEnergy: 100,
    radius: 18,
    drift: 60,              // px/s base drift speed
    jitter: 0.4,            // 0..1 brownian intensity
    drainCurve: [           // accessible-area-pct → energy-drain/sec
      { areaPct: 100, drain: 0.0 },
      { areaPct: 60,  drain: 0.4 },
      { areaPct: 30,  drain: 1.4 },
      { areaPct: 15,  drain: 3.5 },
      { areaPct: 5,   drain: 7.0 },
    ],
    ramDamage: 25,          // damage per ram to a wall
    ramRadius: 22,          // distance at which a ram registers
    ramCooldown: 1.2,       // seconds between ram attempts
  },
  win: {
    energyAtOrBelow: 0,
    areaAtOrBelowPct: 22,
  },
  loss: {
    dronePoolExhausted: true,
  },
  duration: 90,             // hard time limit (s)
  // Flood-fill grid for accessible-area %. 60×40 cells = 12px each.
  grid: { cols: 60, rows: 40 },
};

const TAU = Math.PI * 2;
const HOT = '#88ff88', MID = '#3a8c3a', AMBER = '#ffaa44', RED = '#ff3322';

// DOM refs (resolved on first open)
let modal = null;
let canvas = null;
let ctx = null;
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
  if (msgEl) msgEl.textContent = '';
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
    drones: [],
    lines: [],
    dronePool: CFG.drone.pool,
    dronesUsed: 0,
    startedAt: performance.now() / 1000,
    lastT: performance.now() / 1000,
    accessiblePct: 100,
    settled: false,
    outcome: null,
    // 'tutorial' → 'play' → 'settled'.  Tutorial is dismissed on first tap.
    uiMode: 'tutorial',
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
  // Creature drift (random walk, with avoidance from drones in flight + walls)
  const c = state.creature;
  const cfg = CFG.creature;
  // brownian impulse
  c.vx += (Math.random() - 0.5) * cfg.jitter * 80 * dt;
  c.vy += (Math.random() - 0.5) * cfg.jitter * 80 * dt;
  // damp toward base drift
  const speed = Math.hypot(c.vx, c.vy) || 1;
  const targetSpeed = cfg.drift;
  c.vx *= targetSpeed / Math.max(speed, targetSpeed * 0.2);
  c.vy *= targetSpeed / Math.max(speed, targetSpeed * 0.2);
  // tentative move
  let nx = c.x + c.vx * dt;
  let ny = c.y + c.vy * dt;
  // arena bounds: bounce
  if (nx < cfg.radius) { nx = cfg.radius; c.vx = Math.abs(c.vx); }
  if (nx > CFG.arena.w - cfg.radius) { nx = CFG.arena.w - cfg.radius; c.vx = -Math.abs(c.vx); }
  if (ny < cfg.radius) { ny = cfg.radius; c.vy = Math.abs(c.vy); }
  if (ny > CFG.arena.h - cfg.radius) { ny = CFG.arena.h - cfg.radius; c.vy = -Math.abs(c.vy); }
  // wall collision: if a line is between (c.x,c.y) and (nx,ny), bounce.
  // Simple: for each finished line, if creature's path intersects, reflect.
  for (const ln of state.lines) {
    if (ln.broken) continue;
    if (segmentIntersects(c.x, c.y, nx, ny, ln.ax, ln.ay, ln.bx, ln.by)) {
      // Reflect across the line normal
      const lnx = ln.bx - ln.ax, lny = ln.by - ln.ay;
      const lnLen = Math.hypot(lnx, lny) || 1;
      const nxn = -lny / lnLen, nyn = lnx / lnLen;        // unit normal
      const dotV = c.vx * nxn + c.vy * nyn;
      c.vx -= 2 * dotV * nxn;
      c.vy -= 2 * dotV * nyn;
      // ram the wall
      if (t - c.lastRamAt > cfg.ramCooldown) {
        ln.hp -= cfg.ramDamage;
        c.lastRamAt = t;
        if (ln.hp <= 0) ln.broken = true;
      }
      // step back from wall a bit
      nx = c.x + c.vx * dt;
      ny = c.y + c.vy * dt;
      break;
    }
  }
  c.x = nx; c.y = ny;

  // Drones in flight — advance toward their dest, lay net trail
  for (const d of state.drones) {
    if (d.finished) continue;
    const remX = d.bx - d.x, remY = d.by - d.y;
    const remDist = Math.hypot(remX, remY);
    const step = CFG.drone.speedPx * dt;
    if (remDist <= step) {
      d.x = d.bx; d.y = d.by;
      d.finished = true;
      // Finalize the line
      state.lines.push({
        ax: d.ax, ay: d.ay, bx: d.bx, by: d.by,
        hp: CFG.drone.netHp, hpMax: CFG.drone.netHp,
        broken: false, tier: 'cruise',
      });
      // Recompute accessible area now that wall set has changed
      state.accessiblePct = computeAccessiblePct();
    } else {
      d.x += (remX / remDist) * step;
      d.y += (remY / remDist) * step;
      // Did the creature ram this in-flight drone? Single-drone-vulnerability.
      if (Math.hypot(c.x - d.x, c.y - d.y) < cfg.ramRadius) {
        d.finished = true;
        d.killed = true;
        // No line laid — this drone was destroyed
      }
    }
  }
  // Prune killed drones from active list (keep finished ones in line list)
  state.drones = state.drones.filter(d => !d.finished || (Date.now() - d._kt < 200));

  // Energy drain based on accessible area
  const drain = drainForArea(state.accessiblePct);
  c.energy = Math.max(0, c.energy - drain * dt);

  // Update HUD numbers
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
  // WIN
  if (c.energy <= CFG.win.energyAtOrBelow) return finish('win', 'CREATURE PACIFIED');
  if (state.accessiblePct <= CFG.win.areaAtOrBelowPct) return finish('win', 'ZONE SEALED');
  // LOSS
  const elapsed = t - state.startedAt;
  if (elapsed >= CFG.duration) return finish('loss', 'TIME EXPIRED');
  if (state.dronePool <= 0 && state.drones.every(d => d.finished)) {
    return finish('loss', 'DRONE POOL EXHAUSTED');
  }
}

function finish(outcome, reason) {
  if (state.settled) return;
  state.settled = true;
  state.outcome = outcome;
  if (msgEl) {
    msgEl.textContent = `${outcome === 'win' ? 'CONTAINED' : 'BREACHED'} — ${reason} · TAP TO CONTINUE`;
    msgEl.className = outcome === 'win' ? 'msg win' : 'msg loss';
  }
  // wait for a tap to dismiss
}

// ─── Input ───────────────────────────────────────────────────────────────
function onPointerDown(ev) {
  ev.preventDefault();
  if (!state) return;
  // Tutorial dismiss → start the run timer fresh so the 90s clock reflects
  // gameplay only, not how long the player read the briefing.
  if (state.uiMode === 'tutorial') {
    state.uiMode = 'play';
    const t = performance.now() / 1000;
    state.startedAt = t;
    state.lastT = t;
    return;
  }
  if (state.settled) {
    close();
    onResultFn({
      outcome: state.outcome,
      dronesUsed: state.dronesUsed,
      avgNetHp: avgRemainingNetHp(),
    });
    return;
  }
  if (state.dronePool <= 0) return;
  const r = canvas.getBoundingClientRect();
  const x = (ev.clientX - r.left) / scaleFactor;
  const y = (ev.clientY - r.top) / scaleFactor;
  // Anchor = nearest arena edge to the tap. Drone goes from edge → tap.
  const edges = [
    { x: 0,             y, label: 'L' },
    { x: CFG.arena.w,   y, label: 'R' },
    { x,                y: 0,             label: 'T' },
    { x,                y: CFG.arena.h,   label: 'B' },
  ];
  let anchor = edges[0], bestD = Infinity;
  for (const e of edges) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) { bestD = d; anchor = e; }
  }
  launchDrone(anchor.x, anchor.y, x, y);
}

function launchDrone(ax, ay, bx, by) {
  if (state.dronePool <= 0) return;
  state.dronePool--;
  state.dronesUsed++;
  state.drones.push({
    ax, ay, bx, by, x: ax, y: ay,
    finished: false, killed: false,
  });
}

// ─── Geometry / area ─────────────────────────────────────────────────────
function drainForArea(pct) {
  const curve = CFG.creature.drainCurve;
  // piecewise linear; curve descending in areaPct
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

// Accessible-area % via flood fill from the creature's current cell.
function computeAccessiblePct() {
  const cols = CFG.grid.cols, rows = CFG.grid.rows;
  const cw = CFG.arena.w / cols, ch = CFG.arena.h / rows;
  const blocked = new Uint8Array(cols * rows);
  // Mark cells crossed by an unbroken line
  for (const ln of state.lines) {
    if (ln.broken) continue;
    rasterizeLine(blocked, cols, rows, cw, ch, ln.ax, ln.ay, ln.bx, ln.by);
  }
  const c = state.creature;
  let cx = Math.floor(c.x / cw);
  let cy = Math.floor(c.y / ch);
  cx = Math.max(0, Math.min(cols - 1, cx));
  cy = Math.max(0, Math.min(rows - 1, cy));
  if (blocked[cy * cols + cx]) return 100; // creature on a wall — treat as full (recoverable)
  // BFS flood
  const seen = new Uint8Array(cols * rows);
  const stack = [cy * cols + cx];
  seen[stack[0]] = 1;
  let count = 0;
  while (stack.length) {
    const i = stack.pop();
    count++;
    const x = i % cols, y = (i - x) / cols;
    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
    ];
    for (const [nx, ny] of neighbors) {
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
  // Bresenham over grid cells
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
  // arena background — dark teal water
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

  // placed lines (walls)
  for (const ln of state.lines) {
    const hpPct = ln.broken ? 0 : (ln.hp / ln.hpMax);
    const a = 0.25 + 0.6 * hpPct;
    ctx.strokeStyle = ln.broken ? `rgba(255, 51, 34, 0.25)` : `rgba(255, 170, 68, ${a.toFixed(3)})`;
    ctx.lineWidth = ln.broken ? 1 : 2.5;
    if (ln.broken) ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(ln.ax, ln.ay); ctx.lineTo(ln.bx, ln.by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // drones in flight
  for (const d of state.drones) {
    if (d.finished) continue;
    // trail from anchor to current position
    ctx.strokeStyle = 'rgba(255, 170, 68, 0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(d.ax, d.ay); ctx.lineTo(d.x, d.y);
    ctx.stroke();
    // drone marker
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(d.x, d.y, 3.5, 0, TAU); ctx.fill();
  }

  // creature
  const c = state.creature;
  const energyPct = c.energy / CFG.creature.startEnergy;
  const fade = 0.35 + 0.65 * energyPct;
  const cg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, CFG.creature.radius * 1.6);
  cg.addColorStop(0, `rgba(136, 255, 136, ${0.85 * fade})`);
  cg.addColorStop(0.6, `rgba(58, 140, 58, ${0.45 * fade})`);
  cg.addColorStop(1, 'rgba(58,140,58,0)');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(c.x, c.y, CFG.creature.radius * 1.6, 0, TAU); ctx.fill();
  // creature body — pulsing inner
  const pulse = 0.7 + 0.3 * Math.sin(t * 4);
  ctx.fillStyle = `rgba(136, 255, 136, ${pulse * fade})`;
  ctx.beginPath(); ctx.arc(c.x, c.y, CFG.creature.radius * 0.55, 0, TAU); ctx.fill();
  // energy ring
  ctx.strokeStyle = `rgba(136, 255, 136, ${fade})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(c.x, c.y, CFG.creature.radius + 4, -Math.PI / 2, -Math.PI / 2 + TAU * energyPct);
  ctx.stroke();

  // win/loss banner
  if (state.settled) {
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

  // tutorial briefing overlay — dismissed on first tap
  if (state.uiMode === 'tutorial') drawTutorial(t);
}

function drawTutorial(t) {
  const W = CFG.arena.w, H = CFG.arena.h;
  ctx.fillStyle = 'rgba(2, 5, 2, 0.88)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Title
  ctx.shadowColor = HOT; ctx.shadowBlur = 12;
  ctx.fillStyle = HOT;
  ctx.font = '900 26px JetBrains Mono, ui-monospace, monospace';
  ctx.fillText('CONTAINMENT PROTOCOL', W / 2, 56);
  // Subtitle — creature
  ctx.shadowBlur = 6;
  ctx.fillStyle = AMBER;
  ctx.font = '700 13px JetBrains Mono, ui-monospace, monospace';
  ctx.fillText(`TARGET · ${state.creatureSlug.toUpperCase()}  ·  TIER 1 · SOFT CONTACT`, W / 2, 84);
  ctx.shadowBlur = 0;
  // Briefing lines
  const lines = [
    'TAP THE ARENA — A DRONE LAUNCHES FROM THE NEAREST EDGE',
    'AND DRAWS A NET WALL TO YOUR TAP POINT.',
    '',
    'WALLS BLOCK THE CREATURE; IT WILL RAM TO BREAK THEM',
    '(25 DAMAGE / 1.2s · NET HP 60).',
    '',
    'WIN — REDUCE ITS ACCESSIBLE AREA TO ≤ 22%, OR DRAIN',
    'ITS ENERGY TO ZERO (DRAIN ACCELERATES AS AREA SHRINKS).',
    '',
    'LOSE — RUN OUT OF DRONES (10) OR EXCEED THE 90s CLOCK.',
  ];
  ctx.font = '500 12px JetBrains Mono, ui-monospace, monospace';
  ctx.fillStyle = MID;
  let y = 130;
  for (const line of lines) {
    if (line) ctx.fillText(line, W / 2, y);
    y += 18;
  }
  // Pulse prompt at bottom
  const pulse = 0.55 + 0.45 * Math.sin(t * 3);
  ctx.font = '700 14px JetBrains Mono, ui-monospace, monospace';
  ctx.fillStyle = `rgba(255, 170, 68, ${pulse.toFixed(3)})`;
  ctx.shadowColor = AMBER; ctx.shadowBlur = 8;
  ctx.fillText('[ TAP TO BEGIN ]', W / 2, H - 38);
  ctx.shadowBlur = 0;
}
