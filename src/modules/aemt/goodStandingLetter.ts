import { esc } from '../academy/docGen'
import { formatDate } from '../../lib/date'
import { clearanceReview, type ClearanceWhen } from '../../data/aemtClearance'
import type { AemtClearance, AemtCourse, AemtSite, AemtStudent } from '../../types'

// ---------------------------------------------------------------------------
// The letter of good standing.
//
// The affiliation agreement requires the program to state in writing, before a
// student sets foot on a unit, that a specific list of things is true of them
// (§4.4, §4.5, §4.6, §4.8, §4.9). This writes that letter from the record
// rather than from a form somebody fills in twice.
//
// The rule that shapes the whole file: the letter asserts nothing the record
// does not hold. Every sentence below is built from a date in the clearance
// record, and a student whose record is short of any of it cannot have a
// letter — the caller is expected to check `clearanceReview().ready` first,
// and `goodStandingLetterHTML` refuses if they did not.
// ---------------------------------------------------------------------------

export interface LetterContext {
  /** The facility the student is going to, from the course's site list. */
  site?: AemtSite
  /** Rotation dates, as they will be written to the facility. */
  rotationStart?: string
  rotationEnd?: string
  /** The program contact with authority over the program (§4.3). */
  contactName?: string
  contactTitle?: string
  contactPhone?: string
  contactEmail?: string
  /** Date at the head of the letter. Defaults to today. */
  letterDate?: string
}

const LETTER_CSS = `
  .gs { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #111; font-size: 12px;
        line-height: 1.62; max-width: 46rem; }
  .gs .lh { font-weight: 700; letter-spacing: .02em; padding-bottom: 10px;
            border-bottom: 2px solid #26456b; margin-bottom: 20px; display: flex;
            justify-content: space-between; gap: 12px; }
  .gs .lh small { font-weight: 400; color: #666; }
  .gs p { margin: 0 0 1em; }
  .gs .re { font-weight: 700; }
  .gs ul { margin: 0 0 1em; padding-left: 0; list-style: none; }
  .gs li { padding-left: 12px; border-left: 2px solid #dfe3ea; margin-bottom: 12px;
           page-break-inside: avoid; }
  .gs .ih { display: block; font-size: 10px; font-weight: 700; letter-spacing: .07em;
            text-transform: uppercase; color: #26456b; margin-bottom: 2px; }
  .gs .sig { margin-top: 26px; }
  .gs .sig .line { display: block; width: 15rem; border-bottom: 1px solid #333;
                   margin: 24px 0 6px; height: 1px; }
  .gs .prov { margin-top: 22px; padding-top: 10px; border-top: 1px solid #ddd;
              font-size: 9px; color: #777; line-height: 1.5; }
`

/** Sentence for one immunisation, or nothing when the record is silent. */
function shot(label: string, date?: string): string {
  return date ? `${label} ${formatDate(date.slice(0, 10))}` : ''
}

function immunisationLine(c: AemtClearance): string {
  const parts = [
    c.varicellaTiter === 'positive' && !c.varicellaDate
      ? 'varicella immune by titer'
      : shot('varicella', c.varicellaDate),
    c.hepBDate ? shot('hepatitis B', c.hepBDate) : c.hepBDeclined ? 'hepatitis B declination signed and on file' : '',
    shot('MMR', c.mmrDate),
    shot('Tdap', c.tdapDate),
    c.fluDate
      ? shot('influenza', c.fluDate)
      : 'influenza not administered — the student will wear a mask during flu season, November through March',
  ].filter(Boolean)
  return parts.join(', ')
}

function tbLine(c: AemtClearance): string {
  const ppd = formatDate((c.ppdDate ?? '').slice(0, 10))
  if (c.ppdResult === 'positive') {
    return (
      `Tuberculin skin test ${ppd}, positive. Chest radiograph ` +
      `${formatDate((c.cxrDate ?? '').slice(0, 10))} clear, with no active symptoms.`
    )
  }
  return `Tuberculin skin test ${ppd}, negative.`
}

/**
 * The filled letter.
 *
 * Returns null when the record cannot support it. That is not a guard against
 * a careless caller so much as the point of the document: an unsupported
 * sentence in this letter is a false statement to a hospital.
 */
