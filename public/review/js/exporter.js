/* ============================================================================
 * exporter.js — XLSX workbook + printable per-chart review sheet
 * ----------------------------------------------------------------------------
 * Column layout mirrors the medical-director workbook this app replaces, so an
 * export drops straight into the existing review workflow.
 * SheetJS is bundled locally; nothing is fetched.
 * ==========================================================================*/

import { SCORE_LABELS } from './criteria.js';

const XLSX = () => window.XLSX;

const fmtVitals = (rec) => {
  if (!rec.vitals || !rec.vitals.length) return 'None recorded';
  return rec.vitals
    .map((v) => {
      const bits = [];
      if (v.hr != null) bits.push(`HR ${v.hr}`);
      if (v.sbp != null) bits.push(`BP ${v.sbp}/${v.dbp ?? '?'}${v.map != null ? ` (${v.map})` : ''}`);
      if (v.rr != null) bits.push(`RR ${v.rr}`);
      if (v.spo2 != null) bits.push(`SpO2 ${v.spo2}${v.roomAir ? ' RA' : ''}`);
      if (v.etco2 != null) bits.push(`EtCO2 ${v.etco2}`);
      if (v.temp != null) bits.push(`T ${v.temp}`);
      if (v.pain != null) bits.push(`Pain ${v.pain}`);
      return `${v.time} ${bits.join(', ')}`;
    })
    .join(' | ');
};

const fmtGcs = (rec) => {
  if (!rec.gcs || !rec.gcs.length) return 'NOT DOCUMENTED';
  return rec.gcs
    .map((g) => `${g.time} GCS ${g.gcs}${g.avpu ? ` (${g.avpu})` : ''}${g.confounded ? ' [CONFOUNDED: ' + g.qualifier + ']' : ''}`)
    .join('; ');
};

const fmtMeds = (rec) =>
  rec.medications && rec.medications.length
    ? rec.medications.map((m) => `${m.time} ${m.text}`).join(' | ')
    : 'None recorded';

const citeList = (ev) =>
  [...ev.criteria, ...ev.integrity]
    .map((c) => `[${c.id}] ${c.cite}`)
    .join('\n');

/* ---------------------------------------------------------------------------
 * Workbook
 * -------------------------------------------------------------------------*/

