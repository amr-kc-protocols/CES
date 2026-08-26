// ---------------------------------------------------------------------------
// The PHI validator.
//
// The Kansas course application states that a student found capturing protected
// health information on an electronic device is dismissed from the program. An
// app with a free-text box in a hospital is an invitation to do exactly that, so
// every free-text field a student or instructor can type a patient into runs
// through this before it is saved — and a hit blocks the save rather than
// warning about it. A warning that can be clicked past is a warning that will
// be clicked past at 0300.
//
// What this is not: a guarantee. Regex cannot recognise "the guy from the house
// with the blue door on Elm". It catches the shapes that identifiers actually
// take — numbers, dates, names with titles, addresses — and the field it guards
// carries a standing reminder for everything it cannot catch.
//
// Nothing here logs, stores or transmits the offending text. The caller gets
// offsets so it can highlight the substring in the box the person is looking at,
// and that is all.
// ---------------------------------------------------------------------------

export interface PhiHit {
  /** Index into the original string, for highlighting. */
  start: number
  end: number
  /** The offending substring, for the caller to mark up — never logged. */
  text: string
  /** What it looks like, in the words the person typing would use. */
  why: string
}

export interface PhiResult {
  ok: boolean
  hits: PhiHit[]
}

/** What to write instead. Shown with every rejection. */
export const PHI_PROMPT = 'Describe the skill and what you learned, not the patient.'

/**
 * Reasons, in the order they are tested. Order matters only for which reason a
 * given substring is reported under; every pattern is checked regardless.
 */
const PATTERNS: { why: string; re: RegExp }[] = [
  {
    // Social security numbers first, so they are named as such rather than
    // caught by the generic digit rule.
    why: 'looks like a Social Security number',
    re: /\b\d{3}-\d{2}-\d{4}\b/g,
  },
  {
    why: 'looks like a date of birth',
    re: /\b(0?[1-9]|1[0-2])[/-](0?[1-9]|[12]\d|3[01])[/-](\d{2}|\d{4})\b/g,
  },
  {
    // MRNs, run numbers, phone numbers, account numbers — anything long enough
    // to identify a record. Six is the shortest length that reliably does.
    why: 'a number this long identifies a record — MRN, run number or phone',
    re: /\b\d{6,}\b/g,
  },
  {
    // "Pt: Halloran", "patient name", "Pt. Halloran". A bare "patient Halloran"
    // is deliberately not matched — "patient care report" would go with it, and
    // the age rule below catches most of what this misses.
    why: 'names the patient',
    re: /\b[Pp](?:t\.?|atient)\s*(?:name\b|[:-]\s*[A-Z][a-z]+)|\b[Pp]t\.\s+[A-Z][a-z]+/g,
  },
  {
    why: 'names the patient',
    re: /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+/g,
  },
  {
    why: 'looks like a street address',
    re: /\b\d{1,6}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Way|Pl|Place)\b\.?/g,
  },
]

/**
 * An age is only identifying next to something else that identifies. "45 y/o
 * male, chest pain" is the clinical shorthand this app exists to collect; "45
 * y/o Mr Halloran" is a person. So the age rule fires only when a capitalised
 * word that is not a sentence opener shares the sentence with it.
 */
const AGE_RE = /\b\d{1,3}\s*(?:y\/?o|yo|year[- ]old|yr[- ]old)\b/gi
// Capturing the separator keeps the running offset exact however much
// whitespace sits between two sentences.
const SENTENCE_SPLIT = /((?<=[.!?])\s+)/

/** Words that are capitalised for reasons other than being somebody's name. */
const NOT_A_NAME = new Set([
  'ED', 'ER', 'ICU', 'CCU', 'PACU', 'OR', 'EMS', 'AMR', 'ALS', 'BLS', 'IV', 'IO', 'IM',
  'ECG', 'EKG', 'CPR', 'COPD', 'CHF', 'MI', 'STEMI', 'CVA', 'DKA', 'GCS', 'BP', 'HR',
  'SpO2', 'EtCO2', 'PCR', 'RN', 'MD', 'APRN', 'AEMT', 'EMT', 'NRB', 'BVM', 'PPE',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December',
])

function ageWithName(text: string): PhiHit[] {
  const hits: PhiHit[] = []
  let offset = 0
  const parts = text.split(SENTENCE_SPLIT)
  for (let p = 0; p < parts.length; p++) {
    const sentence = parts[p]
    // Odd indices are the captured separators, which contain nothing to check.
    const ages = p % 2 ? [] : [...sentence.matchAll(AGE_RE)]
    if (ages.length) {
      // A capitalised word that is not the first word of the sentence and is
      // not a known abbreviation reads as a proper noun.
      const words = [...sentence.matchAll(/\b[A-Z][a-zA-Z]+\b/g)]
      const proper = words.filter((w) => (w.index ?? 0) > 0 && !NOT_A_NAME.has(w[0]))
      if (proper.length) {
        for (const a of ages) {
          const start = offset + (a.index ?? 0)
          hits.push({
            start,
            end: start + a[0].length,
            text: a[0],
            why: `an age next to a name identifies a patient (“${proper[0][0]}”)`,
          })
        }
      }
    }
    offset += sentence.length
  }
  return hits
}

/**
 * Check a free-text field.
 *
 * Returns every hit, not the first — somebody who has typed a name and a run
 * number should be told about both rather than fixing one and being stopped
 * again.
 */
export function checkPhi(text: string | undefined): PhiResult {
  const s = text ?? ''
  if (!s.trim()) return { ok: true, hits: [] }
  const hits: PhiHit[] = []
  for (const { why, re } of PATTERNS) {
    re.lastIndex = 0
    for (const m of s.matchAll(re)) {
      const start = m.index ?? 0
      hits.push({ start, end: start + m[0].length, text: m[0], why })
    }
  }
  hits.push(...ageWithName(s))
  // Earliest first, so the highlighted one is the first the eye lands on, and
  // de-duplicated where two patterns caught the same span.
  hits.sort((a, b) => a.start - b.start || a.end - b.end)
  const unique = hits.filter(
    (h, i) => i === 0 || h.start !== hits[i - 1].start || h.end !== hits[i - 1].end,
  )
  return { ok: unique.length === 0, hits: unique }
}

/** One line naming what was found, for the message under the field. */
export function phiMessage(result: PhiResult): string {
  if (result.ok) return ''
  const why = result.hits[0].why
  const more = result.hits.length > 1 ? ` (and ${result.hits.length - 1} more)` : ''
  return `That ${why}${more}. ${PHI_PROMPT}`
}
