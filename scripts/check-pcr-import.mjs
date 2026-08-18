// Checks for the bulk PCR import: PDF text model, field parse, auto-answers.
//
// These run against a SYNTHETIC chart built out of text items, not a real
// export. Two reasons, and the first is not negotiable: a real PCR is a patient
// record and does not belong in a repository. The second is that a fixture can
// be made to contain exactly the layout quirks that broke this code, which a
// real chart only does by luck.
//
// The quirks encoded below are all ones that produced a wrong answer at some
// point while this was being written:
//
//   - Labels and values are told apart by FONT, not by punctuation. A value
//     like "Non- Emergent EMS Vehicle (Unit) Number:" looks exactly like a
//     label to any regex.
//   - A long narrative continues at the TOP of the next page, after that
//     page's own fields, so in reading order it trails an unrelated value.
//   - Table cells wrap mid-word: "50 Milligra" / "ms (mg)".
//   - Matching against text with the spaces removed makes short needles
//     dangerous: "Paramedic Protocol" contains "cpr".
//
// Run: node scripts/check-pcr-import.mjs
import { readFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-pcr-import-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export * from ${JSON.stringify(join(SRC, 'modules/review/pcrText'))}
      export * from ${JSON.stringify(join(SRC, 'modules/review/pcrParse'))}
      export * from ${JSON.stringify(join(SRC, 'modules/review/autoAnswer'))}
      export { visibleQuestions, compliantAnswer } from ${JSON.stringify(join(SRC, 'data/chartReview'))}
      export * from ${JSON.stringify(join(SRC, 'modules/review/pdfCompat'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
  // pdf.js is only reached by readPcrPdf, which the browser calls. Everything
  // under test takes items and never touches it.
  external: ['pdfjs-dist', 'pdfjs-dist/build/pdf.worker.mjs?url'],
})

let m
try {
  m = await import(pathToFileURL(OUT).href)
} catch (err) {
  console.log('FAIL  the PCR import modules throw on load')
  console.log(`      ${err.message}`)
  // The narrative slice is device-local ONLY because it is absent from the sync
// list. That is one line in another file and nothing else enforces it, so it is
// asserted here rather than left to a comment.
{
  const records = readFileSync(join(SRC, 'lib/records.ts'), 'utf8')
  check(
    !/chartNarratives/.test(records),
    'narratives are not in the sync slices, so they never leave the device',
    'lib/records.ts mentions chartNarratives — a narrative would sync to the server',
  )
}

rmSync(OUT, { force: true })
  process.exit(1)
}

let failed = 0
const check = (ok, label, detail) => {
  if (!ok) failed++
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${label}`)
  if (!ok && detail) console.log(`        ${detail}`)
}

check(true, 'PCR import modules load')

// ----- fixture ---------------------------------------------------------------
//
// LABEL and VALUE are two font names. Which is which is worked out by the code
// under test, so they are deliberately named in the wrong order relative to how
// they are used — a check that hardcoded "the first font is the label" would
// pass on a document where pdf.js numbered them the other way round.

const LABEL = 'g_d0_f2'
const VALUE = 'g_d0_f1'
const CHROME = 'g_d0_f9'

/** Builder mirroring how ImageTrend emits a page: down a column, then across. */
function page(n) {
  const items = []
  let y = 730
  return {
    /** A label and its value, one form field. The colon is part of the label
     *  item, as it is in the export — that is what marks it as a label at all. */
    field(label, value) {
      items.push({ page: n, x: 90, y, str: `${label}:`, font: LABEL })
      if (value !== null) items.push({ page: n, x: 240, y, str: value, font: VALUE })
      y -= 20
      return this
    },
    /** A label with no value at all — a field the crew left empty. */
    blank(label) {
      return this.field(label, null)
    },
    /** A table: one header row, then its cells. */
    table(header, cells) {
      items.push({ page: n, x: 90, y, str: header, font: LABEL })
      y -= 20
      items.push({ page: n, x: 90, y, str: cells, font: VALUE })
      y -= 20
      return this
    },
    /** A block placed at the top of the page, above what is already here. */
    overflow(text) {
      items.push({ page: n, x: 200, y: 745, str: text, font: VALUE })
      return this
    },
    footer() {
      items.push({ page: n, x: 40, y: 50, str: `https://example.invalid/report Page ${n} of 2`, font: CHROME })
      return this
    },
    done: () => items,
  }
}

