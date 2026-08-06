/* ============================================================================
 * parser.js — ImageTrend Elite ePCR extraction
 * ----------------------------------------------------------------------------
 * Two ingestion paths:
 *   1. parsePdf(file)        — layout-preserving text extraction via pdf.js,
 *                              then field extraction. Brittle by nature; every
 *                              field records whether it was found.
 *   2. parseStructured(text) — CSV / JSON / NEMSIS-flavoured column import.
 *                              Preferred path; no layout guessing.
 *
 * Nothing here touches the network. Nothing here is persisted.
 * ==========================================================================*/

const PDFJS_URL = '../lib/pdf.min.mjs';

/* ---------------------------------------------------------------------------
 * PDF text extraction
 * -------------------------------------------------------------------------*/

let _pdfjs = null;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import('../lib/pdf.min.mjs');
  _pdfjs.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;
  return _pdfjs;
}

/**
 * Reconstruct a layout-preserving text rendering of a PDF page.
 *
 * pdf.js returns positioned text runs, not lines. ImageTrend's report is a
 * two-column label/value layout, so naive concatenation interleaves labels
 * into the middle of narrative sentences — this is exactly the artifact that
 * corrupted quotes during the manual review. We bucket runs into lines by
 * y-position, sort each line by x, and pad with spaces proportional to the
 * horizontal gap so that column structure survives.
 */
async function pageToText(page) {
  const content = await page.getTextContent();
  const viewport = page.getViewport({ scale: 1 });
  const lines = new Map();

  for (const item of content.items) {
    if (!item.str) continue;
    const x = item.transform[4];
    const y = Math.round(viewport.height - item.transform[5]);
    // bucket to nearest 3pt to tolerate baseline jitter within a line
    const key = Math.round(y / 3) * 3;
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ x, s: item.str, w: item.width || 0 });
  }

  const out = [];
  for (const key of [...lines.keys()].sort((a, b) => a - b)) {
    const runs = lines.get(key).sort((a, b) => a.x - b.x);
    let line = '';
    let cursor = 0;
    for (const r of runs) {
      const col = Math.round(r.x / 4.8); // ~4.8pt per monospace-ish column
      if (col > cursor) line += ' '.repeat(Math.min(col - cursor, 300));
      line += r.s;
      cursor = col + r.s.length;
    }
    out.push(line.replace(/\s+$/, ''));
  }
  return out.join('\n');
}

export async function pdfToText(file, onProgress) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf, isEvalSupported: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    pages.push(await pageToText(page));
    page.cleanup();
    if (onProgress) onProgress(i, doc.numPages);
  }
  await doc.destroy();
  return pages.join('\n');
}

/* ---------------------------------------------------------------------------
 * Noise stripping and record splitting
 * -------------------------------------------------------------------------*/

const NOISE = [
  /^https?:\/\/\S*imagetrend\S*/i,
  /^Incidents?\s+[\d,]+\s+\d+\/\d+\/\d+/i,
  /^Page \d+ of \d+$/i,
];

function stripNoise(text) {
  return text
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      if (!t) return true;
      return !NOISE.some((re) => re.test(t)) && !/imagetrendelite\.com/i.test(t);
    })
    .join('\n');
}

/** A multi-incident export contains one "EMS Patient Care Report" header per chart. */
export function splitRecords(text) {
  const clean = stripNoise(text);
  const lines = clean.split('\n');
  const marks = [];
  lines.forEach((l, i) => {
    if (/EMS Patient Care Report/i.test(l)) marks.push(i);
  });
  if (!marks.length) return [clean];
  marks.push(lines.length);
  const recs = [];
  for (let i = 0; i < marks.length - 1; i++) {
    const start = Math.max(0, marks[i] - 14); // reach back for the header block
    recs.push(lines.slice(start, marks[i + 1]).join('\n'));
  }
  return recs;
}

/* ---------------------------------------------------------------------------
 * Field extraction helpers
 * -------------------------------------------------------------------------*/

const collapse = (s) => (s || '').replace(/\s+/g, ' ').trim();

function field(text, label, opts = {}) {
  const re = new RegExp(
    label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:?\\s*(.*)',
    'i'
  );
  const m = text.match(re);
  if (!m) return '';
  let v = m[1];
  if (opts.stopAtGap) v = v.split(/\s{3,}/)[0];
  return collapse(v);
}

/**
 * ImageTrend wraps long values onto following lines, indented under the value
 * column. Pull the continuation when the next line is indented past the label.
 */
function fieldWrapped(text, label, maxLines = 2) {
  const lines = text.split('\n');
  const re = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*:', 'i');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(re);
    if (!m) continue;
    const col = lines[i].indexOf(m[0]) + m[0].length;
    let val = lines[i].slice(col);
    const indent = lines[i].length - lines[i].slice(col).length;
    for (let j = 1; j <= maxLines && i + j < lines.length; j++) {
      const nxt = lines[i + j];
      if (!nxt.trim()) break;
      const lead = nxt.search(/\S/);
      if (lead >= indent - 6 && !/:/.test(nxt.slice(0, lead + 30))) val += ' ' + nxt.trim();
      else break;
    }
    return collapse(val).split(/\s{3,}/)[0];
  }
  return '';
}

function sectionBetween(text, startRe, endRes) {
  const s = text.search(startRe);
  if (s < 0) return '';
  let e = text.length;
  for (const re of endRes) {
    const idx = text.slice(s + 1).search(re);
    if (idx > 0) e = Math.min(e, s + 1 + idx);
  }
  return text.slice(s, e);
}

/* ---------------------------------------------------------------------------
 * Vitals
 * -------------------------------------------------------------------------*/

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/* --- column-aware table reading -------------------------------------------
 * ImageTrend tables are fixed-column. Splitting on whitespace and guessing
 * positionally misassigns values — notably reading the ECG "4 Lead" cell as a
 * respiratory rate, and GCS eye/verbal/motor sub-scores as the GCS total.
 * We instead locate each column by its header position and slice data rows on
 * those boundaries.
 * ------------------------------------------------------------------------*/

// Column names that legitimately wrap onto the line above the header row.
const WRAPPED_FRAGMENT = /SBP\s*\/\s*DBP|\(MAP\)|GCS\s*-|Resp\.?\s*Rate|SpO2|EtCO2|Blood Glucose/i;
// Centred section titles sit directly above the header row and must NOT be
// merged — doing so glues the title to the adjacent column name ("Vitals"+"HR"
// -> "VitalsHR"), which destroys the \bHR\b anchor and silently drops a column.
const SECTION_TITLE = /^\s*(Vitals?|Vital Signs|Mental Status[\w \-]*|Blood Glucose|Additional Values|Procedures|Medications)\s*$/i;

