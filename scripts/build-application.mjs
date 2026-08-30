// Build the KBEMS "Initial Instruction Course Approval" application as a .docx.
//
// The schedule table, hour totals, dates, sites, staff and grading model are
// read from src/data/aemt.ts — the same module the app builds its calendar
// from. That is the whole point of generating this rather than typing it: the
// schedule filed with the board and the schedule the coordinator works to are
// the same object, so they cannot drift the way each source document's summary
// line drifted from its own table.
//
// THIS IS A JOINT APPLICATION. AMR Kansas City and AMR Wichita are running one
// AEMT class for the October 2026 cohort. Kansas City is the sponsoring
// organization and files it; both markets' instructors and both markets' sites
// are named, because a site not on the application cannot be rotated through
// without going back to the board for a new approval.
//
// The surrounding prose is the syllabus text both programs had already adopted,
// amended where the joint plan changed the policy it describes.
//
// Run: npm run doc:application  [-- <output path>]
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { build } from 'esbuild'
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_MODULE = join(tmpdir(), `ces-application-${process.pid}.mjs`)
const outPath = resolve(
  process.argv[2] ?? join(ROOT, 'build', 'KBEMS-AEMT-Course-Approval-Oct2026-Joint-Cohort.docx'),
)

// ----- load the course data --------------------------------------------------

await build({
  stdin: {
    contents:
      `export * from ${JSON.stringify(join(ROOT, 'src', 'data/aemt'))}\n` +
      `export * as A from ${JSON.stringify(join(ROOT, 'src', 'data/aemtAssessments'))}\n`,
    resolveDir: join(ROOT, 'src'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT_MODULE,
})
const m = await import(pathToFileURL(OUT_MODULE).href)
rmSync(OUT_MODULE, { force: true })

const totals = m.scheduleTotals()
const staff = m.PRIMARY_INSTRUCTOR
const A = m.A
const clinicalSites = m.KC_SITES.filter((s) => s.kind === 'clinical')
const fieldSites = m.KC_SITES.filter((s) => s.kind === 'field')
const siteList = (sites) =>
  sites.map((s) => `${s.name} (${m.CAMPUS_LABEL[s.campus]})`).join(' and ')

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const longDate = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return `${MONTHS[mo - 1]} ${d}, ${y}`
}
const shortDate = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return `${mo}.${d}.${y}`
}

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const weekdayOf = (iso) => {
  const [y, mo, d] = iso.split('-').map(Number)
  return WEEKDAY[new Date(y, mo - 1, d).getDay()]
}

// ----- document furniture ----------------------------------------------------

const LETTER = { width: 12240, height: 15840 }
const MARGIN = 1080
const CONTENT_WIDTH = LETTER.width - MARGIN * 2 // 10080 DXA

const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    alignment: opts.alignment,
    indent: opts.indent,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22 })],
  })

const H1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28 })],
  })

const H2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  })

const BULLET = (text, level = 0) =>
  new Paragraph({
    numbering: { reference: 'app-bullets', level },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 22 })],
  })

// ----- the schedule table ----------------------------------------------------

const COLS = [1500, 4520, 900, 800, 2360] // sums to CONTENT_WIDTH

const cell = (children, opts = {}) =>
  new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shaded
      ? { type: ShadingType.CLEAR, fill: 'E8EDF5', color: 'auto' }
      : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children,
  })

const headerRow = new TableRow({
  tableHeader: true,
  children: ['Date', 'Topic / Assignment', 'Didactic Hours', 'Lab Hours', 'Instructor'].map(
    (t, i) =>
      cell(
        [
          new Paragraph({
            spacing: { after: 0 },
            alignment: i >= 2 && i <= 3 ? AlignmentType.CENTER : undefined,
            children: [new TextRun({ text: t, bold: true, size: 20 })],
          }),
        ],
        { width: COLS[i], shaded: true },
      ),
  ),
})

