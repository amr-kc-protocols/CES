// ---------------------------------------------------------------------------
// NEOP selection exam — the instrument.
//
// WHAT THIS EXAM DECIDES: NOTHING. The interview decides who is hired, as it
// always has. What this produces is information for two people — the
// interviewer, who gets specific answers to open a conversation with, and the
// educator, who knows before somebody's first shift which half of orientation
// needs to land for them. An exam that ranks nobody out is still worth sitting
// if it means a new hire's first week is aimed at what they actually need.
//
// The AEMT exam this is modelled on measures one thing: who is likely to pass a
// certification examination. This one informs hiring for the KC
// interfacility operation, and it has a second job the AEMT exam never
// had — the oral interviews keep discovering, well into the conversation, that
// the applicant in front of us wants a 911 career and sees interfacility as the
// way in. Everyone's time goes into finding that out one candidate at a time,
// and the candidates who do want this work are competing for seats with people
// who are passing through.
//
// So the exam has three sections, and they are NOT three flavours of the same
// measurement:
//
//   CLINICAL (scored) — can they look after a patient. Held at the level of a
//   NEWLY-QUALIFIED EMT and no higher: EMT and paramedic applicants sit the
//   same section, so paramedic content would mark an EMT down for the
//   certificate they hold. Nothing specific to interfacility work either — an
//   item about lines and drains looks clinical and actually tests a job the
//   applicant has not been given. It is a floor, not a ranking.
//
//   OPERATIONS (scored) — did they read, and understand, what this job is.
//   Every item keys to a section of the briefing in data/kcOperation.ts, which
//   the candidate reads immediately before starting. This is the section that
//   says the most, and a candidate who scores well here has demonstrated
//   something no interview answer can: they engaged with an unglamorous
//   description of the work instead of skimming to the end of the form. One who
//   scores badly has told their educator what to spend the first week on.
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
// AND WHY NONE OF THEM ANNOUNCES WHAT IT IS FOR. Unscored is not enough on its
// own: an item whose preferred answer is obvious is a prompt sheet, and it
// selects for the applicants most willing to say what we want to hear. So
// every option in this section is something a good candidate could pick and
// defend, several items ask what somebody has already DONE rather than what
// they intend, and the interviewer is shown a tally across the section instead
// of a verdict on any one answer. The rules are written out above the items in
// scripts/neop-exam-bank.mjs, where the options themselves live.
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
 *   'consistent' — leans toward the work this operation actually does.
 *   'discuss'    — leans toward scene or fire work, or toward moving on. NOT a
 *                  mark against anyone, and never a reason on its own.
 *   'neutral'    — tells you about them without pointing either way.
 *
 * At most ONE option per item may be 'consistent'. Two would mean the item has
 * two right answers, which is the same as having none.
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
    code: 'fit-own-time',
    theme: 'What they have already spent their own time on',
    measures:
      'Evidence rather than intention. A fire academy course or a department entrance test is a fact about where somebody is heading, and it cannot be re-decided after reading our job description. Every option is somebody showing initiative, so none of them is the wrong answer to give.',
    probe: 'Tell me about the last training you went and got for yourself. What made you pick that one?',
    signals: ['consistent', 'discuss', 'neutral', 'neutral'],
  },
  {
    code: 'fit-paid-class',
    theme: 'The course they would spend our money on',
    measures:
      'Forced choice between four courses any keen applicant would want. What they give up is the signal — extrication is a rescue and scene skill, and nothing in the way this is asked marks it as the wrong pick.',
    probe: 'You chose that course. What would you want to be able to do afterwards that you cannot do now?',
    signals: ['discuss', 'neutral', 'consistent', 'neutral'],
  },
  {
    code: 'fit-compliment',
    theme: 'The praise they would rather have',
    measures:
      'Two kinds of good day, both of them flattering. One is composure in chaos, the other is a patient delivered in the shape they were collected in — and only one of those is what most of our shifts can offer.',
    probe: 'Why that one? Tell me about a time somebody could have said it about you.',
    signals: ['discuss', 'neutral', 'consistent', 'neutral'],
  },
  {
    code: 'fit-story',
    theme: 'The story they reach for',
    measures:
      'What somebody volunteers about a job is what the job meant to them. Reaching first for the worst call they ran is normal and human; it is also what people who miss scene work do.',
    probe: 'Tell me that story properly. What has stayed with you about it?',
    signals: ['neutral', 'discuss', 'consistent', 'neutral'],
  },
  {
    code: 'fit-wear-down',
    theme: 'What they cannot take much of',
    measures:
      'Three of these wear anybody down. The fourth — a shift where nothing happened — is a description of a good day here, and an applicant who names it as the hardest thing has told you something useful about themselves at no cost to their honesty.',
    probe: 'What do you do with a slow day? What does a good one look like when nothing is going wrong?',
    signals: ['discuss', 'neutral', 'neutral', 'neutral'],
  },
  {
    code: 'fit-five-years',
    theme: 'Who they want to have become',
    measures:
      'Ambition, phrased four attractive ways and without naming any employer or service. "First out the door" is a busy scene truck; it is written to sound as good as it feels.',
    probe: 'What would the first year of getting there look like?',
    signals: ['neutral', 'discuss', 'neutral', 'consistent'],
  },
  {
    code: 'fit-pitch',
    theme: 'How they would sell the job',
    measures:
      'What somebody says to a friend is closer to what they believe than what they say to an interviewer. Two options here lean away from us: seeing things most people never see, and — the quiet one — "a good place to start".',
    probe: 'What would you warn that friend about?',
    signals: ['discuss', 'consistent', 'neutral', 'discuss'],
  },
  {
    code: 'fit-applications',
    theme: 'Where else they are applying',
    measures:
      'A plain factual question with no shameful answer — applying widely is what sensible people do in a job market. It is here because it is the one item that can be checked against the rest of the conversation.',
    probe: 'What else are you looking at, and what would make you choose between them?',
    signals: ['consistent', 'neutral', 'discuss', 'neutral'],
  },
  {
    code: 'fit-swap',
    theme: 'The shift they would choose',
    measures:
      'Busiest versus most complicated, with two ordinary human answers alongside them. The same preference as the shift question the first version of this exam asked outright, put where the desirable answer is not written on the face of it.',
    probe: 'Walk me through what a good version of that shift looks like, hour by hour.',
    signals: ['neutral', 'discuss', 'neutral', 'consistent'],
  },
  {
    code: 'fit-leave',
    theme: 'What would start them looking',
    measures:
      'Every option is a legitimate reason to leave a job, including the one that matters to us: an opening somewhere they had been waiting on. Asking what would end it is less coachable than asking how long they will stay.',
    probe: 'Has that happened to you before? What did you do?',
    signals: ['neutral', 'neutral', 'discuss', 'consistent'],
  },
  {
    code: 'fit-least',
    theme: 'Self-knowledge',
    measures:
      'All four are real parts of the job and none is disqualifying. An applicant who cannot name any part they would dislike has not thought about the work.',
    probe: 'What would you do on the day that part of it really gets to you?',
    signals: ['neutral', 'neutral', 'discuss', 'neutral'],
  },
  {
    code: 'fit-charts',
    theme: 'Documentation',
    measures:
      'Context rather than a verdict. Charting is a third of this job and the part applicants most consistently underestimate, and "I keep it short" is a perfectly respectable thing to believe on the way in.',
    probe: 'Tell me about a report you were pleased with. What made it a good one?',
    signals: ['consistent', 'neutral', 'neutral', 'neutral'],
  },
  {
    code: 'fit-experience',
    theme: 'Background',
    measures:
      'Context for every other answer, and not a signal in itself — scene experience is not a mark against anybody, and we hire people with no experience at all.',
    probe: 'What surprised you most about the work you have done so far?',
    signals: ['neutral', 'neutral', 'neutral', 'neutral'],
  },
]

export const FIT_BY_CODE = new Map(FIT_ITEMS.map((f) => [f.code, f]))

export const SIGNAL_LABEL: Record<FitSignal, string> = {
  consistent: 'Leans to this work',
  discuss: 'Leans to scene or fire work',
  neutral: 'Context',
}

/**
 * What the tally means, printed above it so nobody has to remember.
 *
 * A LEAN IS NOT A FINDING. Any one of these answers is a defensible thing for
 * a good candidate to have picked, which is the whole design — an item whose
 * preferred answer is obvious measures nothing but willingness to give it. The
 * signal is the pattern, and even the pattern is a subject for the interview
 * rather than a conclusion from it.
 */
export const TALLY_NOTE =
  'Every option in this section is a reasonable answer, so no single lean means anything. Read the pattern, then ask the probes — and remember that wanting to run 911 or work for a fire department is a legitimate thing to want, and sometimes the right outcome of this conversation is telling somebody where else to apply.'

export const SIGNAL_TONE: Record<FitSignal, string> = {
  consistent: 'ok',
  discuss: 'warn',
  neutral: 'muted',
}
