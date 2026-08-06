/* ============================================================================
 * exporter.js — XLSX workbook + printable per-chart coaching sheet
 * ----------------------------------------------------------------------------
 * SheetJS is bundled locally; nothing is fetched.
 *
 * The workbook is built for a coaching conversation rather than a claim file.
 * Every row carries the element verdicts and the questions a reviewer would
 * ask, so the sheet can be handed to a crew member and read without the app.
 * ==========================================================================*/

import { ELEMENTS, STATUS, crewTrends, elementGaps, authorOf, feedbackText, chartRef } from './necessity.js';

const XLSX = () => window.XLSX;

const STATUS_WORD = {
  [STATUS.FULL]: 'Established',
  [STATUS.PARTIAL]: 'Partial',
  [STATUS.ABSENT]: 'MISSING',
};

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ------------------------------------------------------------------ workbook */

/**
 * @param rows  the current filtered view — what the user is looking at
 * @param all   every loaded chart, so the trend sheets describe the whole
 *              sample rather than the filter. A coaching list built from
 *              "charts I filtered to the worst band" would say everyone is bad.
 */
export function buildWorkbook(rows, all = rows) {
  const X = XLSX();
  if (!X) throw new Error('Spreadsheet library did not load.');

  /* --- 1. Chart review ---------------------------------------------------- */
  const chartRows = rows.map(({ record: r, evaluation: ev, review = {} }) => {
    const out = {
      'EMS response #': r.responseNo || '',
      Incident: r.incident || '',
      'Date of service': r.dateOfService || '',
      Origin: r.originName || '',
      Destination: r.destination || '',
      'Destination reason': r.destinationReason || '',
      'Level of service': r.levelOfService || r.serviceRequested || '',
      'Transport mode': r.transportMode || '',
      Author: authorOf(r).name || '',
      'Author assumed': authorOf(r).name && !authorOf(r).certain ? 'Yes — taken from the crew list' : '',
      Crew: r.crew || '',
      'In scope': ev.scope.inScope ? 'Yes' : 'No',
      'Out-of-scope reason': ev.scope.inScope ? '' : ev.scope.why,
      'Documentation score': ev.score == null ? '' : ev.score,
      Band: ev.band ? ev.band.label : '',
    };
    for (const el of ELEMENTS) {
      const found = ev.elements.find((e) => e.id === el.id);
      out[el.label] = found ? STATUS_WORD[found.status] : '';
    }
    out['Elements missing'] = ev.missing;
    out['Record flags'] = ev.integrity.map((i) => i.label).join('; ');
    out['Questions a reviewer would ask'] = ev.questions.map((q, i) => `${i + 1}. ${q.ask}`).join('\n');
    // Ready to paste into a message. The point of the workbook is the
    // conversation it starts, so the words for that conversation ship with it.
    out['Feedback for the author'] = feedbackText(r, ev);
    out['Reviewed by'] = review.reviewer || '';
    out['Discussed with crew'] = review.discussed || '';
    out['Coaching note'] = review.note || '';
    out['Parse completeness'] = `${Math.round(r.completeness.score * 100)}%`;
    return out;
  });

  /* --- 2. Summary --------------------------------------------------------- */
  const scored = all.filter((r) => r.evaluation.score != null);
  const mean = scored.length
    ? Math.round(scored.reduce((s, r) => s + r.evaluation.score, 0) / scored.length)
    : '';
  const band = (id) => scored.filter((r) => r.evaluation.band.id === id).length;
  const summary = [
    { Measure: 'Charts exported', Value: rows.length },
    { Measure: 'Charts loaded', Value: all.length },
    { Measure: 'In scope (non-emergency IFT)', Value: scored.length },
    { Measure: 'Mean documentation score', Value: mean },
    { Measure: 'Defensible', Value: band('defensible') },
    { Measure: 'Thin', Value: band('thin') },
    { Measure: 'At risk', Value: band('at-risk') },
    { Measure: 'Not established', Value: band('not-established') },
    { Measure: 'Record flags raised', Value: all.reduce((s, r) => s + r.evaluation.integrity.length, 0) },
    { Measure: 'Generated', Value: new Date().toLocaleString() },
    {
      Measure: 'Scope note',
      Value:
        'This workbook grades documentation, not transports. A score is a statement about what the ' +
        'record shows, never a determination that a transport was or was not medically necessary.',
    },
  ];

  /* --- 3. Element gaps ---------------------------------------------------- */
  const gaps = elementGaps(all).map((g) => ({
    Element: g.label,
    Weight: g.weight,
    'Charts scored': g.scored,
    Missing: g.absent,
    Partial: g.partial,
    'Missing %': g.scored ? `${Math.round(g.rate * 100)}%` : '',
  }));

  /* --- 4. By crew member -------------------------------------------------- */
  const crews = crewTrends(all).map((c) => ({
    'Report author': c.name,
    Charts: c.charts,
    'Mean score': c.mean,
    'Small sample': c.charts < 4 ? 'Yes — interpret with care' : '',
    'Most often missing': c.worst ? (ELEMENTS.find((e) => e.id === c.worst[0]) || {}).label : '',
    'Times missing': c.worst ? c.worst[1] : '',
  }));

  /* --- 5. The rubric ------------------------------------------------------ */
  const rubric = ELEMENTS.map((e) => ({
    Element: e.label,
    Weight: e.weight,
    'What establishes it': RUBRIC_TEXT[e.id] || '',
  }));

  const wb = X.utils.book_new();
  const add = (data, name) => {
    const ws = X.utils.json_to_sheet(data.length ? data : [{}]);
    X.utils.book_append_sheet(wb, ws, name);
  };
  add(chartRows, 'Chart Review');
  add(summary, 'Summary');
  add(gaps, 'Element Gaps');
  add(crews, 'By Report Author');
  add(rubric, 'Rubric');
  return wb;
}

