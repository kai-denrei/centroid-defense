// hud.js — DOM updates for HUD chrome. The scope canvas is sacred; this file
// only touches HTML elements outside it.

// All ES module imports must live at the top of the file (browsers parse
// strictly even though Node hoists). The codex modal needs the bestiary.
import { BESTIARY } from './bestiary.js';
import { renderStudiesTab, stopViz } from './science-log.js';

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
  dom.codexTabs = $('codex-tabs');
  // Science Log top-level tabs (BESTIARY | STUDIES)
  dom.scienceTabs = $('science-tabs');
  dom.scienceBestiaryPane = $('science-bestiary-pane');
  dom.scienceStudiesPane = $('science-studies-pane');
  dom.studiesBody = $('studies-body');
  dom.scienceFooter = $('science-footer');
  dom.bestiaryDetail = $('bestiary-detail');
  dom.bestiaryDetailImg = $('bestiary-detail-img');
  dom.bestiaryDetailSpec = $('bestiary-detail-spec');
  dom.bestiaryDetailTaxon = $('bestiary-detail-taxon');
  dom.bestiaryDetailMeta = $('bestiary-detail-meta');
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

// CODEX MODAL — tabbed bestiary view.
// 5 category tabs at top. Active tab shown in the body. Active tab persisted
// to localStorage. Each entry: thumb + taxon + stats + abilities + specimen
// description + clinical field-note. Locked entries silhouette the thumb
// and stub the text.
const CATEGORY_LABELS = {
  pelagic: 'PELAGIC',
  benthic: 'BENTHIC',
  swarm: 'SWARM',
  apex: 'APEX',
  specialist: 'SPECIALIST',
};
const CATEGORY_ORDER = ['pelagic', 'benthic', 'swarm', 'apex', 'specialist'];
const STORAGE_KEY = 'dw-codex-tab';

let _activeTab = 'pelagic';
let _lastCodex = null;

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Format threat for the tier color class — same hierarchy as before.
function threatClass(t) { return ['low', 'medium', 'high', 'apex'].includes(t) ? t : 'medium'; }

// Each species' source PNG was numbered 01..19; that prefix maps to a stable
// SPEC.nn caption. Since the numbers parallel BESTIARY's array order, we use
// (index + 1) zero-padded to 2.
function specNumFor(speciesId) {
  const idx = BESTIARY.findIndex(s => s.id === speciesId);
  if (idx < 0) return '??';
  return String(idx + 1).padStart(2, '0');
}

export function renderCodex(codex) {
  if (!dom.codexBody || !dom.codexTabs) return;
  _lastCodex = codex;
  // restore last tab
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CATEGORY_ORDER.includes(saved)) _activeTab = saved;
  } catch (_) {}
  // tabs
  dom.codexTabs.innerHTML = CATEGORY_ORDER.map(cat => {
    const active = cat === _activeTab ? 'active' : '';
    return `<button class="codex-tab ${active}" data-cat="${cat}" type="button" role="tab" aria-selected="${cat === _activeTab}">${CATEGORY_LABELS[cat]}</button>`;
  }).join('');
  // body — one tab's entries
  renderCodexBody();
  // wire tab clicks (delegated)
  dom.codexTabs.querySelectorAll('.codex-tab').forEach(btn => {
    btn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const cat = btn.getAttribute('data-cat');
      if (!cat || cat === _activeTab) return;
      _activeTab = cat;
      try { localStorage.setItem(STORAGE_KEY, cat); } catch (_) {}
      // update tab UI without rebuilding whole modal
      dom.codexTabs.querySelectorAll('.codex-tab').forEach(b => {
        const a = b.getAttribute('data-cat') === cat;
        b.classList.toggle('active', a);
        b.setAttribute('aria-selected', a ? 'true' : 'false');
      });
      renderCodexBody();
    });
  });
}

function renderCodexBody() {
  const codex = _lastCodex || {};
  const entries = BESTIARY.filter(sp => sp.category === _activeTab);
  if (!entries.length) {
    dom.codexBody.innerHTML = '<div style="color:var(--p-dim);padding:20px;text-align:center;letter-spacing:0.18em">// NO ENTRIES IN THIS TIER //</div>';
    return;
  }
  dom.codexBody.innerHTML = entries.map(sp => renderEntry(sp, codex[sp.id] || 0)).join('');
  dom.codexBody.scrollTop = 0;
  // wire detail-lightbox: thumb on unlocked entry → open detail viewer
  dom.codexBody.querySelectorAll('.entry:not(.locked) .thumb').forEach(img => {
    img.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = img.getAttribute('data-species-id');
      if (id) openBestiaryDetail(id);
    });
  });
}

