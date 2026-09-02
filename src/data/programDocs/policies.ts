// ---------------------------------------------------------------------------
// The program policy manual.
//
// K.A.R. 109-17-3 retains the program's attendance, grading, discipline,
// remediation and dismissal policies as issued to students. The syllabus states
// them too — this is the same policies held as a record in their own right,
// which is what the regulation asks for, and generated from the same course
// record so the two cannot disagree.
//
// It is NOT the record that any of those policies was followed. The make-up
// policy is here; what each absent student actually made up is a per-student
// record on the Hours tab. That distinction is the one the records registry
// exists to hold, and the one that was quietly lost when this document was
// tagged as the generator for the make-up record.
// ---------------------------------------------------------------------------

import {
  bullet, cover, h1, h2, longDate, p, printable, spacer, table,
  type Block,
} from '../../lib/docBlocks'
import * as A from '../aemtAssessments'
import * as R from '../aemtRecords'
import {
  ABSENCE_MAKEUP,
  GRADING_MODEL,
  INSTRUCTOR_VERIFICATION_DAYS,
  KC_COURSE_WEEKS,
  KC_END_DATE,
  KC_START_DATE,
  MIN_PASSING_PERCENT,
  PRE_COURSE_POLICY,
  RECORDS_RETENTION_YEARS,
} from '../aemt'

export const POLICIES_TITLE = 'AEMT Program Policies — October 2026 Cohort'

export const COHORT_LINE = `AMR Kansas City with AMR Wichita  ·  ${longDate(KC_START_DATE)} to ${longDate(KC_END_DATE)}`

