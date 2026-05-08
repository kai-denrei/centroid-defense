// hud.js — DOM updates for HUD chrome. The scope canvas is sacred; this file
// only touches HTML elements outside it.

const dom = {};
function $(id) { return document.getElementById(id); }

export function initHUD() {
  dom.waveNum = $('wave-num');
  dom.missionTime = $('mission-time');
  dom.ordPips = $('ord-pips');
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
}

export function updateHUD(state) {
  if (state.wave > 0) dom.waveNum.textContent = String(state.wave);
  else dom.waveNum.textContent = '—';

  // mission clock — runStartTime base, MM:SS
  const elapsed = state.runStartTime ? Math.floor(performance.now() / 1000 - state.runStartTime) : 0;
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  dom.missionTime.textContent = `T+${m}:${s}`;

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
}

// Rebuild the ordnance pips for the current wave's budget. Spent = hollow pip.
export function setOrdnance(budget, remaining) {
  // keep label, replace pips
  while (dom.ordPips.children.length > 1) dom.ordPips.removeChild(dom.ordPips.lastChild);
  for (let i = 0; i < budget; i++) {
    const p = document.createElement('span');
    p.className = 'pip' + (i < (budget - remaining) ? ' spent' : '');
    dom.ordPips.appendChild(p);
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

// ENDCARD — wave end, run complete, game over.
export function showWaveEndcard({ wave, name, strikesUsed, strikeBudget, accuracyPct, integrity, allDestroyed }) {
  dom.endcardTitle.textContent = allDestroyed
    ? `WAVE ${wave} COMPLETE`
    : `WAVE ${wave} — RIG INTEGRITY CRITICAL`;
  dom.endcardTitle.className = (!allDestroyed || integrity <= 25) ? 'crit' : '';
  dom.endcardTable.style.display = 'none';
  dom.endcardStats.innerHTML = '';
  appendStat('ARCHETYPE', name || '—');
  appendStat('STRIKES USED', `${strikesUsed} / ${strikeBudget}`);
  appendStat('BEST ACCURACY', accuracyPct == null ? '—' : `${Math.round(accuracyPct)}%`);
  appendStat('RIG INTEGRITY', `${Math.round(integrity)}%`);
  dom.endcardPrompt.textContent = '[SPACE] CONTINUE';
  dom.endcard.classList.add('show');
}

export function showRunCompleteCard({ runStats, integrity }) {
  dom.endcardTitle.textContent = 'EXTRACTION SECURED — DEEPWATCH OPS NOMINAL';
  dom.endcardTitle.className = '';
  dom.endcardStats.innerHTML = '';
  appendStat('FINAL RIG INTEGRITY', `${Math.round(integrity)}%`);
  // summary table
  const tbl = dom.endcardTable;
  tbl.style.display = '';
  tbl.innerHTML = `
    <thead><tr>
      <th>WAVE</th><th>ARCHETYPE</th><th>STRIKES</th><th>BEST ACC.</th>
    </tr></thead>
    <tbody>
      ${runStats.waves.map(w => `<tr>
        <td>${w.wave}</td>
        <td>${w.name}</td>
        <td>${w.strikesUsed}/${w.budget}</td>
        <td>${w.bestAcc == null ? '—' : Math.round(w.bestAcc) + '%'}</td>
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
