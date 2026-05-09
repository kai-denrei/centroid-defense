// hud.js — DOM updates for HUD chrome. The scope canvas is sacred; this file
// only touches HTML elements outside it.

const dom = {};
function $(id) { return document.getElementById(id); }

export function initHUD() {
  dom.waveNum = $('wave-num');
  dom.waveNumShort = $('wave-num-short');
  dom.missionTime = $('mission-time');
  dom.missionTimeShort = $('mission-time-short');
  dom.ordPips = $('ord-pips');
  dom.ordStatus = $('ord-status');
  dom.integrityFill = $('integrity-fill');
  dom.integrityReadout = $('integrity-readout');
  dom.contactCount = $('contact-count');
  dom.strikesUsed = $('strikes-used');
  dom.log = $('log');
  dom.endcard = $('endcard');
  dom.endcardTitle = $('endcard-title');
  dom.endcardStats = $('endcard-stats');
  dom.endcardTable = $('endcard-table');
  dom.endcardPrompt = $('endcard-prompt');
  dom.intro = $('intro');
  // v2 biomass + codex
  dom.biomassVal = $('biomass-val');
  dom.codexBtn = $('codex-btn');
  dom.codexModal = $('codex-modal');
  dom.codexClose = $('codex-close');
  dom.codexBody = $('codex-body');
}

export function updateHUD(state) {
  const waveTxt = state.wave > 0 ? String(state.wave) : '—';
  dom.waveNum.textContent = waveTxt;
  if (dom.waveNumShort) dom.waveNumShort.textContent = waveTxt;

  // mission clock — runStartTime base, MM:SS
  const elapsed = state.runStartTime ? Math.floor(performance.now() / 1000 - state.runStartTime) : 0;
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  dom.missionTime.textContent = `T+${m}:${s}`;
  if (dom.missionTimeShort) dom.missionTimeShort.textContent = `${m}:${s}`;

  // integrity bar
  const integ = Math.max(0, Math.min(100, state.rigIntegrity));
  dom.integrityFill.style.height = `${integ}%`;
  dom.integrityReadout.textContent = `${Math.round(integ)}%`;
  let cls = '';
  if (integ <= 25) cls = 'crit';
  else if (integ <= 55) cls = 'warn';
  dom.integrityFill.className = cls;
  dom.integrityReadout.className = cls;

  // contact count
  const live = state.contacts.filter(c => c.alive).length;
  dom.contactCount.textContent = String(live);
  dom.strikesUsed.textContent = String(state.runStats.totalStrikes);
  // v2 biomass
  if (dom.biomassVal) dom.biomassVal.textContent = String(state.biomass || 0);
}

// CODEX MODAL — render the bestiary grouped by category.
// Locked entries (zero kills) show category + threat tier + a "not yet
// catalogued" stub. Unlocked entries fill in the full clinical note.
import { BESTIARY } from './bestiary.js';
const CATEGORY_HEADS = {
  pelagic: 'PELAGIC · MID-WATER',
  benthic: 'BENTHIC · BOTTOM-DWELLING',
  swarm: 'SWARM · MICRO-FAUNA',
  apex: 'APEX · MEGAFAUNA',
  specialist: 'SPECIALIST · IRREGULAR',
};
const CATEGORY_ORDER = ['pelagic', 'benthic', 'swarm', 'apex', 'specialist'];

export function renderCodex(codex) {
  if (!dom.codexBody) return;
  const groups = {};
  for (const sp of BESTIARY) (groups[sp.category] ||= []).push(sp);
  const out = [];
  for (const cat of CATEGORY_ORDER) {
    if (!groups[cat]) continue;
    out.push(`<div class="group-head">${CATEGORY_HEADS[cat]}</div>`);
    for (const sp of groups[cat]) {
      const kills = (codex && codex[sp.id]) || 0;
      const locked = kills === 0;
      out.push(`<div class="entry ${locked ? 'locked' : ''}">
        <div>
          <div class="taxon"><span class="genus">${sp.genus}</span> <span class="species">${sp.species}</span></div>
          <div class="meta">${sp.class} · ${sp.scale} · BIOMASS ${sp.biomass}</div>
        </div>
        <div>
          <div class="threat ${sp.threat}">${sp.threat.toUpperCase()}</div>
          <div class="kills">${locked ? '— LOCKED —' : `${kills} KILLED`}</div>
        </div>
        <div class="note">${locked ? '// CONTACT NOT YET CATALOGUED — STRIKE ONE TO UNLOCK' : sp.note}</div>
      </div>`);
    }
  }
  dom.codexBody.innerHTML = out.join('');
}

