/* ============================================================================
 * app.js — UI, state, sorting, filtering
 * ==========================================================================*/

import { ingestFile } from './parser.js';
import { evaluate, ELEMENTS, BANDS, STATUS, crewTrends, elementGaps, authorOf, feedbackFor, feedbackText, chartRef } from './necessity.js';
import * as store from './store.js';
import { downloadWorkbook, printSheet } from './exporter.js';

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  rows: [],
  view: [],
  selected: null,
  sortBy: 'score',
  sortDir: 'asc',
  screen: 'charts',
};

/* ---------------------------------------------------------------- bootstrap */

init();

async function init() {
  const stored = await store.allCharts();
  state.rows = reEvaluateAll(stored);
  buildBandFilter();
  buildElementFilter();
  wireEvents();
  render();
}

/**
 * Re-run the rubric over every chart.
 *
 * Two passes on purpose. The copy-forward check compares each narrative against
 * every other, so the first pass has to finish building the set before the
 * second can look across it — evaluating in one pass would let the first chart
 * loaded escape a check the last one gets.
 */
function reEvaluateAll(rows) {
  const seeded = rows.map((r) => ({ ...r, evaluation: evaluate({ ...r.record, __key: r.key }) }));
  return seeded.map((r) => ({
    ...r,
    evaluation: evaluate({ ...r.record, __key: r.key }, seeded),
  }));
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
  ['sortBy', 'sortDir', 'fBand', 'fElement', 'fScope'].forEach((id) =>
    $(id).addEventListener('change', () => {
      if (id === 'sortBy') state.sortBy = $('sortBy').value;
      if (id === 'sortDir') state.sortDir = $('sortDir').value;
      render();
    })
  );
  $('btnClearFilters').addEventListener('click', () => {
    ['search', 'fBand', 'fElement'].forEach((id) => ($(id).value = ''));
    $('fScope').value = 'in';
    $('sortBy').value = state.sortBy = 'score';
    $('sortDir').value = state.sortDir = 'asc';
    render();
  });

  document.querySelectorAll('th[data-sort]').forEach((th) =>
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortBy === key) state.sortDir = state.sortDir === 'desc' ? 'asc' : 'desc';
      else { state.sortBy = key; state.sortDir = key === 'score' ? 'asc' : 'desc'; }
      $('sortBy').value = state.sortBy;
      $('sortDir').value = state.sortDir;
      render();
    })
  );

  document.querySelectorAll('.vbtn').forEach((b) =>
    b.addEventListener('click', () => {
      state.screen = b.dataset.view;
      document.querySelectorAll('.vbtn').forEach((x) => x.classList.toggle('active', x === b));
      render();
    })
  );

  $('btnExport').addEventListener('click', () => {
    if (!state.view.length) return;
    downloadWorkbook(state.view, state.rows);
  });
  $('btnPrint').addEventListener('click', () => {
    if (!state.view.length) return;
    printSheet(state.view);
  });

  $('btnWipe').addEventListener('click', async () => {
    if (!confirm(`Delete all ${state.rows.length} chart(s) and every note from this device?\n\nThis cannot be undone. Export first if you need a record.`)) return;
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
  let added = 0, low = 0;
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

      await store.putCharts(recs.map((record) => ({
        key: store.keyFor(record),
        record,
        batch,
        addedAt: new Date().toISOString(),
        review: {},
      })));
      added += recs.length;
      low += recs.filter((r) => r.completeness.score < 0.75).length;
    } catch (err) {
      problems.push(`${file.name}: ${err && err.message ? err.message : 'could not be read'}`);
    }
  }

  fill.style.width = '100%';
  state.rows = reEvaluateAll(await store.allCharts());
  buildBandFilter();
  buildElementFilter();
  render();
  setTimeout(() => { prog.hidden = true; fill.style.width = '0'; }, 350);

  const scoped = state.rows.filter((r) => r.evaluation.score != null).length;
  const bits = [`${added} chart${added === 1 ? '' : 's'} loaded, ${scoped} in scope for necessity review.`];
  if (low) bits.push(`${low} parsed below 75% completeness — flagged for manual verification.`);
  if (problems.length) bits.push(problems.join(' · '));
  note(bits.join(' '), problems.length ? 'err' : low ? 'warn' : 'ok');
}

