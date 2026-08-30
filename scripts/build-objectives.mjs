// Build the clinical and field training objectives as a .docx.
//
// K.A.R. 109-17-3 lists "clinical training objectives" and "field training
// objectives" among the records a course retains. This is the document that
// goes to the PRECEPTOR — the RN in pre-op or the medic on the truck who has
// this student for twelve hours and has never met the syllabus.
//
// So it is written for them, not for the board. A preceptor needs four things
// and does not need anything else:
//
//   What is this student allowed to touch today? Scope is dated: a student is
//   cleared for vascular access on the day of the week 5 laboratory and not
//   before, and a rep logged before that date does not count. Getting this
//   wrong is the one failure here with a patient on the end of it.
//
//   What are they trying to get out of this shift? A phase target, not the
//   whole course — "four complete assessments and two PCRs" is actionable in a
//   way that "15 assessments by February" is not.
//
//   What do I sign, and what does my signature mean? The attestation is
//   evidence for a state certification. It says so.
//
//   What do I do if it is going wrong? Named, because the alternative is a
//   preceptor who says nothing until the evaluation at the end of the shift.
//
// Run: npm run doc:objectives  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import {
  BULLET, H1, H2, H3, P, PAGE, NUMBERING, ROOT, RULE, SPACER, TASK, PAGE_BREAK,
  coverBlock, footer, loadCourse, longDate, printable, provenance, table,
} from './lib/doc-kit.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Clinical-and-Field-Objectives-Oct2026.docx'))
const m = await loadCourse()
const { P: PH, S } = m
const phases = PH.seedPhases(m.KC_START_DATE)
const kar = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar')
const program = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'program')