// Open / close handlers — caller wires the button events to these.
export function openCodex(codex) {
  renderCodex(codex);
  dom.codexModal.classList.remove('hide');
}
export function closeCodex() {
  dom.codexModal.classList.add('hide');
}

// Rebuild the ordnance pips with charging-aware visualization.
// budget   — total strikes for the wave (== total pips)
// ready    — fully-armed orbital assets, glowing solid
// reserved — queued, waiting their turn; the next-up one shows a charging fill
// gauge    — 0..1, fills the next-reserved pip
// Used count = budget - ready - reserved - inFlight (computed from filled.length)
export function setOrdnance(budget, ready, reserved, gauge) {
  while (dom.ordPips.children.length > 1) dom.ordPips.removeChild(dom.ordPips.lastChild);
  // pip order (left → right): used … in-flight … ready … charging-next … reserved …
  // We don't know in-flight here directly, but ready+reserved+(budget-ready-reserved-?) = used.
  // Treat the first (budget - ready - reserved) pips as USED/IN-FLIGHT (hollow), then
  // 1 pip CHARGING (if reserved>0 and gauge>0), then remaining RESERVED (faint outline),
  // then ready as SOLID. To keep it simple visually:
  const used = budget - ready - reserved;
  for (let i = 0; i < budget; i++) {
    const p = document.createElement('span');
    p.className = 'pip';
    if (i < used) {
      p.classList.add('spent');
    } else if (i < used + ready) {
      // ready / armed
      p.classList.add('ready');
    } else if (i === used + ready && reserved > 0) {
      // currently charging slot — show inline fill
      p.classList.add('charging');
      const fill = document.createElement('span');
      fill.className = 'charge-fill';
      fill.style.height = `${Math.round(Math.max(0, Math.min(1, gauge)) * 100)}%`;
      p.appendChild(fill);
    } else {
      p.classList.add('reserved');
    }
    dom.ordPips.appendChild(p);
  }
  // status line
  if (dom.ordStatus) {
    let txt;
    if (ready > 0) txt = `ARMED · ${ready}`;
    else if (reserved > 0) txt = `ORBIT ${Math.round(gauge * 100)}%`;
    else txt = `STANDBY`;
    dom.ordStatus.textContent = txt;
    dom.ordStatus.className = 'status' + (ready > 0 ? ' armed' : '');
  }
}

// Visual nudge: out-of-bounds tap flickers the ordnance pips (no commit).
export function flickerOrdnance() {
  const pips = dom.ordPips.querySelectorAll('.pip');
  pips.forEach(p => {
    p.classList.remove('flicker');
    void p.offsetWidth;     // restart anim
    p.classList.add('flicker');
  });
}

// Append a status log line. Voice register = clinical, military-industrial.
// MAX_LINES sized to fit the visible comms-pane height (cam shares the strip).
const MAX_LINES = 7;
export function logLine(text, opts = {}) {
  const line = document.createElement('div');
  line.className = 'line fresh' + (opts.crit ? ' crit' : '');
  line.textContent = text;
  dom.log.appendChild(line);
  while (dom.log.children.length > MAX_LINES) dom.log.removeChild(dom.log.firstChild);
  // unfreshen older lines after a tick so the newest is brightest
  requestAnimationFrame(() => {
    [...dom.log.children].forEach((l, i, arr) => {
      if (i < arr.length - 1) l.classList.remove('fresh');
    });
  });
}

export function clearLog() {
  while (dom.log.firstChild) dom.log.removeChild(dom.log.firstChild);
}

// Format helpers for the log voice register
export function fmtTime(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `T+${m}:${s}`;
}
export function fmtBearing(b) {
  // b is radians, 0 = north, increasing clockwise
  let deg = (b * 180 / Math.PI + 360) % 360;
  return String(Math.round(deg)).padStart(3, '0');
}
export function fmtRange(px) {
  // map px to a fictitious meters scale: 320px scope edge ≈ 2400m
  return String(Math.round(px / 320 * 2400)).padStart(4, '0');
}

// Hit-tier color matches the cam impact stamp (FULL/PARTIAL/GLANCING).
function hitsCellHtml(hits, inRadius) {
  if (!inRadius) return '<span style="color:var(--p-mid)">—</span>';
  const pct = hits / inRadius;
  let color = 'var(--red)';
  if (pct >= 0.999) color = '#88e0ff';
  else if (pct >= 0.5) color = 'var(--amber)';
  return `<span style="color:${color}">${hits}/${inRadius} (${Math.round(pct * 100)}%)</span>`;
}