// A chest pain call: transported, one medication charted in the wrong unit, and
// a narrative long enough to spill onto the second page.
const NARRATIVE_HEAD = 'unit 101 responded to the reported address for a patient with chest pain.'
const NARRATIVE_TAIL =
  'vitals obtained and a 12-lead placed. iv access obtained. 4mg of zofran administered iv for nausea. '
  + 'patient transported non-emergent and moved to an ed bed. care given to ed staff. unit returns to service. '
  + 'this sentence exists only to push the narrative past the length floor the reviewer applies.'

const p1 = page(1)
  .field('EMS Agency', 'KS-EXAMPLE- Ground')
  .field('Date of Service:', '08/16/2026 16:14:28')
  .field('Incident #', '99000001')
  .field('EMS Unit', '10001')
  .field('Nature of Call', 'Chest Pain (Non-Traumatic)')
  .field('Type of Service Requested', 'Emergency Response (Primary Response Area)')
  .field('Response Mode to Scene', 'Emergent (Immediate Response)')
  .field('Additional Response Mode Descriptors', 'Lights and Sirens')
  .field('Unit Transport and Equipment Capability', 'Ground Transport (ALS Equipped)')
  .field('Incident Address', '1 EXAMPLE ST')
  .field('Unit Disposition', 'Patient Contact Made')
  .field('Patient Evaluation/Care', 'Patient Evaluated and Care Provided')
  .field('Destination Name', 'EXAMPLE MEDICAL CENTER')
  .field('Destination reason', "Patient's Choice")
  .field('Destination Type', 'Hospital-Emergency Department')
  .field('Transport Disposition', 'Transport by This EMS Unit (This Crew Only)')
  .field('Transport Mode Descriptors', 'No Lights or Sirens')
  .field('Possible Injury', 'No')
  .field('Medical/Surgical History', 'CV - Cardiac Stent')
  .table("Phone Numbers Patient's Phone Number PhoneNumberType", '(913) 555-0100 Mobile')
  .field('Narrative Patient Care Report Narrative', NARRATIVE_HEAD)
  .footer()
  .done()

const p2 = page(2)
  .field('Crew Member Completing this Report', 'Vance, Robin (10101)')
  .field('Cardiac Arrest', 'No')
  .table(
    'Vital Signs Vitals Date/Time HR SBP/DBP (MAP) Resp. Rate SpO2 Pain',
    '08/16/2026 16:22:25 || PTA = No Vance, Robin (10101) 60 130 / 80 ( 96 ) 16 Normal 5 Numeric '
      + '08/16/2026 16:40:11 || PTA = No Vance, Robin (10101) 62 128 / 78 ( 95 ) 16 Normal 4 Numeric',
  )
  .table(
    'Mental Status Assessment Scales Date/Time AVPU GCS - Total Glasgow Coma Scale GCS - Qualifier',
    '08/16/2026 16:22:25 || PTA = No Vance, Robin (10101) Alert 15',
  )
  .table(
    'Procedures Date/Ti me Procedur e Perform ed Procedure Performed Prior to this Units EMS Care',
    // "Paramedic Protocol" is the despacing trap: it contains "cpr".
    '16:35:00 No Vance, Robin (10101) Paramedic Protocol (Standing Order) Venous Access - Saline Lock',
  )
  .table(
    'Medical Device Medical Devices Date/Time of Event Crew Member Medical Device Event Type',
    "16:23:02 Vance, Robin ECG-Monitor 1234 Import Event 'Leads On' 16:25:12 Vance, Robin 12-Lead ECG 1234",
  )
  .table(
    'Medication Administration Medications Date/Time PTA Crew Member Medication Administered Dosage Route',
    // Wrapped exactly as a narrow cell wraps it, and in the wrong unit.
    '16:38:00 No Vance, Robin (10101) Fentanyl 50 Milligra ms (mg) Intrav enous (IV) Improved None',
  )
  .table(
    'Crew Member Crew Member Response Role Crew Member ID Crew Member Level',
    'Primary Patient Caregiver-At Scene Vance, Robin (10101) Paramedic Driver/Pilot-Response Okafor, Sam (P- 20202) EMT',
  )
  .field('Signatures Type of Person Signing', 'Crew Member')
  .field('Printed Name', 'Robin Vance')
  .field('Type of Person Signing', 'Crew Member')
  .field('Printed Name', 'Sam Okafor')
  .field('Type of Person Signing', 'Healthcare Provider')
  .field('Printed Name', 'Alex Rivera')
  .overflow(NARRATIVE_TAIL)
  .footer()
  .done()

