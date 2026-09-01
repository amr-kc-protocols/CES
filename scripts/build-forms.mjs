// Build the program policy manual and the blank forms packet as .docx files.
//
// Two documents, one script, because they are the two halves of the same
// question — what the program's rules are, and what somebody signs to show a
// rule was followed.
//
// THE POLICY MANUAL exists because the syllabus is a student document that
// happens to contain policy, and K.A.R. 109-17-3 wants the policies retained as
// a record in their own right. A reviewer asking "what is your make-up policy"
// should not have to read a course schedule to find it. The wording is the
// syllabus's, from the same source, so the two cannot diverge.
//
// THE FORMS PACKET is printable blanks of every instrument the program uses.
// The app holds these and captures them digitally, which is the normal path —
// but a preceptor at 0300 in an emergency department with no signal and no
// account still has to be able to sign something, and a program that has no
// paper fallback has an evidence gap on exactly the shifts that are hardest to
// staff. Every blank here carries the same fields as the digital form, so a
// paper one can be typed in later without translation.
//
// Run: npm run doc:policies  [-- <output path>]
//      npm run doc:forms     [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import {
  BULLET, H1, H2, P, ROOT, RULE, SPACER, PAGE_BREAK,
  coverBlock, loadCourse, longDate, provenance, table,
} from './lib/doc-kit.mjs'
import { footer, NUMBERING, PAGE, renderBlocks } from './lib/doc-render.mjs'

const which = process.argv[2] === 'forms' ? 'forms' : 'policies'
const outPath = resolve(
  process.argv[3] ??
    join(
      ROOT,
      'build',
      which === 'forms' ? 'AEMT-Forms-Packet-Oct2026.docx' : 'AEMT-Program-Policies-Oct2026.docx',
    ),
)
const m = await loadCourse()
const { A, F, P: PH } = m
const cohort = `AMR Kansas City with AMR Wichita  ·  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}`

// ----- the policy manual -----------------------------------------------------
//
// The manual itself is src/data/programDocs/policies.ts. The app builds and
// retains the same document, so there is one copy of the policies and this is
// the half that renders it to a .docx.

const policyDoc = () =>
  new Document({
    creator: 'AMR Kansas City — Clinical Education',
    title: m.DOCS.POLICIES_TITLE,
    description: 'Program policies retained under K.A.R. 109-17-3',
    numbering: NUMBERING,
    sections: [
      {
        properties: { page: PAGE },
        footers: { default: footer('AEMT Program Policies — October 2026 cohort') },
        children: renderBlocks(m.DOCS.policiesBlocks()),
      },
    ],
  })

// ----- the forms packet ------------------------------------------------------

const KIND_HINT = {
  scale: (f) => `${f.scale.min} – ${f.scale.max}   (${f.scale.min} ${f.scale.minLabel} … ${f.scale.max} ${f.scale.maxLabel})   ☐ not seen this shift`,
  yesno: () => 'Yes ☐    No ☐',
  number: () => '__________',
  text: () => '',
  longtext: () => '',
}

function formPages(def) {
  const out = [
    PAGE_BREAK(),
    H1(def.title),
    P(def.subtitle, { italics: true, after: 60 }),
    P(`Completed by: ${def.completedBy}.   Cadence: ${def.cadence === 'shift' ? 'one per shift' : def.cadence === 'course' ? 'once per student, end of course' : 'ongoing'}.`, { size: 20 }),
    ...(def.draft
      ? [P('DRAFT INSTRUMENT — pending Program Manager and Medical Director review before use as a competency record.', { bold: true, size: 19 })]
      : def.reviewedBy
        ? [P(`Reviewed and approved by ${def.reviewedBy}${def.reviewedOn ? ` on ${longDate(def.reviewedOn)}` : ''}.`, { italics: true, size: 19 })]
        : []),
    SPACER(80),
    ...RULE('Student'),
    ...RULE('Date'),
  ]
  for (const sec of def.sections) {
    out.push(H2(sec.title))
    if (sec.help) out.push(P(sec.help, { italics: true, size: 20, after: 80 }))
    const scales = sec.fields.filter((f) => f.kind === 'scale')
    const others = sec.fields.filter((f) => f.kind !== 'scale')
    if (scales.length) {
      out.push(
        table(
          [5080, 5000],
          ['Item', 'Rating'],
          scales.map((f) => [f.label, KIND_HINT.scale(f)]),
        ),
      )
      out.push(SPACER(120))
    }
    for (const f of others) {
      if (f.kind === 'longtext') {
        out.push(P(f.label, { bold: true, after: 40 }))
        if (f.help) out.push(P(f.help, { italics: true, size: 19, after: 40 }))
        out.push(...RULE(null, { tall: true }))
        out.push(...RULE(null, { tall: true }))
      } else if (f.kind === 'yesno') {
        out.push(P(`${f.label}    ${KIND_HINT.yesno()}`, { after: 70 }))
      } else {
        out.push(...RULE(`${f.label}${f.help ? ` — ${f.help}` : ''}`))
      }
    }
  }
  out.push(SPACER(140))
  out.push(...RULE(`${def.completedBy} — name, credential and signature`))
  return out
}