/** Author with a note when it was inferred rather than recorded. */
function authorTitle(r) {
  const a = authorOf(r);
  if (!a.name) return '';
  return a.certain ? a.name : `${a.name} (assumed from the crew list)`;
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
  const band = $('fBand').value;
  const element = $('fElement').value;
  const scope = $('fScope').value;

  const rows = state.rows.filter(({ record: r, evaluation: ev }) => {
    if (scope === 'in' && !ev.scope.inScope) return false;
    if (scope === 'out' && ev.scope.inScope) return false;
    if (band && (!ev.band || ev.band.id !== band)) return false;
    if (element) {
      const el = ev.elements.find((e) => e.id === element);
      if (!el || el.status === STATUS.FULL) return false;
    }
    if (q) {
      const hay = [
        r.incident, r.impression, r.narrative, r.destination, r.originName,
        r.patientName, r.crew, r.author, r.levelOfService, r.dispatchNature, r.responseNo,
      ].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const dir = state.sortDir === 'asc' ? 1 : -1;
  const val = (row) => {
    const ev = row.evaluation;
    switch (state.sortBy) {
      // Unscored charts sort to the end either way rather than reading as 0.
      case 'score': return ev.score == null ? (dir === 1 ? 1e6 : -1e6) : ev.score;
      case 'missing': return ev.missing;
      case 'flags': return ev.integrity.length;
      case 'completeness': return row.record.completeness.score;
      case 'dateOfService': {
        const p = (row.record.dateOfService || '').split('/');
        return p.length === 3 ? Number(`${p[2]}${p[0].padStart(2, '0')}${p[1].padStart(2, '0')}`) : 0;
      }
      // Sorts on what the column shows: the response number crews use.
      case 'incident': return row.record.responseNo || row.record.incident || '';
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
  $('viewswitch').hidden = !has;
  $('emptyState').hidden = has;
  $('btnExport').disabled = !has;
  $('btnPrint').disabled = !has;

  const charts = state.screen === 'charts';
  $('viewCharts').hidden = !has || !charts;
  $('viewCoaching').hidden = !has || charts;
  if (!has) return;

  state.view = applyFilters();

  if (charts) {
    ['stats', 'toolbar', 'tablewrap', 'resultLine'].forEach((id) => ($(id).hidden = false));
    renderStats();
    renderTable();
    $('resultLine').textContent =
      state.view.length === state.rows.length
        ? `Showing all ${state.rows.length} charts.`
        : `Showing ${state.view.length} of ${state.rows.length} charts. Export and print act on this filtered set.`;
    document.querySelectorAll('th[data-sort]').forEach((th) => {
      th.classList.toggle('sorted', th.dataset.sort === state.sortBy);
      th.classList.toggle('asc', th.dataset.sort === state.sortBy && state.sortDir === 'asc');
    });
  } else {
    renderCoaching();
  }
}

function renderStats() {
  const R = state.rows;
  const scored = R.filter((r) => r.evaluation.score != null);
  const mean = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.evaluation.score, 0) / scored.length)
    : null;
  $('statTotal').textContent = R.length;
  $('statScoped').textContent = scored.length;
  $('statMean').textContent = mean == null ? '—' : mean;
  $('statRisk').textContent = scored.filter(
    (r) => r.evaluation.band && (r.evaluation.band.id === 'at-risk' || r.evaluation.band.id === 'not-established'),
  ).length;
  $('statFlags').textContent = R.reduce((s, r) => s + r.evaluation.integrity.length, 0);
}

const BAND_TAG = {
  defensible: 'green', thin: 'amber', 'at-risk': 'red', 'not-established': 'red',
};

function renderTable() {
  const body = $('gridBody');
  body.innerHTML = state.view
    .map((row) => {
      const { record: r, evaluation: ev } = row;
      const scoreCell = ev.score == null
        ? `<span class="mini" title="${esc(ev.scope.why)}">out of scope</span>`
        : `<span class="pri ${ev.band.id === 'defensible' ? 'lo' : ev.band.id === 'thin' ? 'md' : 'hi'}" title="${esc(ev.band.hint)}">${ev.score}</span>`;
      const missing = ev.elements.filter((e) => e.status !== STATUS.FULL);
      const chips = missing.length
        ? missing.slice(0, 4).map((e) =>
            `<span class="tag ${e.status === STATUS.ABSENT ? 'red' : 'amber'}" title="${esc(e.detail)}">${esc(e.label)}</span>`).join('')
        : '<span class="mini">all seven established</span>';
      const lowParse = r.completeness.score < 0.75
        ? `<span class="tag amber" title="Parser completeness ${Math.round(r.completeness.score * 100)}% — verify against source">parse ${Math.round(r.completeness.score * 100)}%</span>`
        : '';

      return `<tr data-key="${esc(row.key)}" class="${state.selected === row.key ? 'sel' : ''}">
        <td class="num">${scoreCell}</td>
        <td><b>${esc(chartRef(r).value)}</b>${r.responseNo && r.incident ? `<span class="mini">inc ${esc(r.incident)}</span>` : ''} ${lowParse}</td>
        <td>${esc(r.dateOfService)}</td>
        <td><span class="trunc" title="${esc(`${r.originName || '?'} → ${r.destination || '?'}`)}">${esc(r.originName || '—')} → ${esc(r.destination || '—')}</span></td>
        <td>${esc(r.levelOfService || r.serviceRequested || '—')}</td>
        <td><div class="domains">${chips}</div></td>
        <td class="num">${ev.integrity.length ? `<span class="tag red">${ev.integrity.length}</span>` : '<span class="mini">0</span>'}</td>
        <td><span class="trunc" title="${esc(authorTitle(r))}">${esc(authorOf(r).name || '—')}${authorOf(r).name && !authorOf(r).certain ? '<span class="mini">?</span>' : ''}</span></td>
        <td><button class="btn ghost" data-open="${esc(row.key)}" type="button">Coach</button></td>
      </tr>`;
    })
    .join('');

  body.querySelectorAll('[data-open]').forEach((b) =>
    b.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(b.dataset.open); })
  );
  body.querySelectorAll('tr').forEach((tr) =>
    tr.addEventListener('click', () => openDrawer(tr.dataset.key))
  );
}

/* ------------------------------------------------------------------ coaching */

function renderCoaching() {
  const gaps = elementGaps(state.rows);
  const scoredCount = gaps.length ? gaps[0].scored : 0;

  $('gapList').innerHTML = scoredCount
    ? gaps.map((g) => {
        const pct = Math.round(g.rate * 100);
        return `<div class="gap">
          <div class="gaphead">
            <b>${esc(g.label)}</b>
            <span class="mini">${g.absent} of ${g.scored} charts missing it entirely${g.partial ? ` · ${g.partial} partial` : ''}</span>
          </div>
          <div class="meter"><div class="mfill ${pct >= 50 ? 'hi' : pct >= 25 ? 'md' : 'lo'}" style="width:${pct}%"></div></div>
          <div class="mini">${pct}% absent · worth ${g.weight} points</div>
        </div>`;
      }).join('')
    : '<p class="mini">No in-scope charts loaded yet.</p>';

  const crews = crewTrends(state.rows);
  $('crewList').innerHTML = crews.length
    ? `<table class="vt"><tr><th>Report author</th><th>Charts</th><th>Mean score</th><th>Most often missing</th></tr>${crews
        .map((c) => {
          const worst = c.worst ? (ELEMENTS.find((e) => e.id === c.worst[0]) || {}).label : null;
          return `<tr>
            <td><b>${esc(c.name)}</b></td>
            <td>${c.charts}</td>
            <td>${c.mean}${c.charts < 4 ? ' <span class="mini">(small sample)</span>' : ''}</td>
            <td>${worst ? `${esc(worst)} <span class="mini">(${c.worst[1]}×)</span>` : '<span class="mini">nothing consistently</span>'}</td>
          </tr>`;
        }).join('')}</table>`
    : '<p class="mini">No crew names parsed from the loaded charts.</p>';
}

/* -------------------------------------------------------------------- drawer */

const STATUS_TAG = {
  [STATUS.FULL]: ['green', 'Established'],
  [STATUS.PARTIAL]: ['amber', 'Partial'],
  [STATUS.ABSENT]: ['red', 'Missing'],
};

function openDrawer(key) {
  const row = state.rows.find((r) => r.key === key);
  if (!row) return;
  state.selected = key;
  const { record: r, evaluation: ev, review = {} } = row;

  const ref = chartRef(r);
  $('dTitle').textContent = `${ref.label === 'response' ? 'Response' : ref.label === 'incident' ? 'Incident' : 'Chart'} ${ref.value}`;
  $('dSub').textContent = `${r.dateOfService} · ${r.originName || 'origin not recorded'} → ${r.destination || 'destination not recorded'}`;

  const verdict = ev.score == null
    ? `<div class="verdict grey"><div class="vscore">—</div><div><b>Not scored</b><p class="fine">${esc(ev.scope.why)}</p></div></div>`
    : `<div class="verdict ${BAND_TAG[ev.band.id]}">
         <div class="vscore">${ev.score}</div>
         <div><b>${esc(ev.band.label)}</b><p class="fine">${esc(ev.band.hint)}</p></div>
       </div>`;

  const elements = ev.elements.map((e) => {
    const [tag, word] = STATUS_TAG[e.status];
    return `<div class="finding ${e.status === STATUS.FULL ? '' : 'integ'}">
      <div class="t">${esc(e.label)} <span class="tag ${tag}">${word}</span> <span class="th">${e.earned} / ${e.weight}</span></div>
      <div class="d">${esc(e.detail)}</div>
      ${e.cite ? `<div class="cite">“${esc(e.cite)}”</div>` : ''}
    </div>`;
  }).join('');

  const questions = ev.questions.length
    ? `<ol class="asks">${ev.questions.map((q) =>
        `<li><b>${esc(q.element)}</b><br>${esc(q.ask)}</li>`).join('')}</ol>`
    : '<p class="mini">Nothing outstanding — all seven elements are established.</p>';

  const integ = ev.integrity.length
    ? ev.integrity.map((c) => `<div class="finding integ">
        <div class="t">${esc(c.label)} <span class="th">severity ${c.severity}</span></div>
        <div class="d">${esc(c.detail)}</div>
        ${c.cite ? `<div class="cite">“${esc(c.cite)}”</div>` : ''}
      </div>`).join('')
    : '<p class="mini">No record flags.</p>';

  const kv = [
    ['Origin', r.originName], ['Origin type', r.originType],
    ['Destination', r.destination], ['Destination reason', r.destinationReason],
    ['EMS response #', r.responseNo],
    ['Incident #', r.incident],
    ['Report author', authorTitle(r)],
    ['Level of service', r.levelOfService || r.serviceRequested],
    ['Transport mode', r.transportMode], ['Primary impression', r.impression],
    ['Moved to ambulance', r.movedToAmbulance], ['Moved by', r.movedByMethod],
    ['Position', r.position], ['PCS', r.pcs], ['Crew', r.crew],
    ['Parse completeness', `${Math.round(r.completeness.score * 100)}%`],
  ].map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v) || '—'}</div>`).join('');

  const fb = feedbackFor(r, ev);
  const fbBlock = ev.score == null ? '' : `
    <div class="dsec"><h3>Feedback for the author</h3>
      <div class="fbbox">
        <div class="fbhead">
          <b>${esc(fb.author.name || 'Author not recorded')}</b>
          ${fb.author.name && !fb.author.certain ? '<span class="tag amber" title="Taken from the crew list — the chart did not name an author">assumed</span>' : ''}
          <button class="btn ghost sm" id="fbCopy" type="button">Copy</button>
        </div>
        ${fb.clean
          ? '<p class="fbclean">Nothing to change on this one. All seven elements are established.</p>'
          : `<ol class="fblines">${fb.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` +
            (fb.more ? `<p class="mini">${fb.more} more below.</p>` : '')}
      </div>
    </div>`;

  $('dBody').innerHTML = `
    ${verdict}
    ${fbBlock}
    <div class="dsec"><h3>What a claim reviewer would ask</h3>${questions}</div>
    <div class="dsec"><h3>The seven elements</h3>${elements}</div>
    <div class="dsec"><h3>Record flags</h3>${integ}</div>
    <div class="dsec"><h3>Chart fields</h3><div class="kv">${kv}</div></div>
    <div class="dsec"><h3>Narrative</h3><div class="narr">${esc(r.narrative) || 'No narrative recorded.'}</div></div>

    <div class="dsec"><h3>Coaching note</h3>
      <div class="reviewbox">
        <p class="fine" style="margin-top:0">For the conversation with the crew. Saved on this device
          and included in the export — it is not sent anywhere.</p>
        <div class="row">
          <label class="field"><span>Reviewed by</span>
            <input type="text" id="rWho" value="${esc(review.reviewer || '')}" placeholder="Initials"></label>
          <label class="field"><span>Discussed with crew</span>
            <select id="rDone">
              <option value="">Not yet</option>
              <option value="yes" ${review.discussed === 'yes' ? 'selected' : ''}>Yes</option>
              <option value="n/a" ${review.discussed === 'n/a' ? 'selected' : ''}>Not needed</option>
            </select></label>
        </div>
        <label class="field" style="margin-bottom:8px"><span>Note</span>
          <textarea id="rNote" placeholder="What to raise, and what this chart did well.">${esc(review.note || '')}</textarea></label>
        <button class="btn primary" id="rSave" type="button">Save note</button>
        <span class="saved" id="rSaved" hidden>Saved</span>
      </div>
    </div>`;

  const copyBtn = $('fbCopy');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      const text = feedbackText(r, ev);
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied';
      } catch {
        // Clipboard is blocked in some embedded contexts; select it instead so
        // the reviewer can still copy by hand rather than being stuck.
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.className = 'fbfallback';
        copyBtn.parentElement.after(ta);
        ta.select();
        copyBtn.textContent = 'Select and copy';
      }
      setTimeout(() => { copyBtn.textContent = 'Copy'; }, 2200);
    });
  }

  $('rSave').addEventListener('click', async () => {
    await saveReview(key, {
      reviewer: $('rWho').value.trim(),
      discussed: $('rDone').value,
      note: $('rNote').value.trim(),
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
  if (state.screen === 'charts' && state.rows.length) renderTable();
}

async function saveReview(key, patch) {
  const updated = await store.updateReview(key, patch);
  if (!updated) return;
  const i = state.rows.findIndex((r) => r.key === key);
  if (i >= 0) state.rows[i] = { ...updated, evaluation: state.rows[i].evaluation };
  render();
}

/* ------------------------------------------------------------------ controls */

function buildBandFilter() {
  $('fBand').innerHTML =
    '<option value="">All</option>' +
    BANDS.map((b) => `<option value="${b.id}">${esc(b.label)}</option>`).join('');
}

function buildElementFilter() {
  $('fElement').innerHTML =
    '<option value="">Any</option>' +
    ELEMENTS.map((e) => `<option value="${e.id}">${esc(e.label)}</option>`).join('');
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