function renderEntry(sp, kills) {
  const locked = kills === 0;
  const thumbSrc = `bestiary-img/thumb/${sp.id}.webp`;
  const specNum = specNumFor(sp.id);
  // thumb cell — image + spec caption (or stub if image fails)
  const thumbHtml = `<div class="thumb-cell">
    <img class="thumb" loading="lazy" decoding="async" src="${thumbSrc}" alt="${escapeHtml(sp.genus + ' ' + sp.species)}"
         data-species-id="${sp.id}"
         onerror="this.outerHTML='<div class=&quot;thumb-stub&quot;>// IMG<br>PENDING</div>';" />
    <span class="spec-num">// SPEC.${specNum}${locked ? ' · UNCATALOGUED' : ''}</span>
  </div>`;
  // text block
  const stats = locked
    ? '<span class="lbl">HP</span> — · <span class="lbl">WT</span> — · <span class="lbl">SPD</span> — · <span class="lbl">BIO</span> — · <span class="lbl">THREAT</span> ?? · <span class="blip-swatch" style="background:transparent"></span>'
    : `HP ${sp.hp} · WT ${sp.weight} · SPD ${sp.speed} · BIO ${sp.biomass} · THREAT ${sp.threat.toUpperCase()} · <span class="blip-swatch" style="background:${sp.blipColor}"></span>`;
  const abilHtml = (!locked && sp.abilities && sp.abilities.length)
    ? `<div class="abil">▸ ${sp.abilities.map(a => a.toUpperCase().replace(/-/g, ' ')).join(' · ')}</div>`
    : '<div class="abil"></div>';
  const desc = locked
    ? '<span class="label">▶ SPECIMEN:</span> // SPECIMEN PHOTOGRAPH PENDING — SUBMIT FIRST KILL FOR FULL CATALOGUE ENTRY'
    : `<span class="label">▶ SPECIMEN:</span> ${escapeHtml(sp.description || '—')}`;
  const note = locked
    ? '<span class="label">▶ FIELD NOTE:</span> // CONTACT NOT YET CATALOGUED — STRIKE ONE TO UNLOCK'
    : `<span class="label">▶ FIELD NOTE:</span> ${escapeHtml(sp.note)}`;
  return `<div class="entry ${locked ? 'locked' : ''}">
    ${thumbHtml}
    <div class="taxon"><span class="genus">${escapeHtml(sp.genus)}</span> <span class="species">${escapeHtml(sp.species)}</span></div>
    <div class="meta">${escapeHtml(sp.class)} · ${escapeHtml(sp.scale)}</div>
    <div class="threat ${threatClass(sp.threat)}">${sp.threat.toUpperCase()}</div>
    <div class="kills">${locked ? '— LOCKED —' : `${kills} KILLED`}</div>
    <div class="stats">${stats}</div>
    ${abilHtml}
    <div class="desc">${desc}</div>
    <div class="note">${note}</div>
  </div>`;
}

// ── SCIENCE LOG top-level tab switching ──────────────────────────────
// Two top tabs: BESTIARY (the existing creature codex) and STUDIES (lore
// panels with live viz). Footer text swaps per tab. Clicks wired once
// during initHUD-time setup; pane visibility toggled by adding/removing
// `.hide`. The Studies viz canvas only ticks while its pane is visible.
const SCIENCE_TAB_KEY = 'dw-science-tab';
const FOOTER_TEXT = {
  bestiary: 'SPECIES UNLOCK ON FIRST KILL · BIOMASS RETURNS PER UNIT VARIES BY MASS',
  studies:  'STUDIES UNLOCK AT NARRATIVE BEATS · CLASSIFIED ENTRIES REMAIN REDACTED',
};
let _activeSciencePane = 'bestiary';

