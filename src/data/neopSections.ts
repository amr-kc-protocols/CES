// ---------------------------------------------------------------------------
// NEOP selection exam — the shape of the exam.
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

export const NEOP_SECTIONS: SectionSpec[] = [
  {
    id: 'clinical',
    label: 'Patient care',
    intro:
      'Straightforward patient-care questions at EMT level. Paramedic applicants are not asked paramedic-only material here — everybody sits the same section.',
    draw: 12,
    scored: true,
  },
  {
    id: 'operations',
    label: 'Our operation',
    intro:
      'These come from the description of the job you just read. They are the part of this exam we weigh most heavily, because understanding what the work is is the thing that goes wrong most often.',
    draw: 16,
    scored: true,
  },
  {
    id: 'fit',
    label: 'What you want',
    intro:
      'These are not scored, and there is no answer here that costs you the job. They exist so your interview starts from what you actually want rather than from guesswork — and so that if what you want is a 911 career, we find that out now and talk about it honestly instead of six months from now. Answer them the way they are true.',
    draw: null,
    scored: false,
  },
]

export const SCORED_SECTIONS = NEOP_SECTIONS.filter((s) => s.scored)

export function sectionSpec(id: NeopSection): SectionSpec | undefined {
  return NEOP_SECTIONS.find((s) => s.id === id)
}

/**
 * Marks, out of the scored items only.
 *
 * The operations floor is the point of the instrument. A candidate can be a
 * perfectly good clinician and still have understood none of what they just
 * read about the job — that combination is exactly the hire that leaves in
 * four months, and an overall percentage lets it through by averaging.
 *
 * These are decision aids, not automatic rejections. Nobody is hired or
 * declined by arithmetic; the exam informs an interview, and the interview
 * decides.
 */
export const NEOP_THRESHOLDS = {
  overall: 70,
  clinical: 70,
  operations: 75,
}

/** How long a sitting lasts. MUST MATCH the server — see lib/exam.ts. */
export const NEOP_LIMIT_MINUTES = 30