// ENDCARD — wave end, run complete, game over.
export function showWaveEndcard({ wave, name, strikesUsed, strikeBudget, accuracyPct, hits, inRadius, biomassEarned, biomassTotal, integrity, allDestroyed }) {
  dom.endcardTitle.textContent = allDestroyed
    ? `WAVE ${wave} COMPLETE`
    : `WAVE ${wave} — RIG INTEGRITY CRITICAL`;
  dom.endcardTitle.className = (!allDestroyed || integrity <= 25) ? 'crit' : '';
  dom.endcardTable.style.display = 'none';
  dom.endcardStats.innerHTML = '';
  appendStat('ARCHETYPE', name || '—');
  appendStat('STRIKES USED', `${strikesUsed} / ${strikeBudget}`);
  appendStatHTML('TOTAL HITS', hitsCellHtml(hits || 0, inRadius || 0));
  appendStat('BEST ACCURACY', accuracyPct == null ? '—' : `${Math.round(accuracyPct)}%`);
  appendStatHTML('BIOMASS COLLECTED', `<span style="color:var(--p-hot)">+${biomassEarned || 0}</span> · TOTAL <span style="color:var(--p-hot)">${biomassTotal || 0}</span>`);
  appendStat('RIG INTEGRITY', `${Math.round(integrity)}%`);
  dom.endcardPrompt.textContent = '[SPACE] CONTINUE';
  dom.endcard.classList.add('show');
}

export function showRunCompleteCard({ runStats, integrity }) {
  dom.endcardTitle.textContent = 'EXTRACTION SECURED — DEEPWATCH OPS NOMINAL';
  dom.endcardTitle.className = '';
  dom.endcardStats.innerHTML = '';
  appendStat('FINAL RIG INTEGRITY', `${Math.round(integrity)}%`);
  const totalHits = runStats.waves.reduce((s, w) => s + (w.hits || 0), 0);
  const totalInRadius = runStats.waves.reduce((s, w) => s + (w.inRadius || 0), 0);
  appendStatHTML('TOTAL HITS (RUN)', hitsCellHtml(totalHits, totalInRadius));
  const totalBiomass = runStats.waves.reduce((s, w) => s + (w.biomass || 0), 0);
  appendStatHTML('TOTAL BIOMASS (RUN)', `<span style="color:var(--p-hot)">${totalBiomass}</span>`);
  // summary table
  const tbl = dom.endcardTable;
  tbl.style.display = '';
  tbl.innerHTML = `
    <thead><tr>
      <th>WAVE</th><th>ARCHETYPE</th><th>STRIKES</th><th>HITS</th><th>BEST ACC.</th><th>BIOMASS</th>
    </tr></thead>
    <tbody>
      ${runStats.waves.map(w => `<tr>
        <td>${w.wave}</td>
        <td>${w.name}</td>
        <td>${w.strikesUsed}/${w.budget}</td>
        <td>${hitsCellHtml(w.hits || 0, w.inRadius || 0)}</td>
        <td>${w.bestAcc == null ? '—' : Math.round(w.bestAcc) + '%'}</td>
        <td style="color:var(--p-hot)">+${w.biomass || 0}</td>
      </tr>`).join('')}
    </tbody>`;
  dom.endcardPrompt.textContent = '[SPACE] NEW RUN';
  dom.endcard.classList.add('show');
}

export function showGameOverCard({ wave, runStats }) {
  dom.endcardTitle.textContent = `RIG LOST — WAVE ${wave}`;
  dom.endcardTitle.className = 'crit';
  dom.endcardStats.innerHTML = '';
  appendStat('WAVES CLEARED', String(runStats.wavesCleared));
  appendStat('STRIKES USED (RUN)', String(runStats.totalStrikes));
  dom.endcardTable.style.display = 'none';
  dom.endcardPrompt.textContent = '[SPACE] NEW RUN';
  dom.endcard.classList.add('show');
}

export function hideEndcard() { dom.endcard.classList.remove('show'); }

export function hideIntro() { dom.intro.classList.add('hide'); }
export function showIntro() { dom.intro.classList.remove('hide'); }

function appendStat(label, val) {
  const a = document.createElement('div'); a.className = 'label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 'val'; b.textContent = val;
  dom.endcardStats.appendChild(a);
  dom.endcardStats.appendChild(b);
}
function appendStatHTML(label, html) {
  const a = document.createElement('div'); a.className = 'label'; a.textContent = label;
  const b = document.createElement('div'); b.className = 'val'; b.innerHTML = html;
  dom.endcardStats.appendChild(a);
  dom.endcardStats.appendChild(b);
}
