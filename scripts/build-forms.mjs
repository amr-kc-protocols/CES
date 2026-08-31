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
  BULLET, H1, H2, H3, P, PAGE, NUMBERING, ROOT, RULE, SPACER, PAGE_BREAK,
  coverBlock, footer, loadCourse, longDate, printable, provenance, table,
} from './lib/doc-kit.mjs'

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

const policyDoc = () =>
  new Document({
    creator: 'AMR Kansas City — Clinical Education',
    title: 'AEMT Program Policies — October 2026 Cohort',
    description: 'Program policies retained under K.A.R. 109-17-3',
    numbering: NUMBERING,
    sections: [
      {
        properties: { page: PAGE },
        footers: { default: footer('AEMT Program Policies — October 2026 cohort') },
        children: [
          ...coverBlock('Program Policies', 'Advanced Emergency Medical Technician', cohort),
          P(
            'These are the policies the syllabus states, held here as a record in their own right. Where this document and the syllabus differ, they have been generated from the same course record and cannot — but the syllabus is the document issued to students and governs.',
            { italics: true },
          ),

          H1('Admission and prerequisite work'),
          P(
            `Every student holds a current EMT certification on entry. ${m.PRE_COURSE_POLICY.requirement} Due ${longDate(m.PRE_COURSE_POLICY.dueBy)}. ${m.PRE_COURSE_POLICY.checkedAt}`,
          ),
          P(`Where the prerequisite work is incomplete on day one: ${m.PRE_COURSE_POLICY.ifIncomplete}`),

          H1('Attendance'),
          P(
            `Sessions run Tuesdays and Thursdays 0900–1300, plus two Saturday American Heart Association provider courses. Attendance at all scheduled meeting times is required.`,
          ),
          H2('Absence and make-up'),
          P(
            `Missing more than ${m.ABSENCE_MAKEUP.triggerHours} hours of scheduled class time triggers a make-up requirement rather than an automatic failure. ${m.ABSENCE_MAKEUP.requirement}`,
          ),
          P(m.ABSENCE_MAKEUP.note),
          P(
            'The trigger is a threshold, not a verdict. A cohort of this size running through respiratory season cannot absorb an absolute cap — one bout of influenza is two missed sessions — and a documented demonstration of equivalent competency is a claim about competence, which is what the certification is actually about.',
            { italics: true },
          ),
          H2('Clinical and field absence'),
          P(
            'Clinical absences are to be avoided. Where unavoidable, the student emails and telephones both the instructor and the site as early as possible, and the student is responsible for rescheduling. Hours not made up mean an incomplete course and no eligibility for the Authorization to Test.',
          ),
          H2('Late enrolment'),
          P(
            `A student admitted after the first session completes the prerequisite block and every missed session's pre-class work before attending, and completes the missed classroom content under the make-up policy above. Because the retrieval quizzes are cumulative from week one, a student joining after the second week is at a disadvantage the schedule cannot recover; admission after that point is at the primary instructor's discretion and is documented.`,
          ),

          H1('Grading and completion'),
          P(
            `A final course grade of ${m.MIN_PASSING_PERCENT}% or higher, all psychomotor skill evaluations completed to the satisfaction of the primary instructor, and all K.A.R. 109-11-8 clinical and field minimums documented.`,
          ),
          SPACER(120),
          table(
            [6280, 1400, 2400],
            ['Component', 'Weight', 'Why it is weighted this way'],
            m.GRADING_MODEL.map((c) => [c.label, c.weight === null ? 'S/U' : `${c.weight}%`, c.rationale]),
          ),
          SPACER(),
          H2('Mastery gates and remediation'),
          P(
            `Three gate examinations, blueprint-weighted, scored against a minimum passing standard of ${m.MIN_PASSING_PERCENT}%.`,
          ),
          BULLET(`Below standard: ${A.GATE_REMEDIATION.belowStandard}`),
          BULLET(A.GATE_REMEDIATION.whatContinues),
          BULLET(A.GATE_REMEDIATION.twoFailedRetests),
          SPACER(120),
          table(
            [4880, 2600, 2600],
            ['Gate', 'Date', 'Retest window closes'],
            A.MASTERY_GATES.map((g) => [g.label, longDate(g.date), longDate(g.retestBy)]),
          ),
          SPACER(),
          H2('Missed examinations'),
          P(
            'Examinations are sat at the scheduled time. Prior arrangements may be made with the instructor; a missed examination without prior approval is graded zero, and a zero on any examination means the course cannot be completed satisfactorily.',
          ),
          H2('Completion verification'),
          P(
            `K.A.R. 109-11-8 requires the PRIMARY instructor to verify in writing that the student completed the course, within ${m.INSTRUCTOR_VERIFICATION_DAYS} days of the final class session and before the student sits the certification examination. A program manager signing in their place does not satisfy it.`,
          ),

          H1('Progress conferences'),
          P(
            'Conferences occur as needed, and every student is scheduled for at least one private conference during the course. Two failed gate retests trigger one, early, while there is still course left to act on it. Conferences are documented and retained.',
          ),
          SPACER(120),
          table(
            [3400, 6680],
            ['Trigger', 'What happens'],
            [
              ['Two failed gate retests', 'Documented private conference with the primary instructor.'],
              ['Below a deficit checkpoint floor', 'An added clinical or field shift is assigned that week. If the shortfall is site availability rather than the student, it is escalated to the site immediately.'],
              ['Affective or professionalism concern', 'Documented conference, with the behaviour and the expected change both written down.'],
              ['Student request', 'Any time; students are encouraged not to wait for a scheduled conference.'],
            ],
          ),

          H1('Conduct'),
          H2('Academic honesty'),
          P(
            'Violations include but are not limited to plagiarism, cheating, trafficking, copyright infringement, and interfering with the learning of other students.',
          ),
          H2('Protected health information'),
          P(
            'THERE IS NO CIRCUMSTANCE IN WHICH PROTECTED HEALTH INFORMATION MAY BE CAPTURED ON AN ELECTRONIC DEVICE DURING A CLINICAL OR FIELD ROTATION. A student found to have done so is dismissed from the program.',
            { bold: true },
          ),
          P(
            'Patient information is not discussed outside the clinical facility and patient records are not copied for program documentation. On social media, students must not post photographs, video, patient information or any other data regarding patients or affiliations. Federal confidentiality law, HIPAA and GMR privacy policy apply in full.',
          ),
          H2('Safety'),
          P(
            'No student performs any action they or the instructional staff judge unsafe. Concerns are raised immediately with the instructor, preceptor or any AMR representative present. A student with an infectious disease is encouraged to report it; participation is at the discretion of the instructional staff.',
          ),
          H2('Dress'),
          P(
            'Black shoes, the issued uniform shirt with name tag, navy-blue pocket pants, for every clinical and field shift. The name tag identifies the wearer as a student at all times.',
          ),

          H1('Records and retention'),
          P(
            `Program records are retained for at least ${m.RECORDS_RETENTION_YEARS} calendar years by the sponsoring agency, in hard copy and electronically, per K.A.R. 109-17-3.`,
          ),
          SPACER(120),
          table(
            [3800, 1500, 4780],
            ['Record', 'Held', 'Why it is required'],
            m.R.REQUIRED_RECORDS.map((r) => [
              r.label,
              r.source === 'ces'
                ? 'In CES'
                : r.source === 'generated'
                  ? 'Generated from the course record'
                  : 'In another system',
              printable(r.why),
            ]),
          ),

          provenance(m, 'npm run doc:policies'),
        ],
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