// Rows in date order. K.A.R. 109-11-1a(b3) wants the date AND time of each
// session, so the time goes in the date cell rather than being implied by a
// note under the table — the two Saturday AHA courses do not run 0900-1300 and
// a reviewer reading down the column should not have to know that.
const scheduleRows = [...m.KC_SCHEDULE]
  .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
  .map((r) => {
  const dateLines = [
    r.label,
    `${weekdayOf(r.date)} ${shortDate(r.date)}`,
    ...(r.startTime ? [`${r.startTime}–${r.endTime}`] : []),
  ]
  const num = (v) =>
    new Paragraph({
      spacing: { after: 0 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(v), size: 20 })],
    })

  return new TableRow({
    children: [
      cell(
        dateLines.map(
          (line, i) =>
            new Paragraph({
              spacing: { after: 0 },
              children: [new TextRun({ text: line, size: 20, bold: i === 0 })],
            }),
        ),
        { width: COLS[0] },
      ),
      cell(
        [
          new Paragraph({
            spacing: { after: 0 },
            children: [new TextRun({ text: r.title, size: 20 })],
          }),
          ...(r.delivery === 'assignment'
            ? [
                new Paragraph({
                  spacing: { before: 40, after: 0 },
                  children: [
                    new TextRun({
                      text: 'Completed by the student through Navigate before the session; not classroom contact time.',
                      size: 17,
                      italics: true,
                    }),
                  ],
                }),
              ]
            : []),
        ],
        { width: COLS[1] },
      ),
      cell([num(r.didacticHours)], { width: COLS[2] }),
      cell([num(r.labHours)], { width: COLS[3] }),
      cell(
        [
          new Paragraph({
            spacing: { after: 0 },
            children: [
              new TextRun({
                text:
                  r.delivery === 'aha'
                    ? 'AHA-certified instructor'
                    : `${staff.name}, ${staff.credential}`,
                size: 20,
              }),
            ],
          }),
        ],
        { width: COLS[4] },
      ),
    ],
  })
})

const totalRow = new TableRow({
  children: [
    cell(
      [
        new Paragraph({
          spacing: { after: 0 },
          children: [new TextRun({ text: 'Total', bold: true, size: 20 })],
        }),
      ],
      { width: COLS[0], shaded: true },
    ),
    cell(
      [
        new Paragraph({
          spacing: { after: 0 },
          children: [
            new TextRun({
              text: `${m.KC_SCHEDULE.length} scheduled rows across ${totals.weeks} instructional weeks`,
              size: 20,
            }),
          ],
        }),
        // The didactic column sums to more than the didactic total quoted
        // below it, because the two AHA provider courses are counted in their
        // own bucket. Said here rather than left for a reviewer to find: a
        // column that does not add up is the first thing anyone checks.
        new Paragraph({
          spacing: { before: 40, after: 0 },
          children: [
            new TextRun({
              text: `Of the didactic total, ${totals.aha} h are the two AHA provider courses and are reported separately below; the remaining ${totals.didactic} h are ${totals.f2fDidactic} h face-to-face and ${totals.assignment} h pre-class.`,
              size: 17,
              italics: true,
            }),
          ],
        }),
      ],
      { width: COLS[1], shaded: true },
    ),
    cell(
      [
        new Paragraph({
          spacing: { after: 0 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: String(Math.round((totals.didactic + totals.aha) * 10) / 10),
              bold: true,
              size: 20,
            }),
          ],
        }),
      ],
      { width: COLS[2], shaded: true },
    ),
    cell(
      [
        new Paragraph({
          spacing: { after: 0 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: String(totals.lab), bold: true, size: 20 })],
        }),
      ],
      { width: COLS[3], shaded: true },
    ),
    cell([new Paragraph({ spacing: { after: 0 }, children: [] })], {
      width: COLS[4],
      shaded: true,
    }),
  ],
})

