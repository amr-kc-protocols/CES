// ---------------------------------------------------------------------------
// The clinical and field training objectives.
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
// ---------------------------------------------------------------------------

import {
  bullet, cover, h1, h2, longDate, p, pageBreak, printable, rule, spacer, table,
  type Block,
} from '../../lib/docBlocks'
import * as PH from '../aemtPhases'
import { phaseTargets } from './syllabus'
import * as S from '../aemtSites'
import {
  CLINICAL_REQUIREMENTS,
  KC_CLINICAL_TARGET,
  KC_END_DATE,
  KC_FIELD_TARGET,
  KC_START_DATE,
  KC_COURSE_WEEKS,
  PRECEPTOR_LABELS,
  PRIMARY_INSTRUCTOR,
  RECORDS_RETENTION_YEARS,
  SETTING_PRECEPTORS,
  KC_SCHEDULE,
} from '../aemt'

export const OBJECTIVES_TITLE = 'AEMT Clinical and Field Training Objectives — October 2026 Cohort'

/** Which laboratory grants each clearance, and on what date. */
const CLEARANCE_SESSION: Record<string, string> = {
  assessment: 'Week 3 · Thu',
  vascular: 'Week 5 · Thu',
  ecg: 'Week 6 · Thu',
}

export function objectivesBlocks(): Block[] {
  const phases = PH.seedPhases(KC_START_DATE)
  const kar = CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'kar')
  const program = CLINICAL_REQUIREMENTS.filter((r) => r.basis === 'program')
  const clearanceDate = (code: string) =>
    KC_SCHEDULE.find((r) => r.label === CLEARANCE_SESSION[code])?.date

  return [
    cover(
      'Clinical and Field Training Objectives',
      'Advanced Emergency Medical Technician',
      `AMR Kansas City with AMR Wichita  ·  ${longDate(KC_START_DATE)} to ${longDate(KC_END_DATE)}`,
    ),

    h1('For the preceptor'),
    p(
      'Thank you for taking a student. This page is the whole of what you need; the rest of the document is detail you can look up if you want it.',
    ),
    p(
      'The student with you today is an EMT working toward Advanced EMT certification in Kansas. They are on your unit to accumulate documented patient contacts against a state minimum, and to be watched doing the',
    ),
    h2('1. Check what they are cleared to do'),
    p(
      'Scope is dated. A student is cleared for a skill on the day they pass the laboratory check-off for it, and not before — and a contact logged before that date does not count toward their certification, however well it went. The student carries their clearance dates; ask for them at the start of the shift.',
    ),
    spacer(100),
    table(
      [2600, 2200, 5280],
      ['Cleared for', 'From', 'What it permits'],
      PH.SKILL_CLEARANCES.map((c) => [
        c.label,
        clearanceDate(c.code) ? longDate(clearanceDate(c.code)!) : c.grantedAt,
        c.gates.length
          ? `${c.gates.map((g) => CLINICAL_REQUIREMENTS.find((r) => r.id === g)?.label ?? g).join(', ')}. Reps before this date are refused.`
          : 'Recorded, not enforced — a documented assessment counts whether or not the laboratory date was entered first.',
      ]),
    ),
    spacer(),
    p(
      'Anything outside that list, the student observes. If you are not sure, they observe. Nobody is behind schedule enough for that to be the wrong answer.',
      { bold: true },
    ),

    h2('2. Know what this shift is for'),
    p(
      'The rotation runs in phases and each has a small number of targets. The student knows which phase they are in; the table on the next page says what each is trying to produce. A shift that meets its hours and produces nothing is a shift that failed, and it is worth saying so at the start rather than at the end.',
    ),

    h2('3. Sign what you saw'),
    p(
      'Your attestation is evidence supporting a state certification, and it is retained for three years. Sign for what you personally watched, and use the daily evaluation to say what actually happened — a preceptor who marks everything satisfactory tells the program nothing, and the student finds out in January.',
    ),

    h2('4. Say something early if it is going wrong'),
    p(
      `Call or email the primary instructor during the shift, not after it. ${PRIMARY_INSTRUCTOR.name}${
        PRIMARY_INSTRUCTOR.email ? `, ${PRIMARY_INSTRUCTOR.email}` : ''
      }. A safety concern ends the student's participation in that task immediately and is not a conversation to defer.`,
    ),

    pageBreak(),
    h1('The rotation, phase by phase'),
    p(
      `${PH.PLANNED_SHIFTS} twelve-hour shifts per student — ${KC_CLINICAL_TARGET} hours hospital clinical and ${KC_FIELD_TARGET} hours field internship. Phases are windows rather than fixed dates; students self-schedule inside the`,
    ),
    spacer(120),
    table(
      [1400, 2100, 900, 5480],
      ['Phase', 'Window', 'Shifts', 'What it is for, and what it should produce'],
      phases.map((ph) => [
        `${ph.ordinal}. ${ph.name}`,
        `${longDate(ph.windowStart)} – ${longDate(ph.windowEnd)}`,
        String(ph.shiftsRequired),
        [
          ph.shiftsRequired
            ? `${ph.hospitalShifts} hospital, ${ph.fieldShifts} field.`
            : 'No clinical. Site onboarding, immunisation records and paperwork.',
          ph.requiresClearance ? `Opens on the ${ph.requiresClearance} check-off.` : '',
          Object.keys(ph.targets ?? {}).length
            ? phaseTargets(ph.targets).trim()
            : '',
        ]
          .filter(Boolean)
          .join(' '),
      ]),
    ),
    spacer(),
    p(
      'The break block is the highest-yield fortnight in the rotation: no class competing for the time, high holiday call volume, and students who usually have leave available. A student who arrives at January behind has very little left to catch up with.',
      { italics: true },
    ),

    h1('What has to be documented'),
    p(
      'These are set by K.A.R. 109-11-8(a)(4). The student logs their own contacts; your part is the attestation that the contact happened and was supervised.',
    ),
    spacer(120),
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
          spacer(),
          p(
            'Tracked additionally as a program competency rather than a statutory minimum — it does not gate completion:',
            { italics: true },
          ),
          ...program.map((r) => bullet(`${r.label} — ${r.minimum}`)),
        ]
      : []),

    h1('Who may supervise'),
    p('K.A.R. 109-1-1 and 109-11-8 name who may precept, and it differs by setting.'),
    spacer(120),
    table(
      [2400, 7680],
      ['Setting', 'Acceptable preceptor credentials'],
      Object.entries(SETTING_PRECEPTORS).map(([setting, creds]) => [
        setting === 'lab' ? 'Skills laboratory' : setting === 'field' ? 'Field internship' : 'Hospital clinical',
        creds.map((c) => PRECEPTOR_LABELS[c]).join(', '),
      ]),
    ),
    spacer(),
    p(
      'Direct supervision throughout. A contact supervised by someone whose credential does not appear against that setting is logged but does not count, which is a waste of the student’s shift and of yours.',
    ),

    pageBreak(),
    h1('Hospital clinical — what each department is for'),
    p(
      'Hours are not the constraint; opportunity is. A twelve-hour emergency department shift where two lines come available met its hours and failed its purpose, so placements are weighted toward where each skill actually occurs.',
    ),
    spacer(120),
    table(
      [2600, 3400, 4080],
      ['Department', 'What it produces', 'Notes'],
      S.HOSPITAL_UNITS.map((u) => [
        u.name,
        u.produces.map((k) => PH.PHASE_TARGET_LABELS[k as PH.PhaseTargetKey] ?? k).join(', '),
        u.notes ?? '—',
      ]),
    ),
    spacer(),
    p(
      `Capacity is seeded at ${S.DEFAULT_UNIT_CAP} student per department per week until each site confirms otherwise. If your department can take more, tell the primary instructor — it is the number the whole placement plan is built on.`,
      { italics: true },
    ),

    h1('Field internship'),
    p(
      `Field capacity is FTO capacity: an agency takes as many students as it has field-training-officer-staffed units available in a week. Twelve of each student's ${PH.PLANNED_SHIFTS} shifts are field shifts, so this is what decides whether the rotation fits.`,
    ),
    ...S.FIELD_UNITS.map((u) =>
      bullet(`${u.name} — produces ${u.produces.map((k) => PH.PHASE_TARGET_LABELS[k as PH.PhaseTargetKey] ?? k).join(', ')}`),
    ),

    pageBreak(),
    h1('Shift record'),
    p(
      'One per shift, kept with the student’s file. The daily evaluation form is separate and is where the narrative goes; this is the countable half.',
      { italics: true },
    ),
    rule('Student'),
    rule('Date, site and unit'),
    rule('Preceptor name, credential and certificate number'),
    spacer(120),
    table(
      [5040, 2520, 2520],
      ['Contact type', 'Attempted', 'Successful'],
      kar.map((r) => [r.label, '', '']),
    ),
    spacer(),
    p('Anything the student should work on next shift:', { bold: true }),
    rule(undefined, { tall: true }),
    rule(undefined, { tall: true }),
    spacer(160),
    p(
      `I attest that I personally supervised this student for the contacts recorded above, and that this record is accurate. I understand it is retained for ${RECORDS_RETENTION_YEARS} years as evidence supporting a Kansas EMS certification.`,
      { small: true },
    ),
    spacer(120),
    rule('Preceptor signature and date'),
    {
      k: 'provenance',
      command: 'npm run doc:objectives',
      startDate: KC_START_DATE,
      endDate: KC_END_DATE,
      weeks: KC_COURSE_WEEKS,
    },
  ]
}