export function buildWorkbook(rows, thresholds) {
  const X = XLSX();
  const wb = X.utils.book_new();

  /* --- Tab 1: Chart Review ------------------------------------------------*/
  const header = [
    '#', 'Incident #', 'Date of Service', 'Age/Sex', 'Dispatch Nature', 'Primary Impression',
    'Crew Acuity Code', 'Response Mode to Scene', 'Transport Mode (charted)', 'Lights & Sirens Used',
    'ALS on Scene', 'Destination', 'Destination Reason', 'Key Vitals (documented)', 'Mental Status',
    'Medications / Interventions', 'Review Priority (auto)', 'Criteria Domains Met (auto)',
    'Physiologic Criteria Detail (auto)', 'Data-Integrity Findings (auto)',
    'JUSTIFICATION SCORE', 'Score Label', 'Summary Rationale', 'Verbatim Chart Support',
    'Documentation Quality (1-5)', 'Flags for MD Attention', 'Reviewer', 'Reviewed At',
    'MD Agrees? (Y/N)', 'MD Score Override', 'MD Comments',
  ];

  const body = rows.map((row, i) => {
    const { record: r, evaluation: ev, review = {} } = row;
    return [
      i + 1,
      r.incident || '(none)',
      r.dateOfService,
      `${r.age || ''} ${r.sex || ''}`.trim(),
      r.dispatchNature,
      r.impression,
      r.acuity,
      r.responseMode,
      r.transportMode,
      r.lightsSirens || '(not recorded)',
      r.alsOnScene || '(not recorded)',
      r.destination,
      r.destinationReason,
      fmtVitals(r),
      fmtGcs(r),
      fmtMeds(r),
      ev.priority,
      ev.domains.join('; ') || 'None',
      ev.criteria.map((c) => `${c.domain}: ${c.detail} [threshold ${c.threshold}]`).join('\n') || 'No physiologic criteria crossed',
      ev.integrity.map((c) => `${c.label}: ${c.detail}`).join('\n') || 'None',
      review.score ?? '',
      review.score ? `${review.score} - ${SCORE_LABELS[review.score]}` : '',
      review.rationale || ev.summary,
      review.quotes || citeList(ev),
      review.docQuality ?? '',
      review.flags || ev.integrity.map((c) => c.label).join('; '),
      review.reviewer || '',
      review.updatedAt || '',
      '', '', '',
    ];
  });

  const ws = X.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = [
    { wch: 4 }, { wch: 13 }, { wch: 13 }, { wch: 9 }, { wch: 24 }, { wch: 26 }, { wch: 18 },
    { wch: 15 }, { wch: 15 }, { wch: 11 }, { wch: 12 }, { wch: 28 }, { wch: 22 }, { wch: 48 },
    { wch: 30 }, { wch: 36 }, { wch: 11 }, { wch: 30 }, { wch: 60 }, { wch: 60 },
    { wch: 12 }, { wch: 24 }, { wch: 70 }, { wch: 80 }, { wch: 12 }, { wch: 50 },
    { wch: 16 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 36 },
  ];
  ws['!freeze'] = { xSplit: 3, ySplit: 1 };
  ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: body.length, c: header.length - 1 } }) };
  X.utils.book_append_sheet(wb, ws, 'Chart Review');

  /* --- Tab 2: Summary -----------------------------------------------------*/
  const n = rows.length || 1;
  const count = (fn) => rows.filter(fn).length;
  const pct = (v) => (rows.length ? v / rows.length : 0);
  const lowAcuity = (a) => a === 'Non-Acute' || a === 'Lower Acuity (Green)';

  const summary = [
    ['SUMMARY OF FINDINGS', `n = ${rows.length} charts`, '', ''],
    [],
    ['JUSTIFICATION SCORE DISTRIBUTION (reviewer-assigned)', '', '', ''],
    ['Score', 'Count', '% of n', 'Interpretation'],
    ...[5, 4, 3, 2, 1].map((s) => [
      `${s} - ${SCORE_LABELS[s]}`,
      count((r) => r.review && r.review.score === s),
      pct(count((r) => r.review && r.review.score === s)),
      '',
    ]),
    ['Not yet scored', count((r) => !r.review || !r.review.score), pct(count((r) => !r.review || !r.review.score)), ''],
    ['TOTAL', rows.length, 1, ''],
    [],
    ['SYSTEM-LEVEL FINDINGS (computed)', '', '', ''],
    ['Metric', 'Count', `of ${rows.length}`, 'Why it matters'],
    [
      "Charts coded Transport Mode = 'Emergent'",
      count((r) => r.record.transportMode === 'Emergent'),
      pct(count((r) => r.record.transportMode === 'Emergent')),
      'A mode field that never varies carries no information and cannot support billing, QA or mode-risk analysis.',
    ],
    [
      'Charts where lights & sirens were actually used',
      count((r) => r.record.lightsSirens === 'Yes'),
      pct(count((r) => r.record.lightsSirens === 'Yes')),
      'The gap against the Emergent count indicates whether the mode field is being chosen or defaulted.',
    ],
    [
      'Emergent transport on a low-acuity-coded chart',
      count((r) => r.record.transportMode === 'Emergent' && lowAcuity(r.record.acuity)),
      pct(count((r) => r.record.transportMode === 'Emergent' && lowAcuity(r.record.acuity))),
      "Direct internal contradiction between the crew's own acuity assessment and the transport mode on the same chart.",
    ],
    [
      'Charts with no physiologic criteria crossed',
      count((r) => r.evaluation.criteria.length === 0),
      pct(count((r) => r.evaluation.criteria.length === 0)),
      'Nothing in the recorded physiology supports urgency. Not proof of over-triage — may be a documentation gap.',
    ],
    [
      'Charts with at least one data-integrity finding',
      count((r) => r.evaluation.integrity.length > 0),
      pct(count((r) => r.evaluation.integrity.length > 0)),
      'Charts where the record itself is the limiting factor on defensibility.',
    ],
    [
      'Charts with no mental status documented',
      count((r) => !r.record.gcs || !r.record.gcs.length),
      pct(count((r) => !r.record.gcs || !r.record.gcs.length)),
      'GCS/AVPU absent entirely — a required element for acuity justification.',
    ],
    [],
    ['CREW ACUITY DISTRIBUTION', '', '', ''],
    ['Acuity Code', 'Count', `of ${rows.length}`, ''],
    ...['Critical (Red)', 'Emergent (Yellow)', 'Lower Acuity (Green)', 'Non-Acute'].map((a) => [
      a, count((r) => r.record.acuity === a), pct(count((r) => r.record.acuity === a)), '',
    ]),
    [],
    ['METHOD', '', '', ''],
    [
      'Criteria are applied deterministically against stated thresholds; the justification score is assigned by a human reviewer and is blank until they do so. Flags describe what the record documents, not what the patient experienced. Every finding carries a citation in the Chart Review tab. Thresholds in force at export are listed on the Criteria & Thresholds tab.',
      '', '', '',
    ],
  ];
  const ws2 = X.utils.aoa_to_sheet(summary);
  ws2['!cols'] = [{ wch: 56 }, { wch: 12 }, { wch: 12 }, { wch: 92 }];
  for (let r = 4; r <= 10; r++) {
    const c = X.utils.encode_cell({ r, c: 2 });
    if (ws2[c]) ws2[c].z = '0.0%';
  }
  X.utils.book_append_sheet(wb, ws2, 'Summary');

  /* --- Tab 3: Criteria & Thresholds --------------------------------------*/
  const crit = [
    ['CRITERIA AND THRESHOLDS IN FORCE AT EXPORT', '', ''],
    [],
    ['5-POINT JUSTIFICATION SCALE (assigned by reviewer)', '', ''],
    ['Score', 'Definition', 'Threshold for assignment'],
    [5, SCORE_LABELS[5], 'Unambiguous physiologic derangement or categorical time-critical diagnosis.'],
    [4, SCORE_LABELS[4], 'Supporting physiology present but not decisive; a reasonable reviewer could differ.'],
    [3, SCORE_LABELS[3], 'Findings conflict, are unvalidated, or risk is anticipatory rather than manifest.'],
    [2, SCORE_LABELS[2], 'Ambulance transport appropriate, but no documented finding supports EMERGENT.'],
    [1, SCORE_LABELS[1], 'Neither ambulance transport nor emergent designation supported by the record.'],
    [],
    ['PHYSIOLOGIC THRESHOLDS (editable in app settings)', '', ''],
    ['Parameter', 'Threshold', 'Units'],
    ['SpO2 low', thresholds.spo2Low, '%'],
    ['SpO2 critical', thresholds.spo2Critical, '%'],
    ['SBP low', thresholds.sbpLow, 'mmHg'],
    ['MAP low', thresholds.mapLow, 'mmHg'],
    ['HR high', thresholds.hrHigh, 'bpm'],
    ['HR low', thresholds.hrLow, 'bpm'],
    ['RR high', thresholds.rrHigh, '/min'],
    ['RR low', thresholds.rrLow, '/min'],
    ['GCS abnormal (<=)', thresholds.gcsLow, 'points'],
    ['GCS airway-threatening (<=)', thresholds.gcsCritical, 'points'],
    ['Severe HTN systolic (>=)', thresholds.sbpSevereHtn, 'mmHg'],
    ['Severe HTN diastolic (>=)', thresholds.dbpSevereHtn, 'mmHg'],
    ['Glucose high (>)', thresholds.glucoseHigh, 'mg/dL'],
    ['Glucose low (<)', thresholds.glucoseLow, 'mg/dL'],
    ['Expected minimum vitals sets', thresholds.minVitalSets, 'sets'],
    ['Pediatric age ceiling', thresholds.pedsAgeMax, 'years'],
    [],
    ['NOTE', '', ''],
    ['Thresholds are adult defaults and belong to the medical director, not to the software. Pediatric charts are flagged so adult thresholds are not applied silently. A GCS recorded with an intubation or sedation qualifier is reported as CONFOUNDED and is not treated as spontaneous obtundation.', '', ''],
  ];
  const ws3 = X.utils.aoa_to_sheet(crit);
  ws3['!cols'] = [{ wch: 34 }, { wch: 20 }, { wch: 80 }];
  X.utils.book_append_sheet(wb, ws3, 'Criteria & Thresholds');

  /* --- Tab 4: Priority Flags ---------------------------------------------*/
  const flagRows = [];
  rows
    .slice()
    .sort((a, b) => b.evaluation.priority - a.evaluation.priority)
    .forEach((row) => {
      row.evaluation.integrity.forEach((f) => {
        flagRows.push([
          row.record.incident, row.record.dateOfService, f.severity, f.label, f.detail, f.cite,
        ]);
      });
    });
  flagRows.sort((a, b) => b[2] - a[2]);
  const ws4 = X.utils.aoa_to_sheet([
    ['PRIORITY FLAGS — data-integrity and documentation findings', '', '', '', '', ''],
    ['Sorted by severity. These describe the record, not the patient, and are separate from the justification score.', '', '', '', '', ''],
    [],
    ['Incident #', 'Date of Service', 'Severity', 'Finding', 'Detail', 'Citation'],
    ...flagRows,
  ]);
  ws4['!cols'] = [{ wch: 14 }, { wch: 14 }, { wch: 9 }, { wch: 38 }, { wch: 74 }, { wch: 74 }];
  X.utils.book_append_sheet(wb, ws4, 'Priority Flags');

  return wb;
}