const doc = m.buildPcrDoc([...p1, ...p2])

// ----- the text model --------------------------------------------------------

const labelRuns = doc.runs.filter((r) => r.kind === 'label').length
const valueRuns = doc.runs.filter((r) => r.kind === 'value').length
check(
  labelRuns > 20 && valueRuns > 20,
  'labels and values are told apart by font',
  `${labelRuns} label runs, ${valueRuns} value runs — one of them is being read as chrome`,
)

const charts = m.splitCharts(doc)
check(charts.length === 1 && charts[0].from === 1 && charts[0].to === 2, 'the export splits into one chart over both pages',
  JSON.stringify(charts))

const chart = m.parseChart(doc, 1, 2)

check(chart.incidentNumber === '99000001', 'the run number is read', chart.incidentNumber)
check(chart.serviceDate === '08/16/2026 16:14:28', 'the double-colon date label is read', chart.serviceDate)
check(chart.transportDisposition?.startsWith('Transport by This EMS Unit'), 'a long value is not truncated at its own words',
  chart.transportDisposition)

// ----- the two page-layout traps ---------------------------------------------

check(chart.cardiacArrest === 'No', 'a field keeps its own value when a continued block follows it',
  chart.cardiacArrest)
check(
  chart.narrative?.includes(NARRATIVE_HEAD) && chart.narrative?.includes('signed refusal') === false
    && chart.narrative?.includes('length floor the reviewer applies'),
  'a narrative continued on the next page is rejoined to its label',
  `${chart.narrative?.length ?? 0} characters`,
)

// ----- tables ----------------------------------------------------------------

check(chart.vitalsCount === 2, 'vitals sets are counted from the vitals table only', String(chart.vitalsCount))
check(chart.hasGcs && chart.hasAvpu, 'GCS and AVPU are found in the scales table')
check(chart.hasTwelveLead && chart.hasCardiacMonitor, 'the device table yields the 12-lead and the monitor')
check(chart.hasPhone === true, 'a phone number in the phone table is found')

check(
  chart.procedureNames.includes('Venous access') && !chart.procedureNames.includes('CPR'),
  'a short procedure name is not matched inside a despaced word',
  // "Paramedic Protocol" despaces to "paramedicprotocol", which contains "cpr".
  chart.procedureNames.join(', '),
)

check(
  chart.crew.length === 2 && chart.crew.some((c) => c.id === 'P-20202'),
  'crew are read from the crew table, including a licence number split by a wrap',
  chart.crew.map((c) => `${c.name} (${c.id}) ${c.level ?? '?'}`).join(' | '),
)
check(
  chart.signedBy.length === 2 && !chart.signedBy.includes('Alex Rivera'),
  'only crew-member signatures count as crew signatures',
  chart.signedBy.join(', '),
)

const fent = chart.medications.find((x) => x.name === 'Fentanyl')
check(
  fent && fent.amount === '50' && fent.unit === 'mg',
  'a dose wrapped mid-word is read with its unit',
  JSON.stringify(chart.medications),
)

