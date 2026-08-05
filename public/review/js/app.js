/* ============================================================================
 * app.js — UI, state, sorting, filtering
 * ==========================================================================*/

import { ingestFile } from './parser.js';
import { evaluate, DEFAULT_THRESHOLDS, SCORE_LABELS, CATALOGUE } from './criteria.js';
import * as store from './store.js';
import { downloadWorkbook, printSheet } from './exporter.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  rows: [],           // { key, record, evaluation, review, batch, addedAt }
  view: [],
  thresholds: { ...DEFAULT_THRESHOLDS },
  selected: null,
  sortBy: 'priority',
  sortDir: 'desc',
};

/* ---------------------------------------------------------------- bootstrap */

init();

async function init() {
  const settings = await store.getSettings();
  if (settings.thresholds) state.thresholds = { ...DEFAULT_THRESHOLDS, ...settings.thresholds };

  const stored = await store.allCharts();
  state.rows = stored.map(reEvaluate);
  buildFlagFilter();
  buildThresholdFields();
  wireEvents();
  render();

  // Upstream registered its own `sw.js` here. Removed: this app is embedded in
  // the KC Academy PWA, which already runs a Workbox service worker over the
  // whole origin and caches these assets on first use (vite.config.ts,
  // runtimeCaching). Two service workers on one origin would fight over the
  // same scope. Offline behaviour is unchanged — see UPSTREAM.md.
}

/** Re-run the criteria engine — called on load and whenever thresholds change. */
function reEvaluate(row) {
  return { ...row, evaluation: evaluate(row.record, state.thresholds) };
}

/* ------------------------------------------------------------------- events */

function wireEvents() {
  const dz = $('dropzone');
  const fi = $('fileInput');

  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); }
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('over'); })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('over'); })
  );
  dz.addEventListener('drop', (e) => handleFiles([...e.dataTransfer.files]));
  fi.addEventListener('change', () => { handleFiles([...fi.files]); fi.value = ''; });

  $('search').addEventListener('input', debounce(render, 160));
  ['sortBy', 'sortDir', 'fAcuity', 'fScore', 'fFlag'].forEach((id) =>
    $(id).addEventListener('change', () => {
      if (id === 'sortBy') state.sortBy = $('sortBy').value;
      if (id === 'sortDir') state.sortDir = $('sortDir').value;
      render();
    })
  );
  $('btnClearFilters').addEventListener('click', () => {
    ['search', 'fAcuity', 'fScore', 'fFlag'].forEach((id) => ($(id).value = ''));
    $('sortBy').value = state.sortBy = 'priority';
    $('sortDir').value = state.sortDir = 'desc';
    render();
  });

  document.querySelectorAll('th[data-sort]').forEach((th) =>
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortBy === key) state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      else { state.sortBy = key; state.sortDir = 'desc'; }
      $('sortBy').value = state.sortBy;
      $('sortDir').value = state.sortDir;
      render();
    })
  );

  $('btnExport').addEventListener('click', () => {
    if (!state.view.length) return;
    downloadWorkbook(state.view, state.thresholds);
  });
  $('btnPrint').addEventListener('click', () => {
    if (!state.view.length) return;
    printSheet(state.view, state.thresholds);
  });

  $('btnWipe').addEventListener('click', async () => {
    if (!confirm(`Delete all ${state.rows.length} chart(s) and every review from this device?\n\nThis cannot be undone. Export first if you need a record.`)) return;
    await store.wipe();
    state.rows = [];
    state.selected = null;
    closeDrawer();
    render();
    note('All local data cleared.', 'ok');
  });

  $('dClose').addEventListener('click', closeDrawer);
  $('scrim').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

  $('btnSettings').addEventListener('click', () => $('settingsDlg').showModal());
  $('settingsDlg').addEventListener('close', async (e) => {
    const dlg = $('settingsDlg');
    if (dlg.returnValue === 'save') {
      const next = { ...state.thresholds };
      for (const k of Object.keys(DEFAULT_THRESHOLDS)) {
        const el = document.querySelector(`[name="th_${k}"]`);
        if (el && el.value !== '') next[k] = Number(el.value);
      }
      state.thresholds = next;
      await store.saveSettings({ thresholds: next });
      state.rows = state.rows.map(reEvaluate);
      render();
      note('Thresholds saved. All charts re-evaluated.', 'ok');
    } else if (dlg.returnValue === 'reset') {
      state.thresholds = { ...DEFAULT_THRESHOLDS };
      await store.saveSettings({ thresholds: state.thresholds });
      buildThresholdFields();
      state.rows = state.rows.map(reEvaluate);
      render();
      note('Thresholds restored to defaults.', 'ok');
    }
  });
}