function applySciencePane(pane, codex) {
  _activeSciencePane = pane;
  // tab pills
  if (dom.scienceTabs) {
    dom.scienceTabs.querySelectorAll('.science-tab').forEach(b => {
      const a = b.getAttribute('data-pane') === pane;
      b.classList.toggle('active', a);
      b.setAttribute('aria-selected', a ? 'true' : 'false');
    });
  }
  // panes
  if (dom.scienceBestiaryPane) dom.scienceBestiaryPane.classList.toggle('hide', pane !== 'bestiary');
  if (dom.scienceStudiesPane)  dom.scienceStudiesPane.classList.toggle('hide', pane !== 'studies');
  // footer copy
  if (dom.scienceFooter) dom.scienceFooter.textContent = FOOTER_TEXT[pane] || FOOTER_TEXT.bestiary;
  // pane content
  if (pane === 'bestiary') {
    stopViz();                                     // release the canvas rAF
    renderCodex(codex || _lastCodex || {});
  } else {
    renderStudiesTab(dom.studiesBody);
  }
  try { localStorage.setItem(SCIENCE_TAB_KEY, pane); } catch (_) {}
}

function ensureScienceTabsWired() {
  if (!dom.scienceTabs || dom.scienceTabs._wired) return;
  dom.scienceTabs._wired = true;
  dom.scienceTabs.querySelectorAll('.science-tab').forEach(btn => {
    btn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault(); ev.stopPropagation();
      const pane = btn.getAttribute('data-pane');
      if (!pane || pane === _activeSciencePane) return;
      applySciencePane(pane, _lastCodex);
    });
  });
}

// Open / close handlers — caller wires the button events to these.
export function openCodex(codex) {
  ensureScienceTabsWired();
  // restore last-used top tab
  try {
    const saved = localStorage.getItem(SCIENCE_TAB_KEY);
    if (saved === 'bestiary' || saved === 'studies') _activeSciencePane = saved;
  } catch (_) {}
  _lastCodex = codex;
  applySciencePane(_activeSciencePane, codex);
  dom.codexModal.classList.remove('hide');
}
export function closeCodex() {
  dom.codexModal.classList.add('hide');
  stopViz();                              // release the studies canvas rAF
  closeBestiaryDetail();   // also dismiss any stacked lightbox
}

// Detail-image lightbox — opens above the codex modal when an unlocked thumb
// is clicked. Loads the higher-resolution detail webp (~80KB). Close on
// backdrop / X / ESC.
export function openBestiaryDetail(speciesId) {
  const sp = BESTIARY.find(s => s.id === speciesId);
  if (!sp || !dom.bestiaryDetail) return;
  const detailSrc = `bestiary-img/detail/${sp.id}.webp`;
  dom.bestiaryDetailImg.src = detailSrc;
  dom.bestiaryDetailImg.alt = `${sp.genus} ${sp.species} — specimen plate`;
  dom.bestiaryDetailImg.onerror = () => {
    dom.bestiaryDetailImg.style.display = 'none';
  };
  dom.bestiaryDetailImg.style.display = '';
  dom.bestiaryDetailSpec.textContent = `// SPECIMEN PLATE · SPEC.${specNumFor(sp.id)}`;
  dom.bestiaryDetailTaxon.innerHTML = `<span class="genus">${escapeHtml(sp.genus)}</span> <span class="species">${escapeHtml(sp.species)}</span>`;
  dom.bestiaryDetailMeta.textContent = `${sp.class} · ${sp.scale}`;
  dom.bestiaryDetail.classList.remove('hide');
}

export function closeBestiaryDetail() {
  if (!dom.bestiaryDetail) return;
  dom.bestiaryDetail.classList.add('hide');
}

export function isBestiaryDetailOpen() {
  return dom.bestiaryDetail && !dom.bestiaryDetail.classList.contains('hide');
}