// ----- blank is not absent ---------------------------------------------------

const stripped = m.buildPcrDoc([
  ...page(1).field('EMS Agency', 'KS-EXAMPLE- Ground').field('Incident #', '99000002')
    .blank('Destination Name').field('Unit Disposition', 'Patient Contact Made').footer().done(),
])
const blankChart = m.parseChart(stripped, 1, 1)
check(blankChart.destinationName === '', 'a field printed with nothing after it reads as blank',
  JSON.stringify(blankChart.destinationName))
check(blankChart.transportMode === undefined, 'a field the export never printed reads as absent',
  JSON.stringify(blankChart.transportMode))

// ----- the auto-answers ------------------------------------------------------

const review = m.autoReview(chart)

check(review.types.join() === 'cqm', 'a chart with a patient is a CQM review', review.types.join())
check(
  !review.categories.includes('Trauma'),
  'a "Non-Traumatic" impression does not select the trauma block',
  // The word "Traumatic" is inside "Chest Pain (Non-Traumatic)", and ImageTrend's
  // own Possible Injury field says No.
  review.categories.join(', '),
)
check(review.categories.includes('Lights and Sirens'), 'an emergent response selects the lights and sirens block',
  review.categories.join(', '))

const answered = m.visibleQuestions(review.types, review.categories)
const yesNo = answered.filter((q) => q.kind === 'yesno')
check(
  yesNo.every((q) => typeof review.answers[q.id] === 'boolean'),
  'every yes/no question in scope gets an answer',
  yesNo.filter((q) => typeof review.answers[q.id] !== 'boolean').map((q) => q.id).join(', '),
)
check(
  yesNo.every((q) => review.sources[q.id]),
  'every answer records why it was given',
  yesNo.filter((q) => !review.sources[q.id]).map((q) => q.id).join(', '),
)
check(review.answers['cqm.careLevel'] === 'ALS', 'the care level is read from the unit capability',
  String(review.answers['cqm.careLevel']))

const doseFlag = review.flags.find((f) => f.title.includes('Fentanyl'))
check(doseFlag?.severity === 'stop', 'a drug charted in the wrong unit stops the chart',
  JSON.stringify(review.flags.map((f) => f.title)))

const zofran = review.flags.find((f) => f.title.includes('Ondansetron'))
check(
  zofran?.severity === 'stop',
  'a drug named in the narrative by its brand name is matched against the medication table',
  // The narrative says "zofran"; the medications table has no ondansetron.
  JSON.stringify(review.flags.map((f) => f.title)),
)
check(
  !review.flags.some((f) => f.title.includes('12-lead')),
  'a 12-lead recorded as a device is not reported as missing from Procedures',
  JSON.stringify(review.flags.map((f) => f.title)),
)
check(review.clear === false, 'a chart with a stop flag is not cleared')
check(
  review.findings.every((id) => review.findingNotes[id]),
  'every finding arrives with a note the reviewer can edit rather than write',
  review.findings.filter((id) => !review.findingNotes[id]).join(', '),
)

// The same chart with the dose right and no drug missing from the table.
const clean = m.parseChart(
  m.buildPcrDoc(
    [...p1, ...p2].map((it) => {
      // Right unit on the fentanyl, and a narrative that names no drug the
      // medications table is missing.
      if (it.str.includes('Fentanyl')) {
        return { ...it, str: it.str.replace('Milligra ms (mg)', 'Microgra ms (mcg)') }
      }
      if (it.str === NARRATIVE_HEAD || it.str === NARRATIVE_TAIL) {
        return {
          ...it,
          str: it.str === NARRATIVE_HEAD
            ? NARRATIVE_HEAD
            : 'vitals obtained and a 12-lead placed. patient transported non-emergent and moved to an '
              + 'ed bed. care given to ed staff. unit returns to service. this sentence exists only to '
              + 'push the narrative past the length floor the reviewer applies.',
        }
      }
      return it
    }),
  ),
  1,
  2,
)
const cleanReview = m.autoReview(clean)
check(
  cleanReview.clear === true,
  'a chart that reads clean is cleared without a human',
  JSON.stringify(cleanReview.flags.map((f) => f.title)),
)

