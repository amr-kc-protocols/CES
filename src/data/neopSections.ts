// ---------------------------------------------------------------------------
// NEOP comprehension exam — the shape of the exam.
//
// SPLIT FROM neopSelection.ts ON PURPOSE. This half is imported by the
// candidate-facing exam page, so everything in it is safe for a candidate to
// read: what the three sections are, what each is for, and the marks. The
// other half — the interview probes, and the reading each preference answer
// gets — is imported only by the administrator's results screen, so it is not
// served as part of the page that asks the questions.
//
// That is a smaller guarantee than the one the question bank gets (the bank
// and its answers never leave the database at all), and it is worth being
// straight about why it can be smaller: there is no key here to protect. The
// preference section is unscored, and a candidate who dug the signal map out
// of a JavaScript bundle in order to answer "correctly" would have told us
// only that they want the job — which the interview is there to test either
// way. See the reasoning in neopSelection.ts.
// ---------------------------------------------------------------------------

export type NeopSection = 'clinical' | 'operations' | 'fit'

export interface SectionSpec {
  id: NeopSection
  label: string
  /** Shown to the candidate when the section begins. */
  intro: string
  /**
   * How many items are drawn. `null` means every active item in the section is
   * served — which the fit section requires: a random subset would give two
   * candidates different questions and leave the interviewer comparing
   * answers to questions only one of them was asked.
   */
  draw: number | null
  scored: boolean
}

/**
 * IN SERVED ORDER, and the order is a design decision.
 *
 * The preference section comes SECOND, before the operations section rather
 * than after it. The operations items are sixteen questions whose answers all
 * describe what we value and what we are wary of — run them first and the
 * candidate answers the preference items having just been coached, at length,
 * on what we would like to hear. Patient care first is a neutral warm-up that
 * gives nothing away; what somebody wants is asked before we have spent a
 * quarter of an hour telling them.
 *
 * The briefing still comes before all of it, and still says plainly that this
 * is not 911 work. That is the trade: self-selection is worth more than a clean
 * measurement, which is why the preference items lean on what a candidate has
 * already done rather than what they now say they want.
 */
export const NEOP_SECTIONS: SectionSpec[] = [
  {
    id: 'clinical',
    label: 'Patient care',
    intro:
      'Straightforward patient-care questions, at the level of a newly qualified EMT and no higher. Everybody sits the same section — paramedic applicants are not asked paramedic material, and nothing here is specific to the way we work.',
    draw: 12,
    scored: true,
  },
  {
    id: 'fit',
    label: 'What you want',
    intro:
      'About you rather than about us. Nothing in this section is scored and no answer here costs you the job — we use it to shape the conversation in your interview rather than to mark you. Several of these have no option that fits you exactly; pick the closest one that is true. Guessing at what we would like to hear will only get you an interview about somebody you are not.',
    draw: null,
    scored: false,
  },
  {
    id: 'operations',
    label: 'Our operation',
    intro:
      'These come from the description of the job you just read. They are the part of this exam we weigh most heavily, because understanding what the work is is the thing that goes wrong most often.',
    draw: 16,
    scored: true,
  },
]

export const SCORED_SECTIONS = NEOP_SECTIONS.filter((s) => s.scored)

export function sectionSpec(id: NeopSection): SectionSpec | undefined {
  return NEOP_SECTIONS.find((s) => s.id === id)
}

/**
 * Marks that flag a topic worth covering, out of the scored items only.
 *
 * THESE ARE NOT PASS MARKS, AND THIS EXAM DOES NOT DECIDE WHO IS HIRED. What
 * they do is say where to spend somebody's first weeks: a new hire who scored
 * 55% on the operations section has told us, before their first shift, which
 * half of the orientation actually needs to land for them. That is worth
 * knowing and it is cheap to act on.
 *
 * They were written as floors — a gate, with the operations mark as the thing
 * that kept a likely four-month hire out. That is not how this instrument is
 * being used. An exam sat by applicants is a selection procedure the moment a
 * score influences a hiring decision, whatever anybody intended, so a number
 * shown in red beside a candidate's name is not a neutral observation; it is a
 * decision being made without saying so. If a score is going to inform hiring,
 * that belongs in the open where HR and counsel can look at it. Until then the
 * screen shows these as what they are: topics to pick up in academy.
 *
 * The selection judgement still happens — in the interview, informed by what
 * this exam surfaced. People decide, and they own the decision.
 */
export const LEARNING_MARKS = {
  overall: 70,
  clinical: 70,
  operations: 75,
}

/** How long a sitting lasts. MUST MATCH the server — see lib/exam.ts. */
export const NEOP_LIMIT_MINUTES = 35