/** Merge a header line with the line above it so wrapped headers ("SBP/DBP" /
 *  "(MAP)") resolve to a single positional header string. */
function compositeHeader(lines, i) {
  const cur = lines[i] || '';
  const prev = lines[i - 1] || '';
  if (!prev.trim() || SECTION_TITLE.test(prev) || !WRAPPED_FRAGMENT.test(prev)) return cur;
  const len = Math.max(cur.length, prev.length);
  let out = '';
  for (let c = 0; c < len; c++) {
    const a = cur[c] || ' ';
    const b = prev[c] || ' ';
    out += a !== ' ' ? a : b;
  }
  return out;
}

/** Locate named columns in a header string. Returns [{key,start}] sorted. */
function anchors(header, spec) {
  const found = [];
  for (const [key, re] of spec) {
    const m = header.match(re);
    if (m) found.push({ key, start: m.index });
  }
  found.sort((a, b) => a.start - b.start);
  return found;
}

/**
 * Assign the cells of a data row to columns.
 *
 * Neither boundary slicing nor nearest-anchor matching is safe here, because
 * the two ingestion paths place values differently relative to their header:
 * pdftotext leaves them at or slightly LEFT of the header start, while pdf.js
 * pushes them several characters RIGHT. On tight tables that drift exceeds
 * half a column gap, so "nearest header" silently assigns SpO2 to Pain.
 *
 * What IS invariant across both extractors is column ORDER. So we align the
 * row's tokens to the header anchors monotonically — the same left-to-right
 * sequence, allowing empty columns to be skipped — choosing the alignment
 * that minimises total horizontal displacement. Both layouts then resolve
 * correctly without tuning any offset.
 */
function tokenize(line) {
  const toks = [];
  const rx = /\S(?:.*?\S)?(?=\s{2,}|$)/g;
  let m;
  while ((m = rx.exec(line))) toks.push({ t: m[0], start: m.index });
  return toks;
}

/**
 * Estimate the systematic horizontal offset between a table's header starts
 * and its value starts.
 *
 * pdftotext yields roughly 0; pdf.js yields a positive shift of several
 * characters. A sparse row (say HR and SpO2 only) carries too little
 * information to recover this on its own — that is precisely where a per-row
 * alignment goes wrong — so the offset is fitted ONCE across every row in the
 * table, where the dense rows dominate, and then applied to all of them.
 */
function estimateShift(lines, cols) {
  let bestShift = 0;
  let bestCost = Infinity;
  for (let shift = -8; shift <= 24; shift++) {
    let total = 0;
    let counted = 0;
    for (const line of lines) {
      const toks = tokenize(line);
      if (!toks.length || toks.length > cols.length) continue;
      total += alignCost(toks, cols, shift);
      counted++;
    }
    if (!counted) continue;
    if (total < bestCost) { bestCost = total; bestShift = shift; }
  }
  return bestShift;
}

/** Minimum total displacement of a monotonic alignment (cost only). */
function alignCost(toks, cols, shift) {
  const n = toks.length, k = cols.length;
  if (n > k) return Infinity;
  let prevRow = new Array(k).fill(Infinity);
  for (let j = 0; j < k; j++) prevRow[j] = Math.abs(toks[0].start - shift - cols[j].start);
  for (let i = 1; i < n; i++) {
    const row = new Array(k).fill(Infinity);
    let best = Infinity;
    for (let j = i; j < k; j++) {
      best = Math.min(best, prevRow[j - 1]);
      if (best < Infinity) row[j] = best + Math.abs(toks[i].start - shift - cols[j].start);
    }
    prevRow = row;
  }
  let min = Infinity;
  for (let j = n - 1; j < k; j++) min = Math.min(min, prevRow[j]);
  return min;
}

function mapTokens(line, cols, shift = 0) {
  const out = {};
  if (!cols.length) return out;

  const toks = tokenize(line).map((t) => ({ ...t, start: t.start - shift }));
  if (!toks.length) return out;

  const n = toks.length;
  const k = cols.length;

  // More tokens than columns: fall back to monotonic greedy, merging the
  // overflow into the final column rather than dropping it.
  if (n > k) {
    let j = 0;
    for (let i = 0; i < n; i++) {
      while (j < k - 1 && Math.abs(cols[j + 1].start - toks[i].start) < Math.abs(cols[j].start - toks[i].start)) j++;
      const key = cols[Math.min(j, k - 1)].key;
      out[key] = out[key] ? `${out[key]} ${toks[i].t}` : toks[i].t;
      if (j < k - 1) j++;
    }
    return out;
  }

  // cost[i][j] = best total displacement aligning tokens 0..i with token i
  // placed at column j (columns strictly increasing).
  const INF = Infinity;
  const cost = Array.from({ length: n }, () => new Array(k).fill(INF));
  const prev = Array.from({ length: n }, () => new Array(k).fill(-1));

  for (let j = 0; j < k; j++) cost[0][j] = Math.abs(toks[0].start - cols[j].start);
  for (let i = 1; i < n; i++) {
    for (let j = i; j < k; j++) {
      let best = INF, bestJ = -1;
      for (let p = i - 1; p < j; p++) {
        if (cost[i - 1][p] < best) { best = cost[i - 1][p]; bestJ = p; }
      }
      if (bestJ >= 0) {
        cost[i][j] = best + Math.abs(toks[i].start - cols[j].start);
        prev[i][j] = bestJ;
      }
    }
  }

  let endJ = -1, endCost = INF;
  for (let j = n - 1; j < k; j++) {
    if (cost[n - 1][j] < endCost) { endCost = cost[n - 1][j]; endJ = j; }
  }
  if (endJ < 0) return out;

  for (let i = n - 1, j = endJ; i >= 0; i--) {
    out[cols[j].key] = toks[i].t;
    j = prev[i][j];
    if (j < 0 && i > 0) break;
  }
  return out;
}

/** Plausibility clamps. A misread must not silently become a clinical flag. */
const RANGE = {
  hr: [20, 300],
  rr: [3, 80],
  spo2: [40, 100],
  etco2: [5, 99],
  temp: [28, 43],
  pain: [0, 10],
  sbp: [40, 300],
  dbp: [20, 200],
  map: [20, 250],
};

function clamp(key, v) {
  if (v === null || v === undefined) return null;
  const r = RANGE[key];
  if (!r) return v;
  return v >= r[0] && v <= r[1] ? v : null;
}

