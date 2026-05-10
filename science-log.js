// science-log.js — Studies tab + GARDENER intro overlay.
//
// The Science Log modal has two top-level tabs: BESTIARY (the existing
// creature codex) and STUDIES (this module). Studies are unlockable lore
// panels — each one a live canvas viz on top of prose and a sample
// telemetry log. Currently one study: TWO-SEQ-NOISE / GARDENER, unlocked
// by the first containment intro.

import { render as renderTwoSeq } from './two-sequence.js';

const UNLOCK_KEY = 'dw-studies-unlocked';
const INTRO_SEEN_KEY = 'dw-gardener-intro-seen';

// ─── Study registry ──────────────────────────────────────────────────────

const STUDIES = [
  {
    id: 'two-seq-noise',
    num: '01',
    title: 'TWO-SEQ-NOISE',
    subtitle: 'BIOACOUSTIC INTENT CLASSIFIER',
    plate: 'MODEL: LSTM-1997  ·  TRAINED: 14·III·1997  ·  GARDENER  ·  3 BLOCKS × 2 CELLS  ·  σ=0.32',
    render: renderTwoSeq,
    lore: [
      `The panel is a bioacoustic intent classifier running on the sub's onboard signal-processing chip. It listens to the hydrophone tail, takes a 100-sample window, and decides whether what it just heard is one of two known classes for the creature currently held in contact. The amber trace converging toward a target line is the network "locking in" on a verdict. The faint phosphor waveform underneath is the raw hydrophone — it looks like noise to the operator, but the net hears structure.`,
      `The first-ten-timesteps blue band has a name in-fiction: the <em>trigger pulse</em> — the brief structured prelude in the call (the mantis-shrimp snap, the sperm-whale coda, the orienting click). The rest of the 100-sample window is contaminated by current shear, hull thrum, and reef chatter. The whole point of the architecture is "decide on the basis of evidence given long ago, ignore the noise that came after."`,
      `<strong>CLASS 0 / TRANSIT</strong> — the creature is just passing through. Hold fire.`,
      `<strong>CLASS 1 / HUNT</strong> — the creature has locked on. Possibly on you. Weapons free.`,
      `<strong>No convergence</strong> — trace stays in the middle. The signal is too noisy: the contact is too far, or the reef is too loud. Close to under 200m.`,
      `The acoustic suite was inherited from a Cold-War-era Soviet biologist-defector who trained binary classifiers on long-horizon cetacean recordings between 1989 and 1998. The output-gate biases are literally <span class="mono">−2, −4, −6</span> because that's what he wrote in his notebook. Every weird convergence behaviour the operator notices ("why does it always lean toward CLASS 0 at first?") is justified by the historical training regime.`,
    ],
    logs: [
      {
        title: 'CLEAN LOCK',
        lines: [
          '[14:22:11] SONAR    contact 047 / 8kt / -120m',
          '[14:22:14] GARDENER window armed',
          '[14:22:16] GARDENER trigger pulse +',
          '[14:22:19] GARDENER converging  +0.41',
          '[14:22:23] GARDENER lock  CLASS 1  hunt-state',
          '[14:22:24] CONN     weapons free',
        ],
      },
      {
        title: "WON'T CONVERGE",
        lines: [
          '[09:51:33] SONAR    contact 113 / low-band',
          '[09:51:39] GARDENER window armed',
          '[09:51:48] GARDENER no convergence  σ over margin',
          '[09:51:50] GARDENER recommend close to <200m',
          '[09:51:54] CONN     ride in',
        ],
      },
      {
        title: 'LATE REVISION (the one you remember)',
        lines: [
          '[02:14:06] GARDENER lock  CLASS 0  transit',
          '[02:14:21] SONAR    047 turning hot',
          '[02:14:24] CONN     GARDENER recheck',
          '[02:14:29] GARDENER -0.59 → +0.62 revising',
          '[02:14:31] CONN     too late',
        ],
      },
    ],
  },
];

// ─── Unlock state ────────────────────────────────────────────────────────

function loadUnlocked() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw));
  } catch (_) { return new Set(); }
}

function saveUnlocked(set) {
  try { localStorage.setItem(UNLOCK_KEY, JSON.stringify([...set])); } catch (_) {}
}

let _unlocked = loadUnlocked();

export function unlockStudy(id) {
  if (_unlocked.has(id)) return;
  _unlocked.add(id);
  saveUnlocked(_unlocked);
}

export function isStudyUnlocked(id) { return _unlocked.has(id); }

// ─── Viz canvas lifecycle ────────────────────────────────────────────────
// One module-level canvas + rAF loop. The render() target is whichever
// container is currently mounting it (intro overlay OR Studies viewer).
// Stop ticking when no container holds it.

let _vizCanvas = null;
let _vizCtx = null;
let _vizActive = null;       // current Study object whose render() to call
let _rafId = 0;
let _resizeObserver = null;

function ensureCanvas() {
  if (_vizCanvas) return _vizCanvas;
  _vizCanvas = document.createElement('canvas');
  _vizCanvas.className = 'study-viz-canvas';
  _vizCtx = _vizCanvas.getContext('2d');
  return _vizCanvas;
}

