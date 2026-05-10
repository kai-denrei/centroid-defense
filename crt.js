// crt.js — shared CRT-aesthetic helpers for canvas viz panels.
// Vendored from synthetic-learningx58 with palette harmonized to the
// centroid-defense amber/phosphor CSS theme.
// No state, no allocations in hot loops where avoidable.

export const PALETTE = {
  bg:        '#000000',
  bgDim:     '#050505',
  green:     '#88ff88',  // p-hot — used for target line
  greenDim:  '#3a8c3a',  // p-mid
  amber:     '#ffaa44',  // matches --amber — convergence trace + headers
  amberDim:  '#6b4818',  // matches --amber-dim
  red:       '#ff3322',  // matches --red
  redDim:    '#7a1f12',
  blue:      '#5599ff',  // trigger-pulse band — kept blue as a deliberate
  blueDim:   '#23457a',  // foreign-system tell, per the GARDENER lore
  gray:      '#3a8c3a',  // re-mapped to phosphor green dim — noise trace
  grayDim:   '#0f2c0f',  // matches --p-dim — frame/baseline
  white:     '#e0e0e0',
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash01(n) {
  let x = (n | 0) ^ 0x9E3779B9;
  x = Math.imul(x ^ (x >>> 16), 0x85EBCA6B);
  x = Math.imul(x ^ (x >>> 13), 0xC2B2AE35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (x, lo, hi) => x < lo ? lo : x > hi ? hi : x;
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function applyScanlines(ctx, w, h, opts = {}) {
  const alpha = opts.alpha ?? 0.18;
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  for (let y = 0; y < h; y += 2) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

export function drawBezel(ctx, w, h, color = PALETTE.greenDim) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.restore();
}

export function drawHeader(ctx, x, y, text, color = PALETTE.green, size = 10) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function label(ctx, x, y, text, color = PALETTE.gray, size = 9, baseline = 'top') {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function clearBg(ctx, w, h, color = PALETTE.bg) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export function fmtStep(n, width = 4) {
  const s = String(n | 0);
  return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}
