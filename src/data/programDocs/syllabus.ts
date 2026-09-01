// ---------------------------------------------------------------------------
// The course syllabus.
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
// its week-by-week half rewritten for the person doing the work. All of them
// read the same course record, so the syllabus cannot say 80% while the
// application says something else — which is the failure mode that matters,
// because they are read by different people months apart and only one of them
// gets audited.
//
// Returned as a Block[] rather than a .docx: the same tree renders to the file
// a reviewer is sent and to the copy the app builds, prints and retains.
// ---------------------------------------------------------------------------

import {
  bullet, cover, h1, h2, longDate, p, shortDate, spacer, table, weekdayOf,
  type Block,
} from '../../lib/docBlocks'
import * as A from '../aemtAssessments'
import * as N from '../navigateAssets'
import * as PH from '../aemtPhases'
import {
  ABSENCE_MAKEUP,
  CAMPUS_LABEL,
  CLINICAL_REQUIREMENTS,
  COURSE_STAFF,
  COURSE_TEXT,
  GRADING_MODEL,
  GRADING_WEIGHT_TOTAL,
  INSTRUCTOR_VERIFICATION_DAYS,
  KC_CALENDAR_WEEKS,
  KC_CLINICAL_TARGET,
  KC_COURSE_WEEKS,
  KC_END_DATE,
  KC_FIELD_TARGET,
  KC_HOLIDAYS,
  KC_SCHEDULE,
  KC_SITES,
  KC_START_DATE,
  KC_TOTAL_TARGET,
  MAX_ABSENT_HOURS,
  MIN_PASSING_PERCENT,
  PRE_COURSE_CHAPTERS,
  PRE_COURSE_POLICY,
  PRIMARY_INSTRUCTOR,
  RECORDS_RETENTION_YEARS,
  WINTER_BREAK,
  scheduleTotals,
} from '../aemt'

export const SYLLABUS_TITLE = 'AEMT Course Syllabus — October 2026 Cohort'

/** " Targets: 4 assessments, 2 PCRs." — or nothing, where a phase sets none. */
export function phaseTargets(targets: Partial<Record<PH.PhaseTargetKey, number>> | undefined): string {
  const entries = Object.entries(targets ?? {}) as [PH.PhaseTargetKey, number][]
  if (!entries.length) return ''
  return ` Targets: ${entries
    .map(([k, v]) => `${v} ${PH.PHASE_TARGET_LABELS[k].toLowerCase()}`)
    .join(', ')}.`
}