const VITAL_COLS = [
  ['dt', /Date\/Time/i],
  ['hr', /\bHR\b/],
  ['bp', /SBP\s*\/\s*DBP|\(MAP\)/i],
  ['rr', /Resp\.?\s*Rate/i],
  ['spo2', /SpO2/i],
  ['etco2', /EtCO2|ETCO2/i],
  ['temp', /Temp/i],
  ['pain', /\bPain\b/i],
];

// A data row begins with a date+time. The "|| PTA = x" suffix is present in
// the vitals table but absent in some mental-status layouts, so it is optional.
const ROW_START = /^\s*(\d\d\/\d\d\/\d{4})\s+(\d\d:\d\d:\d\d)\b/;

/** Blank the leading "MM/DD/YYYY HH:MM:SS || PTA = x" prefix while preserving
 *  character positions, so column offsets stay valid. Without this the date
 *  itself matches the blood-pressure pattern ("04/12"). */
function maskTimestamp(line) {
  // "PTA" and its "= No" can be split across lines, so the value part is
  // optional; without this the stray "PTA" survives as a token and shifts
  // every subsequent column assignment by one.
  const m = line.match(/^(\s*)(\d\d\/\d\d\/\d{4}\s+\d\d:\d\d:\d\d\s*(?:\|\|\s*(?:PTA\s*(?:=\s*\w+)?)?)?)/);
  if (!m) return line;
  return m[1] + ' '.repeat(m[2].length) + line.slice(m[1].length + m[2].length);
}

/** Pull BP out of a line and blank those characters, so the column slicer
 *  never has to disambiguate "97 / 54 ( 66 )" from a neighbouring cell. */
function extractBp(line) {
  const m = line.match(/(\d{2,3})\s*\/\s*(\d{2,3})\s*(?:\(\s*(\d{2,3})\s*\))?/);
  if (!m) return { bp: null, line };
  const masked = line.slice(0, m.index) + ' '.repeat(m[0].length) + line.slice(m.index + m[0].length);
  return {
    bp: {
      sbp: clamp('sbp', num(m[1])),
      dbp: clamp('dbp', num(m[2])),
      map: m[3] ? clamp('map', num(m[3])) : null,
    },
    line: masked,
  };
}

function parseVitals(text) {
  // Bound to the Vitals table proper — stop before Pulse/ECG so "4 Lead" and
  // rhythm strings never reach the numeric parser.
  const block = sectionBetween(text, /\n\s*Vital Signs\s*\n/i, [
    /Mental Status Assessment/i,
  ]);
  if (!block) return [];
  const lines = block.split('\n');

  // Find every vitals-table header in the block (a chart may paginate).
  const headers = [];
  lines.forEach((l, i) => {
    if (/Date\/Time/i.test(l) && /(\bHR\b|SpO2|SBP)/.test(compositeHeader(lines, i))) {
      headers.push(i);
    }
  });
  if (!headers.length) return [];

  const stopAt = lines.findIndex((l) => /Pulse\s*\/\s*ECG/i.test(l));
  const limit = stopAt >= 0 ? stopAt : lines.length;

  const rows = [];
  for (let h = 0; h < headers.length; h++) {
    const hi = headers[h];
    if (hi >= limit) continue;
    const cols = anchors(compositeHeader(lines, hi), VITAL_COLS);
    if (cols.length < 2) continue;
    const end = Math.min(h + 1 < headers.length ? headers[h + 1] - 1 : limit, limit);

    // BP is consumed separately; leaving its anchor in place would attract the
    // adjacent HR value, which sits between the two headers.
    const valueCols = cols.filter((c) => c.key !== 'bp' && c.key !== 'dt');

    // Fit the header-to-value offset across the whole table before reading any
    // single row, so a sparse row inherits the offset the dense rows establish.
    const prepared = [];
    for (let i = hi + 1; i < end; i++) {
      if (!ROW_START.test(lines[i])) continue;
      prepared.push({ i, ...extractBp(maskTimestamp(lines[i])) });
    }
    const shift = estimateShift(prepared.map((p) => p.line), valueCols);

    for (const { i, bp, line } of prepared) {
      const raw = lines[i];
      const m = raw.match(ROW_START);
      if (!m) continue;

      const cell = mapTokens(line, valueCols, shift);
      // continuation line carries qualifiers (Room Air, Normal, O2 device)
      const cont = lines[i + 1] && !ROW_START.test(lines[i + 1]) ? lines[i + 1] : '';
      const contCell = cont ? mapTokens(cont, valueCols, shift) : {};

      const int = (key, s) => {
        const v = (s || '').match(/\d+(?:\.\d+)?/);
        return clamp(key, v ? num(v[0]) : null);
      };
      const qual = `${cell.spo2 || ''} ${contCell.spo2 || ''} ${contCell.rr || ''}`;

      rows.push({
        date: m[1],
        time: m[2],
        pta: /PTA\s*=\s*Yes/i.test(raw),
        hr: int('hr', cell.hr),
        sbp: bp ? bp.sbp : null,
        dbp: bp ? bp.dbp : null,
        map: bp ? bp.map : null,
        rr: int('rr', cell.rr),
        spo2: int('spo2', cell.spo2),
        etco2: int('etco2', cell.etco2),
        temp: int('temp', cell.temp),
        pain: int('pain', cell.pain),
        roomAir: /Room Air/i.test(qual),
        supplementalO2:
          /Concentration O2|Nasal|Non-?Rebreather|\bNRB\b|BVM|Bag Valve|CPAP|BiPAP|Ventilat|Mechanically Assisted/i.test(
            `${raw} ${cont}`
          ),
        raw: collapse(raw.replace(/^\s*\d\d\/\d\d\/\d{4}\s+\d\d:\d\d:\d\d\s*(\|\|)?\s*(PTA\s*=\s*\w+)?/, '')),
      });
    }
  }
  // A row with no numeric content at all is a rhythm/qualifier artifact.
  return rows.filter(
    (r) => r.hr !== null || r.sbp !== null || r.rr !== null || r.spo2 !== null || r.temp !== null
  );
}

const GCS_COLS = [
  ['dt', /Date\/Time/i],
  ['avpu', /AVPU/i],
  ['rass', /RASS/i],
  ['total', /\bTotal\b/i],
  ['scale', /Glasgow Coma Scale/i],
  ['qual', /GCS\s*-\s*Qualifier/i],
];

