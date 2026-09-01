import { addDays, todayISO } from '../lib/date'
import type { AemtClearance } from '../types'

// ---------------------------------------------------------------------------
// Clinical clearance, against the affiliation agreement.
//
// A student cannot start a rotation until the program can state, in writing,
// that a specific list of things is true of them. This file is that list, and
// the rules that decide whether each one is satisfied on a given date.
//
// Two principles run through it:
//
//   - Nothing is satisfied by a tick. Every item resolves off a date or a
//     recorded result, because the letter the program sends asserts these
//     facts to a hospital, and the hospital may ask to see the record behind
//     any of them.
//   - Dates expire. A PPD is good for a year and a rotation is in the future,
//     so an item is judged against the day the student is due on the floor,
//     not the day someone opened the screen.
//
// Section numbers are the AdventHealth master affiliation agreement.
// ---------------------------------------------------------------------------

/** How long a TB screen stands (§4.4: "current (within one year)"). */
export const PPD_VALID_DAYS = 365
/** Warn this far ahead of a PPD lapsing, so it can be redone in time. */
export const PPD_WARN_DAYS = 45
/** Influenza season, when a student without a flu shot has to mask (§4.4). */
export const FLU_SEASON_MONTHS = [11, 12, 1, 2, 3]

export type ClearanceState =
  /** On file and good for the rotation. */
  | 'ok'
  /** On file but runs out before or during the rotation. */
  | 'expiring'
  /** Not on file, or on file and not sufficient. */
  | 'missing'
  /** Not required of this student — the facility employs them (§4.21). */
  | 'exempt'
  /** On file and satisfied by a condition rather than a document. */
  | 'noted'

export interface ClearanceItem {
  id: string
  label: string
  /** The clause this item exists to satisfy, for the letter and for audits. */
  clause: string
  state: ClearanceState
  /** What is on file, or what is missing — shown to the person fixing it. */
  detail: string
}

export interface ClearanceReview {
  items: ClearanceItem[]
  /** Items that stop the student going. */
  blocking: ClearanceItem[]
  /** True when nothing blocks and the letter can honestly be written. */
  ready: boolean
  /** The date everything was judged against. */
  asOf: string
}

export interface ClearanceWhen {
  /** Day the student is due on the floor. Defaults to today. */
  rotationStart?: string
  /** Last day of the rotation, for insurance and for the flu-season test. */
  rotationEnd?: string
  /** Today, injectable so this is testable. */
  today?: string
}

const iso = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : '')
const monthOf = (d: string) => Number(d.slice(5, 7))

/** Does any part of the rotation fall in flu season? */
function touchesFluSeason(start: string, end?: string): boolean {
  if (FLU_SEASON_MONTHS.includes(monthOf(start))) return true
  if (!end) return false
  // Short rotations only: step month by month rather than day by day.
  let cursor = start
  for (let i = 0; i < 24 && cursor <= end; i++) {
    if (FLU_SEASON_MONTHS.includes(monthOf(cursor))) return true
    cursor = addDays(cursor, 30)
  }
  return FLU_SEASON_MONTHS.includes(monthOf(end))
}

function item(
  id: string,
  label: string,
  clause: string,
  state: ClearanceState,
  detail: string,
): ClearanceItem {
  return { id, label, clause, state, detail }
}

/**
 * Judge a student's clearance for a rotation.
 *
 * `blocking` is what a facility would turn them away for. An item that is
 * merely `noted` — masking through flu season, a positive PPD with a clear
 * film — is satisfied, and says how.
 */
