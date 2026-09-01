// Build the student course guide as a .docx — the sheet a student works from.
//
// Everything in it is read from the same modules the app and the KBEMS
// application are built from: the schedule (data/aemt.ts), the graded events
// (data/aemtAssessments.ts), the Navigate assets (data/navigateAssets.ts) and
// the rotation plan (data/aemtPhases.ts). Nothing is typed twice, so a student
// cannot be handed a week that disagrees with the calendar the instructor is
// working to — which is the failure this replaces. The old answer to "what am I
// supposed to do before Tuesday" was a verbal one.
//
// WHAT MAKES AN ASSIGNMENT USABLE, and what this is trying to do about it:
//
//   It has to be specific enough to finish. "Do the Navigate work for chapter
//   11" is not an assignment. "Module 11, 87 minutes, then the fourteen airway
//   Skill Drills starting on page 569" is — a student can tell on a Sunday
//   evening whether they are done.
//
//   It has to say what it costs. Every week states its module minutes, taken
//   from the publisher's own run times, and says plainly that reading the
//   chapter and the flashcards are on top of that. A student planning around
//   two jobs needs the real number, not an encouraging one.
//
//   It has to say what happens in the room. A flipped classroom collapses the
//   moment students discover the lecture gets re-delivered. Each week states
//   what class will be spent on, so skipping the module is visibly a decision
//   to sit through something you cannot follow.
//
//   It has to carry the clinical load beside the reading. The single largest
//   cause of failure here is not the material — it is 18 twelve-hour shifts
//   landing on top of a full-time job, so the rotation phase is on the same
//   page as the week's reading rather than in a separate document.
//
// Run: npm run doc:student  [-- <output path>]
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
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
import { dayDate, loadCourse, longDate, provenance, ROOT, weekdayOf } from './lib/doc-kit.mjs'

const outPath = resolve(
  process.argv[2] ?? join(ROOT, 'build', 'AEMT-Student-Guide-Oct2026.docx'),
)

// Through doc-kit, so the guide, the syllabus and the lesson plans are reading
// the same modules at the same moment — a student told one thing and an
// instructor told another is the failure this document set exists to prevent.
const m = await loadCourse()
const { A, N, P } = m
const totals = m.scheduleTotals()

// ----- document furniture ----------------------------------------------------

const LETTER = { width: 12240, height: 15840 }
const MARGIN = 1080
const CONTENT_WIDTH = LETTER.width - MARGIN * 2

const P_ = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22 })],
  })

const H1 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 140 }, children: [new TextRun({ text, bold: true, size: 30 })] })

const H2 = (text) =>
  new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 100 }, children: [new TextRun({ text, bold: true, size: 24 })] })

const BULLET = (text, level = 0, bold = false) =>
  new Paragraph({
    numbering: { reference: 'sg-bullets', level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, bold })],
  })

/** A tick box a student can actually mark on paper. */
const TASK = (text, level = 0) =>
  new Paragraph({
    spacing: { after: 60 },
    indent: { left: 360 + level * 360, hanging: 300 },
    children: [new TextRun({ text: `☐  ${text}`, size: 22 })],
  })

const cell = (children, opts = {}) =>
  new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: 'E8EDF5', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children,
  })

const tcell = (text, opts = {}) =>
  cell(
    [new Paragraph({ spacing: { after: 0 }, alignment: opts.align, children: [new TextRun({ text: String(text), bold: opts.bold, size: 20 })] })],
    opts,
  )

const table = (cols, header, rows) =>
  new Table({
    columnWidths: cols,
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h, i) => tcell(h, { width: cols[i], shaded: true, bold: true })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => tcell(c, { width: cols[i] })) })),
    ],
  })

// ----- the weeks -------------------------------------------------------------

const bySession = (a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1)
const weekRows = (w) => m.KC_SCHEDULE.filter((r) => r.week === w).sort(bySession)
const preClassOf = (w) => weekRows(w).find((r) => r.delivery === 'assignment' && !r.standalone)
const classesOf = (w) => weekRows(w).filter((r) => r.delivery === 'f2f')

/** The phase a date falls in, so the clinical load sits beside the reading. */
const phases = P.seedPhases(m.KC_START_DATE)
const phaseOn = (iso) => phases.find((p) => iso >= p.windowStart && iso <= p.windowEnd)