const scheduleTable = new Table({
  columnWidths: COLS,
  width: { size: CONTENT_WIDTH, type: WidthType.DXA },
  rows: [headerRow, ...scheduleRows, totalRow],
})

// ----- clinical minimums table ----------------------------------------------

const karMinimums = m.CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar')

// ----- the document ----------------------------------------------------------

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: 'Initial Instruction Course Approval — Advanced Emergency Medical Technician',
  description:
    'Kansas BEMS AEMT initial course approval application — joint AMR Kansas City / AMR Wichita cohort, October 2026',
  numbering: {
    config: [
      {
        reference: 'app-bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 480, hanging: 240 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 960, hanging: 240 } } } },
        ],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: { size: LETTER, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } },
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: 'AMR Kansas City & AMR Wichita — AEMT Initial Course Approval    ',
                  size: 18,
                }),
                new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18 }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'Initial Instruction Course Approval', bold: true, size: 32 })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [
            new TextRun({ text: 'Advanced Emergency Medical Technician', bold: true, size: 26 }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 240 },
          border: { bottom: { style: 'single', size: 6, color: '888888', space: 8 } },
          children: [
            new TextRun({
              text: `AMR Kansas City (sponsoring organization) with AMR Wichita  ·  ${longDate(
                m.KC_START_DATE,
              )} to ${longDate(m.KC_END_DATE)}`,
              size: 22,
            }),
          ],
        }),

        H1('Glossary'),
        ...[
          'AEMT: Advanced Emergency Medical Technician',
          'EMR: Emergency Medical Responder',
          'EMS: Emergency Medical Service',
          'EMT: Emergency Medical Technician',
          'F2F: Face to face / in person classroom',
          'Teams: Online meeting platform',
        ].map((t) => P(t, { after: 40 })),

        H1('Course requirements in K.A.R. 109-11-1a (b)-(e)'),

        H2('(b1) Documents'),

        H2('Course Goals and Objectives'),
        P(
          'The AEMT is a health professional whose primary focus is to respond to, assess and triage nonurgent, urgent, and emergent requests for medical care, apply basic and focused advanced knowledge and skills necessary to provide patient care and/or medical transportation, and facilitate access to a higher level of care when the needs of the patient exceed the capability level of the AEMT. The additional preparation beyond EMT prepares an AEMT to improve patient care in common emergency conditions for which reasonably safe, targeted, and evidence-based interventions exist. Interventions within the AEMT scope of practice may carry more risk if not performed properly than interventions authorized for the EMR/EMT levels. With proper supervision, AEMTs may serve as a patient care team member in a hospital or health care setting to the full extent of their education, certification, licensure, and credentialing. In a community setting an AEMT might visit patients at home and make observations that are reported to a higher-level authority to help manage a patient’s care.',
        ),
        P('Students will be able to:'),
        BULLET('Describe patient care responsibilities of the AEMT,'),
        BULLET('Demonstrate AEMT level skills, and'),
        BULLET('Apply the patient care and other duties/responsibilities of the AEMT.'),

        H2('Instructional and Other Materials Required to be Purchased by the Student'),
        P(
          `Textbook: ${m.COURSE_TEXT.title} (${m.COURSE_TEXT.edition} ed., © ${m.COURSE_TEXT.copyright}). Burlington, MA: ${m.COURSE_TEXT.publisher}. ISBN: ${m.COURSE_TEXT.isbn}.`,
        ),
        P(
          `Resources: ${m.COURSE_TEXT.title}, ${m.COURSE_TEXT.edition} Edition Navigate online course materials.`,
        ),

        H2('Student Attendance Policies'),
        P(
          `Classroom, lecture, and lab skill performance are scheduled every Tuesday and Thursday from 9am to 1pm, with two American Heart Association provider courses delivered on Saturdays as shown in the schedule. Students are required to attend all scheduled meeting times to successfully meet the course objectives. In the event of an unavoidable absence, it is the student’s responsibility to contact the instructor to obtain the missed information.`,
        ),
        P(
          `Missing more than ${m.MAX_ABSENT_HOURS} hours of the scheduled meeting time triggers a documented make-up requirement: ${m.ABSENCE_MAKEUP.requirement} A student who does not complete the make-up has not met the course objectives and does not complete the course. ${m.ABSENCE_MAKEUP.note}`,
        ),
        P(
          'Clinical absences should be avoided. If unavoidable, the student must e-mail and leave a voice mail for the instructor and EMS unit as soon as possible regarding their impending absence. The student is responsible for working with the instructor to schedule a makeup time. If the student is unable to reschedule missed clinical time the course will be considered incomplete and the student will not be eligible to attempt board certification.',
        ),

        H2('Prerequisite Work Required Before the First Session'),
        P(
          `${m.PRE_COURSE_POLICY.requirement} This covers chapters ${m.PRE_COURSE_CHAPTERS[0]} to ${m.PRE_COURSE_CHAPTERS[m.PRE_COURSE_CHAPTERS.length - 1]} — EMS systems, workforce safety and wellness, medical-legal and ethical issues, and communications and documentation — which are delivered as assigned Navigate work rather than as classroom time. Every student enters the course holding a current EMT certification and works inside this material on every shift, so the classroom hours it would otherwise consume are re-allocated to the Clinical Judgment domain, which is 31-35% of the certification examination. ${m.PRE_COURSE_POLICY.checkedAt} ${m.PRE_COURSE_POLICY.ifIncomplete}`,
        ),

        H2('Student Requirements for Successful Course Completion'),
        P(
          `Students must successfully complete the course with a final course grade of ${m.MIN_PASSING_PERCENT}% or higher to be eligible to take the National Registry Certification exam. Students are expected to take all exams during the time they are scheduled. Students may make prior arrangements with the instructor to make up missed exams. However, any missed exam without prior instructor approval will be given a grade of “0”. A zero on any exam results in the student’s inability to complete the course satisfactorily. In addition to exams, each student will be evaluated by instructors regarding attitude, participation, attendance, appearance, and overall performance. This evaluation will be based on observations by the instructors, clinical preceptors, and the EMS Lead Instructor during classroom/lab practice, skill demonstrations, and clinical experiences. Students must satisfactorily complete all methods of evaluation to successfully complete the course.`,
        ),

        H2('Description of the Clinical and Field Training Requirements'),
        P(
          `All students will be required to complete a total of ${m.KC_FIELD_TARGET} hours with an ambulance service — twelve 12-hour shifts — and six 12-hour shifts (${m.KC_CLINICAL_TARGET} hours) at a clinical facility, to participate in supervised patient skills. Each student rotates through the sites of their own operation, so that every student responds to 911 calls in both the urban and the rural setting within reasonable travelling distance of where they live and work. The didactic programme is delivered jointly and is identical for every student.`,
        ),
        BULLET('Field internship:'),
        ...fieldSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`, 1)),
        BULLET('Clinical:'),
        ...clinicalSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`, 1)),
        P(
          'Clinical and field placement is scheduled by phase against what the student is cleared to perform, weighted toward the settings where each required skill actually occurs, with reserve shifts held back for any student who falls behind. Deficit checkpoints tied to the didactic gates are reviewed on fixed dates; a student below the cumulative floor is assigned an added shift in that week.',
        ),
        P(
          'Uniform attire of black shoes, the uniform shirt with provided name tag and navy-blue pocket pants for both clinical and ambulance experiences is required during clinical and field internship experiences.',
        ),

        H2('Student Discipline Policies'),
        P(
          'ACADEMIC HONESTY: As a profession, EMS should be dedicated to creating and maintaining an environment of academic honesty. It is the faculty’s responsibility to affirm the importance of academic integrity and to try to educate students as to standards of academic behavior. Students, too, bear the responsibility for academic integrity. Each student is expected to learn and comply with academic expectations, display appropriate conduct in classroom situations, and preserve academic integrity by upholding the spirit of honest course work. Violations of academic integrity include but are not limited to the following: plagiarism, cheating, trafficking, copyright infringement, and interfering with the learning of other students.',
        ),

        H2('Instructor Information'),
        ...m.COURSE_STAFF.flatMap((st) => [
          BULLET(
            `${st.role === 'primary' ? 'Primary instructor' : 'Co-instructor of record'}: ${st.name}, ${st.credential} — ${st.operation}`,
          ),
          BULLET(`Office hours or hours available for consultation: ${st.officeHours}`, 1),
          ...(st.email ? [BULLET(`Electronic-mail address: ${st.email}`, 1)] : []),
        ]),
        P(
          `Written verification of course completion under K.A.R. 109-11-8 is provided by the primary instructor, ${staff.name}. The co-instructor of record teaches to the same schedule and the same standard but does not sign completions.`,
        ),

        H1('(b2) Course Policies'),

        H2('Student Evaluation of Program Policies'),
        ...m.GRADING_MODEL.map((c) =>
          BULLET(
            `${c.label} — ${c.weight === null ? 'Satisfactory / Unsatisfactory' : `${c.weight}%`}`,
          ),
        ),
        P(
          `Graded components total ${m.GRADING_WEIGHT_TOTAL}%. Every closed-book component is proctored and administered under examination conditions. Three mastery gate examinations are blueprint-weighted to the National Registry AEMT examination specifications and are scored against a minimum passing standard of ${m.MIN_PASSING_PERCENT}%; a student below the standard completes a targeted deliberate-practice session within seven days and retests on a parallel form. Didactic instruction continues throughout; what is gated is the following unit’s psychomotor laboratory. Two failed retests trigger the private progress conference described below.`,
        ),
        ...A.MASTERY_GATES.map((g) =>
          BULLET(`${g.label} — ${longDate(g.date)}; retest window closes ${longDate(g.retestBy)}`),
        ),
        P(
          'Course evaluations will be used for each educational offering. Evaluations will be reviewed and analyzed by the Instructor, Preceptors, Training Program Manager and/or EMS Service Director to ensure that quality education is being delivered. If need be, the EMS Training Program Manager and EMS Service Director will act upon evaluations as they see fit or the need arises.',
        ),
        P(
          'Each clinical experience as well as each field internship experience will be evaluated by the student’s preceptor. This evaluation will reflect the number of required skills the student attempted and the success of those attempts. These evaluations will be reviewed, and remedial education will be provided when necessary. The student will be provided with the opportunity to evaluate each preceptor and is encouraged to do so.',
        ),

        H2('Student and Participant Safety Policies'),
        P(
          'Performing in the role of medical assistance may require contact with the human body and body secretions. The course may contain explicit information on topics and issues such as nudity, sexuality, and elimination of body waste (this is not an inclusive list). As a result, this course will contain information about these topics.',
        ),
        P(
          'Each student shall address any problem or concern they may have regarding their safety immediately to the instructor, preceptor or any AMR employee or representative that is present. All students will perform with normal regard for personal safety. At no time shall the student perform any action that the student or instructional staff deems unsafe or feels is an inappropriate action. Any student with an infectious disease will be encouraged to report their condition to the instructional staff. Participation in course activities, by the person with an infectious disease, will be at the discretion of the instructional staff. The student will utilize all necessary means to prevent transmission to other course participants. In severe cases, the instructional staff reserves the right to refuse participation in the course. As is the policy in the workplace, persons who feel ill should not participate in any class, clinical or field internship activities.',
        ),
        P(
          'Besides physical safety, AMR recognizes the mental and emotional strains inherent to the EMS profession. The pace of this course along with working full time, family obligations and social interactions can become overwhelming. The student is encouraged to voice feelings of becoming overwhelmed to the instructor or a representative of the GMR EAP. The ultimate goal of this endeavor is the success of the student.',
        ),

        H2('Patient Confidentiality'),
        P(
          'Students are expected to protect patient confidentiality in all aspects of the clinical/field internship. Students are not to discuss patient information outside of the clinical facility and are not allowed to copy patient records to complete patient documentations for the program. Students will be under the direct supervision of hospital, field, or AMR preceptors and will follow their directives.',
        ),
        P('PHI (PERSONAL HEALTH INFORMATION)', { bold: true }),
        BULLET(
          'THERE IS NO CIRCUMSTANCE IN WHICH ANY OF THIS INFORMATION SHOULD BE CAPTURED ON AN ELECTRONIC DEVICE WHILE DOING CLINICAL OR EMS ROTATIONS.',
        ),
        BULLET('IF FOUND TO HAVE HAPPENED, THE STUDENT WILL BE DISMISSED FROM THE PROGRAM.'),
        P(
          'In regard to current concerns of social networking sites, including but not limited to Facebook, Twitter (X), YouTube, etc., the student must NOT POST ANY PHOTOS, VIDEOS, PATIENT INFORMATION OR ANY OTHER DATA REGARDING YOUR PATIENTS, OR AFFILIATIONS. The student must keep in mind everything taught to them in school in regard to moral and ethical behavior plus federal laws regarding confidentiality, HIPAA protected information and GMR policies regarding protection of privacy of the student’s patients. Students who breach these policies will be exited from the program.',
        ),

        H2('Kansas Requirements for Certification'),
        P(
          `After successfully completing this course, the participant will be eligible to sit the National Registry cognitive examination, which awards certification at a national level and through the Kansas Board of EMS. The National Registry discontinued the Advanced EMT psychomotor examination on 30 June 2024; its content was absorbed into the cognitive examination as the Clinical Judgment domain, and since 1 July 2024 the Program Director verifies through the National Registry that each candidate has met the state minimum competency requirements before the candidate sits the examination. Facilitation of application, Authorization to Test and Pearson VUE scheduling is provided during the final week of the course. Students are advised to sit the examination within ${A.NREMT_SIT_WITHIN_DAYS} days of course completion; the Authorization to Test is valid for 90 days, but retention decays and there is no advantage in waiting.`,
        ),

        H2('Student Dress and Hygiene Policies'),
        P(
          'The student must wear black shoes, a uniform shirt provided and navy-blue pocket pants for both clinical and ambulance experiences. At all times it will be evident that the student is in a learning role and will wear the provided name tag bearing the title “student.”',
        ),

        H2('Student Progress Conferences'),
        P(
          'Student progress and affective evaluation conferences will occur as needed, with each student being scheduled for at least one private conference with the instructor during the course. Each student is encouraged to contact the instructor immediately with any concerns during the course and should not wait for a scheduled conference.',
        ),

        H2('Equipment Use Policies'),
        P(
          'Instructors will follow the appropriate decontamination of equipment according to the manufacturer’s instructions. Instructors are responsible for ensuring that the course equipment is clean and in working condition before the course. If contaminated with potential infectious material, the equipment will be placed out of service and immediately disinfected with a disinfectant agent effective against enveloped virus and following the agent manufacturer recommendations.',
        ),

        new Paragraph({ children: [] }),
        H1('(b3) Course Schedule'),
        BULLET('The date and time of each class session: as shown below.'),
        BULLET('The title of the subject matter of each class session: as shown below.'),
        BULLET('The instructor of each class session: as shown below.'),
        BULLET('The number of psychomotor skills laboratory hours for each session: as shown below.'),
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        scheduleTable,
        new Paragraph({ spacing: { before: 160 }, children: [] }),
        P(
          `Class location (unless otherwise noted): AMR Kansas City headquarters, with AMR Wichita joining by Teams. Class dates ${longDate(
            m.KC_START_DATE,
          )} to ${longDate(m.KC_END_DATE)}. F2F — 0900 to 1300, Tuesday and Thursday. The two American Heart Association provider courses are delivered on the Saturdays shown. The first row of the table is prerequisite work assigned before the course opens and carries no classroom time; it is dated ${longDate(
            m.PRE_COURSE.date,
          )} because that is when it falls due, and it sits inside the table rather than outside it so the schedule accounts for every hour the student is assigned.`,
        ),
        P(
          `Total hours: ${
            m.KC_TOTAL_TARGET
          } (Didactic ${totals.didactic}; Lab ${totals.lab}; AHA provider courses ${totals.aha}; Clinicals ${m.KC_CLINICAL_TARGET}; Field Internship ${m.KC_FIELD_TARGET}).`,
          { bold: true },
        ),
        P(
          `Of the ${totals.classroom} classroom hours, ${totals.f2f} are face-to-face across ${totals.f2fWeeks} class weeks, ${totals.aha} are the two AHA provider courses, and ${totals.assignment} are completed by the student through the Navigate online course materials before the session they belong to.`,
        ),
        P(
          `The course delivers ${totals.weeks} instructional weeks across ${m.KC_CALENDAR_WEEKS} calendar weeks. No class session falls on a holiday. Rather than moving class weeks around the holidays and extending the course, the calendar absorbs them: week 8 runs on the Tuesday only and the ACLS provider course moves to Saturday ${shortDate(
            '2026-12-05',
          )}, and a two-week break runs ${longDate(m.WINTER_BREAK.start)} to ${longDate(
            m.WINTER_BREAK.end,
          )}. The break is not a pause — students complete concentrated clinical and field shifts across it, together with three dated retrieval assignments. The holidays observed are:`,
        ),
        ...m.KC_HOLIDAYS.map((h) => BULLET(`${longDate(h.date)} — ${h.name}. ${h.absorbedBy}`)),
        P(
          'Didactic hours are believed to be the minimum time the student should dedicate to the material. Depending on the subject and the level of experience of each student, it will generally be the case that most of these subjects will take longer to master than is represented by the course schedule.',
          { italics: true },
        ),

        H1('(b4) Letters or Contracts From'),
        BULLET('Ambulance Service Directors providing field training to the students:'),
        ...fieldSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`, 1)),
        BULLET('Administrators of the medical facilities where clinical rotation is provided:'),
        ...clinicalSites.map((s) => BULLET(`${s.name} — ${m.CAMPUS_LABEL[s.campus]}`, 1)),
        P(
          'Every site above is named on this application, including those held for overflow capacity and not currently intended for rotation, so that a student may be placed at any of them without a further approval.',
        ),

        H1('(c) Application Submission'),
        BULLET(
          `The first scheduled course session is ${longDate(
            m.KC_START_DATE,
          )}. K.A.R. 109-11-1a(c) requires this application in the board office not later than 30 calendar days before it — ${longDate(
            '2026-09-06',
          )}. That is a Sunday and the following Monday is Labor Day, so the application is submitted by ${longDate(
            '2026-09-04',
          )}.`,
        ),

        H1('(d) Approved Initial Course Shall Meet the Following Conditions'),
        BULLET(
          'Meet or exceed the course requirements described in the board’s regulations: 109-11-4a.',
        ),
        BULLET(
          'Approval by the sponsoring organization’s medical director: approval of the AEMT class noted by signature on the course application by the medical director of the sponsoring agency.',
        ),
        P(
          `Records will be maintained for at least ${m.RECORDS_RETENTION_YEARS} calendar years by the sponsoring agency, both in hardcopy and electronic format. The following items will be kept/uploaded at the above stated location following each educational offering:`,
        ),
        ...[
          'All documents required to be submitted with the application for course approval,',
          'Student attendance,',
          'Student grades,',
          'Student conferences,',
          'Course curriculum,',
          'Lesson plans for all lessons,',
          'Clinical training objectives, if applicable,',
          'Field training objectives, if applicable,',
          'Completed clinical and field training preceptor evaluations for each student,',
          'Each student’s ability to perform competently in a simulated or actual field situation, or both,',
          'Each student’s ability to integrate cognitive and psychomotor skills to appropriately care for sick and injured patients (App A and App C),',
          'Each student’s psychomotor skills evaluations as specified in the course syllabus,',
          'Completed copies of each student’s evaluations of each course, all instructors for the course, and all lab instructors for the course, and',
          'Course syllabus.',
        ].map((t) => BULLET(t)),

        H1('(e) Student Registration'),
        P(
          `Each primary instructor shall provide the executive director with a student registration form from each student within 20 days of the first class session, scheduled on ${longDate(
            m.KC_START_DATE,
          )}.`,
        ),

        H1('K.A.R. 109-11-4a  Advanced Emergency Medical Technician Course Approval'),
        H2('(c) How each student is provided with experiences'),
        P(
          'Students will track individual patient encounters using the AMR patient encounter log (App B). Under no circumstances should any personally identifying information be included in the log. This log, in conjunction with the AMR AEMT daily evaluation (App C), will allow students and the instructor to ensure the minimum encounters described below:',
        ),
        ...karMinimums.map((r) =>
          BULLET(
            `${r.label} — ${r.minimum}${
              r.subRequirement ? ` (${r.subRequirement.minimum} ${r.subRequirement.label})` : ''
            }${
              // Only worth saying when it constrains something. Where the field
              // minimum equals the total, "at least 10 during field internship"
              // beside "10" is noise.
              r.fieldMinimum && r.fieldMinimum < r.minimum
                ? `; at least ${r.fieldMinimum} during field internship`
                : ''
            }`,
          ),
        ),
        BULLET(
          'Administer one nebulized breathing treatment during clinical training — tracked as a program competency (see note below).',
        ),
        P(
          'Note on the nebulized breathing treatment: the previously filed Wichita syllabus, which this course descends from, listed this among the K.A.R. 109-11-4a(c) minimums. It is retained here because the program tracks it, but it is not a statutory AEMT minimum — nebulized treatment appears under the EMT requirement at K.A.R. 109-11-8(a)(3)(B), not in the AEMT list at (a)(4), and is absent from (a)(4) in the 2021, 2023 and current (6 March 2026) regulation text. It is therefore carried under (a)(2), which requires practical skills be completed to the satisfaction of the primary instructor, and it does not gate course completion.',
          { italics: true },
        ),

        H2('(d)-(f)'),
        BULLET('Any approved course may be monitored by the executive director.'),
        BULLET(
          'Each sponsoring organization shall ensure that the instructor-coordinator provides any course documentation requested by the executive director.',
        ),
        BULLET(
          'Program approval may be withdrawn by the board if the sponsoring organization fails to comply with or violates any regulation or statute that governs sponsoring organizations.',
        ),

        H1('Appendices'),
        ...[
          'Appendix A — CoAEMSP affective evaluation',
          'Appendix B — Patient encounter log',
          'Appendix C — Clinical / field internship daily evaluation',
          'Appendix D — CoAEMSP instructor evaluation',
          'Appendix E — CoAEMSP final course evaluation',
        ].map((t) => BULLET(t)),
      ],
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))

console.log(`Wrote ${outPath}`)
console.log(
  `  ${m.KC_SCHEDULE.length} schedule rows · didactic ${totals.didactic} · lab ${totals.lab} · ` +
    `AHA ${totals.aha} h · f2f ${totals.f2f} h · pre-class ${totals.assignment} h`,
)
console.log(
  `  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)} · ` +
    `${totals.weeks} instructional weeks over ${m.KC_CALENDAR_WEEKS} calendar weeks · ` +
    `${m.COURSE_STAFF.length} instructors, ${m.KC_SITES.length} sites across both markets`,
)