export function clearanceReview(
  c: AemtClearance | undefined,
  when: ClearanceWhen = {},
): ClearanceReview {
  const cl = c ?? {}
  const today = iso(when.today) || todayISO()
  // Judged against the day they are due on the floor. A PPD that is current
  // today and lapses the week before the rotation is not clearance.
  const asOf = iso(when.rotationStart) || today
  const end = iso(when.rotationEnd)
  const items: ClearanceItem[] = []

  // ── Physical examination (§4.4) ──────────────────────────────────────────
  if (cl.facilityEmployee) {
    items.push(
      item('physical', 'Physical examination', '§4.4', 'exempt', 'Employed by the facility'),
    )
  } else if (iso(cl.physicalDate)) {
    items.push(item('physical', 'Physical examination', '§4.4', 'ok', `Completed ${iso(cl.physicalDate)}`))
  } else {
    items.push(item('physical', 'Physical examination', '§4.4', 'missing', 'No date on file'))
  }

  // ── Immunisations (§4.4) ─────────────────────────────────────────────────
  // Varicella is the one with a second step: a negative titer has to be
  // followed by the vaccine, so a titer alone is not clearance.
  if (cl.varicellaTiter === 'negative' && !iso(cl.varicellaDate)) {
    items.push(
      item('varicella', 'Varicella', '§4.4', 'missing', 'Titer negative — vaccination required'),
    )
  } else if (iso(cl.varicellaDate)) {
    items.push(item('varicella', 'Varicella', '§4.4', 'ok', `On file ${iso(cl.varicellaDate)}`))
  } else if (cl.varicellaTiter === 'positive') {
    items.push(item('varicella', 'Varicella', '§4.4', 'noted', 'Immune by titer'))
  } else {
    items.push(item('varicella', 'Varicella', '§4.4', 'missing', 'No date or titer on file'))
  }

  if (iso(cl.hepBDate)) {
    items.push(item('hepb', 'Hepatitis B', '§4.4', 'ok', `On file ${iso(cl.hepBDate)}`))
  } else if (cl.hepBDeclined) {
    items.push(item('hepb', 'Hepatitis B', '§4.4', 'noted', 'Signed declination on file'))
  } else {
    items.push(item('hepb', 'Hepatitis B', '§4.4', 'missing', 'No date or signed declination'))
  }

  for (const [id, label, date] of [
    ['mmr', 'MMR', cl.mmrDate],
    ['tdap', 'Tdap', cl.tdapDate],
  ] as const) {
    items.push(
      iso(date)
        ? item(id, label, '§4.4', 'ok', `On file ${iso(date)}`)
        : item(id, label, '§4.4', 'missing', 'No date on file'),
    )
  }

  // Influenza is the one immunisation the agreement lets a student work
  // without — they mask from November through March instead — so a missing
  // flu shot is a note on the letter, not a closed door.
  if (iso(cl.fluDate)) {
    items.push(item('flu', 'Influenza', '§4.4', 'ok', `On file ${iso(cl.fluDate)}`))
  } else if (touchesFluSeason(asOf, end)) {
    items.push(item('flu', 'Influenza', '§4.4', 'noted', 'No vaccination — masks through the season'))
  } else {
    items.push(item('flu', 'Influenza', '§4.4', 'noted', 'Outside flu season'))
  }

  // ── Tuberculosis screening (§4.4) ────────────────────────────────────────
  const ppd = iso(cl.ppdDate)
  if (!ppd) {
    items.push(item('ppd', 'TB screening', '§4.4', 'missing', 'No PPD on file'))
  } else if (cl.ppdResult === 'positive' && !(iso(cl.cxrDate) && cl.cxrClear)) {
    items.push(
      item('ppd', 'TB screening', '§4.4', 'missing', 'PPD positive — clear chest film required'),
    )
  } else {
    const expires = addDays(ppd, PPD_VALID_DAYS)
    const detail =
      cl.ppdResult === 'positive'
        ? `PPD ${ppd} positive · chest film ${iso(cl.cxrDate)} clear · valid to ${expires}`
        : `PPD ${ppd} negative · valid to ${expires}`
    if (expires < asOf) {
      items.push(item('ppd', 'TB screening', '§4.4', 'missing', `Lapsed ${expires} — due again`))
    } else if (expires < addDays(asOf, PPD_WARN_DAYS) || (end && expires < end)) {
      items.push(item('ppd', 'TB screening', '§4.4', 'expiring', `${detail} — redo before the rotation ends`))
    } else {
      items.push(item('ppd', 'TB screening', '§4.4', 'ok', detail))
    }
  }

  // ── Criminal background check (§4.5) ─────────────────────────────────────
  if (cl.facilityEmployee) {
    items.push(item('background', 'Background check', '§4.5', 'exempt', 'Employed by the facility'))
  } else if (!iso(cl.backgroundDate)) {
    items.push(item('background', 'Background check', '§4.5', 'missing', 'No date on file'))
  } else if (!cl.backgroundSevenYear) {
    items.push(
      item(
        'background',
        'Background check',
        '§4.5',
        'missing',
        'Seven-year, all-jurisdiction scope not confirmed',
      ),
    )
  } else if (!cl.backgroundCleared) {
    items.push(
      item('background', 'Background check', '§4.5', 'missing', 'Not yet screened against the disqualification list'),
    )
  } else {
    items.push(
      item('background', 'Background check', '§4.5', 'ok', `${iso(cl.backgroundDate)} · seven-year · cleared`),
    )
  }

  // ── Drug screen (§4.6) ───────────────────────────────────────────────────
  if (cl.facilityEmployee) {
    items.push(item('drug', 'Drug screen', '§4.6', 'exempt', 'Employed by the facility'))
  } else if (!iso(cl.drugScreenDate)) {
    items.push(item('drug', 'Drug screen', '§4.6', 'missing', 'No date on file'))
  } else if (!cl.drugScreenNinePanel) {
    items.push(item('drug', 'Drug screen', '§4.6', 'missing', 'Not confirmed as the nine-panel'))
  } else if (!cl.drugScreenNegative) {
    items.push(item('drug', 'Drug screen', '§4.6', 'missing', 'Result not recorded as negative'))
  } else {
    items.push(item('drug', 'Drug screen', '§4.6', 'ok', `${iso(cl.drugScreenDate)} · nine-panel · negative`))
  }

  // ── Personal health insurance (§4.8) ─────────────────────────────────────
  const through = iso(cl.insuranceThrough)
  if (!cl.insuranceCarrier?.trim()) {
    items.push(item('insurance', 'Health insurance', '§4.8', 'missing', 'No carrier on file'))
  } else if (through && end && through < end) {
    items.push(
      item('insurance', 'Health insurance', '§4.8', 'expiring', `${cl.insuranceCarrier} — lapses ${through}, before the rotation ends`),
    )
  } else if (through && through < asOf) {
    items.push(item('insurance', 'Health insurance', '§4.8', 'missing', `${cl.insuranceCarrier} — lapsed ${through}`))
  } else {
    items.push(
      item('insurance', 'Health insurance', '§4.8', 'ok', cl.insuranceCarrier + (through ? ` · through ${through}` : '')),
    )
  }

  const blocking = items.filter((i) => i.state === 'missing' || i.state === 'expiring')
  return { items, blocking, ready: blocking.length === 0, asOf }
}

/** One-line summary for a roster row. */
export function clearanceSummary(r: ClearanceReview): string {
  if (r.ready) return 'Cleared'
  const n = r.blocking.length
  return `${n} item${n === 1 ? '' : 's'} outstanding`
}
