// ---------------------------------------------------------------------------
// Self-study course library. Each block is a chunk of online course material
// that backs up a hands-on academy day — a new hire (or FTO brushing up) can
// work through it before or after the day to fill any gaps. Every link is an
// existing Field Guide resource, so URLs live in one place (data/fieldGuide).
// ---------------------------------------------------------------------------

export type LearningKind = 'course' | 'sim' | 'quiz' | 'reference'

export interface LearningItem {
  /** Field Guide resource ref (resolved to a URL via data/fieldGuide). */
  ref: string
  kind: LearningKind
}

export interface LearningBlock {
  id: string
  icon: string
  title: string
  /** The academy day / topic this material supports. */
  supports: string
  summary: string
  items: LearningItem[]
}

/** Full online course blocks tied to specific academy days. */
export const COURSE_BLOCKS: LearningBlock[] = [
  {
    id: 'systems-onboarding',
    icon: '🚑',
    title: 'AMR Systems Onboarding',
    supports: 'Day 1 · New-hire systems, logins & policies',
    summary:
      'Your first-week systems course — Okta SSO, GPS Portal, NinthBrain credentials, Cornerstone, benefits, time off, conduct, and Just Culture, plus local contacts and a first-30-days map. Ten short modules, each with a knowledge check. Progress saves on your device; start here.',
    items: [{ ref: 'amr-systems-onboarding', kind: 'course' }],
  },
  {
    id: 'ventilator',
    icon: '🫁',
    title: 'Ventilator Academy',
    supports: 'Mechanical Ventilation (LTV 1200) · Week 2',
    summary:
      'The complete ventilator course — physiology, modes, alarms, and DOPE troubleshooting across nine modules, plus a hands-on LTV 1200 simulator. Complete the modules before the vent day and use the simulator to rehearse setup and alarm response.',
    items: [
      { ref: 'vent-academy', kind: 'course' },
      { ref: 'vent-sim', kind: 'sim' },
      { ref: 'quiz-vent', kind: 'quiz' },
    ],
  },
  {
    id: 'hemodynamics',
    icon: '🩸',
    title: 'Hemodynamics Academy',
    supports: 'Hemodynamics, Pressors & MCS · Week 2',
    summary:
      'Eight modules on hemodynamic physiology, pressor selection, and mechanical circulatory support (IABP, Impella, ECMO). Pairs with the pressors & MCS day; the ICU and Impella/ECMO quizzes check retention.',
    items: [
      { ref: 'hemo-academy', kind: 'course' },
      { ref: 'quiz-icu', kind: 'quiz' },
      { ref: 'quiz-impella-ecmo', kind: 'quiz' },
    ],
  },
  {
    id: 'organ-transport',
    icon: '🫀',
    title: 'Organ Transport',
    supports: 'Clinical Flipped Pre-Work · Capstone call types',
    summary:
      'Familiarization for organ-procurement transports — the mission, the team, and what the crew owns en route. A flipped pre-read before the capstone day covers these calls.',
    items: [{ ref: 'organ', kind: 'reference' }],
  },
]

/** Not day-specific — general practice a hire can drill any time. */
export const PRACTICE_ITEMS: LearningItem[] = [
  { ref: 'flashcards', kind: 'reference' },
  { ref: 'acls-flash', kind: 'reference' },
  { ref: 'quiz-rhythms', kind: 'quiz' },
  { ref: 'quiz-pals', kind: 'quiz' },
  { ref: 'quiz-daily5', kind: 'quiz' },
]

export const KIND_META: Record<LearningKind, { label: string; icon: string }> = {
  course: { label: 'Course', icon: '📘' },
  sim: { label: 'Simulator', icon: '🎮' },
  quiz: { label: 'Quiz', icon: '✅' },
  reference: { label: 'Reference', icon: '📄' },
}
