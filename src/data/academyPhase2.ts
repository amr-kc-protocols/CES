import type { AcademyTemplate, TemplateBlock, TemplateSession } from '../types'

// ---------------------------------------------------------------------------
// AMR KC New Hire Academy — one unified template spanning both weeks.
//
//   Week 1 (Systems & Safety): HR/onboarding, EVOC classroom, EVOC road course
//     (offsite Independence, 0700), PCR/ImageTrend software mechanics, stretcher
//     & equipment, and an at-home Cornerstone corporate-compliance day.
//   Week 2 (Clinical Depth): clinical mindset & call types, ventilation, an
//     at-home Cornerstone clinical flipped-prework day, hemodynamics/MCS, and the
//     capstone + FTO hand-off.
//
// Phase 1 and Phase 2 were reconciled so nothing is taught twice: the clinical
// mindset / call types / Med-Nec content lives only in Week 2 (Session 7 + its
// decks); Week 1's PCR day is ImageTrend *software mechanics* only. The two
// at-home Cornerstone days split the modules (Week 1 = corporate compliance;
// Week 2 = clinical flipped pre-work) rather than repeating them. Sessions 7
// and 11 were likewise consolidated: specialty call types are taught once, in
// Session 11 with organ transport (Session 7 no longer previews them), and
// Med-Nec/narrative is taught once, in Session 7 (Session 11's final chart is
// a graded assessment against that standard, not a re-teach).
//
// In-person days are fitted to the real teaching day: start 0900 (EVOC road is
// the 0700 exception), a 1h lunch, content stops at 1530, and 1530–1600 is
// housekeeping — ~5h of teaching. Sessions are ordered, not dated; dates and
// facilitators are layered on per class. Completion is an INTERNAL record — not CE.
// ---------------------------------------------------------------------------

const HOUSEKEEPING = {
  durationMin: 30,
  kind: 'closeout' as const,
  title: 'Housekeeping & closeout',
  notes: 'Announcements, paperwork, questions, next-session logistics.',
}