function weekSection(w) {
  const pre = preClassOf(w)
  const classes = classesOf(w)
  const chapters = pre?.chapters ?? []
  const drills = N.skillDrills(chapters)
  const rides = N.rideAlongs(chapters)
  const first = classes[0]
  const phase = first ? phaseOn(first.date) : undefined
  const out = []

  out.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 340, after: 40 },
      children: [
        new TextRun({ text: `Week ${w}`, bold: true, size: 30 }),
        new TextRun({
          text: `   ${classes.map((c) => dayDate(c.date)).join('  ·  ')}`,
          size: 22,
          color: '5B6472',
        }),
      ],
    }),
  )

  // What happens in the room. First, because it is the reason the pre-work
  // exists — a student who knows Thursday is a live IV lab reads chapter 13
  // differently.
  out.push(H2('In class'))
  for (const c of classes) {
    out.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: `${dayDate(c.date)}, ${c.startTime}–${c.endTime}. `, bold: true, size: 22 }),
          new TextRun({ text: c.title, size: 22 }),
        ],
      }),
    )
  }

  // Before class.
  if (pre && chapters.length) {
    const mins = chapters.reduce((n, c) => n + (N.chapterAssets(c)?.moduleMinutes ?? 0), 0)
    out.push(H2(`Before class — about ${mins} minutes of module time, plus reading`))
    for (const ch of chapters) {
      const a = N.chapterAssets(ch)
      if (!a) continue
      out.push(TASK(`Read Chapter ${ch}: ${a.title}`))
      out.push(TASK(`Navigate Module ${ch}: ${a.title} — ${a.moduleMinutes} min`, 1))
      out.push(TASK(`Chapter ${ch} flashcards`, 1))
      out.push(TASK(`Chapter ${ch} practice activity`, 1))
    }
    if (drills.length) {
      out.push(
        P_(
          `Skill Drills for this week — read them before the lab, not during it. Every one is in the textbook at the page shown.`,
          { italics: true, after: 60 },
        ),
      )
      for (const d of drills) out.push(TASK(`Skill Drill ${d.n}: ${d.title} — p. ${d.page}`, 1))
    }
    if (rides.length) {
      for (const r of rides) out.push(TASK(`Virtual Ride-Along: ${r}`, 1))
    }
  } else if (pre) {
    out.push(H2('Before class'))
    out.push(TASK(pre.title))
  }

  // Graded events, from the assessment calendar rather than restated.
  const events = classes.flatMap((c) =>
    (c.assessmentIds ?? []).map((id) => ({ c, a: A.assessment(id) })).filter((x) => x.a),
  )
  if (events.length) {
    out.push(H2('Graded this week'))
    for (const { c, a } of events) {
      const bits = [
        a.items ? `${a.items} items` : null,
        a.minutes ? `${a.minutes} min` : null,
        a.proctored ? 'closed book, proctored' : null,
        a.mps ? `${a.mps}% to pass` : null,
      ].filter(Boolean)
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({ text: `${a.label} — ${dayDate(c.date)}. `, bold: true, size: 22 }),
            new TextRun({ text: `Covers ${a.covers}${bits.length ? ` (${bits.join(', ')})` : ''}.`, size: 22 }),
          ],
        }),
      )
      if (a.retestBy) {
        out.push(P_(`If you are below the standard: a targeted practice session within seven days, then a retest on a parallel form by ${longDate(a.retestBy)}. Didactic carries on — what is held back is the next unit's lab.`, { italics: true, after: 100 }))
      }
      if (a.note) out.push(P_(a.note, { italics: true, after: 100 }))
    }
  }

  // The clinical load, on the same page.
  if (phase && phase.shiftsRequired > 0) {
    out.push(H2('Clinical and field, this stretch'))
    out.push(
      P_(
        `You are in Phase ${phase.ordinal}, ${phase.name} (${longDate(phase.windowStart)} to ${longDate(phase.windowEnd)}): ${phase.shiftsRequired} twelve-hour shifts across the window — ${phase.hospitalShifts} hospital, ${phase.fieldShifts} field. These are scheduled on top of class and on top of your regular work.`,
        { after: 80 },
      ),
    )
    const targets = Object.entries(phase.targets ?? {})
    if (targets.length) {
      out.push(
        P_(
          `What the phase should produce: ${targets
            .map(([k, v]) => `${v} ${P.PHASE_TARGET_LABELS[k].toLowerCase()}`)
            .join(', ')}.`,
          { after: 100 },
        ),
      )
    }
  }
  return out
}

// ----- standalone rows: the winter break, and any weekend provider course ----

