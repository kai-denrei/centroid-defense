// two-sequence.js — two side-by-side oscilloscope-style traces (CLASS 0 / CLASS 1).
// Vendored from synthetic-learningx58. Each panel shows: faint phosphor noisy x
// input, dashed target line, bright amber y_out(t) trace converging to target as
// "training progress" advances. The first-10-step blue band is the trigger pulse
// — the brief structured prelude in the call (mantis-shrimp snap, sperm-whale
// coda, orienting click) on which the network must base its verdict.
//
// Diegetically: the GARDENER bioacoustic intent classifier on the sub's onboard
// signal-processing chip. See science-log.js for the full lore.
//
// render(ctx, t, w, h, opts?)

import {
  PALETTE, mulberry32, hash01, lerp, clamp, smoothstep,
  clearBg, drawBezel, drawHeader, label, fmtStep,
} from './crt.js';

const PERIOD_MS = 13000;
const T_LEN = 100;
const FIRST_REGION = 10;
const SEED = 7777;

function buildContext(seed) {
  const rng = mulberry32(seed);
  const x0 = new Array(T_LEN);
  const x1 = new Array(T_LEN);
  for (let i = 0; i < T_LEN; i++) {
    x0[i] = (rng() - 0.5) * 0.6;
    x1[i] = (rng() - 0.5) * 0.6;
  }
  const target0 = -0.6;
  const target1 =  0.6;
  return { x0, x1, target0, target1 };
}

let _ctx = null;
function getCtx() {
  if (!_ctx) _ctx = buildContext(SEED);
  return _ctx;
}

function yOut(seqIndex, ti, p, target) {
  const settleT = lerp(20, 6, p);
  const ramp = 1 - Math.exp(-ti / settleT);
  const targetTrace = target * ramp;
  const noiseAmp = lerp(0.55, 0.04, p);
  const n = (hash01(seqIndex * 1009 + ti * 7 + (p * 1000) | 0) - 0.5) * 2 * noiseAmp;
  const messy = (hash01(seqIndex * 311 + ti * 13) - 0.5) * 1.2;
  const trace = lerp(messy, targetTrace, smoothstep(0, 1, p));
  return clamp(trace + n * (1 - p), -1.3, 1.3);
}

export function render(ctx, t, w, h, opts = {}) {
  const period = opts.period ?? PERIOD_MS;
  const phase = (t % period) / period;
  const trainP = clamp(phase / 0.85, 0, 1);
  const C = getCtx();

  clearBg(ctx, w, h, PALETTE.bg);

  const pad = 8;
  const headerH = 14;
  const step = ((trainP * 8000) | 0);

  drawHeader(ctx, pad, 2,
    `> TWO-SEQ-NOISE  STEP ${fmtStep(step, 4)}/8000  CONV: ${(trainP * 100).toFixed(0)}%`,
    PALETTE.amber, 10);

  const panelY = headerH + pad;
  const panelH = h - panelY - pad;
  const panelW = (w - pad * 3) / 2;

  drawPanel(ctx, pad, panelY, panelW, panelH, 'CLASS 0  ·  TRANSIT', C.x0, 0, C.target0, trainP);
  drawPanel(ctx, pad * 2 + panelW, panelY, panelW, panelH, 'CLASS 1  ·  HUNT', C.x1, 1, C.target1, trainP);

  drawBezel(ctx, w, h, PALETTE.amberDim);
}

function drawPanel(ctx, x, y, w, h, title, xSeq, seqIdx, target, p) {
  const innerY = y + 12;
  const innerH = h - 14;
  const yMin = -1.3, yMax = 1.3;
  const yToPx = (v) => innerY + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
  const tToPx = (ti) => x + (ti / (T_LEN - 1)) * w;

  label(ctx, x, y, title, PALETTE.greenDim, 9);

  ctx.strokeStyle = PALETTE.grayDim;
  ctx.strokeRect(x + 0.5, innerY + 0.5, w - 1, innerH - 1);

  // trigger-pulse band (first 10 steps)
  ctx.save();
  ctx.fillStyle = 'rgba(85,153,255,0.10)';
  const fx0 = tToPx(0), fx1 = tToPx(FIRST_REGION);
  ctx.fillRect(fx0, innerY, fx1 - fx0, innerH);
  ctx.restore();

  // zero baseline
  ctx.save();
  ctx.strokeStyle = PALETTE.grayDim;
  ctx.setLineDash([1, 3]);
  const zy = yToPx(0);
  ctx.beginPath(); ctx.moveTo(x, zy); ctx.lineTo(x + w, zy); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // faint phosphor input x trace
  ctx.save();
  ctx.strokeStyle = 'rgba(58,140,58,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ti = 0; ti < T_LEN; ti++) {
    const px = tToPx(ti);
    const py = yToPx(xSeq[ti]);
    if (ti === 0) ctx.moveTo(px, py);
    else          ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  // dashed target line
  ctx.save();
  ctx.strokeStyle = PALETTE.green;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  const ty = yToPx(target);
  ctx.beginPath(); ctx.moveTo(x, ty); ctx.lineTo(x + w, ty); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // bright amber y_out(t) — the convergence trace
  ctx.save();
  ctx.strokeStyle = PALETTE.amber;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let ti = 0; ti < T_LEN; ti++) {
    const v = yOut(seqIdx, ti, p, target);
    const px = tToPx(ti);
    const py = yToPx(v);
    if (ti === 0) ctx.moveTo(px, py);
    else          ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();

  label(ctx, x + w - 30, ty - 9, `tgt ${target.toFixed(1)}`, PALETTE.green, 8);
}

export default render;
