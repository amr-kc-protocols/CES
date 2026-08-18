// ---------------------------------------------------------------------------
// NEOP selection exam — the instrument.
//
// The AEMT exam this is modelled on measures one thing: who is likely to pass a
// certification examination. This one is a hiring instrument for the Kansas
// City interfacility operation, and it has a second job the AEMT exam never
// had — the oral interviews keep discovering, well into the conversation, that
// the applicant in front of us wants a 911 career and sees interfacility as the
// way in. Everyone's time goes into finding that out one candidate at a time,
// and the candidates who do want this work are competing for seats with people
// who are passing through.
//
// So the exam has three sections, and they are NOT three flavours of the same
// measurement:
//
//   CLINICAL (scored) — can they look after a patient. Deliberately held at
//   EMT scope: the same instrument is sat by EMT and paramedic applicants, and
//   failing an EMT on paramedic content measures the posting they applied to,
//   not the person.
//
//   OPERATIONS (scored) — did they read, and understand, what this job is.
//   Every item keys to a section of the briefing in data/kcOperation.ts, which
//   the candidate reads immediately before starting. This is the section that
//   carries the weight, and a candidate who scores well here has demonstrated
//   something no interview answer can: they engaged with an unglamorous
//   description of the work instead of skimming to the end of the form.
//
//   FIT (NOT scored, and never scored) — what they actually want. Recorded,
//   surfaced to the interviewer, and given no marks at all.
//
// WHY FIT IS UNSCORED. Score "would you take a 911 job if one opened" and
// within one hiring round every applicant answers no, because the desirable
// answer is written on the face of the question. A self-report item cannot
// measure sincerity; what it can do is put a specific, on-the-record answer in
// front of the interviewer so the conversation starts somewhere concrete
// instead of at "so, tell us why you want to work here". That is what these
// items are for, and it is why each one carries an interview probe rather than
// a key.
//
// It follows that a fit answer is never a reason to reject anybody on its own.
// "I want to run 911 eventually" is a legitimate thing for a person to want. It
// is a conversation, and sometimes it is a referral to the Linn County
// operation, which is the honest outcome for everyone.
// ---------------------------------------------------------------------------

// The same list governs both programs. Retyping it would let one copy drift,
// and this one is not a style preference — it is what may not be asked.
export { PROHIBITED_TOPICS } from './aemtSelection'

// The shape of the exam — sections, draw sizes and marks — lives in
// neopSections.ts, which the candidate page imports. Re-exported here so an
// administrator screen has one import rather than two.
export * from './neopSections'

/* ---------------------------------------------------------------------------
 * The fit items, as the interviewer sees them.
 *
 * The stems and options live in the question bank on the server, like every
 * other item — scripts/neop-exam-bank.mjs is the source, and nothing with an
 * answer key is ever bundled into the app. What lives here is what an
 * interviewer needs beside the candidate's answer: what the item was for, what
 * to ask next, and whether this particular answer is one to talk about.
 *
 * `signals` is positional, one entry per option, in the bank's option order:
 *
 *   'consistent' — reads as somebody who wants this work.
 *   'discuss'    — worth a real conversation. NOT a mark against anyone.
 *   'neutral'    — tells you about them without pointing either way.
 *
 * scripts/check-neop-exam.mjs fails the build if a code here has no item in
 * the bank, if an item has no entry here, or if the signal count does not match
 * the option count — a positional map that has silently slipped by one would
 * put the wrong flag beside a real person's answer.
 * ------------------------------------------------------------------------ */

export type FitSignal = 'consistent' | 'discuss' | 'neutral'

export interface FitItem {
  code: string
  theme: string
  /** What this item is actually for. */
  measures: string
  /** Ask this in the oral interview, whatever they answered. */
  probe: string
  signals: FitSignal[]
}