function standaloneSection(r) {
  const out = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 340, after: 40 },
      children: [new TextRun({ text: r.label, bold: true, size: 30 })],
    }),
  ]
  if (r.startTime) {
    out.push(
      P_(`${weekdayOf(r.date)} ${longDate(r.date)}, ${r.startTime}–${r.endTime}.`, { bold: true }),
    )
    if (r.breakMinutes) {
      out.push(P_(`Includes a ${r.breakMinutes}-minute break. Eight instructional hours.`, { italics: true }))
    }
  }
  out.push(P_(r.title))

  // Anything graded in the block, as dated tick boxes. The break carries three
  // TestPrep sets on three separate dates, and burying those in a sentence is
  // how a fortnight with no class in it becomes a fortnight with no work in it.
  const events = (r.assessmentIds ?? []).map((id) => A.assessment(id)).filter(Boolean)
  if (events.length) {
    out.push(H2('Due during this block'))
    for (const a of events) {
      out.push(TASK(`${a.label} — due ${dayDate(a.date)}. ${a.covers}`))
    }
    const note = events.find((a) => a.note)?.note
    if (note) out.push(P_(note, { italics: true }))
  }

  // The clinical phase, where the block has one — the break IS the phase.
  const phase = phaseOn(r.date)
  if (phase && phase.shiftsRequired > 0) {
    out.push(
      P_(
        `Phase ${phase.ordinal}, ${phase.name}: ${phase.shiftsRequired} twelve-hour shifts inside this window — ${phase.hospitalShifts} hospital, ${phase.fieldShifts} field. There is no class competing for the time and holiday call volume is high, which is why this is the highest-yield block in the whole rotation.`,
      ),
    )
  }
  return out
}

// ----- the document ----------------------------------------------------------

const gates = A.MASTERY_GATES
const quizzes = A.RETRIEVAL_QUIZZES