const RUBRIC_TEXT = {
  functional: 'What the patient could not do — ambulate, transfer, sit upright. "Patient unable to…" stated directly.',
  contraindication: 'Why a car or wheelchair van was not an option: monitoring, oxygen, infusion, positioning, behavioural or fall risk, isolation, devices.',
  objective: 'Vital signs and a mental status. Numbers rather than adjectives.',
  destination: 'What this specific facility provides that the sending one did not.',
  reason: 'A clinical reason for the transfer, not only an administrative one.',
  level: 'For an ALS level of service, a documented ALS assessment or intervention.',
  narrative: 'A narrative long enough and specific enough to carry the argument, not a restatement of the dispatch reason.',
};

export function downloadWorkbook(rows, all, filename) {
  const X = XLSX();
  const wb = buildWorkbook(rows, all);
  const name = filename || `Medical_Necessity_Review_${new Date().toISOString().slice(0, 10)}.xlsx`;
  X.writeFile(wb, name);
}

/* --------------------------------------------------------------- print sheet */

export function printSheet(rows) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups for this page to print coaching sheets.');
    return;
  }

  const page = (row) => {
    const { record: r, evaluation: ev, review = {} } = row;
    const elements = ev.elements.map((e) => `
      <tr>
        <td><b>${esc(e.label)}</b></td>
        <td class="st ${e.status}">${STATUS_WORD[e.status]}</td>
        <td>${e.earned} / ${e.weight}</td>
        <td>${esc(e.detail)}${e.cite ? `<div class="cite">“${esc(e.cite)}”</div>` : ''}</td>
      </tr>`).join('');

    const asks = ev.questions.length
      ? `<ol>${ev.questions.map((q) => `<li><b>${esc(q.element)}</b> — ${esc(q.ask)}</li>`).join('')}</ol>`
      : '<p class="mini">All seven elements established.</p>';

    const flags = ev.integrity.length
      ? `<ul>${ev.integrity.map((i) => `<li><b>${esc(i.label)}</b> — ${esc(i.detail)}</li>`).join('')}</ul>`
      : '<p class="mini">None.</p>';

    return `<section class="sheet">
      <header>
        <div>
          <h1>${esc(chartRef(r).label === 'response' ? 'Response' : 'Incident')} ${esc(chartRef(r).value)}</h1>
          <p>${esc(r.dateOfService)} · ${esc(r.originName || 'origin not recorded')} → ${esc(r.destination || 'destination not recorded')} · ${esc(r.levelOfService || r.serviceRequested || 'level not recorded')}</p>
          <p>Author: ${esc(authorOf(r).name || 'not recorded')}${authorOf(r).name && !authorOf(r).certain ? ' (assumed from crew)' : ''} · Crew: ${esc(r.crew || 'not recorded')}</p>
        </div>
        <div class="score ${ev.band ? ev.band.id : 'none'}">
          <b>${ev.score == null ? '—' : ev.score}</b>
          <span>${ev.band ? esc(ev.band.label) : esc(ev.scope.why)}</span>
        </div>
      </header>

      ${ev.score == null ? '' : `<h2>Feedback for the author</h2>
      <div class="fb">${esc(feedbackText(r, ev)).replace(/\n/g, '<br>')}</div>`}

      <h2>What a claim reviewer would ask</h2>
      ${asks}

      <h2>The seven elements</h2>
      <table class="el"><tr><th>Element</th><th>Status</th><th>Points</th><th>Finding</th></tr>${elements}</table>

      <h2>Record flags</h2>
      ${flags}

      <h2>Narrative as written</h2>
      <div class="narr">${esc(r.narrative) || 'No narrative recorded.'}</div>

      <h2>Coaching note</h2>
      <div class="note">${esc(review.note) || ''}</div>
      <table class="sig">
        <tr><td>Reviewed by</td><td>${esc(review.reviewer) || ''}</td><td>Date</td><td></td></tr>
        <tr><td>Discussed with</td><td></td><td>Date</td><td></td></tr>
      </table>

      <footer>Grades the record, not the transport. Not a billing determination.</footer>
    </section>`;
  };

  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Medical Necessity Coaching Sheets</title><style>
    * { box-sizing: border-box; }
    body { font: 12px/1.45 -apple-system, "Segoe UI", Roboto, sans-serif; color: #16191d; margin: 0; }
    .sheet { padding: 22px 26px; page-break-after: always; }
    .sheet:last-child { page-break-after: auto; }
    header { display: flex; justify-content: space-between; align-items: flex-start;
             border-bottom: 2px solid #1f3864; padding-bottom: 8px; margin-bottom: 14px; gap: 16px; }
    h1 { font-size: 17px; margin: 0 0 3px; color: #1f3864; }
    header p { margin: 1px 0; font-size: 11.5px; color: #5b6470; }
    h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: #1f3864;
         border-bottom: 1px solid #d8dde5; padding-bottom: 3px; margin: 16px 0 7px; }
    .score { text-align: center; border: 2px solid #d8dde5; border-radius: 8px; padding: 8px 14px; min-width: 96px; }
    .score b { display: block; font-size: 26px; line-height: 1; }
    .score span { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
    .score.defensible { border-color: #1e6b3a; color: #1e6b3a; }
    .score.thin { border-color: #8a5a00; color: #8a5a00; }
    .score.at-risk, .score.not-established { border-color: #b3261e; color: #b3261e; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .el td, .el th { border: 1px solid #d8dde5; padding: 5px 7px; text-align: left; vertical-align: top; }
    .el th { background: #f2f5f9; }
    .st { font-weight: 700; white-space: nowrap; }
    .st.absent { color: #b3261e; }
    .st.partial { color: #8a5a00; }
    .st.full { color: #1e6b3a; }
    .cite { margin-top: 3px; font-style: italic; color: #5b6470; }
    ol, ul { margin: 6px 0; padding-left: 20px; }
    li { margin-bottom: 4px; }
    .narr { white-space: pre-wrap; border: 1px solid #d8dde5; padding: 8px; background: #fbfcfe; }
    .note { border: 1px solid #d8dde5; min-height: 54px; padding: 8px; }
    .sig { margin-top: 10px; }
    .sig td { border: 1px solid #d8dde5; padding: 7px; height: 26px; }
    .sig td:nth-child(odd) { background: #f7f9fc; font-size: 10px; text-transform: uppercase;
                             letter-spacing: .04em; color: #5b6470; width: 15%; }
    .mini { color: #5b6470; font-size: 11px; }
    .fb { border: 1px solid #d8dde5; border-left: 4px solid #1f3864; padding: 8px 10px;
          background: #fbfcfe; font-size: 11.5px; line-height: 1.5; }
    footer { margin-top: 14px; padding-top: 6px; border-top: 1px solid #d8dde5;
             font-size: 10px; color: #5b6470; }
    @page { margin: 12mm; }
    </style></head><body>${rows.map(page).join('')}</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