/* -------------------------------------------------------------------- intake */

async function handleFiles(files) {
  if (!files.length) return;
  const prog = $('progress');
  const fill = $('progressFill');
  const txt = $('progressText');
  prog.hidden = false;
  $('intakeNote').hidden = true;

  const batch = new Date().toISOString();
  let added = 0, skipped = 0;
  const problems = [];

  for (let f = 0; f < files.length; f++) {
    const file = files[f];
    txt.textContent = `Reading ${file.name} (${f + 1} of ${files.length})…`;
    fill.style.width = `${(f / files.length) * 100}%`;
    try {
      const recs = await ingestFile(file, (page, total) => {
        txt.textContent = `Reading ${file.name} — page ${page} of ${total}`;
        fill.style.width = `${((f + page / total) / files.length) * 100}%`;
      });
      if (!recs.length) { problems.push(`${file.name}: no chart records found`); continue; }

      const entries = recs.map((record) => ({
        key: store.keyFor(record),
        record,
        batch,
        addedAt: new Date().toISOString(),
        review: {},
      }));
      await store.putCharts(entries);
      added += entries.length;
      const low = recs.filter((r) => r.completeness.score < 0.75).length;
      if (low) skipped += low;
    } catch (err) {
      problems.push(`${file.name}: ${err && err.message ? err.message : 'could not be read'}`);
    }
  }

  fill.style.width = '100%';
  const stored = await store.allCharts();
  state.rows = stored.map(reEvaluate);
  buildFlagFilter();
  render();
  setTimeout(() => { prog.hidden = true; fill.style.width = '0'; }, 350);

  const bits = [`${added} chart${added === 1 ? '' : 's'} loaded.`];
  if (skipped) bits.push(`${skipped} parsed below 75% completeness — flagged for manual verification.`);
  if (problems.length) bits.push(problems.join(' · '));
  note(bits.join(' '), problems.length ? 'err' : skipped ? 'warn' : 'ok');
}

function note(msg, kind) {
  const el = $('intakeNote');
  el.textContent = msg;
  el.className = 'intake-note' + (kind === 'err' ? ' err' : kind === 'warn' ? ' warn' : '');
  el.hidden = false;
}

/* -------------------------------------------------------- filtering + sort */