// Resolve a wave's headliner species data — for binomial display in topbar/log.
export function speciesById(id) { return BESTIARY.find(s => s.id === id); }

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
export function showWaveEndcard({
  wave, name, binomial, strikesUsed, strikeBudget, accuracyPct,
  hits, inRadius,
  strikeKills, strikeBiomass, droneKills, droneBiomass,
  biomassEarned, biomassTotal, integrity, allDestroyed,
}) {
  dom.endcardTitle.textContent = allDestroyed
    ? `WAVE ${wave} COMPLETE`
    : `WAVE ${wave} — RIG INTEGRITY CRITICAL`;
  dom.endcardTitle.className = (!allDestroyed || integrity <= 25) ? 'crit' : '';
  dom.endcardTable.style.display = 'none';
  dom.endcardStats.innerHTML = '';
  if (binomial) appendStatHTML('SPECIES', `<span style="color:var(--p-hot);font-style:italic">${binomial}</span>`);
  appendStat('ARCHETYPE', name || '—');
  appendStat('STRIKES USED', `${strikesUsed} / ${strikeBudget}`);
  // Kill breakdown — strike vs automated point-defense (drones + rig).
  const sk = strikeKills || 0, sb = strikeBiomass || 0;
  const dk = droneKills || 0, db = droneBiomass || 0;
  appendStatHTML('KILLED BY STRIKES',
    `<span style="color:var(--amber)">${sk}</span> · <span style="color:var(--p-hot)">+${sb}</span> BIO`);
  appendStatHTML('KILLED BY DRONES',
    `<span style="color:var(--p-hot)">${dk}</span> · <span style="color:var(--p-hot)">+${db}</span> BIO`);
  appendStatHTML('STRIKE ACCURACY', hitsCellHtml(sk, inRadius || 0));
  appendStat('BEST ACCURACY', accuracyPct == null ? '—' : `${Math.round(accuracyPct)}%`);
  appendStatHTML('BIOMASS THIS WAVE', `<span style="color:var(--p-hot)">+${biomassEarned || 0}</span> · TOTAL <span style="color:var(--p-hot)">${biomassTotal || 0}</span>`);
  appendStat('RIG INTEGRITY', `${Math.round(integrity)}%`);
  dom.endcardPrompt.textContent = '[SPACE] PREPARATION PHASE';
  dom.endcard.classList.add('show');
}

export function showRunCompleteCard({ runStats, integrity }) {
  dom.endcardTitle.textContent = 'EXTRACTION SECURED — DEEPWATCH OPS NOMINAL';
  dom.endcardTitle.className = '';
  dom.endcardStats.innerHTML = '';
  appendStat('FINAL RIG INTEGRITY', `${Math.round(integrity)}%`);
  const totalStrikeKills = runStats.waves.reduce((s, w) => s + (w.strikeKills || 0), 0);
  const totalDroneKills = runStats.waves.reduce((s, w) => s + (w.droneKills || 0), 0);
  const totalInRadius = runStats.waves.reduce((s, w) => s + (w.inRadius || 0), 0);
  const totalStrikeBio = runStats.waves.reduce((s, w) => s + (w.strikeBiomass || 0), 0);
  const totalDroneBio = runStats.waves.reduce((s, w) => s + (w.droneBiomass || 0), 0);
  const totalBiomass = totalStrikeBio + totalDroneBio;
  appendStatHTML('STRIKE KILLS (RUN)',
    `<span style="color:var(--amber)">${totalStrikeKills}</span> · <span style="color:var(--p-hot)">+${totalStrikeBio}</span> BIO`);
  appendStatHTML('DRONE KILLS (RUN)',
    `<span style="color:var(--p-hot)">${totalDroneKills}</span> · <span style="color:var(--p-hot)">+${totalDroneBio}</span> BIO`);
  appendStatHTML('STRIKE ACCURACY (RUN)', hitsCellHtml(totalStrikeKills, totalInRadius));
  appendStatHTML('TOTAL BIOMASS (RUN)', `<span style="color:var(--p-hot)">${totalBiomass}</span>`);
  // summary table
  const tbl = dom.endcardTable;
  tbl.style.display = '';
  tbl.innerHTML = `
    <thead><tr>
      <th>WAVE</th><th>SPECIES</th><th>STRIKES</th><th>STRIKE K</th><th>DRONE K</th><th>BEST ACC.</th><th>BIOMASS</th>
    </tr></thead>
    <tbody>
      ${runStats.waves.map(w => `<tr>
        <td>${w.wave}</td>
        <td style="font-style:italic">${w.binomial || w.name}</td>
        <td>${w.strikesUsed}/${w.budget}</td>
        <td><span style="color:var(--amber)">${w.strikeKills || 0}</span></td>
        <td><span style="color:var(--p-hot)">${w.droneKills || 0}</span></td>
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