// ----- a call with no patient ------------------------------------------------

const noPatient = m.parseChart(
  m.buildPcrDoc([
    ...page(1)
      .field('EMS Agency', 'KS-EXAMPLE- Ground')
      .field('Incident #', '99000003')
      .field('Incident Address', '2 EXAMPLE RD')
      .field('Unit Disposition', 'No Patient Found')
      .field('Patient Evaluation/Care', 'Not Applicable')
      .field('Crew Disposition', 'Back in Service, No Care/Support Services Required')
      .field('Narrative Patient Care Report Narrative',
        'called to a two vehicle collision. on arrival nobody reported injury or complaint. no patients found.')
      .table('Crew Member Crew Member Response Role Crew Member ID Crew Member Level',
        'Driver/Pilot-Response Vance, Robin (10101) Paramedic')
      .field('Signatures Type of Person Signing', 'Crew Member')
      .field('Printed Name', 'Robin Vance')
      .footer()
      .done(),
  ]),
  1,
  1,
)
const npReview = m.autoReview(noPatient)
check(npReview.types.join() === 'nopatient', 'a call with no patient found is a no-patient review',
  npReview.types.join())
check(npReview.categories.length === 0, 'a no-patient review gets no category blocks')
check(
  review.crew.join(' | ') === 'Robin Vance',
  'the review counts against the crew member who wrote the report, not the whole crew',
  // A chart is one provider's work. Crediting both means a driver carries their
  // partner's documentation score and the author's own figure is diluted.
  review.crew.join(' | '),
)
check(
  review.otherCrew.join(' | ') === 'Sam Okafor',
  'the rest of the crew is kept for context, separately',
  review.otherCrew.join(' | '),
)
check(
  !review.crew.some((n) => n.includes(',')),
  'crew names are stored the way a person types them, with no comma inside a name',
  // The crew field is one comma-separated line in the form, so "Vance, Robin"
  // would split into two people the first time anyone opened and saved this.
  review.crew.join(' | '),
)

// Without an author named, crediting nobody would be worse than crediting all.
{
  const anonymous = m.parseChart(
    m.buildPcrDoc([...p1, ...p2].filter((it) => !it.str.startsWith('Crew Member Completing'))),
    1,
    2,
  )
  const r = m.autoReview(anonymous)
  check(
    r.crew.length === 2 && r.otherCrew.length === 0,
    'a chart that never names an author falls back to the whole crew',
    `${r.crew.join(' | ')} / ${r.otherCrew.join(' | ')}`,
  )
}

check(
  review.narrative?.includes(NARRATIVE_HEAD),
  'the narrative is handed to the reviewer to read',
  `${review.narrative?.length ?? 0} characters`,
)
check(
  review.serviceDate === '2026-08-16',
  'the printed date is stored as ISO, which is what the date filter compares',
  String(review.serviceDate),
)
check(npReview.clear === true, 'a tidy no-patient call is cleared',
  JSON.stringify(npReview.flags.map((f) => f.title)))
check(
  m.visibleQuestions(npReview.types, npReview.categories)
    .filter((q) => q.kind === 'yesno')
    .every((q) => typeof npReview.answers[q.id] === 'boolean'),
  'a no-patient review is fully answered',
)