const SESSIONS: TemplateSession[] = [
  // ===== Week 1 — Systems, Safety & Onboarding =====================
  {
    id: 'p1s1',
    order: 1,
    week: 1,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'HR & Systems Onboarding',
    objectives: [
      'Complete systems access (Okta, Ninth Brain, Cornerstone) in the room',
      'Finish pre-shift HR items: I-9, benefits, GPS Portal, Respiratory Questionnaire',
      'Know the Captains operations basics ("the Four Things")',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'HR' },
      { role: 'Captains (operations)' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Welcome, intros, group-text exercise', notes: 'Sets the tone; from the Captains’ deck.' },
      { durationMin: 105, kind: 'education', title: 'Day-1 Intro — systems access done live', notes: 'Okta registration, Ninth Brain, Cornerstone access, Respiratory Questionnaire — all completed in the room.' },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 45, kind: 'education', title: 'GPS Portal · I-9 verification · Benefits orientation', notes: 'Focus on what must be done before first shift.' },
      { durationMin: 60, kind: 'lunch', title: 'Lunch + truck walk-around with Captains' },
      { durationMin: 120, kind: 'education', title: 'HR session — benefits, leave, EAP, 401(k), bereavement' },
      { durationMin: 45, kind: 'education', title: 'Captains Operations Part 1', notes: 'Manifesting, BOS book, OOS, communications, "the Four Things." Pause every 15 min for partner discussion.' },
      { durationMin: 15, kind: 'assessment', title: 'Day-1 retrieval quiz (low-stakes) + preview' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p1s2',
    order: 2,
    week: 1,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'EVOC Classroom (Corporate)',
    objectives: ['Complete the GMR EVOC classroom curriculum'],
    facilitatorRoles: [{ role: 'Corporate EVOC instructors', lead: true }],
    blocks: [
      { durationMin: 420, kind: 'education', title: 'EVOC classroom — GMR corporate curriculum', notes: 'Corporate / read-only; delivered against the GMR EVOC standard. No CES planning required.' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p1s3',
    order: 3,
    week: 1,
    mode: 'in-person',
    defaultStart: '0700',
    location: 'Independence Safety Education Center (offsite)',
    title: 'EVOC Road Course (Corporate)',
    objectives: ['Pass the GMR EVOC driving road course'],
    facilitatorRoles: [{ role: 'Corporate EVOC team', lead: true }],
    blocks: [
      { durationMin: 540, kind: 'hands-on', title: 'EVOC road course — Independence', notes: 'Starts 0700 to beat the heat. Meet HQ 7 AM → Independence. Fully covered by the corporate EVOC team; CES not present.' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p1s4',
    order: 4,
    week: 1,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'PCR Documentation & ImageTrend (software mechanics)',
    objectives: [
      'Navigate ImageTrend Field: login, CAD download, chart sections, validation',
      'Enter a chart end-to-end in the software',
      'Use the validation counter and Power Tools',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'ImageTrend power users' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Welcome back · EVOC debrief · day intro', notes: 'One EVOC takeaway per trainee.' },
      { durationMin: 90, kind: 'education', title: 'ImageTrend Field — Foundations', notes: 'Login, home, CAD download, chart navigation, validation counter, right-rail Power Tools. Laptops out, demo creds verified.', resources: ['imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 90, kind: 'hands-on', title: 'ImageTrend Field — Guided Chart', notes: 'Instructor enters a chart on the projector; students follow on devices. Pause after each accordion section.', resources: ['imagetrend'] },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 90, kind: 'hands-on', title: 'ImageTrend Field — Independent Entry (mechanics)', notes: 'Students enter a chart solo — navigation, required fields, validation. Clinical narrative quality (DCHART / Med-Nec) is taught in Week 2, Session 7.', resources: ['imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 15, kind: 'assessment', title: 'Charting-mechanics check + retrieval quiz + preview' },
      HOUSEKEEPING,
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p1s5',
    order: 5,
    week: 1,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'Stretcher & Equipment Check-Off',
    objectives: [
      'Demonstrate safe stretcher handling (GMR v3.2)',
      'Complete the equipment check-off',
    ],
    facilitatorRoles: [{ role: 'CES', lead: true }, { role: 'Stretcher / equipment leads' }],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Opener · objectives · safety brief' },
      { durationMin: 165, kind: 'hands-on', title: 'Stretcher lab', notes: 'PowerLoad + Stryker hand placement, stair chair. Runs against the GMR Safe Stretcher Handling v3.2 deck.' },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 150, kind: 'assessment', title: 'Equipment check-off', notes: 'Against the equipment check-off sheet.' },
      { durationMin: 30, kind: 'closeout', title: 'Final sign-offs · Week-1 retrieval quiz · housekeeping' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p1s6',
    order: 6,
    week: 1,
    mode: 'at-home',
    title: 'Cornerstone (LMS) — Corporate Compliance',
    objectives: ['Complete the assigned corporate compliance modules'],
    facilitatorRoles: [{ role: 'CES', lead: true }],
    placement: 'At-home self-paced day within Week 1; CES available remotely.',
    segments: [
      { kind: 'lms', system: 'Cornerstone', title: 'Corporate compliance modules — HIPAA · BBP/OSHA · CEVO driving · harassment prevention · workplace safety', hours: 7, notes: 'The bulk of required corporate modules, done early. CES to confirm the exact module list.', submit: 'Upload completions per AMR process' },
    ],
    retrieval: { pullsFrom: [] },
  },
  // ===== Week 2 — Clinical Depth ===================================
  {
    id: 'p2s1',
    order: 7,
    week: 2,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'Clinical Mindset & IFT Call Types',
    objectives: [
      'Sort any transfer into call-type category + level of care',
      'Apply "why does this patient need us / exceeds your credential"',
      'Run a call end-to-end: assess → transport priorities → chart',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'Paramedic clinical lead' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Opener: prior-phase cumulative recall + arc overview', notes: '3 items from Phase 1 (systems, ImageTrend Med-Nec, safety).' },
      { durationMin: 75, kind: 'education', title: 'Clinical mindset & patient population', notes: 'IFT vs 911, level-of-care matching, "why does this patient need us."' },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 75, kind: 'education', title: 'IFT Call Types deep dive (Cardiac & Neuro) + ALS/BLS scope drill', notes: 'Small-group card-sort + present-back; merges call-types I and the KC Med Guidelines scope drill.', resources: ['deck-cardiac-neuro-dive', 'call-guide', 'call-guide-scope'] },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'hands-on', title: 'Case-flow scenario lab — teams run call types end-to-end', notes: 'Assess → transport → chart; rotate roles; Captains spot-check Med-Nec.', resources: ['deck-cardiac-neuro-cases', 'imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'assessment', title: 'Call Types II (Pulmonary/Medical · BLS) + Med-Nec critique + retrieval quiz', notes: 'Merges call-types II with the narrative/Med-Nec critique and cumulative retrieval + preview. Accompanied-specialty call types are taught once, in Session 11 with organ transport — no preview here.', resources: ['deck-call-types-ii', 'call-guide'] },
      HOUSEKEEPING,
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p2s2',
    order: 8,
    week: 2,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'Mechanical Ventilation (LTV 1200)',
    objectives: [
      'Explain LTV 1200 modes/settings/alarms',
      'Paramedic manages a vented ICU-to-ICU transport; EMT monitors + keeps BVM ready',
      'Troubleshoot with DOPE',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'RT / vent SME' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Recall opener (call types) · objectives' },
      { durationMin: 75, kind: 'education', title: 'Vent physiology, indications, modes + alarms/DOPE', notes: 'Modules 1–3; alarms (high/low pressure, low MV, disconnect, silence logic) folded in.', resources: ['vent-academy'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'hands-on', title: 'LTV 1200 orientation + guided simulator walk-through', notes: 'Instructor drives, trainees mirror.', resources: ['vent-sim'] },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'hands-on', title: 'Simulator reps — round 1 (guided)', notes: 'Every trainee hands-on through graded scenarios.', resources: ['vent-sim'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 75, kind: 'assessment', title: 'Simulator reps — round 2 (independent) + skills check-off + vent quiz', notes: 'Paramedic: ALS scenarios. EMT: recognition + BVM. Transport doctrine (ICU-ICU, BVM-ready, charting) folded in.', resources: ['quiz-vent'] },
      HOUSEKEEPING,
    ],
    retrieval: { pullsFrom: ['p2s1'], resource: 'quiz-vent' },
  },
  {
    id: 'p2s3',
    order: 9,
    week: 2,
    mode: 'at-home',
    title: 'Cornerstone (LMS) — Clinical Flipped Pre-Work',
    objectives: [
      'Complete flipped Organ Transport module (gates the Capstone)',
      'Complete Hemodynamics pre-read modules 1–2 (gates the Hemodynamics session)',
      'Finish any remaining assigned Cornerstone modules',
    ],
    facilitatorRoles: [{ role: 'CES', lead: true }],
    placement: 'Must precede the sessions its flipped pre-work supports (Hemodynamics, Capstone). Bulk corporate compliance was completed on the Week 1 Cornerstone day.',
    segments: [
      { kind: 'flipped', title: 'Organ Transport module + knowledge check', resources: ['organ'], gatesSession: 'p2s5' },
      { kind: 'flipped', title: 'Hemodynamics pre-read (modules 1–2)', resources: ['hemo-academy'], gatesSession: 'p2s4' },
      { kind: 'lms', system: 'Cornerstone', title: 'Remaining assigned Cornerstone modules (clinical / role-specific)', hours: 3, notes: 'Bulk corporate compliance (HIPAA, OSHA, CEVO, harassment, safety) was done on the Week 1 Cornerstone day.', submit: 'Upload completions per AMR process' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p2s4',
    order: 10,
    week: 2,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'Hemodynamics, Pressors & MCS',
    objectives: [
      'Use the shock lens (pump/tank/pipes)',
      'Paramedic manages a pressor within scope; EMT knows the accompanied-MCS role',
      'State the "never adjust the device" rule (IABP/Impella/ECMO)',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'Critical-care Paramedic SME' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Opener (vent recall) · verify flipped pre-read + organ completion · objectives' },
      { durationMin: 75, kind: 'education', title: 'Hemodynamic physiology + shock lens', notes: 'Builds on the flipped pre-read (modules 1 & 8).', resources: ['hemo-academy'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 75, kind: 'education', title: 'Pressors, arterial lines + hypertensive & vasoactive infusions', notes: 'MAP targets, pressor selection, pump/rate familiarity (modules 2–4).', resources: ['hemo-academy'] },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'hands-on', title: 'MCS familiarity (IABP · Impella · ECMO) + accompanied-specialty scenario lab', notes: '"Specialty team owns the device" (modules 5–7); then a pressor-dependent + MCS accompanied transport — role clarity, in-scope monitoring, documentation.', resources: ['hemo-academy', 'call-guide'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'assessment', title: 'Impella & ECMO quiz + cumulative retrieval + preview', resources: ['quiz-impella-ecmo'] },
      HOUSEKEEPING,
    ],
    retrieval: { pullsFrom: ['p2s1', 'p2s2'], resource: 'quiz-impella-ecmo' },
  },
  {
    id: 'p2s5',
    order: 11,
    week: 2,
    mode: 'in-person',
    defaultStart: '0900',
    title: 'Specialty Transports, Capstone & FTO Hand-off',
    objectives: [
      'Pass the capstone circuit',
      'Apply the 3 organ-transport missions + high-acuity specialty planning',
      'Enter the field phase with an FTO pairing + internal completion record',
    ],
    facilitatorRoles: [
      { role: 'CES', lead: true },
      { role: 'FTOs' },
      { role: 'Captains' },
      { role: 'OPO — Midwest Transplant Network (pending; fallback: CES-led from Organ module)' },
    ],
    blocks: [
      { durationMin: 15, kind: 'education', title: 'Opener · academy arc recap · objectives' },
      { durationMin: 75, kind: 'education', title: 'Organ Transport (applied, flipped) + accompanied & high-acuity specialty call types', notes: 'The single home for specialty call types (consolidated from Session 7): 3-mission discussion + donor ethics/OPO; accompanied-specialty roles; peds (Children’s Mercy), bariatric, long-distance (O2 2×, batteries, supervisor threshold), NICU/flight. Guest if confirmed.', resources: ['organ', 'call-guide'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 75, kind: 'assessment', title: 'Capstone scenario circuit — vent · hemodynamics/pressor · call-type+charting · specialty', notes: 'FTO-observed competency check.' },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'assessment', title: 'Final independent ImageTrend chart (specialty case) — graded on the DCHART/Med-Nec standard', notes: 'Pure assessment: narrative quality was taught in Session 7; this grades against it rather than re-teaching.', resources: ['imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'assessment', title: 'Final cumulative retrieval exam (whole academy) + field-phase expectations', notes: 'NEOP checklist (Section C + Call-Type Exposure log), I-do/we-do/you-do, exposure→training JIT triggers.' },
      { durationMin: 30, kind: 'closeout', title: 'Sign-offs · FTO pairing · graduation · first-shift logistics', notes: 'Internal completion records (not CE), FTO pairing, first-shift logistics.' },
    ],
    retrieval: { pullsFrom: ['p2s1', 'p2s2', 'p2s4'] },
  },
]

export const ACADEMY_TEMPLATE: AcademyTemplate = {
  id: 'academy',
  name: 'AMR KC New Hire Academy',
  notCE: true,
  // A real 0900–1600 day (1h lunch, 1530 content stop, 30m housekeeping) holds
  // ~5h of teaching; in-person sessions are fitted to that.
  minEducationHoursPerDay: 5,
  phase: { id: 'academy', name: 'Systems & Safety (Week 1) + Clinical Depth (Week 2)' },
  sessions: SESSIONS,
}

/** Human labels for the two academy weeks. */
export const WEEK_LABELS: Record<1 | 2, string> = {
  1: 'Week 1 — Systems, Safety & Onboarding',
  2: 'Week 2 — Clinical Depth',
}

/** @deprecated Use ACADEMY_TEMPLATE — the template now spans both weeks. */
export const PHASE2_TEMPLATE = ACADEMY_TEMPLATE

// ----- derived helpers ------------------------------------------------------

// Break, lunch, and housekeeping/closeout are not teaching time.
const NON_EDUCATION: ReadonlySet<string> = new Set(['break', 'lunch', 'closeout'])

/** Minutes of genuine education across a block list (excludes break/lunch/closeout). */
export function educationMinutesForBlocks(blocks: TemplateBlock[]): number {
  return blocks.filter((b) => !NON_EDUCATION.has(b.kind)).reduce((sum, b) => sum + b.durationMin, 0)
}

/** Minutes of genuine education in a session (excludes break/lunch/closeout). */
export function educationMinutes(session: TemplateSession, blocks?: TemplateBlock[]): number {
  const effective = blocks ?? session.blocks
  if (!effective) {
    // At-home: sum segment hours (LMS + flipped).
    return (session.segments ?? []).reduce((sum, s) => sum + (s.hours ?? 0) * 60, 0)
  }
  return educationMinutesForBlocks(effective)
}

/** Total wall-clock minutes of a session's timeline (blocks incl. break/lunch). */
export function totalMinutes(session: TemplateSession): number {
  return (session.blocks ?? []).reduce((sum, b) => sum + b.durationMin, 0)
}

/** True when an in-person session falls below the program's min education hours. */
export function isUnderMinHours(session: TemplateSession, minHours: number, blocks?: TemplateBlock[]): boolean {
  if (session.mode !== 'in-person') return false
  return educationMinutes(session, blocks) < minHours * 60
}

// ----- clock-time math ------------------------------------------------------

/** 'HHMM' or 'HH:MM' → minutes since midnight; undefined if unparseable. */
export function parseClock(t: string | undefined): number | undefined {
  if (!t) return undefined
  const s = t.replace(/[^0-9]/g, '')
  if (s.length < 3) return undefined
  const h = Number(s.slice(0, s.length - 2))
  const m = Number(s.slice(s.length - 2))
  if (!Number.isFinite(h) || !Number.isFinite(m) || h > 23 || m > 59) return undefined
  return h * 60 + m
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`
}

export interface TimedBlock {
  start: string
  end: string
  block: TemplateBlock
}

/** Lay a block list onto the clock from a start time. */
export function timelineFromBlocks(blocks: TemplateBlock[], startTime: string | undefined): TimedBlock[] | null {
  const startMin = parseClock(startTime)
  if (startMin === undefined) return null
  let cursor = startMin
  return blocks.map((block) => {
    const start = cursor
    cursor += block.durationMin
    return { start: formatClock(start), end: formatClock(cursor), block }
  })
}

/**
 * Lay a session's blocks onto the clock from a start time. Returns each block
 * with computed start/end 'HHMM' strings; returns null if startTime is unset
 * or unparseable (the UI then prompts for a start time). Pass `blocks` to use a
 * class's edited blocks instead of the template default.
 */
export function timeline(
  session: TemplateSession,
  startTime: string | undefined,
  blocks?: TemplateBlock[],
): TimedBlock[] | null {
  const effective = blocks ?? session.blocks
  if (!effective) return null
  return timelineFromBlocks(effective, startTime)
}