export function downloadWorkbook(rows, thresholds, filename) {
  const X = XLSX();
  const wb = buildWorkbook(rows, thresholds);
  X.writeFile(wb, filename || `EMS_Transport_Review_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ---------------------------------------------------------------------------
 * Printable per-chart review sheet
 * -------------------------------------------------------------------------*/

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function printSheet(rows, thresholds) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Allow pop-ups for this page to print review sheets.');
    return;
  }
  const body = rows.map((row) => chartSection(row)).join('\n');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>EMS Transport Review — ${rows.length} chart${rows.length === 1 ? '' : 's'}</title>
<style>
  @page { size: letter portrait; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font: 10pt/1.45 Arial, Helvetica, sans-serif; color: #111; margin: 0; }
  .chart { page-break-after: always; }
  .chart:last-child { page-break-after: auto; }
  h1 { font-size: 13pt; margin: 0 0 2mm; border-bottom: 2px solid #1f3864; padding-bottom: 2mm; color: #1f3864; }
  h2 { font-size: 10pt; margin: 5mm 0 1.5mm; text-transform: uppercase; letter-spacing: .04em; color: #1f3864; border-bottom: 1px solid #ccc; padding-bottom: 1mm; }
  .meta { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2mm 4mm; margin-bottom: 2mm; }
  .meta div { font-size: 8.5pt; }
  .meta b { display: block; color: #555; font-weight: 600; font-size: 7.5pt; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th, td { border: 1px solid #bbb; padding: 1.5mm 2mm; text-align: left; vertical-align: top; }
  th { background: #eef2f9; font-size: 8pt; }
  .finding { margin-bottom: 2mm; padding: 2mm; border-left: 3px solid #1f3864; background: #f7f9fc; }
  .finding.integ { border-left-color: #c00; background: #fdf6f6; }
  .finding .t { font-weight: bold; }
  .finding .th { color: #555; font-size: 8pt; font-style: italic; }
  .finding .cite { font-family: "Courier New", monospace; font-size: 7.5pt; color: #333; margin-top: 1mm; word-break: break-word; }
  .narr { white-space: pre-wrap; font-size: 8.5pt; border: 1px solid #ddd; padding: 2mm; background: #fafafa; max-height: none; }
  .sign { margin-top: 6mm; border: 1px solid #333; padding: 3mm; }
  .sign .row { display: flex; gap: 6mm; margin-bottom: 4mm; }
  .sign .row > div { flex: 1; }
  .line { border-bottom: 1px solid #333; height: 7mm; }
  .scale { font-size: 8pt; color: #444; margin-bottom: 3mm; }
  .none { color: #777; font-style: italic; }
  .foot { margin-top: 3mm; font-size: 7.5pt; color: #666; border-top: 1px solid #ddd; padding-top: 1.5mm; }
</style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function chartSection({ record: r, evaluation: ev, review = {} }) {
  const meta = [
    ['Incident #', r.incident || '(none)'], ['Date of Service', r.dateOfService],
    ['Age / Sex', `${r.age || ''} ${r.sex || ''}`], ['Dispatch', r.dispatchNature],
    ['Primary Impression', r.impression], ['Crew Acuity', r.acuity],
    ['Response Mode', r.responseMode], ['Transport Mode', r.transportMode],
    ['Lights & Sirens', r.lightsSirens || '(not recorded)'], ['ALS on Scene', r.alsOnScene || '(not recorded)'],
    ['Destination', r.destination], ['Destination Reason', r.destinationReason],
  ].map(([k, v]) => `<div><b>${esc(k)}</b>${esc(v) || '<span class="none">—</span>'}</div>`).join('');

  const vitalRows = (r.vitals || []).length
    ? r.vitals.map((v) => `<tr><td>${esc(v.time)}</td><td>${v.hr ?? ''}</td><td>${v.sbp != null ? `${v.sbp}/${v.dbp ?? '?'}${v.map != null ? ` (${v.map})` : ''}` : ''}</td><td>${v.rr ?? ''}</td><td>${v.spo2 != null ? v.spo2 + (v.roomAir ? ' RA' : '') : ''}</td><td>${v.etco2 ?? ''}</td><td>${v.temp ?? ''}</td><td>${v.pain ?? ''}</td></tr>`).join('')
    : '<tr><td colspan="8" class="none">No vital signs recorded in this chart.</td></tr>';

  const gcsRows = (r.gcs || []).length
    ? r.gcs.map((g) => `<tr><td>${esc(g.time)}</td><td>${esc(g.avpu) || '—'}</td><td><b>${g.gcs}</b></td><td>${esc(g.qualifier) || '—'}</td></tr>`).join('')
    : '<tr><td colspan="4" class="none">No mental status assessment recorded in this chart.</td></tr>';

  const crit = ev.criteria.length
    ? ev.criteria.map((c) => `<div class="finding"><div class="t">${esc(c.domain)}</div><div>${esc(c.detail)}</div><div class="th">Threshold: ${esc(c.threshold)}</div><div class="cite">${esc(c.cite)}</div></div>`).join('')
    : '<p class="none">No physiologic criteria crossed.</p>';

  const integ = ev.integrity.length
    ? ev.integrity.map((c) => `<div class="finding integ"><div class="t">${esc(c.label)} <span class="th">(severity ${c.severity})</span></div><div>${esc(c.detail)}</div><div class="cite">${esc(c.cite)}</div></div>`).join('')
    : '<p class="none">No data-integrity findings.</p>';

  const meds = (r.medications || []).length
    ? `<table><tr><th>Time</th><th>Entry</th></tr>${r.medications.map((m) => `<tr><td>${esc(m.time)}</td><td>${esc(m.text)}</td></tr>`).join('')}</table>`
    : '<p class="none">No medications recorded.</p>';

  const scoreLine = review.score
    ? `Pre-filled from app: <b>${review.score} — ${esc(SCORE_LABELS[review.score])}</b>${review.reviewer ? ` (${esc(review.reviewer)})` : ''}`
    : 'Not yet scored in the app.';

  return `<div class="chart">
  <h1>Emergent Transport Review — Incident ${esc(r.incident || '(none)')}</h1>
  <div class="meta">${meta}</div>

  <h2>Vital Signs</h2>
  <table><tr><th>Time</th><th>HR</th><th>BP (MAP)</th><th>RR</th><th>SpO2</th><th>EtCO2</th><th>Temp</th><th>Pain</th></tr>${vitalRows}</table>

  <h2>Mental Status</h2>
  <table><tr><th>Time</th><th>AVPU</th><th>GCS</th><th>Qualifier</th></tr>${gcsRows}</table>

  <h2>Medications / Interventions</h2>${meds}

  <h2>Physiologic Criteria Met (automatic)</h2>${crit}

  <h2>Data-Integrity Findings (automatic)</h2>${integ}

  <h2>Narrative</h2>
  <div class="narr">${esc(r.narrative) || '<span class="none">No narrative recorded.</span>'}</div>

  <h2>Medical Director Determination</h2>
  <div class="scale">Was emergent transport justified? &nbsp; 5 = clearly justified &nbsp;·&nbsp; 4 = probably &nbsp;·&nbsp; 3 = equivocal &nbsp;·&nbsp; 2 = probably not &nbsp;·&nbsp; 1 = clearly not. <br>${scoreLine}</div>
  <div class="sign">
    <div class="row">
      <div><b>Justification score (1–5)</b><div class="line"></div></div>
      <div><b>Documentation quality (1–5)</b><div class="line"></div></div>
      <div><b>Agrees with auto-flags? Y / N</b><div class="line"></div></div>
    </div>
    <div><b>Comments / required follow-up</b><div class="line"></div><div class="line"></div><div class="line"></div></div>
    <div class="row" style="margin-top:4mm">
      <div><b>Reviewer signature</b><div class="line"></div></div>
      <div><b>Date</b><div class="line"></div></div>
    </div>
  </div>
  <div class="foot">Generated locally on this device. Auto-flags are threshold-based and carry citations; they do not constitute a clinical determination. Parser completeness for this chart: ${Math.round((r.completeness?.score ?? 0) * 100)}%.</div>
</div>`;
}