// ----- the browser shim ------------------------------------------------------
//
// pdf.js calls Promise.withResolvers about forty times and Safari only shipped
// it in 17.4, so on an iPhone a version behind the import screen died with
// "undefined is not a function". Checked here because the failure is in a
// dependency's assumptions rather than in anything this repo would notice.
{
  const real = Promise.withResolvers
  delete Promise.withResolvers
  check(m.needsPdfCompat() === true, 'a browser without Promise.withResolvers is detected')
  m.installPdfCompat()
  check(typeof Promise.withResolvers === 'function', 'the shim installs Promise.withResolvers')

  const { promise, resolve } = Promise.withResolvers()
  resolve('done')
  check((await promise) === 'done', 'the shimmed Promise.withResolvers resolves')

  const { promise: rejects, reject } = Promise.withResolvers()
  reject(new Error('nope'))
  check(await rejects.then(() => false, (e) => e.message === 'nope'), 'the shimmed one rejects too')

  // The worker is its own global scope, so the wrapper has to carry the shim's
  // source across — assert the function survives being stringified.
  check(
    /withResolvers/.test(m.installPdfCompat.toString()),
    'the shim can be sent into a worker as source',
  )

  if (real) Promise.withResolvers = real
  else delete Promise.withResolvers
  check(m.needsPdfCompat() === false, 'a browser that already has it needs no shim')
}

check(
  m.describePdfFailure(new Error('undefined is not a function')).includes('too old'),
  'an unreadable PDF on an old browser says so, rather than repeating the raw error',
  m.describePdfFailure(new Error('undefined is not a function')),
)

// ----- a transport with nobody to assess -------------------------------------
//
// A flight crew carried back to base, an organ, a standby. These are NOT
// cancelled calls: the run happened, it has a destination and it has mileage.
// Read as an ordinary transport they fail every patient-care question they were
// never going to be able to answer, which is exactly the false alarm the import
// exists to avoid.

function nonPatientChart(over = {}) {
  const b = page(1)
    .field('EMS Agency', 'KS-EXAMPLE- Ground')
    .field('Incident #', over.run ?? '99000004')
    .field('Date of Service:', '08/16/2026 09:10:00')
    .field('Type of Service Requested', over.service ?? 'Standby')
    .field('Nature of Call', over.nature ?? 'Transfer of Flight Crew')
    .field('Incident Address', '9 AIRPORT RD')
    .field('Unit Disposition', over.unitDisposition ?? 'Non-Patient Transport (Not Otherwise Listed)')
    .field('Destination Name', over.destination ?? 'EXAMPLE REGIONAL AIRPORT')
    .field('Transport Disposition', over.transportDisposition ?? 'Non-Patient Transport (Not Otherwise Listed)')
    .field('Unit Notified by Dispatch', '08/16/2026 09:10:00')
    .field('Unit En Route', '08/16/2026 09:12:00')
    .field('Unit Arrived on Scene', '08/16/2026 09:31:00')
    .field('Unit Left Scene', '08/16/2026 09:40:00')
    .field('Unit Back in Service', '08/16/2026 10:15:00')
    .field('Beginning Odometer Reading', '0')
    .field('Ending Odometer Reading', over.odometerEnd ?? '31.4')
    .field('Total Loaded Miles', over.loadedMiles ?? '22.8')
    .field('Narrative Patient Care Report Narrative',
      over.narrative
        ?? 'unit dispatched to return the flight crew to the airport following a completed transport. '
           + 'no patient on board. crew and equipment carried to the hangar without incident. unit back in service.')
  if (over.vitals) {
    b.table(
      'Vital Signs Vitals Date/Time HR SBP/DBP (MAP) Resp. Rate SpO2 Pain',
      '08/16/2026 09:35:00 || PTA = No Vance, Robin (10101) 70 120 / 80 ( 93 ) 16 Normal',
    )
  }
  b.table('Crew Member Crew Member Response Role Crew Member ID Crew Member Level',
    'Driver/Pilot-Response Vance, Robin (10101) Paramedic')
    .field('Crew Member Completing this Report', 'Vance, Robin (10101)')
    .field('Signatures Type of Person Signing', 'Crew Member')
    .field('Printed Name', 'Robin Vance')
    .footer()
  return m.parseChart(m.buildPcrDoc(b.done()), 1, 1)
}