function applyFilters() {
  const q = $('search').value.trim().toLowerCase();
  const acuity = $('fAcuity').value;
  const score = $('fScore').value;
  const flag = $('fFlag').value;

  let rows = state.rows.filter(({ record: r, evaluation: ev, review = {} }) => {
    if (acuity && r.acuity !== acuity) return false;
    if (score === 'unscored' && review.score) return false;
    if (score && score !== 'unscored' && String(review.score || '') !== score) return false;
    if (flag && !ev.integrity.some((i) => i.id === flag) && !ev.criteria.some((c) => c.id === flag)) return false;
    if (q) {
      const hay = [
        r.incident, r.impression, r.dispatchNature, r.narrative, r.destination,
        r.patientName, r.complaints, r.acuity,
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = state.sortDir === 'asc' ? 1 : -1;
  const val = (row) => {
    switch (state.sortBy) {
      case 'priority': return row.evaluation.priority;
      case 'criticalCount': return row.evaluation.criticalCount;
      case 'integrity': return row.evaluation.integrity.length;
      case 'score': return row.review && row.review.score ? row.review.score : -1;
      case 'completeness': return row.record.completeness.score;
      case 'acuity': return ['Non-Acute', 'Lower Acuity (Green)', 'Emergent (Yellow)', 'Critical (Red)'].indexOf(row.record.acuity);
      case 'dateOfService': {
        const p = (row.record.dateOfService || '').split('/');
        return p.length === 3 ? Number(`${p[2]}${p[0].padStart(2, '0')}${p[1].padStart(2, '0')}`) : 0;
      }
      case 'incident': return row.record.incident || '';
      default: return 0;
    }
  };
  rows.sort((a, b) => {
    const x = val(a), y = val(b);
    if (typeof x === 'string' || typeof y === 'string') return String(x).localeCompare(String(y)) * dir;
    return (x - y) * dir;
  });
  return rows;
}

/* -------------------------------------------------------------------- render */

function render() {
  const has = state.rows.length > 0;
  ['stats', 'toolbar', 'tablewrap', 'resultLine'].forEach((id) => ($(id).hidden = !has));
  $('emptyState').hidden = has;
  $('btnExport').disabled = !has;
  $('btnPrint').disabled = !has;
  if (!has) return;

  state.view = applyFilters();
  renderStats();
  renderTable();

  $('resultLine').textContent =
    state.view.length === state.rows.length
      ? `Showing all ${state.rows.length} charts, sorted by ${$('sortBy').selectedOptions[0].text.toLowerCase()}.`
      : `Showing ${state.view.length} of ${state.rows.length} charts. Export and print act on this filtered set.`;

  document.querySelectorAll('th[data-sort]').forEach((th) => {
    th.classList.toggle('sorted', th.dataset.sort === state.sortBy);
    th.classList.toggle('asc', th.dataset.sort === state.sortBy && state.sortDir === 'asc');
  });
}

function renderStats() {
  const R = state.rows;
  const low = (a) => a === 'Non-Acute' || a === 'Lower Acuity (Green)';
  $('statTotal').textContent = R.length;
  $('statEmergent').textContent = R.filter((r) => r.record.transportMode === 'Emergent').length;
  $('statMismatch').textContent = R.filter((r) => r.record.transportMode === 'Emergent' && low(r.record.acuity)).length;
  $('statNoCriteria').textContent = R.filter((r) => r.evaluation.criteria.length === 0).length;
  $('statScored').textContent = R.filter((r) => r.review && r.review.score).length;
}

function renderTable() {
  const body = $('gridBody');
  body.innerHTML = state.view
    .map((row) => {
      const { record: r, evaluation: ev, review = {} } = row;
      const pcls = ev.priority >= 30 ? 'hi' : ev.priority >= 15 ? 'md' : 'lo';
      const acuityTag = {
        'Critical (Red)': 'red', 'Emergent (Yellow)': 'amber',
        'Lower Acuity (Green)': 'green', 'Non-Acute': 'grey',
      }[r.acuity] || 'grey';
      const mismatch = r.transportMode === 'Emergent' && (r.acuity === 'Non-Acute' || r.acuity === 'Lower Acuity (Green)');
      const domains = ev.domains.length
        ? ev.domains.map((d) => `<span class="tag navy">${esc(d)}</span>`).join('')
        : '<span class="mini">none crossed</span>';
      const lowParse = r.completeness.score < 0.75
        ? `<span class="tag amber" title="Parser completeness ${Math.round(r.completeness.score * 100)}% — verify against source">parse ${Math.round(r.completeness.score * 100)}%</span>`
        : '';

      return `<tr data-key="${esc(row.key)}" class="${state.selected === row.key ? 'sel' : ''}">
        <td class="num"><span class="pri ${pcls}">${ev.priority}</span></td>
        <td><b>${esc(r.incident || '—')}</b> ${lowParse}</td>
        <td>${esc(r.dateOfService)}</td>
        <td>${esc(`${r.age || ''} ${r.sex ? r.sex[0] : ''}`.trim())}</td>
        <td><span class="tag ${acuityTag}">${esc(r.acuity || '—')}</span></td>
        <td>${esc(r.transportMode || '—')}${mismatch ? ' <span class="tag red" title="Emergent transport mode on a chart the crew coded low acuity">mismatch</span>' : ''}</td>
        <td>${r.lightsSirens === 'Yes' ? '<span class="tag red">Yes</span>' : r.lightsSirens === 'No' ? '<span class="tag grey">No</span>' : '<span class="mini">—</span>'}</td>
        <td><span class="trunc" title="${esc(r.impression)}">${esc(r.impression || '—')}</span></td>
        <td><div class="domains">${domains}</div></td>
        <td class="num">${ev.integrity.length ? `<span class="tag red">${ev.integrity.length}</span>` : '<span class="mini">0</span>'}</td>
        <td class="num">
          <select class="scorepick ${review.score ? 'set' : ''}" data-key="${esc(row.key)}" aria-label="Justification score">
            <option value="">—</option>
            ${[5, 4, 3, 2, 1].map((s) => `<option value="${s}" ${review.score === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td><button class="btn ghost" data-open="${esc(row.key)}" type="button">Review</button></td>
      </tr>`;
    })
    .join('');

  body.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(b.dataset.open); })
  );
  body.querySelectorAll('.scorepick').forEach((sel) =>
    sel.addEventListener('click', (e) => e.stopPropagation())
  );
  body.querySelectorAll('.scorepick').forEach((sel) =>
    sel.addEventListener('change', async () => {
      const v = sel.value ? Number(sel.value) : null;
      await saveReview(sel.dataset.key, { score: v });
    })
  );
  body.querySelectorAll('tr').forEach((tr) =>
    tr.addEventListener('click', () => openDrawer(tr.dataset.key))
  );
}

/* -------------------------------------------------------------------- drawer */

function openDrawer(key) {
  const row = state.rows.find((r) => r.key === key);
  if (!row) return;
  state.selected = key;
  const { record: r, evaluation: ev, review = {} } = row;
  const T = state.thresholds;

  $('dTitle').textContent = `Incident ${r.incident || '(none)'}`;
  $('dSub').textContent = `${r.dateOfService} · ${r.age || ''} ${r.sex || ''} · ${r.impression || 'no impression recorded'}`;

  const kv = [
    ['Dispatch nature', r.dispatchNature], ['EMD card', r.emdCard],
    ['Crew acuity', r.acuity], ['Response mode', r.responseMode],
    ['Transport mode', r.transportMode], ['Lights & sirens', r.lightsSirens || '(not recorded)'],
    ['ALS on scene', r.alsOnScene || '(not recorded)'], ['Pre-arrival alert', r.preArrivalAlert || '(not recorded)'],
    ['Destination', r.destination], ['Destination reason', r.destinationReason],
    ['Moved to ambulance', r.movedToAmbulance], ['Complaints', r.complaints],
    ['Source', r.source], ['Parse completeness', `${Math.round(r.completeness.score * 100)}%`],
  ].map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v) || '—'}</div>`).join('');

  const bad = (key, v) => {
    if (v == null) return false;
    if (key === 'spo2') return v < T.spo2Low;
    if (key === 'sbp') return v < T.sbpLow || v >= T.sbpSevereHtn;
    if (key === 'map') return v < T.mapLow;
    if (key === 'hr') return v > T.hrHigh || v < T.hrLow;
    if (key === 'rr') return v > T.rrHigh || v < T.rrLow;
    return false;
  };
  const vitals = (r.vitals || []).length
    ? `<table class="vt"><tr><th>Time</th><th>HR</th><th>BP (MAP)</th><th>RR</th><th>SpO2</th><th>EtCO2</th><th>Temp</th><th>Pain</th></tr>${r.vitals
        .map((v) => `<tr>
          <td>${esc(v.time)}</td>
          <td class="${bad('hr', v.hr) ? 'bad' : ''}">${v.hr ?? ''}</td>
          <td class="${bad('sbp', v.sbp) || bad('map', v.map) ? 'bad' : ''}">${v.sbp != null ? `${v.sbp}/${v.dbp ?? '?'}${v.map != null ? ` (${v.map})` : ''}` : ''}</td>
          <td class="${bad('rr', v.rr) ? 'bad' : ''}">${v.rr ?? ''}</td>
          <td class="${bad('spo2', v.spo2) ? 'bad' : ''}">${v.spo2 != null ? v.spo2 + (v.roomAir ? ' RA' : '') : ''}</td>
          <td>${v.etco2 ?? ''}</td><td>${v.temp ?? ''}</td><td>${v.pain ?? ''}</td></tr>`)
        .join('')}</table>`
    : '<p class="mini">No vital signs recorded in this chart.</p>';

  const gcs = (r.gcs || []).length
    ? `<table class="vt"><tr><th>Time</th><th>AVPU</th><th>GCS</th><th>Qualifier</th></tr>${r.gcs
        .map((g) => `<tr><td>${esc(g.time)}</td><td>${esc(g.avpu) || '—'}</td><td class="${g.gcs <= T.gcsLow && !g.confounded ? 'bad' : ''}"><b>${g.gcs}</b></td><td>${esc(g.qualifier) || '—'}</td></tr>`)
        .join('')}</table>`
    : '<p class="mini">No mental status assessment recorded in this chart.</p>';

  const crit = ev.criteria.length
    ? ev.criteria.map((c) => `<div class="finding"><div class="t">${esc(c.domain)}</div><div class="d">${esc(c.detail)}</div><div class="th">Threshold: ${esc(c.threshold)}</div><div class="cite">${esc(c.cite)}</div></div>`).join('')
    : '<p class="mini">No physiologic criteria crossed at the thresholds currently in force.</p>';

  const integ = ev.integrity.length
    ? ev.integrity.map((c) => `<div class="finding integ"><div class="t">${esc(c.label)} <span class="th">severity ${c.severity}</span></div><div class="d">${esc(c.detail)}</div><div class="cite">${esc(c.cite)}</div></div>`).join('')
    : '<p class="mini">No data-integrity findings.</p>';

  const meds = (r.medications || []).length
    ? `<table class="vt"><tr><th>Time</th><th>Entry</th></tr>${r.medications.map((m) => `<tr><td>${esc(m.time)}</td><td>${esc(m.text)}</td></tr>`).join('')}</table>`
    : '<p class="mini">No medications recorded.</p>';

  $('dBody').innerHTML = `
    <div class="dsec"><h3>Chart fields</h3><div class="kv">${kv}</div></div>
    <div class="dsec"><h3>Vital signs</h3>${vitals}
      ${r.glucose && r.glucose.length ? `<p class="mini" style="margin-top:6px">Blood glucose: <b>${r.glucose.join(', ')}</b></p>` : ''}</div>
    <div class="dsec"><h3>Mental status</h3>${gcs}</div>
    <div class="dsec"><h3>Medications / interventions</h3>${meds}</div>
    <div class="dsec"><h3>Physiologic criteria met (automatic)</h3>${crit}</div>
    <div class="dsec"><h3>Data-integrity findings (automatic)</h3>${integ}</div>
    <div class="dsec"><h3>Narrative</h3><div class="narr">${esc(r.narrative) || 'No narrative recorded.'}</div></div>

    <div class="dsec"><h3>Your determination</h3>
      <div class="reviewbox">
        <p class="fine" style="margin-top:0">The app does not score this. Assign a justification score after reading the citations above.</p>
        <div class="row">
          <label class="field"><span>Justification score</span>
            <select id="rScore">
              <option value="">Not scored</option>
              ${[5, 4, 3, 2, 1].map((s) => `<option value="${s}" ${review.score === s ? 'selected' : ''}>${s} — ${SCORE_LABELS[s]}</option>`).join('')}
            </select></label>
          <label class="field"><span>Documentation quality</span>
            <select id="rDoc">
              <option value="">—</option>
              ${[5, 4, 3, 2, 1].map((s) => `<option value="${s}" ${review.docQuality === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></label>
          <label class="field"><span>Reviewer</span>
            <input type="text" id="rWho" value="${esc(review.reviewer || '')}" placeholder="Initials"></label>
        </div>
        <label class="field" style="margin-bottom:8px"><span>Rationale</span>
          <textarea id="rWhy" placeholder="Why this score, in terms of the findings above.">${esc(review.rationale || '')}</textarea></label>
        <label class="field" style="margin-bottom:8px"><span>Flags for MD attention</span>
          <textarea id="rFlags" placeholder="Care-quality or safety concerns separate from the transport-mode question.">${esc(review.flags || '')}</textarea></label>
        <button class="btn primary" id="rSave" type="button">Save review</button>
        <span class="saved" id="rSaved" hidden>Saved</span>
      </div>
    </div>`;

  $('rSave').addEventListener('click', async () => {
    await saveReview(key, {
      score: $('rScore').value ? Number($('rScore').value) : null,
      docQuality: $('rDoc').value ? Number($('rDoc').value) : null,
      reviewer: $('rWho').value.trim(),
      rationale: $('rWhy').value.trim(),
      flags: $('rFlags').value.trim(),
    });
    const s = $('rSaved');
    s.hidden = false;
    setTimeout(() => (s.hidden = true), 1800);
  });

  $('drawer').hidden = false;
  $('scrim').hidden = false;
  $('drawer').scrollTop = 0;
}

function closeDrawer() {
  $('drawer').hidden = true;
  $('scrim').hidden = true;
  state.selected = null;
  renderTable();
}

async function saveReview(key, patch) {
  const updated = await store.updateReview(key, patch);
  if (!updated) return;
  const i = state.rows.findIndex((r) => r.key === key);
  if (i >= 0) state.rows[i] = reEvaluate(updated);
  render();
}

/* ------------------------------------------------------------------ controls */

function buildFlagFilter() {
  const sel = $('fFlag');
  const present = new Set();
  state.rows.forEach((r) => {
    r.evaluation.integrity.forEach((i) => present.add(`I:${i.id}:${i.label}`));
    r.evaluation.criteria.forEach((c) => present.add(`C:${c.id}:${c.domain}`));
  });
  const opts = [...present].sort().map((s) => {
    const [kind, id, label] = s.split(':');
    return `<option value="${esc(id)}">${kind === 'I' ? '⚑ ' : '• '}${esc(label)}</option>`;
  });
  sel.innerHTML = '<option value="">All charts</option>' + opts.join('');
}

const THRESHOLD_LABELS = {
  spo2Low: 'SpO2 low (%)', spo2Critical: 'SpO2 critical (%)',
  sbpLow: 'SBP low (mmHg)', mapLow: 'MAP low (mmHg)',
  hrHigh: 'HR high (bpm)', hrLow: 'HR low (bpm)',
  rrHigh: 'RR high (/min)', rrLow: 'RR low (/min)',
  gcsLow: 'GCS abnormal (≤)', gcsCritical: 'GCS airway risk (≤)',
  sbpSevereHtn: 'Severe HTN systolic (≥)', dbpSevereHtn: 'Severe HTN diastolic (≥)',
  glucoseHigh: 'Glucose high (>)', glucoseLow: 'Glucose low (<)',
  tempHigh: 'Temp high (°C)', tempLow: 'Temp low (°C)',
  minVitalSets: 'Expected vitals sets', pedsAgeMax: 'Pediatric age ceiling',
};

function buildThresholdFields() {
  $('thresholdFields').innerHTML = Object.keys(DEFAULT_THRESHOLDS)
    .map((k) => `<label>${esc(THRESHOLD_LABELS[k] || k)}
      <input type="number" step="any" name="th_${k}" value="${state.thresholds[k]}"></label>`)
    .join('');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
