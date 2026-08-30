// Build the course syllabus as a .docx.
//
// K.A.R. 109-1-1(ss) defines a syllabus, and the definition is a list: goals
// and objectives, required materials, attendance policy, requirements for
// successful completion, a description of the clinical and field training,
// discipline policies, instructor contact information, and the course
// schedule. Each of those is a heading below, in that order, so that a KBEMS
// reviewer checking the definition can check it down the page.
//
// THIS IS THE DOCUMENT THE OTHERS POINT AT. The approval application encloses
// it, the policy manual expands two of its sections, and the student guide is
// its week-by-week half rewritten for the person doing the work. All four read
// the same course record, so the syllabus cannot say 80% while the application
// says something else — which is the failure mode that matters, because they
// are read by different people months apart and only one of them gets audited.
//
// Run: npm run doc:syllabus  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { Document, Packer } from 'docx'
import {
  BULLET, CONTENT_WIDTH, H1, H2, P, PAGE, NUMBERING, ROOT, SPACER,
  coverBlock, footer, loadCourse, longDate, provenance, shortDate, table, weekdayOf,
} from './lib/doc-kit.mjs'

const outPath = resolve(process.argv[2] ?? join(ROOT, 'build', 'AEMT-Syllabus-Oct2026.docx'))
const m = await loadCourse()
const { A, N, P: PH } = m
const totals = m.scheduleTotals()
const staff = m.PRIMARY_INSTRUCTOR
const clinicalSites = m.KC_SITES.filter((s) => s.kind === 'clinical')
const fieldSites = m.KC_SITES.filter((s) => s.kind === 'field')

// ----- the schedule table ----------------------------------------------------
//
// K.A.R. 109-11-1a(b3) wants the date and time of each session, its subject,
// its instructor, and its psychomotor laboratory hours. Same five columns as
// the application's table, because it is the same schedule — a syllabus whose
// schedule differs from the filed one is the single most expensive discrepancy
// available here.

const SCHED_COLS = [1560, 4680, 900, 800, 2140]
const scheduleRows = [...m.KC_SCHEDULE]
  .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
  .map((r) => [
    [r.label, `${weekdayOf(r.date)} ${shortDate(r.date)}`, ...(r.startTime ? [`${r.startTime}–${r.endTime}`] : [])],
    r.delivery === 'assignment'
      ? [r.title, 'Completed by the student before the session; not classroom contact time.']
      : [r.title],
    String(r.didacticHours),
    String(r.labHours),
    r.delivery === 'aha' ? 'AHA-certified instructor' : `${staff.name}, ${staff.credential}`,
  ])