{
  const r = m.autoReview(nonPatientChart())
  check(r.types.join() === 'nonpatient', 'a flight-crew return is a non-patient transport, not a cancelled call',
    r.types.join())
  check(r.categories.length === 0, 'a non-patient transport gets no CQM category blocks')
  const asked = m.visibleQuestions(r.types, r.categories).map((q) => q.id)
  check(
    asked.includes('npt.mileage') && !asked.includes('asm.monitoring') && !asked.includes('np.narrative'),
    'it is asked its own questions, not the patient-care ones and not the no-contact ones',
    asked.join(', '),
  )
  check(r.clear === true, 'a properly documented one is cleared without a human',
    JSON.stringify(r.flags.map((f) => f.title)))
  check(
    m.visibleQuestions(r.types, r.categories)
      .filter((q) => q.kind === 'yesno')
      .every((q) => typeof r.answers[q.id] === 'boolean'),
    'every question on the block is answered',
  )
}

// Mileage is the whole claim on one of these and cannot be reconstructed later.
{
  const r = m.autoReview(nonPatientChart({ loadedMiles: '', odometerEnd: '' }))
  check(
    r.answers['npt.mileage'] === false && r.flags.some((f) => /mileage/i.test(f.title)),
    'no mileage on a non-patient transport stops the chart',
    JSON.stringify(r.flags.map((f) => f.title)),
  )
}

// Patient care on a run with no patient means a template or a copied chart.
{
  const r = m.autoReview(nonPatientChart({ vitals: true }))
  check(
    r.answers['npt.noPatientFields'] === false && r.flags.some((f) => /patient care/i.test(f.title)),
    'vitals on a run with no patient are flagged, not ignored',
    JSON.stringify(r.flags.map((f) => f.title)),
  )
}

// The service type alone is enough, for an operation that files the disposition
// as an ordinary transport.
{
  const r = m.autoReview(nonPatientChart({
    unitDisposition: 'Patient Contact Made',
    transportDisposition: 'Transport by This EMS Unit (This Crew Only)',
    service: 'Organ Procurement Transport',
    nature: 'Organ Transport',
  }))
  check(r.types.join() === 'nonpatient', 'an organ transport is recognised from the service type',
    r.types.join())
  check(r.answers['npt.disposition'] === false,
    'and its disposition is reported as not saying so')
}

// ----- what the SYNCED review carries ----------------------------------------
//
// The narrative is shown to the reviewer and kept on their device, but it must
// never ride along on the review record — that is what syncs to the server and
// what the workbook exports. These are the fields the import writes onto a
// ChartReviewEntry; nothing patient-identifying may appear among them.
const stored = JSON.stringify({
  incidentNumber: review.incidentNumber,
  serviceDate: review.serviceDate,
  crew: review.crew,
  answers: review.answers,
  sources: review.sources,
  flags: review.flags,
})
check(!stored.includes('1 EXAMPLE ST'), 'the incident address is not carried into the stored review')
check(!stored.includes('555-0100'), 'the phone number is not carried into the stored review')
check(!stored.includes(NARRATIVE_HEAD), 'the narrative is not carried into the stored review')

// The narrative slice is device-local ONLY because it is absent from the sync
// list. That is one line in another file and nothing else enforces it, so it is
// asserted here rather than left to a comment.
{
  const records = readFileSync(join(SRC, 'lib/records.ts'), 'utf8')
  check(
    !/chartNarratives/.test(records),
    'narratives are not in the sync slices, so they never leave the device',
    'lib/records.ts mentions chartNarratives — a narrative would sync to the server',
  )
}

rmSync(OUT, { force: true })

console.log('')
console.log(`  chart read: ${chart.crew.length} crew, ${chart.vitalsCount} vitals, ${chart.medications.length} medication(s)`)
console.log(`  ${review.flags.length} flag(s), ${review.findings.length} finding(s), clear=${review.clear}`)
console.log('')

if (failed) {
  console.log(`${failed} check(s) failed.`)
  process.exit(1)
}
console.log('PCR import pipeline is consistent.')