const doc = new Document({
  creator: 'AMR Kansas City — Clinical Education',
  title: 'AEMT Student Course Guide — October 2026 Cohort',
  description: 'Week-by-week assignments, readings and graded events for the joint AMR Kansas City / AMR Wichita AEMT cohort',
  numbering: {
    config: [
      {
        reference: 'sg-bullets',
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 240 } } } },
          { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 780, hanging: 240 } } } },
        ],
      },
    ],
  },
  sections: [
    {
      properties: { page: { size: LETTER, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: 'AEMT Student Guide — October 2026 cohort    ', size: 18 }),
                new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18 }),
              ],
            }),
          ],
        }),
      },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Advanced EMT — Student Course Guide', bold: true, size: 34 })] }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 },
          border: { bottom: { style: 'single', size: 6, color: '888888', space: 8 } },
          children: [new TextRun({ text: `AMR Kansas City & AMR Wichita  ·  ${longDate(m.KC_START_DATE)} to ${longDate(m.KC_END_DATE)}`, size: 22 })],
        }),

        H1('How this course works'),
        P_(
          `Sixteen instructional weeks across ${m.KC_CALENDAR_WEEKS} calendar weeks, Tuesdays and Thursdays 0900–1300, with two American Heart Association provider courses on Saturdays and a two-week break over the holidays. Kansas City and Wichita run this as one class: one schedule, one standard, one set of exams. Your clinical and field shifts are at your own operation's sites.`,
        ),
        H2('The lecture is not in the classroom'),
        P_(
          `Each week has a Navigate module to work through BEFORE the session it belongs to. Class time is spent on worked cases, exam-format drills and lab — not on re-delivering the module. That is the whole design, and it only works from your side of it: if you arrive without the module done, the session will be about material you have not met yet, and nobody will slow down to cover it.`,
        ),
        H2('What the module times below mean'),
        P_(
          `Each week states the run time of its Navigate modules, taken from the publisher's own figures. That is module time only. Reading the chapter, the flashcards and the practice activities are on top of it. Plan for meaningfully more than the number shown.`,
        ),
        H2('The single biggest demand is the clinical'),
        P_(
          `${P.PLANNED_SHIFTS} twelve-hour shifts — ${m.KC_CLINICAL_TARGET} hours in hospital and ${m.KC_FIELD_TARGET} hours on an ambulance — scheduled on your days off, on top of class and on top of your regular job. That is roughly 1.3 shifts a week, peaking at two a week over the winter break. Every year this is what ends courses, and it ends them in January when there is no slack left. Build your schedule around it now.`,
        ),

        H1('How you are graded'),
        P_(`${m.MIN_PASSING_PERCENT}% is the minimum to complete the course. Most of the graded weight is closed book and proctored, because that is what the certification exam is.`),
        table(
          [7080, 1500, 1500],
          ['Component', 'Weight', ''],
          m.GRADING_MODEL.map((c) => [c.label, c.weight === null ? 'S/U' : `${c.weight}%`, '']),
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        P_(
          `The three gate exams are pass/fail against ${m.MIN_PASSING_PERCENT}%. Falling below it does not stop you attending — what it holds back is the next unit's lab, until you have done a targeted practice session and passed a retest on a parallel form. Two failed retests means a private progress conference, early, while there is still course left to fix it in.`,
        ),
        table(
          [4680, 2700, 2700],
          ['Gate exam', 'Date', 'Retest window closes'],
          gates.map((g) => [g.label, longDate(g.date), longDate(g.retestBy)]),
        ),
        new Paragraph({ spacing: { after: 200 }, children: [] }),
        P_(
          `There is a ten-item closed-book quiz at the start of almost every session — ${quizzes.length} in all. Roughly four items come from last session, three from two to four sessions back, and three from the earliest material in the course. They are cumulative from week one on purpose: material you met in October is on the quiz in January, which is the only reliable way to still have it in February.`,
        ),

        H1('Attendance'),
        P_(
          `Missing more than ${m.MAX_ABSENT_HOURS} hours of scheduled class time triggers a make-up requirement: ${m.ABSENCE_MAKEUP.requirement} ${m.ABSENCE_MAKEUP.note}`,
        ),
        P_(
          `Clinical absences should be avoided. If one is unavoidable, email and phone the instructor and the site as early as you can, and it is your job to reschedule it. Clinical hours you do not make up mean an incomplete course, and an incomplete course means you are not eligible to sit the certification exam.`,
        ),

        H1('Before the course starts'),
        P_(`${m.PRE_COURSE_POLICY.requirement} Due ${longDate(m.PRE_COURSE_POLICY.dueBy)}.`, { bold: true }),
        P_(
          `Chapters ${m.PRE_COURSE_CHAPTERS[0]}–${m.PRE_COURSE_CHAPTERS[m.PRE_COURSE_CHAPTERS.length - 1]} are the material you already work inside on every shift — systems, safety, medical-legal, and documentation. We are not spending a classroom day on them. Doing them before you arrive is what lets the first session open on medical terminology and the second get into anatomy and physiology.`,
        ),
        ...m.PRE_COURSE_CHAPTERS.map((ch) => {
          const a = N.chapterAssets(ch)
          return TASK(`Chapter ${ch}: ${a.title} — read, Module ${ch} (${a.moduleMinutes} min), flashcards, practice activity, chapter quiz`)
        }),
        P_(`${m.PRE_COURSE_POLICY.checkedAt} ${m.PRE_COURSE_POLICY.ifIncomplete}`, { italics: true }),

        H1('Week by week'),
        P_(
          `Every session below is dated. Tick boxes are yours to use — nothing here is collected, but a week you cannot tick is a week you will feel in the Tuesday quiz.`,
          { italics: true },
        ),

        // Weeks and the standalone blocks, in date order.
        ...(() => {
          const out = []
          const standalone = m.KC_SCHEDULE.filter((r) => r.standalone && r.week > 0)
          for (let w = 1; w <= m.KC_COURSE_WEEKS; w++) {
            out.push(...weekSection(w))
            // Anything standalone that falls after this week's last session and
            // before the next week's first — the winter break block.
            const lastOfWeek = classesOf(w).slice(-1)[0]?.date
            const firstOfNext = classesOf(w + 1)[0]?.date
            for (const r of standalone) {
              if (!lastOfWeek) continue
              if (r.date > lastOfWeek && (!firstOfNext || r.date < firstOfNext)) out.push(...standaloneSection(r))
            }
          }
          return out
        })(),

        H1('After the course'),
        P_(
          `Sit the National Registry cognitive exam within about ${A.NREMT_SIT_WITHIN_DAYS} days of the final session. Your Authorization to Test is valid for 90 days, so this is a recommendation rather than a deadline — but retention decays, and a candidate who drifts to April sits an exam having forgotten the winter. The final week covers the application, the ATT and Pearson VUE scheduling.`,
        ),
        P_(
          `The Advanced EMT psychomotor examination was discontinued on 30 June 2024. Its content moved into the cognitive exam as the Clinical Judgment domain, which is now the largest single domain on the test — which is why this course drills the six-step cycle in week 2 and names it aloud in every lab debrief for the rest of the course.`,
        ),

        H1('The clinical minimums you have to document'),
        P_('These are set by Kansas regulation, not by us. You are responsible for logging them as you go.'),
        table(
          [6480, 1800, 1800],
          ['Requirement', 'Minimum', 'Of which'],
          m.CLINICAL_REQUIREMENTS.map((r) => [
            r.label,
            String(r.minimum),
            r.subRequirement
              ? `${r.subRequirement.minimum} ${r.subRequirement.label}`
              : r.fieldMinimum && r.fieldMinimum < r.minimum
                ? `${r.fieldMinimum} in field internship`
                : '—',
          ]),
        ),

        provenance(m, 'npm run doc:student'),
      ],
    },
  ],
})

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, await Packer.toBuffer(doc))

const drillCount = m.KC_SCHEDULE.reduce((n, r) => n + N.skillDrills(r.chapters ?? []).length, 0)
console.log(`Wrote ${outPath}`)
console.log(
  `  ${m.KC_COURSE_WEEKS} weeks · ${totals.assignment} h of Navigate modules · ${drillCount} skill drills · ` +
    `${A.COURSE_ASSESSMENTS.length} graded events · ${P.PLANNED_SHIFTS} clinical shifts`,
)