export const FIT_ITEMS: FitItem[] = [
  {
    code: 'fit-future',
    theme: 'Where they are headed',
    measures: 'The single most direct statement of what career they are actually pursuing.',
    probe: 'You said that is where you want to be in three years. What would you need to be doing between now and then to get there?',
    signals: ['consistent', 'discuss', 'neutral', 'neutral'],
  },
  {
    code: 'fit-draw',
    theme: 'What brought them to EMS',
    measures:
      'Whether the motivation is the emergency or the patient. Neither is wrong; only one of them is fed by this job.',
    probe: 'Tell me about a patient who stayed with you. What was it about that call?',
    signals: ['discuss', 'consistent', 'neutral', 'neutral'],
  },
  {
    code: 'fit-shift',
    theme: 'The shift they would choose',
    measures:
      'Preference stated as a trade-off rather than as an ideal, which is harder to answer strategically.',
    probe: 'Walk me through the shift you picked. What would make that a good day for you?',
    signals: ['discuss', 'consistent', 'neutral', 'neutral'],
  },
  {
    code: 'fit-tradeoff',
    theme: 'What they would give up',
    measures: 'Which half of the work they would keep if they could only keep one.',
    probe: 'Why that one? What would you miss about the other?',
    signals: ['consistent', 'discuss', 'neutral', 'discuss'],
  },
  {
    code: 'fit-911-offer',
    theme: 'The 911 opening',
    measures:
      'Asked plainly, and unscored so that answering it honestly costs nothing. The answer matters less than what they say about it in the room.',
    probe: 'Say that opening came up in six months. Talk me through how you would actually think about it.',
    signals: ['discuss', 'consistent', 'neutral', 'discuss'],
  },
  {
    code: 'fit-honest',
    theme: 'Why this job, now',
    measures:
      'Gives explicit permission to say "I need a job", which is true of many good hires and is not held against anybody. What it produces is a candid conversation rather than a rehearsed one.',
    probe: 'Whatever the reason you applied — what would have to be true a year from now for you to be glad you did?',
    signals: ['consistent', 'neutral', 'discuss', 'neutral'],
  },
  {
    code: 'fit-least',
    theme: 'Self-knowledge',
    measures:
      'Every option is a real part of the job. There is no wrong answer; an applicant who cannot name any part they would dislike has not thought about it.',
    probe: 'You named that as the part you would like least. What would you do on the day it gets to you?',
    signals: ['neutral', 'neutral', 'neutral', 'neutral'],
  },
  {
    code: 'fit-paperwork',
    theme: 'Documentation',
    measures:
      'Charting is a third of this job and the part applicants most consistently underestimate.',
    probe: 'Tell me about the last report you wrote that you were pleased with. What made it good?',
    signals: ['neutral', 'consistent', 'discuss', 'neutral'],
  },
  {
    code: 'fit-alone',
    theme: 'The back of the truck',
    measures:
      'Comfort with sustained solo responsibility for a stable-but-complicated patient — the actual working condition of this job.',
    probe: 'What would you want in place before you were comfortable in the back with a vented patient?',
    signals: ['neutral', 'consistent', 'discuss', 'consistent'],
  },
  {
    code: 'fit-experience',
    theme: 'Background',
    measures: 'Context for every other answer. Not a qualification — we hire people with none of it.',
    probe: 'What surprised you most about the work you have done so far?',
    signals: ['neutral', 'neutral', 'neutral', 'neutral'],
  },
  {
    code: 'fit-stay',
    theme: 'Horizon',
    measures:
      'What they picture, not what they promise. Retention is handled by hiring people who want the job, not by an answer to this question.',
    probe: 'What would keep you here past that point? What would make you start looking?',
    signals: ['discuss', 'discuss', 'consistent', 'neutral'],
  },
]

export const FIT_BY_CODE = new Map(FIT_ITEMS.map((f) => [f.code, f]))

export const SIGNAL_LABEL: Record<FitSignal, string> = {
  consistent: 'Consistent with the work',
  discuss: 'Worth discussing',
  neutral: 'Context',
}

export const SIGNAL_TONE: Record<FitSignal, string> = {
  consistent: 'ok',
  discuss: 'warn',
  neutral: 'muted',
}