export function policiesBlocks(): Block[] {
  const cohort = COHORT_LINE

  return [
    cover('Program Policies', 'Advanced Emergency Medical Technician', cohort),
    p(
      'These are the policies the syllabus states, held here as a record in their own right. Where this document and the syllabus differ, they have been generated from the same course record and cannot — but the syllabus is the document issued to students and governs.',
      { italics: true },
    ),

    h1('Admission and prerequisite work'),
    p(
      `Every student holds a current EMT certification on entry. ${PRE_COURSE_POLICY.requirement} Due ${longDate(PRE_COURSE_POLICY.dueBy)}. ${PRE_COURSE_POLICY.checkedAt}`,
    ),
    p(`Where the prerequisite work is incomplete on day one: ${PRE_COURSE_POLICY.ifIncomplete}`),

    h1('Attendance'),
    p(
      `Sessions run Mondays and Thursdays 0800–1200. Attendance at all scheduled meeting times is required. ACLS and PALS are not part of this course; each operation runs its own AHA classes and students arrange those separately.`,
    ),
    h2('Absence and make-up'),
    p(
      `Missing more than ${ABSENCE_MAKEUP.triggerHours} hours of scheduled class time triggers a make-up requirement rather than an automatic failure. ${ABSENCE_MAKEUP.requirement}`,
    ),
    p(ABSENCE_MAKEUP.note),
    p(
      'The trigger is a threshold, not a verdict. A cohort of this size running through respiratory season cannot absorb an absolute cap — one bout of influenza is two missed sessions — and a documented demonstration of equivalent competency is a claim about competence, which is what the certification is actually about.',
      { italics: true },
    ),
    h2('Clinical and field absence'),
    p(
      'Clinical absences are to be avoided. Where unavoidable, the student emails and telephones both the instructor and the site as early as possible, and the student is responsible for rescheduling. Hours not made up mean an incomplete course and no eligibility for the Authorization to Test.',
    ),
    h2('Late enrolment'),
    p(
      `A student admitted after the first session completes the prerequisite block and every missed session's pre-class work before attending, and completes the missed classroom content under the make-up policy above. Because the retrieval quizzes are cumulative from week one, a student joining after the second week is at a disadvantage the schedule cannot recover; admission after that point is at the primary instructor's discretion and is documented.`,
    ),

    h1('Grading and completion'),
    p(
      `A final course grade of ${MIN_PASSING_PERCENT}% or higher, all psychomotor skill evaluations completed to the satisfaction of the primary instructor, and all K.A.R. 109-11-8 clinical and field minimums documented.`,
    ),
    spacer(120),
    table(
      [6280, 1400, 2400],
      ['Component', 'Weight', 'Why it is weighted this way'],
      GRADING_MODEL.map((c) => [c.label, c.weight === null ? 'S/U' : `${c.weight}%`, c.rationale]),
    ),
    spacer(),
    h2('Mastery gates and remediation'),
    p(
      `Three gate examinations, blueprint-weighted, scored against a minimum passing standard of ${MIN_PASSING_PERCENT}%.`,
    ),
    bullet(`Below standard: ${A.GATE_REMEDIATION.belowStandard}`),
    bullet(A.GATE_REMEDIATION.whatContinues),
    bullet(A.GATE_REMEDIATION.twoFailedRetests),
    spacer(120),
    table(
      [4880, 2600, 2600],
      ['Gate', 'Date', 'Retest window closes'],
      A.MASTERY_GATES.map((g) => [g.label, longDate(g.date), g.retestBy ? longDate(g.retestBy) : '—']),
    ),
    spacer(),
    h2('Missed examinations'),
    p(
      'Examinations are sat at the scheduled time. Prior arrangements may be made with the instructor; a missed examination without prior approval is graded zero, and a zero on any examination means the course cannot be completed satisfactorily.',
    ),
    h2('Completion verification'),
    p(
      `K.A.R. 109-11-8 requires the PRIMARY instructor to verify in writing that the student completed the course, within ${INSTRUCTOR_VERIFICATION_DAYS} days of the final class session and before the student sits the certification examination. A program manager signing in their place does not satisfy it.`,
    ),

    h1('Progress conferences'),
    p(
      'Conferences occur as needed, and every student is scheduled for at least one private conference during the course. Two failed gate retests trigger one, early, while there is still course left to act on it. Conferences are documented and retained.',
    ),
    spacer(120),
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

    h1('Conduct'),
    h2('Academic honesty'),
    p(
      'Violations include but are not limited to plagiarism, cheating, trafficking, copyright infringement, and interfering with the learning of other students.',
    ),
    h2('Protected health information'),
    p(
      'THERE IS NO CIRCUMSTANCE IN WHICH PROTECTED HEALTH INFORMATION MAY BE CAPTURED ON AN ELECTRONIC DEVICE DURING A CLINICAL OR FIELD ROTATION. A student found to have done so is dismissed from the program.',
      { bold: true },
    ),
    p(
      'Patient information is not discussed outside the clinical facility and patient records are not copied for program documentation. On social media, students must not post photographs, video, patient information or any other data regarding patients or affiliations. Federal confidentiality law, HIPAA and GMR privacy policy apply in full.',
    ),
    h2('Safety'),
    p(
      'No student performs any action they or the instructional staff judge unsafe. Concerns are raised immediately with the instructor, preceptor or any AMR representative present. A student with an infectious disease is encouraged to report it; participation is at the discretion of the instructional staff.',
    ),
    h2('Dress'),
    p(
      'Black shoes, the issued uniform shirt with name tag, navy-blue pocket pants, for every clinical and field shift. The name tag identifies the wearer as a student at all times.',
    ),

    h1('Records and retention'),
    p(
      `Program records are retained for at least ${RECORDS_RETENTION_YEARS} calendar years by the sponsoring agency, in hard copy and electronically, per K.A.R. 109-17-3.`,
    ),
    spacer(120),
    table(
      [3800, 1500, 4780],
      ['Record', 'Held', 'Why it is required'],
      R.REQUIRED_RECORDS.map((r) => [
        r.label,
        r.source === 'ces'
          ? 'In CES'
          : r.source === 'generated'
            ? 'Generated from the course record'
            : 'In another system',
        printable(r.why),
      ]),
    ),
    {
      k: 'provenance',
      command: 'npm run doc:policies',
      startDate: KC_START_DATE,
      endDate: KC_END_DATE,
      weeks: KC_COURSE_WEEKS,
    },
  ]
}