// ----- the document ----------------------------------------------------------

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: 'AEMT Course Syllabus — October 2026 Cohort',
  description: 'Course syllabus for the joint AMR Kansas City / AMR Wichita Advanced EMT cohort',
  numbering: NUMBERING,
  sections: [
    {
      properties: { page: PAGE },
      footers: { default: footer('AEMT Course Syllabus — October 2026 cohort') },
      children: [
        ...coverBlock(
          'Course Syllabus',
          'Advanced Emergency Medical Technician',
          `AMR Kansas City with AMR Wichita  ·  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}`,
        ),

        // --- 1. Course description, goals and objectives ---------------------
        H1('Course description'),
        P(
          `A Kansas-approved initial course of instruction for the Advanced Emergency Medical Technician, delivered jointly by AMR Kansas City and AMR Wichita as one class. ${m.KC_COURSE_WEEKS} instructional weeks across ${m.KC_CALENDAR_WEEKS} calendar weeks, Tuesdays and Thursdays 0900–1300, with two American Heart Association provider courses on Saturdays and a two-week break over the holidays. Classroom and laboratory sessions are held at AMR Kansas City headquarters with AMR Wichita joining by Teams; clinical and field internship placements are local to each student's own operation.`,
        ),
        P(
          `Successful completion makes the student eligible to sit the National Registry cognitive examination and, on passing, to be certified by the Kansas Board of Emergency Medical Services.`,
        ),

        H1('Goals and objectives'),
        P(
          'The AEMT is a health professional whose primary focus is to respond to, assess and triage nonurgent, urgent, and emergent requests for medical care, apply basic and focused advanced knowledge and skills necessary to provide patient care and/or medical transportation, and facilitate access to a higher level of care when the needs of the patient exceed the capability level of the AEMT. The additional preparation beyond EMT prepares an AEMT to improve patient care in common emergency conditions for which reasonably safe, targeted, and evidence-based interventions exist. Interventions within the AEMT scope of practice may carry more risk if not performed properly than interventions authorized for the EMR/EMT levels.',
        ),
        P('On completion the student will be able to:'),
        BULLET('Describe the patient care responsibilities of the AEMT.'),
        BULLET('Demonstrate AEMT-level psychomotor skills to the satisfaction of the primary instructor.'),
        BULLET('Apply the patient care and other duties and responsibilities of the AEMT.'),
        BULLET(
          'Work the six-step clinical judgment cycle aloud — recognize cues, analyze cues, define hypothesis, generate solutions, take action, evaluate outcomes — in scenario and in the field.',
        ),
        P(
          `Content is sequenced against the National Registry AEMT examination specifications effective 1 July 2024. The blueprint and the hours allocated against it are below.`,
          { italics: true },
        ),
        SPACER(120),
        table(
          [3900, 1600, 4580],
          ['Examination domain', '% of exam', 'How this course allocates against it'],
          A.EXAM_BLUEPRINT.map((d) => [d.label, `${d.examMin}–${d.examMax}%`, d.verdict]),
        ),

        // --- 2. Required materials -------------------------------------------
        H1('Instructional materials required'),
        P(
          `Textbook: ${m.COURSE_TEXT.title} (${m.COURSE_TEXT.edition} ed., © ${m.COURSE_TEXT.copyright}). Burlington, MA: ${m.COURSE_TEXT.publisher}. ISBN ${m.COURSE_TEXT.isbn}.`,
        ),
        P(`Online: ${m.COURSE_TEXT.navigateEdition}`),
        P(
          `Each chapter carries an interactive lecture module, flashcards and a practice activity; ${Object.keys(N.SKILL_DRILLS).length} chapters also carry Skill Drills with Skill Evaluation Sheets. Module run times total ${N.moduleHours([...new Set(m.KC_SCHEDULE.flatMap((r) => r.chapters ?? []))])} hours across the course, which is module time only — reading, flashcards and practice activities are in addition.`,
        ),
        P(
          `Uniform: black shoes, the issued uniform shirt with name tag, and navy-blue pocket pants, for every clinical and field internship shift. The name tag identifies the wearer as a student.`,
        ),

        // --- 3. Attendance ----------------------------------------------------
        H1('Attendance policy'),
        P(
          `Classroom, lecture and laboratory sessions run every Tuesday and Thursday 0900–1300, with the two AHA provider courses on the Saturdays shown in the schedule. Students are required to attend all scheduled meeting times. Where an absence is unavoidable it is the student's responsibility to contact the instructor and obtain the missed material.`,
        ),
        P(
          `Missing more than ${m.MAX_ABSENT_HOURS} hours of scheduled class time triggers a documented make-up requirement: ${m.ABSENCE_MAKEUP.requirement} ${m.ABSENCE_MAKEUP.note} A student who does not complete the make-up has not met the course objectives and does not complete the course.`,
        ),
        P(
          `Clinical and field absences are to be avoided. Where unavoidable, the student must email and telephone both the instructor and the site as early as possible, and it is the student's responsibility to reschedule. Clinical or field hours that are not made up mean an incomplete course, and an incomplete course means the student is not eligible for the Authorization to Test.`,
        ),

        // --- 4. Completion requirements ---------------------------------------
        H1('Requirements for successful completion'),
        P(
          `A final course grade of ${m.MIN_PASSING_PERCENT}% or higher, all psychomotor skill evaluations completed to the satisfaction of the primary instructor, and all clinical and field internship minimums documented. Graded components total ${m.GRADING_WEIGHT_TOTAL}%.`,
        ),
        SPACER(120),
        table(
          [7480, 1300, 1300],
          ['Component', 'Weight', ''],
          m.GRADING_MODEL.map((c) => [c.label, c.weight === null ? 'S/U' : `${c.weight}%`, '']),
        ),
        SPACER(),
        P(
          `The three gate examinations are blueprint-weighted and scored against a minimum passing standard of ${m.MIN_PASSING_PERCENT}%. ${A.GATE_REMEDIATION.belowStandard} ${A.GATE_REMEDIATION.whatContinues} ${A.GATE_REMEDIATION.twoFailedRetests}`,
        ),
        SPACER(120),
        table(
          [4880, 2600, 2600],
          ['Gate examination', 'Date', 'Retest window closes'],
          A.MASTERY_GATES.map((g) => [g.label, longDate(g.date), longDate(g.retestBy)]),
        ),
        SPACER(),
        P(
          `A ten-item closed-book cumulative quiz opens almost every session — ${A.RETRIEVAL_QUIZZES.length} in all, drawn roughly four items from the last session, three from two to four sessions back and three from the earliest material in the course.`,
        ),
        P(
          `Students are expected to sit every examination at its scheduled time. Prior arrangements may be made with the instructor to make up a missed examination; a missed examination without prior approval is graded zero, and a zero on any examination means the course cannot be completed satisfactorily. Each student is additionally evaluated on attitude, participation, attendance, appearance and overall performance, on the observations of the instructors, the clinical preceptors and the lead instructor.`,
        ),

        H2('Prerequisite work'),
        P(
          `${m.PRE_COURSE_POLICY.requirement} Due ${longDate(m.PRE_COURSE_POLICY.dueBy)}. This covers chapters ${m.PRE_COURSE_CHAPTERS[0]}–${m.PRE_COURSE_CHAPTERS[m.PRE_COURSE_CHAPTERS.length - 1]}, which every student already works inside on shift; the classroom hours they would otherwise consume are re-allocated to the Clinical Judgment domain. ${m.PRE_COURSE_POLICY.checkedAt} ${m.PRE_COURSE_POLICY.ifIncomplete}`,
        ),

        // --- 5. Clinical and field description --------------------------------
        H1('Clinical and field internship'),
        P(
          `${m.KC_CLINICAL_TARGET} hours of hospital clinical — six 12-hour shifts — and ${m.KC_FIELD_TARGET} hours of field internship on an ambulance — twelve 12-hour shifts. ${PH.PLANNED_SHIFTS} shifts in total, scheduled in addition to class and in addition to the student's regular work schedule.`,
        ),
        P(
          `Placement is by phase against what the student has been checked off to perform, and is local to the student's own operation. A student does not begin invasive skills before the laboratory check-off that clears them for it.`,
        ),
        SPACER(120),
        table(
          [1180, 2300, 900, 5420],
          ['Phase', 'Opens after', 'Shifts', 'What the phase is for'],
          PH.PHASE_TEMPLATE.map((p) => [
            `${p.ordinal}. ${p.name}`,
            p.requiresClearance ? `${p.requiresClearance} check-off` : p.ordinal === 0 ? 'Course start' : 'Prior phase',
            String(p.shiftsRequired),
            `${p.hospitalShifts} hospital, ${p.fieldShifts} field.` +
              (Object.keys(p.targets ?? {}).length
                ? ` Targets: ${Object.entries(p.targets).map(([k, v]) => `${v} ${PH.PHASE_TARGET_LABELS[k].toLowerCase()}`).join(', ')}.`
                : ''),
          ]),
        ),
        SPACER(),
        P('Clinical sites:', { bold: true, after: 60 }),
        ...clinicalSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`)),
        P('Field internship services:', { bold: true, after: 60, before: 120 }),
        ...fieldSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`)),
        SPACER(),
        P(
          'Documented patient contacts required, per K.A.R. 109-11-8(a)(4). Students log their own encounters and are responsible for reaching these:',
        ),
        SPACER(100),
        table(
          [6280, 1900, 1900],
          ['Requirement', 'Minimum', 'Of which'],
          m.CLINICAL_REQUIREMENTS.map((r) => [
            r.label + (r.basis === 'program' ? ' (program competency)' : ''),
            String(r.minimum),
            r.subRequirement
              ? `${r.subRequirement.minimum} ${r.subRequirement.label}`
              : r.fieldMinimum && r.fieldMinimum < r.minimum
                ? `${r.fieldMinimum} in field internship`
                : '—',
          ]),
        ),

        // --- 6. Discipline ----------------------------------------------------
        H1('Student conduct and discipline'),
        H2('Academic honesty'),
        P(
          'EMS as a profession is dedicated to creating and maintaining an environment of academic honesty. Faculty affirm the importance of academic integrity and educate students in the standards of academic behavior; students bear the responsibility of learning and complying with those expectations, displaying appropriate conduct in classroom situations, and preserving academic integrity by upholding the spirit of honest course work. Violations include but are not limited to plagiarism, cheating, trafficking, copyright infringement, and interfering with the learning of other students.',
        ),
        H2('Patient confidentiality and protected health information'),
        P(
          'Students protect patient confidentiality in every aspect of the clinical and field internship. Patient information is not discussed outside the clinical facility, and patient records are not copied for program documentation. Students work under the direct supervision of hospital, field or AMR preceptors and follow their directives.',
        ),
        P(
          'THERE IS NO CIRCUMSTANCE IN WHICH PROTECTED HEALTH INFORMATION MAY BE CAPTURED ON AN ELECTRONIC DEVICE DURING A CLINICAL OR FIELD ROTATION. A student found to have done so is dismissed from the program.',
          { bold: true },
        ),
        P(
          'On social networking — including but not limited to Facebook, X, YouTube and equivalents — students must not post photographs, video, patient information or any other data regarding patients or affiliations. Federal confidentiality law, HIPAA and GMR privacy policy apply in full. A student who breaches these policies exits the program.',
        ),
        H2('Safety'),
        P(
          'Performing in the role of medical assistance may require contact with the human body and body secretions, and the course contains explicit information on topics including nudity, sexuality and elimination of body waste. Any concern about personal safety is raised immediately with the instructor, preceptor or any AMR representative present. No student performs any action that they or the instructional staff judge unsafe. A student with an infectious disease is encouraged to report it to the instructional staff; participation is at the discretion of the staff, and the student uses all necessary means to prevent transmission. Anyone who feels ill should not participate in class, clinical or field activity.',
        ),
        P(
          'Besides physical safety, AMR recognises the mental and emotional strain inherent to EMS. The pace of this course alongside full-time work, family obligations and social commitments can become overwhelming; students are encouraged to say so to the instructor or to a GMR EAP representative. The goal of the whole undertaking is the success of the student.',
        ),
        H2('Progress conferences'),
        P(
          'Progress and affective evaluation conferences occur as needed, and every student is scheduled for at least one private conference during the course. Students are encouraged to raise concerns immediately rather than waiting for a scheduled conference. Two failed gate retests trigger a documented private conference.',
        ),

        // --- 7. Instructor contact -------------------------------------------
        H1('Instructional staff'),
        ...m.COURSE_STAFF.flatMap((st) => [
          H2(`${st.name}, ${st.credential} — ${st.role === 'primary' ? 'primary instructor' : 'co-instructor of record'}`),
          BULLET(`Operation: ${st.operation}`),
          ...(st.email ? [BULLET(`Email: ${st.email}`)] : []),
          BULLET(`Availability: ${st.officeHours}`),
        ]),
        P(
          `Written verification of course completion under K.A.R. 109-11-8 is provided by the primary instructor, ${staff.name}, within ${m.INSTRUCTOR_VERIFICATION_DAYS} days of the final class session and before the student sits the certification examination.`,
        ),

        // --- 8. The schedule --------------------------------------------------
        H1('Course schedule'),
        P(
          `Every session with its date, time, subject, laboratory hours and instructor, per K.A.R. 109-11-1a(b3). Class location unless otherwise noted: AMR Kansas City headquarters, with AMR Wichita joining by Teams.`,
        ),
        SPACER(120),
        table(SCHED_COLS, ['Date', 'Topic / assignment', 'Didactic hrs', 'Lab hrs', 'Instructor'], scheduleRows),
        SPACER(),
        P(
          `Total hours: ${m.KC_TOTAL_TARGET} — didactic ${totals.didactic}, laboratory ${totals.lab}, AHA provider courses ${totals.aha}, hospital clinical ${m.KC_CLINICAL_TARGET}, field internship ${m.KC_FIELD_TARGET}. Of the ${totals.classroom} classroom hours, ${totals.f2f} are face-to-face across ${totals.f2fWeeks} class weeks and ${totals.assignment} are completed by the student through Navigate before the session they belong to.`,
          { bold: true },
        ),
        P(
          `No session falls on a holiday. The calendar absorbs them rather than extending the course: week 8 runs Tuesday only and ACLS moves to Saturday ${shortDate('2026-12-05')}, and a two-week break runs ${longDate(m.WINTER_BREAK.start)} to ${longDate(m.WINTER_BREAK.end)}. The break is not a pause — students complete concentrated clinical and field shifts across it together with three dated retrieval assignments.`,
        ),
        ...m.KC_HOLIDAYS.map((h) => BULLET(`${longDate(h.date)} — ${h.name}. ${h.absorbedBy}`)),
        SPACER(),
        P(
          'Didactic hours represent the minimum time a student should dedicate to the material. Depending on the subject and on the student, most subjects take longer to master than the schedule allots.',
          { italics: true },
        ),

        H1('Records'),
        P(
          `Program records are retained for at least ${m.RECORDS_RETENTION_YEARS} calendar years by the sponsoring agency, in hard copy and electronically, per K.A.R. 109-17-3.`,
        ),
        provenance(m, 'npm run doc:syllabus'),
      ],
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))
console.log(`Wrote ${outPath}`)
console.log(
  `  ${m.KC_SCHEDULE.length} schedule rows · ${m.GRADING_MODEL.length} graded components · ` +
    `${m.CLINICAL_REQUIREMENTS.length} clinical minimums · ${m.COURSE_STAFF.length} instructors`,
)
