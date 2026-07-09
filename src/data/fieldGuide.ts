// ---------------------------------------------------------------------------
// Field Guide resource registry (Academy Phase 2 brief §4).
//
// CES links out to the Field Guide site rather than duplicating teaching
// content: template blocks reference a resource by `ref`, and the UI resolves
// it to a deep link here. Keep refs stable — the template data depends on them.
// ---------------------------------------------------------------------------

export const FIELD_GUIDE_BASE = 'https://amr-kc-protocols.github.io/amr-kc-protocols/'

export interface FieldGuideResource {
  ref: string
  label: string
  /**
   * Path (and optional query) under FIELD_GUIDE_BASE — or an app-local path
   * starting with '/' for files the PWA serves itself (public/, e.g. decks).
   */
  path: string
}

export const FIELD_GUIDE_RESOURCES: FieldGuideResource[] = [
  { ref: 'call-guide', label: 'IFT Call Guide (Call Types)', path: 'ift-call-guide.html' },
  { ref: 'call-guide-scope', label: 'IFT Call Guide → ALS vs BLS', path: 'ift-call-guide.html#scope' },
  { ref: 'deck-cardiac-neuro-dive', label: 'Slides: Cardiac & Neuro deep dive', path: '/decks/session1-1045-cardiac-neuro-deep-dive.pptx' },
  { ref: 'deck-cardiac-neuro-cases', label: 'Slides: Cardiac & Neuro case studies', path: '/decks/session1-1300-cardiac-neuro-case-studies.pptx' },
  { ref: 'deck-call-types-ii', label: 'Slides: Call Types II — Pulmonary & Medical (BLS)', path: '/decks/session1-1430-call-types-ii.pptx' },
  { ref: 'imagetrend', label: 'ImageTrend Job Aid', path: 'imagetrend-job-aid.html' },
  { ref: 'vent-academy', label: 'Ventilator Academy (9 modules)', path: 'vta/academy.html' },
  { ref: 'vent-sim', label: 'LTV 1200 simulator', path: 'vent-ltv1200.html' },
  { ref: 'hemo-academy', label: 'Hemodynamics Academy (8 modules)', path: 'hemodynamics-academy.html' },
  { ref: 'organ', label: 'Organ Transport (familiarization)', path: 'organ-transport.html' },
  { ref: 'quiz-daily5', label: 'Daily 5', path: 'quiz-daily5.html' },
  { ref: 'quiz-rhythms', label: 'Rhythm Strip ID', path: 'quiz-rhythms.html' },
  { ref: 'quiz-vent', label: 'Ventilator quiz', path: 'quiz-vent.html' },
  { ref: 'quiz-icu', label: 'ICU / critical-care quiz', path: 'quiz-icu.html' },
  { ref: 'quiz-impella-ecmo', label: 'Impella & ECMO quiz', path: 'quiz-impella-ecmo.html' },
  { ref: 'quiz-pals', label: 'PALS 2025 quiz', path: 'quiz-pals.html' },
  { ref: 'flashcards', label: 'Drug flashcards', path: 'flashcards.html' },
  { ref: 'acls-flash', label: 'ACLS 2025 flashcards', path: 'acls-2025-flashcards.html' },
]

const BY_REF = new Map(FIELD_GUIDE_RESOURCES.map((r) => [r.ref, r]))

export function resourceFor(ref: string): FieldGuideResource | undefined {
  return BY_REF.get(ref)
}

export function resourceUrl(ref: string): string | undefined {
  const r = BY_REF.get(ref)
  if (!r) return undefined
  if (r.path.startsWith('/')) {
    // App-local file: absolute URL so the link also works from printed /
    // downloaded documents, which open outside the app.
    return typeof window === 'undefined' ? r.path : window.location.origin + r.path
  }
  return FIELD_GUIDE_BASE + r.path
}