function fitCanvas() {
  if (!_vizCanvas || !_vizCanvas.parentElement) return;
  const parent = _vizCanvas.parentElement;
  const w = parent.clientWidth;
  // 16:9-ish but capped — viz reads best around 380px tall on desktop
  const h = Math.max(220, Math.min(380, Math.round(w * 0.42)));
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  _vizCanvas.style.width = w + 'px';
  _vizCanvas.style.height = h + 'px';
  _vizCanvas.width = Math.round(w * dpr);
  _vizCanvas.height = Math.round(h * dpr);
  _vizCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function vizLoop(tMs) {
  if (!_vizActive || !_vizCanvas || !_vizCanvas.isConnected) {
    _rafId = 0;
    return;
  }
  const cssW = parseInt(_vizCanvas.style.width, 10) || _vizCanvas.width;
  const cssH = parseInt(_vizCanvas.style.height, 10) || _vizCanvas.height;
  _vizActive.render(_vizCtx, tMs, cssW, cssH);
  _rafId = requestAnimationFrame(vizLoop);
}

function startViz(study, container) {
  ensureCanvas();
  if (_vizCanvas.parentElement !== container) {
    container.innerHTML = '';
    container.appendChild(_vizCanvas);
  }
  _vizActive = study;
  fitCanvas();
  if (!_resizeObserver) {
    _resizeObserver = new ResizeObserver(() => fitCanvas());
  }
  _resizeObserver.disconnect();
  if (_vizCanvas.parentElement) _resizeObserver.observe(_vizCanvas.parentElement);
  if (!_rafId) _rafId = requestAnimationFrame(vizLoop);
}

export function stopViz() {
  _vizActive = null;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = 0; }
  if (_resizeObserver) _resizeObserver.disconnect();
  if (_vizCanvas && _vizCanvas.parentElement) _vizCanvas.parentElement.removeChild(_vizCanvas);
}

// ─── HTML rendering ──────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function studyViewerHtml(study) {
  const loreHtml = study.lore.map(p => `<p>${p}</p>`).join('');
  const logsHtml = study.logs.map(l => `
    <div class="study-log">
      <div class="study-log-title">${escapeHtml(l.title)}</div>
      <pre class="study-log-body">${l.lines.map(escapeHtml).join('\n')}</pre>
    </div>
  `).join('');
  return `
    <div class="study-viewer">
      <div class="study-head">
        <div class="study-num">STUDY ${escapeHtml(study.num)}</div>
        <div class="study-title">${escapeHtml(study.title)}</div>
        <div class="study-sub">${escapeHtml(study.subtitle)}</div>
      </div>
      <div class="study-viz-mount" data-study-id="${escapeHtml(study.id)}"></div>
      <div class="study-plate">${escapeHtml(study.plate)}</div>
      <div class="study-lore">${loreHtml}</div>
      <div class="study-logs">${logsHtml}</div>
    </div>
  `;
}

// Render the Studies tab body into the given container.
// Currently the only unlocked study is shown directly. If nothing unlocked,
// shows a placeholder.
export function renderStudiesTab(container) {
  if (!container) return;
  const unlocked = STUDIES.filter(s => _unlocked.has(s.id));
  if (!unlocked.length) {
    stopViz();
    container.innerHTML = `
      <div class="studies-empty">
        // NO STUDIES DISCOVERED //<br>
        <span class="studies-empty-sub">narrative beats unlock entries here</span>
      </div>
    `;
    return;
  }
  // v1: only one study, show it directly. Later: card list → viewer.
  const study = unlocked[0];
  container.innerHTML = studyViewerHtml(study);
  const mount = container.querySelector('.study-viz-mount');
  if (mount) startViz(study, mount);
}

// ─── GARDENER intro overlay ──────────────────────────────────────────────

let _introEl = null;

function ensureIntroDom() {
  if (_introEl) return _introEl;
  _introEl = document.createElement('div');
  _introEl.id = 'gardener-intro-modal';
  _introEl.setAttribute('role', 'dialog');
  _introEl.setAttribute('aria-modal', 'true');
  _introEl.innerHTML = `
    <div class="gardener-intro-card">
      <div class="gardener-intro-banner">// SCIENCE LOG — NEW ENTRY UNLOCKED //</div>
      <div class="gardener-intro-body"></div>
      <div class="gardener-intro-actions">
        <button class="gardener-intro-proceed" type="button">PROCEED TO CONTAINMENT</button>
      </div>
    </div>
  `;
  document.body.appendChild(_introEl);
  return _introEl;
}

export function hasSeenGardenerIntro() {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch (_) { return false; }
}

function markGardenerIntroSeen() {
  try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch (_) {}
}

export function openGardenerIntro(onProceed) {
  unlockStudy('two-seq-noise');
  const el = ensureIntroDom();
  const body = el.querySelector('.gardener-intro-body');
  const proceedBtn = el.querySelector('.gardener-intro-proceed');
  body.innerHTML = studyViewerHtml(STUDIES[0]);
  el.classList.add('open');
  const mount = body.querySelector('.study-viz-mount');
  if (mount) startViz(STUDIES[0], mount);

  const close = (ev) => {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    el.classList.remove('open');
    stopViz();
    markGardenerIntroSeen();
    proceedBtn.removeEventListener('pointerdown', close);
    if (typeof onProceed === 'function') onProceed();
  };
  proceedBtn.addEventListener('pointerdown', close);
}

export function isGardenerIntroOpen() {
  return _introEl && _introEl.classList.contains('open');
}