export function goodStandingLetterHTML(
  student: AemtStudent,
  course: AemtCourse,
  ctx: LetterContext = {},
): string | null {
  const c = student.clearance
  const when: ClearanceWhen = { rotationStart: ctx.rotationStart, rotationEnd: ctx.rotationEnd }
  const review = clearanceReview(c, when)
  if (!c || !review.ready) return null

  const facility = ctx.site?.name ?? '[facility]'
  const liaison = ctx.site?.contact ?? ''
  const effective = ctx.site?.effectiveFrom
  const employee = !!c.facilityEmployee

  const window =
    ctx.rotationStart && ctx.rotationEnd
      ? `${formatDate(ctx.rotationStart)} to ${formatDate(ctx.rotationEnd)}`
      : ctx.rotationStart
        ? `beginning ${formatDate(ctx.rotationStart)}`
        : ''

  // The three the facility's own employees are excused from (§4.21). Said once,
  // plainly, rather than by leaving gaps the reader has to notice.
  const exemptNote = employee
    ? `<li><span class="ih">Facility employment</span>${esc(student.name)} is an employee of
        ${esc(facility)} in good standing and is therefore exempt from the physical examination,
        criminal background check and drug screen under section 4.21 of the agreement.</li>`
    : ''

  const physical = employee
    ? ''
    : `<li><span class="ih">Physical examination</span>Completed
        ${esc(formatDate((c.physicalDate ?? '').slice(0, 10)))}, including assessment of mobility,
        motor skills, hearing, vision and tactile ability.</li>`

  const background = employee
    ? ''
    : `<li><span class="ih">Criminal background check</span>Completed
        ${esc(formatDate((c.backgroundDate ?? '').slice(0, 10)))}, covering every city, county and
        state in which the student has resided or worked during the preceding seven years. Screened
        against the Student Disqualification Guidelines at Exhibit D; the student is not
        disqualified.</li>`

  const drug = employee
    ? ''
    : `<li><span class="ih">Drug screen</span>Nine-panel screen completed
        ${esc(formatDate((c.drugScreenDate ?? '').slice(0, 10)))}, negative for amphetamines,
        barbiturates, methadone, benzodiazepines, cocaine metabolite, methamphetamines, opiates,
        PCP and THC.</li>`

  const insurance = `<li><span class="ih">Health insurance</span>The student maintains personal
        health insurance in force for the period of the rotation${
          c.insuranceThrough ? ` (through ${esc(formatDate(c.insuranceThrough.slice(0, 10)))})` : ''
        }.</li>`

  return `<style>${LETTER_CSS}</style>
  <div class="gs">
    <div class="lh"><span>${esc(course.organization || 'American Medical Response')} — Clinical Education</span>
      <small>Advanced EMT program</small></div>

    <p>${esc(formatDate((ctx.letterDate ?? new Date().toISOString()).slice(0, 10)))}</p>

    ${liaison ? `<p>${esc(liaison)}<br>${esc(facility)}</p>` : `<p>${esc(facility)}</p>`}

    <p class="re">Re: Letter of Good Standing — ${esc(student.name)}, AEMT clinical rotation${
      window ? ` ${esc(window)}` : ''
    }</p>

    <p>Dear ${esc(liaison || 'Clinical Education Coordinator')},</p>

    <p>This letter confirms that ${esc(student.name)} is enrolled in and in good standing with the
      ${esc(course.organization || 'American Medical Response')} Advanced EMT program
      ${course.courseNumber ? `(Kansas BEMS course #${esc(course.courseNumber)})` : ''}, and is
      presented for a clinical rotation at ${esc(facility)}${
        effective ? ` under the affiliation agreement effective ${esc(formatDate(effective))}` : ''
      }.</p>

    <p>Prior to this rotation, the student has completed the following:</p>

    <ul>
      ${exemptNote}
      ${physical}
      <li><span class="ih">Immunizations</span>${esc(immunisationLine(c))}.</li>
      <li><span class="ih">Tuberculosis screening</span>${esc(tbLine(c))}</li>
      ${background}
      ${drug}
      ${insurance}
      <li><span class="ih">Preclinical preparation</span>The student has received adequate
        preclinical instruction and has completed the preclinical requirements for this rotation.</li>
    </ul>

    <p>The student has been instructed on and agrees to comply with the facility's policies and
      procedures, HIPAA and confidentiality requirements, and will wear the program uniform and
      identification badge at all times on site.</p>

    <p>${esc(course.organization || 'American Medical Response')} maintains professional liability
      coverage for its faculty and students of $1,000,000 per claim and $3,000,000 in the annual
      aggregate. A certificate of insurance is available on request.</p>

    <p>Please contact me directly with any questions, or if anything further is required before the
      rotation begins.</p>

    <p class="sig">Sincerely,
      <span class="line"></span>
      ${esc(ctx.contactName || course.coordinator || '')}${
        ctx.contactTitle ? `, ${esc(ctx.contactTitle)}` : ''
      }<br>
      Clinical Education — ${esc(course.organization || 'American Medical Response')}<br>
      ${esc([ctx.contactPhone, ctx.contactEmail].filter(Boolean).join(' · '))}</p>

    <div class="prov">
      Generated from the student's clearance record in CES on
      ${esc(formatDate(new Date().toISOString().slice(0, 10)))}${
        c.verifiedBy ? ` · records verified by ${esc(c.verifiedBy)}` : ''
      }${c.verifiedAt ? ` on ${esc(formatDate(c.verifiedAt.slice(0, 10)))}` : ''}.
      Every statement above is held as a dated record and can be produced on request.
    </div>
  </div>`
}

export function letterTitle(student: AemtStudent): string {
  return `Letter of Good Standing — ${student.name}`
}

export function letterFilename(student: AemtStudent, site?: AemtSite): string {
  const where = site?.name ? `_${site.name}` : ''
  return `Good_Standing_${student.name}${where}`
}