function parseGcs(text) {
  const block = sectionBetween(text, /Mental Status Assessment/i, [
    /Vitals Methods of Measurements/i,
    /Blood Glucose/i,
    /Additional Values/i,
    /\n\s*Procedures\s*\n/i,
  ]);
  if (!block) return [];
  const lines = block.split('\n');
  const hi = lines.findIndex(
    (l, i) => /Date\/Time/i.test(l) && /\bTotal\b/i.test(compositeHeader(lines, i))
  );
  if (hi < 0) return [];
  const cols = anchors(compositeHeader(lines, hi), GCS_COLS);
  const totalCol = cols.find((c) => c.key === 'total');
  if (!totalCol) return [];
  const valueCols = cols.filter((c) => c.key !== 'dt');

  const dataIdx = [];
  for (let i = hi + 1; i < lines.length; i++) if (ROW_START.test(lines[i])) dataIdx.push(i);
  const shift = estimateShift(dataIdx.map((i) => maskTimestamp(lines[i])), valueCols);

  const out = [];
  for (const i of dataIdx) {
    const m = lines[i].match(ROW_START);
    if (!m) continue;
    const cell = mapTokens(maskTimestamp(lines[i]), valueCols, shift);
    const cont =
      lines[i + 1] && !ROW_START.test(lines[i + 1])
        ? mapTokens(lines[i + 1], valueCols, shift)
        : {};
    const tot = (cell.total || '').match(/\b(\d{1,2})\b/);
    let avpu = `${cell.avpu || ''}${cont.avpu || ''}`.replace(/\s+/g, '');
    if (/unrespo/i.test(avpu)) avpu = 'Unresponsive';
    else if (/^alert/i.test(avpu)) avpu = 'Alert';
    else if (/^verbal/i.test(avpu)) avpu = 'Verbal';
    else if (/^pain/i.test(avpu)) avpu = 'Painful';
    else avpu = '';
    const g = tot ? num(tot[1]) : null;
    if (g === null || g < 3 || g > 15) continue;

    // The qualifier column matters clinically: a GCS of 8 in a chemically
    // sedated, intubated patient is a pharmacologic number, not a neurologic
    // one, and must not be read as spontaneous obtundation.
    const qualText = `${cell.qual || ''} ${cont.qual || ''}`;
    // The qualifier cell overlaps the wide "Glasgow Coma Scale" column, so
    // keep only the recognised qualifier phrases rather than the raw slice.
    const known = [
      /Patient (?:Chemically )?Intubated/i,
      /Patient Chemically Sedated/i,
      /Patient Chemically Paralyzed/i,
      /Eye Obstruction/i,
      /GCS has legitimate values without interventions/i,
    ];
    const parts = known.map((re) => (qualText.match(re) || [])[0]).filter(Boolean);
    const confounded = /Intubat|Sedat|Paralyz/i.test(qualText);
    out.push({
      date: m[1],
      time: m[2],
      avpu,
      gcs: g,
      qualifier: parts.length ? parts.join('; ') : collapse(qualText).slice(0, 120),
      confounded,
    });
  }
  return out;
}

// Section headers that terminate a value table. Without this bound the
// glucose reader runs on into "Additional Values" and reads the Revised
// Trauma Score as a blood sugar.
const NEXT_SECTION = /\n\s*(Additional Values|Stroke Values|Procedures|Medications?|Mental Status|Pulse\s*\/\s*ECG|Vitals Methods|Cardiac Arrest|Narrative)\s*\n/i;

function parseGlucose(text) {
  const out = [];
  const lines = text.split('\n');

  for (let h = 0; h < lines.length; h++) {
    // Two column variants exist: a numeric "Blood Glucose Level" and a
    // categorical "Blood Glucose Other" carrying High/Low when the meter is
    // out of range. Both matter — an out-of-range reading is a finding.
    if (!/Blood Glucose\s+(Level|Other)/i.test(lines[h])) continue;

    const cols = anchors(lines[h], [
      ['dt', /Date\/Time/i],
      ['bgl', /Blood Glucose\s+(Level|Other)/i],
    ]);

    for (let i = h + 1; i < lines.length; i++) {
      // Stop at the next section so "Revised Trauma Score" is never read as a
      // blood sugar.
      if (NEXT_SECTION.test('\n' + lines[i] + '\n')) break;
      // Some rows carry only "|| PTA = Yes" with no timestamp.
      if (!ROW_START.test(lines[i]) && !/\|\|\s*PTA/i.test(lines[i])) continue;

      const masked = maskTimestamp(lines[i]).replace(/\|\|\s*PTA\s*=\s*\w+/i, (s) => ' '.repeat(s.length));
      const cell = cols.length === 2 ? mapTokens(masked, cols.filter((c) => c.key !== 'dt')) : { bgl: masked };
      const v = (cell.bgl || '').match(/\b(HIGH|LOW|HI|LO|\d{2,4})\b/i);
      if (!v) continue;
      const token = v[1].toUpperCase();
      const val = /^\d+$/.test(token) ? num(token) : token === 'HIGH' ? 'HI' : token === 'LOW' ? 'LO' : token;
      // Plausible capillary glucose range, or an out-of-range meter reading.
      if (typeof val === 'number' && (val < 10 || val > 2000)) continue;
      if (!out.includes(val)) out.push(val);
    }
  }
  return out;
}

function parseMedications(text) {
  const out = [];
  const re = /Medication Administration/gi;
  let m;
  while ((m = re.exec(text))) {
    const block = text.slice(m.index, m.index + 3500);
    for (const line of block.split('\n')) {
      const mm = line.match(/^\s*(\d\d:\d\d:\d\d)\s+(Yes|No)\s+(.+)$/i);
      if (!mm) continue;
      const parts = mm[3].split(/\s{2,}/).map((s) => s.trim()).filter(Boolean);
      const entry = { time: mm[1], text: collapse(mm[3]), name: parts[1] || parts[0] || '' };
      if (!out.some((e) => e.time === entry.time && e.text === entry.text)) out.push(entry);
    }
  }
  return out;
}

function parseNarrative(text) {
  let block = sectionBetween(text, /\n\s*Narrative\s*\n/i, [
    /Hospital Team Activations/i,
    /\n\s*Cardiac Arrest\s*\n/i,
    /Protocols Used/i,
  ]);
  block = block
    .replace(/^\s*Narrative\s*\n/i, '')
    .replace(/Patient Care Report\s*/gi, '')
    .replace(/\s*Narrative:\s*/gi, ' ')
    .replace(/[ \t]{2,}/g, ' ');
  return block.trim();
}

/* ---------------------------------------------------------------------------
 * Record assembly
 * -------------------------------------------------------------------------*/

function normAcuity(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('critical') || s.includes('red')) return 'Critical (Red)';
  if (s.includes('emergent') || s.includes('yellow')) return 'Emergent (Yellow)';
  if (s.includes('lower') || s.includes('green')) return 'Lower Acuity (Green)';
  if (s.includes('non-acute') || s.includes('non acute')) return 'Non-Acute';
  return raw || '';
}

