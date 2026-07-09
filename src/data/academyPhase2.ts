import type { AcademyTemplate, TemplateSession } from '../types'

// ---------------------------------------------------------------------------
// Academy — Phase 2 (Clinical Depth, Specialty Transports & Field Readiness).
//
// Transcribed from the Phase 2 CES integration brief, then fitted to the real
// teaching day: classes start 0900 (EVOC road course is the 0700 exception,
// handled in the Phase 1 free-form schedule), break an hour for lunch, stop
// content at 1530, and reserve 1530–1600 for housekeeping. That day holds ~5h
// of teaching, so each in-person session was compressed from the brief's ~7h —
// hands-on sim/scenario/assessment blocks were protected and lecture time was
// trimmed or merged (see block titles). Sessions are ordered, not dated; dates
// and facilitator names are layered on per class. Completion is an INTERNAL
// record only — never CE.
// ---------------------------------------------------------------------------

const HOUSEKEEPING = {
  durationMin: 30,
  kind: 'closeout' as const,
  title: 'Housekeeping & closeout',
  notes: 'Announcements, paperwork, questions, next-session logistics.',
}

const SESSIONS: TemplateSession[] = [
  {
    id: 'p2s1',
    order: 1,
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
      { durationMin: 75, kind: 'education', title: 'IFT Call Types deep dive (Cardiac & Neuro) + ALS/BLS scope drill', notes: 'Small-group card-sort + present-back; merges call-types I and the KC Med Guidelines scope drill.', resources: ['call-guide', 'call-guide-scope'] },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'hands-on', title: 'Case-flow scenario lab — teams run call types end-to-end', notes: 'Assess → transport → chart; rotate roles; Captains spot-check Med-Nec.', resources: ['imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'assessment', title: 'Call Types II (Pulmonary/Medical · BLS · intro Accompanied Specialty) + Med-Nec critique + retrieval quiz', notes: 'Merges call-types II with the narrative/Med-Nec critique and cumulative retrieval + preview. Deck: Call Types II (BLS Pulmonary/Medical). Quiz: 6-item cumulative retrieval.', resources: ['deck-call-types-ii', 'quiz-call-types-ii', 'call-guide'] },
      HOUSEKEEPING,
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p2s2',
    order: 2,
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
    order: 3,
    mode: 'at-home',
    title: 'Cornerstone (LMS) Compliance Day',
    objectives: [
      'Complete assigned Cornerstone corporate modules',
      'Complete flipped Organ Transport module (gates Session 5)',
      'Complete Hemodynamics pre-read modules 1–2 (gates Session 4)',
    ],
    facilitatorRoles: [{ role: 'CES', lead: true }],
    placement: 'Must precede the sessions its flipped pre-work supports (p2s4, p2s5).',
    segments: [
      { kind: 'lms', system: 'Cornerstone', title: 'Assigned Cornerstone modules', hours: 7, notes: 'Hours fixed at 7; CES to confirm the exact module list.', submit: 'Upload completions per AMR process' },
      { kind: 'flipped', title: 'Organ Transport module + knowledge check', resources: ['organ'], gatesSession: 'p2s5' },
      { kind: 'flipped', title: 'Hemodynamics pre-read (modules 1–2)', resources: ['hemo-academy'], gatesSession: 'p2s4' },
    ],
    retrieval: { pullsFrom: [] },
  },
  {
    id: 'p2s4',
    order: 4,
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
    order: 5,
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
      { durationMin: 75, kind: 'education', title: 'Organ Transport (applied, flipped) + other high-acuity specialty', notes: '3-mission discussion + donor ethics/OPO; peds (Children’s Mercy), bariatric, long-distance (O2 2×, batteries, supervisor threshold), NICU/flight roles. Guest if confirmed.', resources: ['organ', 'call-guide'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 75, kind: 'assessment', title: 'Capstone scenario circuit — vent · hemodynamics/pressor · call-type+charting · specialty', notes: 'FTO-observed competency check.' },
      { durationMin: 60, kind: 'lunch', title: 'Lunch' },
      { durationMin: 75, kind: 'assessment', title: 'Final independent ImageTrend chart (specialty case) + DCHART/Med-Nec critique', resources: ['imagetrend'] },
      { durationMin: 15, kind: 'break', title: 'Break' },
      { durationMin: 60, kind: 'assessment', title: 'Final cumulative retrieval exam (whole academy) + field-phase expectations', notes: 'NEOP checklist (Section C + Call-Type Exposure log), I-do/we-do/you-do, exposure→training JIT triggers.' },
      { durationMin: 30, kind: 'closeout', title: 'Sign-offs · FTO pairing · graduation · first-shift logistics', notes: 'Internal completion records (not CE), FTO pairing, first-shift logistics.' },
    ],
    retrieval: { pullsFrom: ['p2s1', 'p2s2', 'p2s4'] },
  },
]

export const PHASE2_TEMPLATE: AcademyTemplate = {
  id: 'p2',
  name: 'Academy — Phase 2 (Clinical)',
  notCE: true,
  // A real 0900–1600 day (1h lunch, 1530 content stop, 30m housekeeping) holds
  // ~5h of teaching; sessions are fitted to that.
  minEducationHoursPerDay: 5,
  phase: { id: 'p2', name: 'Clinical Depth, Specialty Transports & Field Readiness' },
  sessions: SESSIONS,
}

// ----- derived helpers ------------------------------------------------------

// Break, lunch, and housekeeping/closeout are not teaching time.
const NON_EDUCATION: ReadonlySet<string> = new Set(['break', 'lunch', 'closeout'])

/** Minutes of genuine education in a session (excludes break/lunch/closeout). */
export function educationMinutes(session: TemplateSession): number {
  if (!session.blocks) {
    // At-home: sum segment hours (LMS + flipped).
    return (session.segments ?? []).reduce((sum, s) => sum + (s.hours ?? 0) * 60, 0)
  }
  return session.blocks
    .filter((b) => !NON_EDUCATION.has(b.kind))
    .reduce((sum, b) => sum + b.durationMin, 0)
}

/** Total wall-clock minutes of a session's timeline (blocks incl. break/lunch). */
export function totalMinutes(session: TemplateSession): number {
  return (session.blocks ?? []).reduce((sum, b) => sum + b.durationMin, 0)
}

/** True when an in-person session falls below the program's min education hours. */
export function isUnderMinHours(session: TemplateSession, minHours: number): boolean {
  if (session.mode !== 'in-person') return false
  return educationMinutes(session) < minHours * 60
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

/**
 * Lay a session's blocks onto the clock from a start time. Returns each block
 * with computed start/end 'HHMM' strings; returns null if startTime is unset
 * or unparseable (the UI then prompts for a start time).
 */
export function timeline(
  session: TemplateSession,
  startTime: string | undefined,
): { start: string; end: string; block: NonNullable<TemplateSession['blocks']>[number] }[] | null {
  const startMin = parseClock(startTime)
  if (startMin === undefined || !session.blocks) return null
  let cursor = startMin
  return session.blocks.map((block) => {
    const start = cursor
    cursor += block.durationMin
    return { start: formatClock(start), end: formatClock(cursor), block }
  })
}