/** The patient encounter log — a grid the student fills a row of per contact. */
function encounterLog() {
  const kar = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar')
  return [
    PAGE_BREAK(),
    H1('Patient Encounter Log'),
    P('One row per patient contact. Carry this on shift; the totals are what the K.A.R. minimums are counted from.', { italics: true }),
    P(
      'NO PATIENT IDENTIFIERS. No name, no date of birth, no run number, no address. A contact is identified by its date, the unit and the procedure — nothing that could identify the patient belongs on this sheet or anywhere else the program holds.',
      { bold: true },
    ),
    SPACER(100),
    ...RULE('Student'),
    SPACER(60),
    table(
      [1180, 1500, 1500, 3200, 1350, 1350],
      ['Date', 'Site / unit', 'Setting', 'Procedure or contact type', 'Success?', 'Preceptor initials'],
      Array.from({ length: 22 }, () => ['', '', '', '', '', '']),
      { cell: { size: 18 } },
    ),
    SPACER(140),
    P('Counted requirements, for reference:', { bold: true, after: 60 }),
    ...kar.map((r) =>
      BULLET(
        `${r.label} — ${r.minimum}${r.subRequirement ? ` (${r.subRequirement.minimum} ${r.subRequirement.label})` : ''}${
          r.fieldMinimum && r.fieldMinimum < r.minimum ? `, at least ${r.fieldMinimum} in field internship` : ''
        }`,
      ),
    ),
  ]
}

const formsDoc = () =>
  new Document({
    creator: 'AMR Kansas City — Clinical Education',
    title: 'AEMT Forms Packet — October 2026 Cohort',
    description: 'Printable blanks of every program instrument',
    numbering: NUMBERING,
    sections: [
      {
        properties: { page: PAGE },
        footers: { default: footer('AEMT Forms Packet — October 2026 cohort') },
        children: [
          ...coverBlock('Forms Packet', 'Advanced Emergency Medical Technician', cohort),
          P(
            'Printable blanks of every instrument the program uses. These are the paper fallback: the app captures all of them digitally and that is the normal path, but a preceptor at 0300 with no signal still has to be able to sign something. Fields match the digital form exactly, so a paper one can be entered later without translation.',
          ),
          P(
            `Contents: the patient encounter log, then ${F.AEMT_FORMS.length} evaluation instruments.`,
            { italics: true },
          ),
          SPACER(120),
          table(
            [4400, 2400, 3280],
            ['Instrument', 'Completed by', 'When'],
            [
              ['Patient Encounter Log', 'Student', 'Every patient contact'],
              ...F.AEMT_FORMS.map((f) => [
                f.title,
                f.completedBy,
                f.cadence === 'shift' ? 'Every shift' : f.cadence === 'course' ? 'End of course' : 'Ongoing',
              ]),
            ],
          ),
          ...encounterLog(),
          ...F.AEMT_FORMS.flatMap((f) => formPages(f)),
          provenance(m, 'npm run doc:forms'),
        ],
      },
    ],
  })

const doc = which === 'forms' ? formsDoc() : policyDoc()
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
console.log(`Wrote ${outPath}`)
console.log(
  which === 'forms'
    ? `  ${F.AEMT_FORMS.length} instruments + the encounter log · ${F.AEMT_FORMS.filter((f) => f.draft).length} marked draft`
    : `  ${m.GRADING_MODEL.length} graded components · ${A.MASTERY_GATES.length} gates · ${m.R.REQUIRED_RECORDS.length} retained records`,
)