function normMode(raw) {
  const s = (raw || '').toLowerCase();
  if (s.includes('non-emergent') || s.includes('non emergent')) return 'Non-Emergent';
  if (s.includes('emergent')) return 'Emergent';
  return raw || '';
}


/* ---------------------------------------------------------------------------
 * Layout-aware label/value extraction
 * ---------------------------------------------------------------------------
 * Written against real ImageTrend "EMS Patient Care Report (3.5)" exports. The
 * report is a TWO-COLUMN form, and both halves of a pair wrap vertically:
 *
 *        Incident   75123459          <- label starts, value sits beside it
 *              # :                    <- label finishes, colon here
 *
 *        Destination Name  : AdventHealth
 *                            Shawnee Mission        <- value continues below
 *
 * A per-label regex cannot read that. `field('Incident #')` never matches
 * because the two halves of the label are on different lines, and
 * `field('Destination Name')` stops at the line break and returns half a
 * hospital. Against these three charts the old approach produced an empty
 * incident number, an empty origin, "UNIVERSITY OF" for a destination and
 * "Non-" for a transport mode.
 *
 * So: find every colon, walk UP for the rest of the label and the start of the
 * value, walk DOWN for the rest of the value, and cut at column gaps.
 * ------------------------------------------------------------------------*/

const colAt = (line, from, to) => (line || '').slice(from, to);
const firstCell = (s) => s.split(/\s{3,}/)[0].trim();
const blankIn = (line, from, to) => !colAt(line, from, to).trim();

/** Footer, URL and pagination fragments that bleed in from other columns. */
const BLEED = /https?:|%[0-9A-F]{2}|Page \d+ of \d+|imagetrend/i;