/** Which laboratory grants each clearance, and on what date. */
const CLEARANCE_SESSION = { assessment: 'Week 3 · Thu', vascular: 'Week 5 · Thu', ecg: 'Week 6 · Thu' }
const clearanceDate = (code) =>
  m.KC_SCHEDULE.find((r) => r.label === CLEARANCE_SESSION[code])?.date

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: 'AEMT Clinical and Field Training Objectives — October 2026 Cohort',
  description: 'Preceptor-facing objectives, scope of practice and documented minimums',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Clinical and Field Training Objectives — October 2026 cohort') },
      children: [
        ...coverBlock(
          'Clinical and Field Training Objectives',
          'Advanced Emergency Medical Technician',
          `AMR Kansas City with AMR Wichita  ·  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}`,
        ),

        H1('For the preceptor'),
        P(
          'Thank you for taking a student. This page is the whole of what you need; the rest of the document is detail you can look up if you want it.',
        ),
        P(
          'The student with you today is an EMT working toward Advanced EMT certification in Kansas. They are on your unit to accumulate documented patient contacts against a state minimum, and to be watched doing them.',
        ),
        H2('1. Check what they are cleared to do'),
        P(
          'Scope is dated. A student is cleared for a skill on the day they pass the laboratory check-off for it, and not before — and a contact logged before that date does not count toward their certification, however well it went. The student carries their clearance dates; ask for them at the start of the shift.',
        ),
        SPACER(100),
        table(
          [2600, 2200, 5280],
          ['Cleared for', 'From', 'What it permits'],
          PH.SKILL_CLEARANCES.map((c) => [
            c.label,
            clearanceDate(c.code) ? longDate(clearanceDate(c.code)) : c.grantedAt,
            c.gates.length
              ? `${c.gates.map((g) => m.CLINICAL_REQUIREMENTS.find((r) => r.id === g)?.label ?? g).join(', ')}. Reps before this date are refused.`
              : 'Recorded, not enforced — a documented assessment counts whether or not the laboratory date was entered first.',
          ]),
        ),
        SPACER(),
        P(
          'Anything outside that list, the student observes. If you are not sure, they observe. Nobody is behind schedule enough for that to be the wrong answer.',
          { bold: true },
        ),

        H2('2. Know what this shift is for'),
        P(
          'The rotation runs in phases and each has a small number of targets. The student knows which phase they are in; the table on the next page says what each is trying to produce. A shift that meets its hours and produces nothing is a shift that failed, and it is worth saying so at the start rather than at the end.',
        ),

        H2('3. Sign what you saw'),
        P(
          'Your attestation is evidence supporting a state certification, and it is retained for three years. Sign for what you personally watched, and use the daily evaluation to say what actually happened — a preceptor who marks everything satisfactory tells the program nothing, and the student finds out in January.',
        ),

        H2('4. Say something early if it is going wrong'),
        P(
          `Call or email the primary instructor during the shift, not after it. ${m.PRIMARY_INSTRUCTOR.name}${
            m.PRIMARY_INSTRUCTOR.email ? `, ${m.PRIMARY_INSTRUCTOR.email}` : ''
          }. A safety concern ends the student's participation in that task immediately and is not a conversation to defer.`,
        ),

        PAGE_BREAK(),
        H1('The rotation, phase by phase'),
        P(
          `${PH.PLANNED_SHIFTS} twelve-hour shifts per student — ${m.KC_CLINICAL_TARGET} hours hospital clinical and ${m.KC_FIELD_TARGET} hours field internship. Phases are windows rather than fixed dates; students self-schedule inside them.`,
        ),
        SPACER(120),
        table(
          [1400, 2100, 900, 5480],
          ['Phase', 'Window', 'Shifts', 'What it is for, and what it should produce'],
          phases.map((p) => [
            `${p.ordinal}. ${p.name}`,
            `${longDate(p.windowStart)} – ${longDate(p.windowEnd)}`,
            String(p.shiftsRequired),
            [
              p.shiftsRequired
                ? `${p.hospitalShifts} hospital, ${p.fieldShifts} field.`
                : 'No clinical. Site onboarding, immunisation records and paperwork.',
              p.requiresClearance ? `Opens on the ${p.requiresClearance} check-off.` : '',
              Object.keys(p.targets ?? {}).length
                ? `Targets: ${Object.entries(p.targets).map(([k, v]) => `${v} ${PH.PHASE_TARGET_LABELS[k].toLowerCase()}`).join(', ')}.`
                : '',
            ]
              .filter(Boolean)
              .join(' '),
          ]),
        ),
        SPACER(),
        P(
          'The break block is the highest-yield fortnight in the rotation: no class competing for the time, high holiday call volume, and students who usually have leave available. A student who arrives at January behind has very little left to catch up with.',
          { italics: true },
        ),

        H1('What has to be documented'),
        P(
          'These are set by K.A.R. 109-11-8(a)(4). The student logs their own contacts; your part is the attestation that the contact happened and was supervised.',
        ),
        SPACER(120),
        table(
          [4700, 1200, 1500, 2680],
          ['Requirement', 'Minimum', 'Of which', 'Where these come from'],
          kar.map((r) => [
            r.label,
            String(r.minimum),
            r.subRequirement
              ? `${r.subRequirement.minimum} ${r.subRequirement.label}`
              : r.fieldMinimum && r.fieldMinimum < r.minimum
                ? `${r.fieldMinimum} in field`
                : '—',
            printable(r.note ?? r.site ?? '—'),
          ]),
        ),
        ...(program.length
          ? [
              SPACER(),
              P(
                'Tracked additionally as a program competency rather than a statutory minimum — it does not gate completion:',
                { italics: true },
              ),
              ...program.map((r) => BULLET(`${r.label} — ${r.minimum}`)),
            ]
          : []),

        H1('Who may supervise'),
        P('K.A.R. 109-1-1 and 109-11-8 name who may precept, and it differs by setting.'),
        SPACER(120),
        table(
          [2400, 7680],
          ['Setting', 'Acceptable preceptor credentials'],
          Object.entries(m.SETTING_PRECEPTORS).map(([setting, creds]) => [
            setting === 'lab' ? 'Skills laboratory' : setting === 'field' ? 'Field internship' : 'Hospital clinical',
            creds.map((c) => m.PRECEPTOR_LABELS[c]).join(', '),
          ]),
        ),
        SPACER(),
        P(
          'Direct supervision throughout. A contact supervised by someone whose credential does not appear against that setting is logged but does not count, which is a waste of the student’s shift and of yours.',
        ),

        PAGE_BREAK(),
        H1('Hospital clinical — what each department is for'),
        P(
          'Hours are not the constraint; opportunity is. A twelve-hour emergency department shift where two lines come available met its hours and failed its purpose, so placements are weighted toward where each skill actually occurs.',
        ),
        SPACER(120),
        table(
          [2600, 3400, 4080],
          ['Department', 'What it produces', 'Notes'],
          S.HOSPITAL_UNITS.map((u) => [
            u.name,
            u.produces.map((k) => PH.PHASE_TARGET_LABELS[k] ?? k).join(', '),
            u.notes ?? '—',
          ]),
        ),
        SPACER(),
        P(
          `Capacity is seeded at ${S.DEFAULT_UNIT_CAP} student per department per week until each site confirms otherwise. If your department can take more, tell the primary instructor — it is the number the whole placement plan is built on.`,
          { italics: true },
        ),

        H1('Field internship'),
        P(
          `Field capacity is FTO capacity: an agency takes as many students as it has field-training-officer-staffed units available in a week. Twelve of each student's ${PH.PLANNED_SHIFTS} shifts are field shifts, so this is what decides whether the rotation fits.`,
        ),
        ...S.FIELD_UNITS.map((u) =>
          BULLET(`${u.name} — produces ${u.produces.map((k) => PH.PHASE_TARGET_LABELS[k] ?? k).join(', ')}`),
        ),

        PAGE_BREAK(),
        H1('Shift record'),
        P(
          'One per shift, kept with the student’s file. The daily evaluation form is separate and is where the narrative goes; this is the countable half.',
          { italics: true },
        ),
        ...RULE('Student'),
        ...RULE('Date, site and unit'),
        ...RULE('Preceptor name, credential and certificate number'),
        SPACER(120),
        table(
          [5040, 2520, 2520],
          ['Contact type', 'Attempted', 'Successful'],
          kar.map((r) => [r.label, '', '']),
        ),
        SPACER(),
        P('Anything the student should work on next shift:', { bold: true, after: 40 }),
        ...RULE(null, { tall: true }),
        ...RULE(null, { tall: true }),
        SPACER(160),
        P(
          `I attest that I personally supervised this student for the contacts recorded above, and that this record is accurate. I understand it is retained for ${m.RECORDS_RETENTION_YEARS} years as evidence supporting a Kansas EMS certification.`,
          { size: 20 },
        ),
        SPACER(120),
        ...RULE('Preceptor signature and date'),

        provenance(m, 'npm run doc:objectives'),
      ],
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
console.log(`Wrote ${outPath}`)
console.log(
  `  ${phases.length} phases · ${kar.length} statutory minimums · ${program.length} program competencies · ` +
    `${PH.SKILL_CLEARANCES.length} dated clearances`,
)