export function syllabusBlocks(): Block[] {
  const totals = scheduleTotals()
  const staff = PRIMARY_INSTRUCTOR
  const clinicalSites = KC_SITES.filter((s) => s.kind === 'clinical')
  const fieldSites = KC_SITES.filter((s) => s.kind === 'field')

  // K.A.R. 109-11-1a(b3) wants the date and time of each session, its subject,
  // its instructor, and its psychomotor laboratory hours. Same five columns as
  // the application's table, because it is the same schedule — a syllabus whose
  // schedule differs from the filed one is the single most expensive
  // discrepancy available here.
  const SCHED_COLS = [1560, 4680, 900, 800, 2140]
  const scheduleRows = [...KC_SCHEDULE]
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

  return [
    cover(
      'Course Syllabus',
      'Advanced Emergency Medical Technician',
      `AMR Kansas City with AMR Wichita  ·  ${longDate(KC_START_DATE)} to ${longDate(KC_END_DATE)}`,
    ),

    // --- 1. Course description, goals and objectives ---------------------
    h1('Course description'),
    p(
      `A Kansas-approved initial course of instruction for the Advanced Emergency Medical Technician, delivered jointly by AMR Kansas City and AMR Wichita as one class. ${KC_COURSE_WEEKS} instructional weeks across ${KC_CALENDAR_WEEKS} calendar weeks, Tuesdays and Thursdays 0900–1300, with a two-week break over the holidays. Classroom and laboratory sessions are held at AMR Kansas City headquarters with AMR Wichita joining by Teams; clinical and field internship placements are local to each student's own operation.`,
    ),
    p(
      `Successful completion makes the student eligible to sit the National Registry cognitive examination and, on passing, to be certified by the Kansas Board of Emergency Medical Services.`,
    ),

    // Said here, in the description, rather than left to be discovered from
    // the absence of two Saturdays in the schedule. A student who was told
    // during selection that this course included ACLS and PALS needs to read
    // where they went, not work it out.
    h2('ACLS and PALS are not part of this course'),
    p(
      'No hours for either are filed here and neither appears in the schedule. Both are still expected of you: each operation runs its own American Heart Association classes, and you take them there — Kansas City students with AMR Kansas City, Wichita students with AMR Wichita. Arrange yours through your own operation, and ask the primary instructor if you are not sure who to speak to.',
    ),
    p(
      'The Navigate cardiovascular module assigned over the Thanksgiving week and the pediatric module in week 13 double as pre-course reading for them, so the timing works if you take them alongside this course.',
    ),

    h1('Goals and objectives'),
    p(
      'The AEMT is a health professional whose primary focus is to respond to, assess and triage nonurgent, urgent, and emergent requests for medical care, apply basic and focused advanced knowledge and skills necessary to provide patient care and/or medical transportation, and facilitate access to a higher level of care when the needs of the patient exceed the capability level of the AEMT. The additional preparation beyond EMT prepares an AEMT to improve patient care in common emergency conditions for which reasonably safe, targeted, and evidence-based interventions exist. Interventions within the AEMT scope of practice may carry more risk if not performed properly than interventions authorized for the EMR/EMT levels.',
    ),
    p('On completion the student will be able to:'),
    bullet('Describe the patient care responsibilities of the AEMT.'),
    bullet('Demonstrate AEMT-level psychomotor skills to the satisfaction of the primary instructor.'),
    bullet('Apply the patient care and other duties and responsibilities of the AEMT.'),
    bullet(
      'Work the six-step clinical judgment cycle aloud — recognize cues, analyze cues, define hypothesis, generate solutions, take action, evaluate outcomes — in scenario and in the field.',
    ),
    p(
      `Content is sequenced against the National Registry AEMT examination specifications effective 1 July 2024. The blueprint and the hours allocated against it are below.`,
      { italics: true },
    ),
    spacer(120),
    table(
      [3900, 1600, 4580],
      ['Examination domain', '% of exam', 'How this course allocates against it'],
      A.EXAM_BLUEPRINT.map((d) => [d.label, `${d.examMin}–${d.examMax}%`, d.verdict]),
    ),

    // --- 2. Required materials -------------------------------------------
    h1('Instructional materials required'),
    p(
      `Textbook: ${COURSE_TEXT.title} (${COURSE_TEXT.edition} ed., © ${COURSE_TEXT.copyright}). Burlington, MA: ${COURSE_TEXT.publisher}. ISBN ${COURSE_TEXT.isbn}.`,
    ),
    p(`Online: ${COURSE_TEXT.navigateEdition}`),
    p(
      `Each chapter carries an interactive lecture module, flashcards and a practice activity; ${Object.keys(N.SKILL_DRILLS).length} chapters also carry Skill Drills with Skill Evaluation Sheets. Module run times total ${N.moduleHours([...new Set(KC_SCHEDULE.flatMap((r) => r.chapters ?? []))])} hours across the course, which is module time only — reading, flashcards and practice activities are in addition.`,
    ),
    p(
      `Uniform: black shoes, the issued uniform shirt with name tag, and navy-blue pocket pants, for every clinical and field internship shift. The name tag identifies the wearer as a student.`,
    ),

    // --- 3. Attendance ----------------------------------------------------
    h1('Attendance policy'),
    p(
      `Classroom, lecture and laboratory sessions run every Tuesday and Thursday 0900–1300. Students are required to attend all scheduled meeting times. Where an absence is unavoidable it is the student's responsibility to contact the instructor and obtain the missed material.`,
    ),
    p(
      `Missing more than ${MAX_ABSENT_HOURS} hours of scheduled class time triggers a documented make-up requirement: ${ABSENCE_MAKEUP.requirement} ${ABSENCE_MAKEUP.note} A student who does not complete the make-up has not met the course objectives and does not complete the course.`,
    ),
    p(
      `Clinical and field absences are to be avoided. Where unavoidable, the student must email and telephone both the instructor and the site as early as possible, and it is the student's responsibility to reschedule. Clinical or field hours that are not made up mean an incomplete course, and an incomplete course means the student is not eligible for the Authorization to Test.`,
    ),

    // --- 4. Completion requirements ---------------------------------------
    h1('Requirements for successful completion'),
    p(
      `A final course grade of ${MIN_PASSING_PERCENT}% or higher, all psychomotor skill evaluations completed to the satisfaction of the primary instructor, and all clinical and field internship minimums documented. Graded components total ${GRADING_WEIGHT_TOTAL}%.`,
    ),
    spacer(120),
    table(
      [7480, 1300, 1300],
      ['Component', 'Weight', ''],
      GRADING_MODEL.map((c) => [c.label, c.weight === null ? 'S/U' : `${c.weight}%`, '']),
    ),
    spacer(),
    p(
      `The three gate examinations are blueprint-weighted and scored against a minimum passing standard of ${MIN_PASSING_PERCENT}%. ${A.GATE_REMEDIATION.belowStandard} ${A.GATE_REMEDIATION.whatContinues} ${A.GATE_REMEDIATION.twoFailedRetests}`,
    ),
    spacer(120),
    table(
      [4880, 2600, 2600],
      ['Gate examination', 'Date', 'Retest window closes'],
      A.MASTERY_GATES.map((g) => [g.label, longDate(g.date), g.retestBy ? longDate(g.retestBy) : '—']),
    ),
    spacer(),
    p(
      `A ten-item closed-book cumulative quiz opens almost every session — ${A.RETRIEVAL_QUIZZES.length} in all, drawn roughly four items from the last session, three from two to four sessions back and three from the earliest material in the course.`,
    ),
    p(
      `Students are expected to sit every examination at its scheduled time. Prior arrangements may be made with the instructor to make up a missed examination; a missed examination without prior approval is graded zero, and a zero on any examination means the course cannot be completed satisfactorily. Each student is additionally evaluated on attitude, participation, attendance, appearance and overall performance, on the observations of the instructors, the clinical preceptors and the lead instructor.`,
    ),

    h2('Prerequisite work'),
    p(
      `${PRE_COURSE_POLICY.requirement} Due ${longDate(PRE_COURSE_POLICY.dueBy)}. This covers chapters ${PRE_COURSE_CHAPTERS[0]}–${PRE_COURSE_CHAPTERS[PRE_COURSE_CHAPTERS.length - 1]}, which every student already works inside on shift; the classroom hours they would otherwise consume are re-allocated to the Clinical Judgment domain. ${PRE_COURSE_POLICY.checkedAt} ${PRE_COURSE_POLICY.ifIncomplete}`,
    ),

    // --- 5. Clinical and field description --------------------------------
    h1('Clinical and field internship'),
    p(
      `${KC_CLINICAL_TARGET} hours of hospital clinical — six 12-hour shifts — and ${KC_FIELD_TARGET} hours of field internship on an ambulance — twelve 12-hour shifts. ${PH.PLANNED_SHIFTS} shifts in total, scheduled in addition to class and in addition to the student's regular work schedule.`,
    ),
    p(
      `Placement is by phase against what the student has been checked off to perform, and is local to the student's own operation. A student does not begin invasive skills before the laboratory check-off that clears them for it.`,
    ),
    spacer(120),
    table(
      [1180, 2300, 900, 5420],
      ['Phase', 'Opens after', 'Shifts', 'What the phase is for'],
      PH.PHASE_TEMPLATE.map((ph) => [
        `${ph.ordinal}. ${ph.name}`,
        ph.requiresClearance ? `${ph.requiresClearance} check-off` : ph.ordinal === 0 ? 'Course start' : 'Prior phase',
        String(ph.shiftsRequired),
        `${ph.hospitalShifts} hospital, ${ph.fieldShifts} field.` + phaseTargets(ph.targets),
      ]),
    ),
    spacer(),
    p('Clinical sites:', { bold: true }),
    ...clinicalSites.map((s) => bullet(`${s.name} — ${CAMPUS_LABEL[s.campus]}`)),
    p('Field internship services:', { bold: true }),
    ...fieldSites.map((s) => bullet(`${s.name} — ${CAMPUS_LABEL[s.campus]}`)),
    spacer(),
    p(
      'Documented patient contacts required, per K.A.R. 109-11-8(a)(4). Students log their own encounters and are responsible for reaching these:',
    ),
    spacer(100),
    table(
      [6280, 1900, 1900],
      ['Requirement', 'Minimum', 'Of which'],
      CLINICAL_REQUIREMENTS.map((r) => [
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
    h1('Student conduct and discipline'),
    h2('Academic honesty'),
    p(
      'EMS as a profession is dedicated to creating and maintaining an environment of academic honesty. Faculty affirm the importance of academic integrity and educate students in the standards of academic behavior; students bear the responsibility of learning and complying with those expectations, displaying appropriate conduct in classroom situations, and preserving academic integrity by upholding the spirit of honest course work. Violations include but are not limited to plagiarism, cheating, trafficking, copyright infringement, and interfering with the learning of other students.',
    ),
    h2('Patient confidentiality and protected health information'),
    p(
      'Students protect patient confidentiality in every aspect of the clinical and field internship. Patient information is not discussed outside the clinical facility, and patient records are not copied for program documentation. Students work under the direct supervision of hospital, field or AMR preceptors and follow their directives.',
    ),
    p(
      'THERE IS NO CIRCUMSTANCE IN WHICH PROTECTED HEALTH INFORMATION MAY BE CAPTURED ON AN ELECTRONIC DEVICE DURING A CLINICAL OR FIELD ROTATION. A student found to have done so is dismissed from the progra',
      { bold: true },
    ),
    p(
      'On social networking — including but not limited to Facebook, X, YouTube and equivalents — students must not post photographs, video, patient information or any other data regarding patients or affiliations. Federal confidentiality law, HIPAA and GMR privacy policy apply in full. A student who breaches these policies exits the progra',
    ),
    h2('Safety'),
    p(
      'Performing in the role of medical assistance may require contact with the human body and body secretions, and the course contains explicit information on topics including nudity, sexuality and elimination of body waste. Any concern about personal safety is raised immediately with the instructor, preceptor or any AMR representative present. No student performs any action that they or the instructional staff judge unsafe. A student with an infectious disease is encouraged to report it to the instructional staff; participation is at the discretion of the staff, and the student uses all necessary means to prevent transmission. Anyone who feels ill should not participate in class, clinical or field activity.',
    ),
    p(
      'Besides physical safety, AMR recognises the mental and emotional strain inherent to EMS. The pace of this course alongside full-time work, family obligations and social commitments can become overwhelming; students are encouraged to say so to the instructor or to a GMR EAP representative. The goal of the whole undertaking is the success of the student.',
    ),
    h2('Progress conferences'),
    p(
      'Progress and affective evaluation conferences occur as needed, and every student is scheduled for at least one private conference during the course. Students are encouraged to raise concerns immediately rather than waiting for a scheduled conference. Two failed gate retests trigger a documented private conference.',
    ),

    // --- 7. Instructor contact -------------------------------------------
    h1('Instructional staff'),
    ...COURSE_STAFF.flatMap((st) => [
      h2(`${st.name}, ${st.credential} — ${st.role === 'primary' ? 'primary instructor' : 'co-instructor of record'}`),
      bullet(`Operation: ${st.operation}`),
      ...(st.email ? [bullet(`Email: ${st.email}`)] : []),
      bullet(`Availability: ${st.officeHours}`),
    ]),
    p(
      `Written verification of course completion under K.A.R. 109-11-8 is provided by the primary instructor, ${staff.name}, within ${INSTRUCTOR_VERIFICATION_DAYS} days of the final class session and before the student sits the certification examination.`,
    ),

    // --- 8. The schedule --------------------------------------------------
    h1('Course schedule'),
    p(
      `Every session with its date, time, subject, laboratory hours and instructor, per K.A.R. 109-11-1a(b3). Class location unless otherwise noted: AMR Kansas City headquarters, with AMR Wichita joining by Teams.`,
    ),
    spacer(120),
    table(SCHED_COLS, ['Date', 'Topic / assignment', 'Didactic hrs', 'Lab hrs', 'Instructor'], scheduleRows),
    spacer(),
    p(
      `Total hours: ${KC_TOTAL_TARGET} — didactic ${totals.didactic}, laboratory ${totals.lab}, hospital clinical ${KC_CLINICAL_TARGET}, field internship ${KC_FIELD_TARGET}. Of the ${totals.classroom} classroom hours, ${totals.f2f} are face-to-face across ${totals.f2fWeeks} class weeks and ${totals.assignment} are completed by the student through Navigate before the session they belong to.`,
      { bold: true },
    ),
    p(
      `No session falls on a holiday. The calendar absorbs them rather than extending the course: week 8 runs Tuesday only, and a two-week break runs ${longDate(WINTER_BREAK.start)} to ${longDate(WINTER_BREAK.end)}. The break is not a pause — students complete concentrated clinical and field shifts across it together with three dated retrieval assignments.`,
    ),
    ...KC_HOLIDAYS.map((h) => bullet(`${longDate(h.date)} — ${h.name}. ${h.absorbedBy}`)),
    spacer(),
    p(
      'Didactic hours represent the minimum time a student should dedicate to the material. Depending on the subject and on the student, most subjects take longer to master than the schedule allots.',
      { italics: true },
    ),

    h1('Records'),
    p(
      `Program records are retained for at least ${RECORDS_RETENTION_YEARS} calendar years by the sponsoring agency, in hard copy and electronically, per K.A.R. 109-17-3.`,
    ),
    {
      k: 'provenance',
      command: 'npm run doc:syllabus',
      startDate: KC_START_DATE,
      endDate: KC_END_DATE,
      weeks: KC_COURSE_WEEKS,
    },
  ]
}