/** Join continuation fragments, respecting a hyphen split ("Non-" + "Emergent"). */
function joinValue(parts) {
  let out = '';
  for (const raw of parts) {
    const part = raw.trim();
    if (!part || BLEED.test(part)) continue;
    if (!out) out = part;
    else if (out.endsWith('-')) out += part;
    else out += ' ' + part;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export function layoutPairs(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const m of [...line.matchAll(/:/g)]) {
      const c = m.index;
      const left = line.slice(0, c);
      const segs = left.split(/\s{3,}/).map((x) => x.trim()).filter(Boolean);
      const label = segs[segs.length - 1] || '';
      if (!/[A-Za-z#]/.test(label)) continue;
      const labStart = left.lastIndexOf(label);
      const vStart = c + 1;

      // Upwards: the rest of a wrapped label, and the value that sits beside
      // the label's FIRST line rather than beside its colon.
      const labelPre = [];
      const valuePre = [];
      for (let up = i - 1; up >= 0 && up > i - 4; up--) {
        const prev = lines[up];
        if (blankIn(prev, Math.max(0, labStart - 8), c + 1) && blankIn(prev, vStart, vStart + 42)) break;
        // A colon in this band means that line is its own pair, not our label.
        if (colAt(prev, Math.max(0, labStart - 8), vStart + 2).includes(':')) break;
        const lab = firstCell(colAt(prev, Math.max(0, labStart - 8), c + 1));
        const val = firstCell(colAt(prev, vStart, vStart + 42));
        if (!lab && !val) break;
        if (lab) labelPre.unshift(lab);
        if (val) valuePre.unshift(val);
      }

      // Downwards: the rest of a wrapped value.
      const valuePost = [];
      for (let dn = i + 1; dn < lines.length && dn < i + 7; dn++) {
        const nxt = lines[dn];
        if (colAt(nxt, Math.max(0, vStart - 30), vStart + 2).includes(':')) break;
        const val = firstCell(colAt(nxt, vStart, vStart + 42));
        if (!val) break;
        valuePost.push(val);
      }

      const fullLabel = [...labelPre, label].join(' ').replace(/\s+/g, ' ').trim();
      const value = joinValue([...valuePre, firstCell(colAt(line, vStart, vStart + 42)), ...valuePost]);
      if (fullLabel && value) out.push({ label: fullLabel, value });
    }
  }
  return out;
}

/**
 * Labels are matched loosely on purpose.
 *
 * Column slicing shaves characters off the front of a wrapped label — the real
 * export yields "f Patient During Transport" and "Crew Member mpleting this
 * Report". Requiring an exact string would drop both. Matching on the distinctive
 * tail is stable against that, and these labels are distinctive enough that a
 * loose match cannot collide.
 */
const FIELD_PATTERNS = {
  incident: [/^incident\s*#/i],
  originName: [/incident name/i],
  originType: [/incident type/i],
  destination: [/destination name/i],
  destinationReason: [/destination reason/i],
  transportMode: [/^transport mode$/i, /ems transport method/i],
  transportDescriptors: [/transport mode descriptors/i],
  levelOfService: [/type of service/i, /^requested$/i],
  // The technician who took patient care and wrote the narrative.
  author: [/crew member.*(completing|mpleting).*report/i],
  movedToAmbulance: [/patient moved to ambulance/i],
  movedByMethod: [/moved from ambulance/i],
  position: [/patient during transport/i],
  impression: [/^primary impression/i],
  acuity: [/initial patient acuity/i],
  destinationType: [/destination type/i],
  dateOfService: [/transport date/i, /^date of service/i],
  // What crews actually quote to each other: the 8-digit EMS Response number
  // from LOGIS, which is what the IFT handbook has them scan onto trailing
  // documents. The label spans three lines in the export -- "EMS" / "Response"
  // / "# :" -- with the value beside the first.
  responseNo: [/ems\s*response\s*#?/i, /^response\s*#?$/i],
};

/**
 * Trailing fragments that belong to the next column, not to this value.
 *
 * A value's column window is a fixed width, so a neighbouring narrow column
 * sometimes lands inside it — "Hospital-to-Hospital Transfer 12650" picks up
 * the EMS unit number sitting to its right. Only a bare trailing number is
 * stripped, because that is the shape that bleeds; real values do not end in
 * a naked four-digit run.
 */
const TRAILING_BLEED = /\s+\d{4,}$/;

/**
 * Fields whose value legitimately ends in a long number, and which therefore
 * must NOT be de-bled. Stripping the tail off "Ground 75123459" left every
 * chart with an incident of "Ground", so all three collapsed onto one key and
 * the importer showed a single record.
 */
const KEEPS_TRAILING_NUMBER = new Set(['incident', 'dateOfService']);

/**
 * Pull a person's name out of a crew-member cell.
 *
 * The real export renders these as "Vance, Kim (00000)", and the column window
 * sometimes catches a tail of the preceding cell, so the raw value arrives as
 * "ure. Vance, Kim (00000)" — the end of "Signature" plus the name plus an
 * employee number. Addressing feedback to "ure. Vance, Kim (00000)" would be
 * worse than not naming anyone.
 *
 * Reordered to "Kim Vance" so it reads the way every other name in this
 * app does, and the employee number is dropped: it identifies the person more
 * than the message needs to, and it is not what a colleague would call them.
 */
export function cleanName(raw) {
  const v = String(raw ?? '').replace(/\(\s*\d+\s*\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (!v) return '';
  const m = v.match(/([A-Z][A-Za-z''\-]{1,24}),\s*([A-Z][A-Za-z''\-]{1,24})/);
  if (m) return `${m[2]} ${m[1]}`;
  // No "Last, First" shape — keep alphabetic words only, so leading fragments
  // like "ure." fall away rather than being addressed by name.
  const words = v.split(/\s+/).filter((w) => /^[A-Z][A-Za-z''\-]{1,24}$/.test(w));
  return words.slice(0, 3).join(' ');
}

/** First value whose label matches, or ''. */
export function pickField(pairs, key) {
  const pats = FIELD_PATTERNS[key];
  if (!pats) return '';
  for (const pat of pats) {
    const hit = pairs.find((p) => pat.test(p.label));
    if (!hit || !hit.value) continue;
    return KEEPS_TRAILING_NUMBER.has(key)
      ? hit.value.trim()
      : hit.value.replace(TRAILING_BLEED, '').trim();
  }
  return '';
}

export function parseRecord(rawText) {
  const text = stripNoise(rawText);
  // Layout pass first — it reads the two-column form correctly. The older
  // per-label regexes stay as a fallback for anything it does not find, and
  // for exports whose layout differs again.
  const pairs = layoutPairs(text);
  const L = (k) => pickField(pairs, k);

  // The layout value can carry a leading service word ("Ground 75123459"),
  // so take the number rather than the first token.
  const incidentRaw = L('incident') || field(text, 'Incident #', { stopAtGap: true });
  const incident = (incidentRaw.match(/\d{5,}/) || [])[0] || incidentRaw.split(/\s+/)[0] || '';
  // pdf.js emits wrapped labels with no separating space, so the value can be
  // welded to the label ("Initial PatientEmergent (Yellow)"). Match the known
  // acuity vocabulary directly rather than relying on a delimiter.
  const acuityRaw =
    (text.match(/Initial Patient\s*(?:Acuity)?\s*:?\s*(Critical[^\n]*|Emergent[^\n]*|Lower Acuity[^\n]*|Non-?\s?Acute[^\n]*)/i) || [])[1] ||
    (text.match(/Initial Patient\s*([^\n]*)/i) || [])[1] ||
    '';

  const vitals = parseVitals(text);
  const gcs = parseGcs(text);

  const transportDescRaw = fieldWrapped(text, 'Transport Mode Descriptors', 2);
  const lightsSirens = /Lights and Sirens/i.test(transportDescRaw)
    ? 'Yes'
    : /No Lights or\s*Sirens/i.test(transportDescRaw.replace(/\s+/g, ' ')) ||
      /No Lights/i.test(transportDescRaw)
    ? 'No'
    : '';

  const rec = {
    source: 'pdf',
    incident,
    responseNo:
      (L('responseNo').match(/\d{6,}/) || [])[0] ||
      (text.match(/EMS Response\s*(?:#:)?\s*(\d+)/i) || [])[1] ||
      '',
    // The real export labels this "Transport Date"; the last resort is simply
    // the first date on the chart, which beats an empty field on every screen
    // that sorts or filters by it.
    dateOfService:
      (L('dateOfService').match(/\d\d\/\d\d\/\d{4}/) || [])[0] ||
      (text.match(/Date of Service:?:?\s*(\d\d\/\d\d\/\d{4})/i) || [])[1] ||
      (text.match(/\b(\d\d\/\d\d\/\d{4})\b/) || [])[1] ||
      '',
    patientName: field(text, 'Patient Name', { stopAtGap: true }),
    age: (text.match(/Age:\s*(\d+)\s*(Years|Months|Days)/i) || []).slice(1).join(' '),
    ageYears: num((text.match(/Age:\s*(\d+)\s*Years/i) || [])[1]),
    sex: (text.match(/Gender:\s*(\w+)/i) || [])[1] || '',
    dispatchNature: field(text, 'Nature of Call', { stopAtGap: true }),
    emdCard: (text.match(/EMD Card Number:\s*(\S+)/i) || [])[1] || '',
    impression: L('impression') || field(text, 'Primary Impression', { stopAtGap: true }),
    acuity: normAcuity(acuityRaw),
    responseMode: normMode(fieldWrapped(text, 'Response Mode to Scene', 2)),
    transportMode: normMode(L('transportMode') || field(text, 'Transport Mode', { stopAtGap: true })),
    transportDescriptors: transportDescRaw,
    lightsSirens,
    serviceRequested: fieldWrapped(text, 'Type of Service Requested', 2),
    destination: L('destination') || field(text, 'Destination Name', { stopAtGap: true }),
    destinationReason: L('destinationReason') || field(text, 'Destination reason', { stopAtGap: true }),
    // Value may sit on the same line or the next, depending on the extractor.
    preArrivalAlert:
      (text.match(/Destination Team Pre-Arrival Alert or Activation\s*:?\s*(Yes[^\s]*|No)\b/i) || [])[1] ||
      (text.match(/Destination Team Pre-Arrival Alert or Activation[^\n]*\n\s*(Yes[^\s]*|No)\b/i) || [])[1] ||
      '',
    // Same welding problem: "...on scene withYes - This AMR". Accept an
    // optional colon and zero whitespace between label and value.
    alsOnScene:
      (text.match(/ALS provider on scene\s*with\s*:?\s*(Yes|No)\b/i) || [])[1] ||
      (text.match(/ALS provider on scene[\s\S]{0,90}?:\s*(Yes|No)\b/i) || [])[1] ||
      '',
    movedToAmbulance: L('movedToAmbulance') || fieldWrapped(text, 'Patient Moved to Ambulance', 1),

    // ----- medical-necessity additions ------------------------------------
    // Fields the emergent-transport review never needed. The mode question is
    // answered by acuity and vitals; the necessity question is answered by how
    // the patient moves, where they came from, and what was running in transit.
    //
    // These PDF anchors are NOT part of the 13-chart validation the rest of
    // this parser carries — that ground truth predates them. They are written
    // defensively (miss rather than guess) and every one of them has a CSV/JSON
    // alias, which is the ingestion path to prefer while they are unproven.
    // A miss costs a "not documented" finding, which is recoverable; a wrong
    // value would be a confident false pass, which is not.
    // For an interfacility transport the "incident" is the sending facility,
    // so ImageTrend's Incident Name / Incident Type ARE the origin.
    originName: L('originName') || field(text, 'Incident Facility Name', { stopAtGap: true }),
    originType: L('originType') || fieldWrapped(text, 'Incident Location Type', 1),
    position: L('position') || fieldWrapped(text, 'Position of Patient During Transport', 1),
    movedByMethod: L('movedByMethod') || fieldWrapped(text, 'Patient Moved to Ambulance by', 1),
    levelOfService: L('levelOfService') || fieldWrapped(text, 'Type of Service Requested', 2),
    /**
     * Who wrote the report.
     *
     * Distinct from `crew`, and the distinction matters: coaching goes to the
     * person who wrote the narrative, not to whoever else was on the truck.
     * The IFT Field Handbook is explicit that "the technician who took patient
     * care writes the ePCR", so the primary patient caregiver is the author.
     *
     * Like the other fields added for this tool, the PDF anchors below are
     * outside the parser's 13-chart validation. Prefer the CSV/JSON column.
     */
    // "Crew Member Completing this Report" in the real export — the
    // technician who took patient care and wrote the narrative.
    author:
      cleanName(L('author')) ||
      field(text, 'Primary Patient Caregiver', { stopAtGap: true }) ||
      field(text, 'Report Author', { stopAtGap: true }) ||
      '',
    crew: (() => {
      const out = [];
      const re = /Crew Member(?:\s*ID)?\s*:?\s*([A-Za-z][A-Za-z'\-. ]{2,40}?)\s{2,}/g;
      let m;
      while ((m = re.exec(text))) out.push(m[1].trim());
      return [...new Set(out)].join('; ');
    })(),
    pcs: /Physician Certification Statement|PCS\b|Certificate of Medical Necessity|CMN\b/i.test(text)
      ? 'Referenced'
      : '',
    cardiacArrest: (text.match(/Cardiac Arrest:\s*(\w+)/i) || [])[1] || '',
    complaints: (() => {
      const cm = sectionBetween(text, /Patient Complaints/i, [
        /Chief Complaint Global/i,
        /Medical History/i,
        /Possible Injury/i,
      ]);
      const out = [];
      const re = /Chief \(Primary\)\s+(.+?)\s{2,}(\S+)\s+(\w+)/g;
      let m;
      while ((m = re.exec(cm))) out.push(`${m[1].trim()} (${m[2]} ${m[3]})`);
      return out.join('; ');
    })(),
    vitals,
    gcs,
    glucose: parseGlucose(text),
    medications: parseMedications(text),
    narrative: parseNarrative(text),
    _rawLength: text.length,
  };

  rec.times = {};
  for (const [label, key] of [
    ['Unit Notified by Dispatch', 'notified'],
    ['Unit Arrived on Scene', 'onScene'],
    ['Unit Left Scene', 'leftScene'],
    ['Patient Arrived at Destination', 'atDestination'],
  ]) {
    const m = text.match(
      new RegExp(label + ':\\s*(\\d\\d\\/\\d\\d\\/\\d{4})\\s*\\n?\\s*(\\d\\d:\\d\\d:\\d\\d)', 'i')
    );
    rec.times[key] = m ? `${m[1]} ${m[2]}` : '';
  }

  rec.completeness = computeCompleteness(rec);
  return rec;
}

/**
 * How much of the record actually parsed — surfaces silent extraction failure.
 *
 * Weighted toward the fields necessity scoring reads. `narrative`, `origin` and
 * `movedToAmbulance` matter more here than `acuity` does: a chart that parsed
 * its acuity but lost its narrative is useless to this tool, and would look
 * healthy on the emergent review's version of this check.
 */
function computeCompleteness(rec) {
  const checks = {
    incident: !!rec.incident,
    dateOfService: !!rec.dateOfService,
    impression: !!rec.impression,
    transportMode: !!rec.transportMode,
    vitals: rec.vitals.length > 0,
    narrative: rec.narrative.length > 120,
    origin: !!rec.originName || !!rec.originType,
    destination: !!rec.destination,
    movement: !!rec.movedToAmbulance || !!rec.movedByMethod || !!rec.position,
  };
  const got = Object.values(checks).filter(Boolean).length;
  return { checks, score: got / Object.keys(checks).length };
}

/* ---------------------------------------------------------------------------
 * Structured import (CSV / JSON)
 * -------------------------------------------------------------------------*/

const ALIASES = {
  incident: ['incident', 'incident #', 'incident number', 'incidentnumber', 'pcr', 'pcr #', 'eincident.01'],
  dateOfService: ['date of service', 'dos', 'incident date', 'date'],
  patientName: ['patient name', 'patient', 'name'],
  age: ['age'],
  sex: ['gender', 'sex'],
  dispatchNature: ['nature of call', 'dispatch nature', 'complaint reported by dispatch', 'edispatch.01'],
  impression: ['primary impression', 'impression', 'esituation.11'],
  acuity: ['initial patient acuity', 'acuity', 'patient acuity', 'esituation.13'],
  responseMode: ['response mode to scene', 'response mode', 'eresponse.23'],
  transportMode: ['transport mode', 'edisposition.18'],
  transportDescriptors: ['transport mode descriptors', 'edisposition.19'],
  destination: ['destination name', 'destination', 'edisposition.01'],
  destinationReason: ['destination reason', 'edisposition.20'],
  preArrivalAlert: ['pre-arrival alert', 'destination team pre-arrival alert or activation'],
  alsOnScene: ['als on scene', 'was there an als provider on scene'],
  narrative: ['narrative', 'patient care report narrative', 'enarrative.01'],

  // ----- medical-necessity additions --------------------------------------
  // Prefer this path over PDF extraction for these fields: the PDF anchors
  // above are unvalidated, these column names are exact matches.
  originName: ['origin', 'origin name', 'sending facility', 'incident facility name', 'pickup', 'pickup location'],
  originType: ['origin type', 'incident location type', 'einjury.01', 'escene.09'],
  position: ['patient position', 'position of patient during transport', 'transport position'],
  movedToAmbulance: ['patient moved to ambulance', 'moved to ambulance', 'edisposition.16'],
  movedByMethod: ['patient moved to ambulance by', 'moved by', 'transfer method'],
  levelOfService: ['level of service', 'type of service requested', 'service level', 'edisposition.21', 'eresponse.05'],
  crew: ['crew', 'crew members', 'personnel', 'attendant'],
  author: ['author', 'report author', 'created by', 'written by', 'primary caregiver', 'primary patient caregiver'],
  pcs: ['pcs', 'physician certification statement', 'cmn', 'certificate of medical necessity'],
  mobility: ['mobility', 'ambulatory status', 'functional status'],
};

function csvRows(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

function mapKeys(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const norm = h.toLowerCase().trim();
    for (const [key, alts] of Object.entries(ALIASES)) {
      if (alts.includes(norm)) { map[key] = i; break; }
    }
  });
  return map;
}

/** Accepts an inline vitals string like "HR 88; BP 133/85 (97); RR 16; SpO2 98". */
function vitalsFromString(s) {
  if (!s) return [];
  return s.split(/\s*\|\s*/).map((chunk) => {
    const bp = chunk.match(/(\d{2,3})\s*\/\s*(\d{2,3})(?:\s*\(\s*(\d{2,3})\s*\))?/);
    const g = (re) => { const m = chunk.match(re); return m ? num(m[1]) : null; };
    return {
      date: (chunk.match(/(\d\d\/\d\d\/\d{4})/) || [])[1] || '',
      time: (chunk.match(/(\d\d:\d\d(?::\d\d)?)/) || [])[1] || '',
      hr: g(/HR\s*[:= ]\s*(\d{2,3})/i),
      sbp: bp ? num(bp[1]) : null,
      dbp: bp ? num(bp[2]) : null,
      map: bp && bp[3] ? num(bp[3]) : null,
      rr: g(/RR\s*[:= ]\s*(\d{1,2})/i),
      spo2: g(/SpO2\s*[:= ]\s*(\d{2,3})/i),
      roomAir: /room air/i.test(chunk),
      // \bO2\b deliberately: a bare "O2" substring also occurs inside "SpO2",
      // which would mark every oxygenation reading as supplemental oxygen and
      // suppress the "hypoxia documented without oxygen therapy" finding.
      supplementalO2:
        !/room air/i.test(chunk) &&
        /\bO2\b|nasal|\bNRB\b|non-?rebreather|\bBVM\b|bag valve|bipap|cpap|ventilat/i.test(chunk),
      raw: collapse(chunk),
    };
  });
}

export function parseStructured(text, filename = '') {
  let records = [];
  const trimmed = text.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data = JSON.parse(trimmed);
    records = Array.isArray(data) ? data : data.records || [data];
    records = records.map((r) => normaliseImported(r));
  } else {
    const rows = csvRows(text);
    if (rows.length < 2) return [];
    const map = mapKeys(rows[0]);
    const vitalsIdx = rows[0].findIndex((h) => /vitals/i.test(h));
    const gcsIdx = rows[0].findIndex((h) => /^gcs/i.test(h.trim()));
    records = rows.slice(1).map((r) => {
      const o = {};
      for (const [key, idx] of Object.entries(map)) o[key] = (r[idx] || '').trim();
      if (vitalsIdx >= 0) o.vitals = vitalsFromString(r[vitalsIdx]);
      if (gcsIdx >= 0) {
        const g = num(r[gcsIdx]);
        if (g !== null) o.gcs = [{ date: '', time: '', avpu: '', gcs: g }];
      }
      return normaliseImported(o);
    });
  }
  return records.map((r) => ({ ...r, source: filename ? `import:${filename}` : 'import' }));
}

function normaliseImported(o) {
  const rec = {
    source: 'import',
    incident: String(o.incident ?? o.incidentNumber ?? '').trim(),
    responseNo: String(o.responseNo ?? '').trim(),
    dateOfService: String(o.dateOfService ?? '').trim(),
    patientName: String(o.patientName ?? '').trim(),
    age: String(o.age ?? '').trim(),
    ageYears: num(String(o.age ?? '').replace(/[^\d.]/g, '')),
    sex: String(o.sex ?? '').trim(),
    dispatchNature: String(o.dispatchNature ?? '').trim(),
    emdCard: String(o.emdCard ?? '').trim(),
    impression: String(o.impression ?? '').trim(),
    acuity: normAcuity(String(o.acuity ?? '')),
    responseMode: normMode(String(o.responseMode ?? '')),
    transportMode: normMode(String(o.transportMode ?? '')),
    transportDescriptors: String(o.transportDescriptors ?? '').trim(),
    lightsSirens: '',
    serviceRequested: String(o.serviceRequested ?? '').trim(),
    destination: String(o.destination ?? '').trim(),
    destinationReason: String(o.destinationReason ?? '').trim(),
    preArrivalAlert: String(o.preArrivalAlert ?? '').trim(),
    alsOnScene: String(o.alsOnScene ?? '').trim(),
    movedToAmbulance: String(o.movedToAmbulance ?? '').trim(),
    cardiacArrest: String(o.cardiacArrest ?? '').trim(),
    complaints: String(o.complaints ?? '').trim(),
    vitals: Array.isArray(o.vitals) ? o.vitals : vitalsFromString(o.vitals),
    gcs: Array.isArray(o.gcs) ? o.gcs : [],
    glucose: Array.isArray(o.glucose) ? o.glucose : [],
    medications: Array.isArray(o.medications) ? o.medications : [],
    narrative: String(o.narrative ?? '').trim(),
    times: o.times || {},

    // ----- medical-necessity additions ------------------------------------
    // This function rebuilds the record field by field rather than spreading
    // `o`, so anything added to ALIASES and not added here is mapped from the
    // column and then silently dropped. Keep the two lists in step.
    originName: String(o.originName ?? '').trim(),
    originType: String(o.originType ?? '').trim(),
    position: String(o.position ?? '').trim(),
    movedByMethod: String(o.movedByMethod ?? '').trim(),
    levelOfService: String(o.levelOfService ?? '').trim(),
    crew: String(o.crew ?? '').trim(),
    author: String(o.author ?? '').trim(),
    pcs: String(o.pcs ?? '').trim(),
    mobility: String(o.mobility ?? '').trim(),
  };
  const d = rec.transportDescriptors;
  rec.lightsSirens = /lights and sirens/i.test(d) ? 'Yes' : /no lights/i.test(d) ? 'No' : '';
  rec.completeness = computeCompleteness(rec);
  return rec;
}

/* ---------------------------------------------------------------------------
 * Entry point
 * -------------------------------------------------------------------------*/

export async function ingestFile(file, onProgress) {
  const name = file.name || 'file';
  if (/\.pdf$/i.test(name)) {
    const text = await pdfToText(file, onProgress);
    return splitRecords(text)
      .map((r) => parseRecord(r))
      .filter((r) => r.incident || r.completeness.score > 0.3)
      .map((r) => ({ ...r, source: `pdf:${name}` }));
  }
  const text = await file.text();
  return parseStructured(text, name);
}
