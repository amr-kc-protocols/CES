// ---------------------------------------------------------------------------
// Candidate emails, generated from a candidate's own intake answers.
//
// Three templates cover the selection process end to end: the next step (take
// the exam), the decline, and the offer of a seat.
//
// DELIBERATELY VAGUE ABOUT HOURS. The program's own data carries a known
// discrepancy — the proposal claims ~110 didactic hours while its schedule
// table sums to 90, moving the total between ~356 and ~376 — and a number
// quoted to a candidate in writing is a number they will hold us to. These
// emails describe the shape of the program (16 weeks, where it happens) and
// leave the hour accounting to the KBEMS submission, where it belongs.
//
// The policy figures that ARE quoted — the pass mark, the absence limit, the
// K.A.R. clinical minimums — are imported from data/aemt.ts rather than
// retyped, so they cannot drift from the course they describe.
// ---------------------------------------------------------------------------

import { CLINICAL_REQUIREMENTS, MAX_ABSENT_HOURS, MIN_PASSING_PERCENT } from './aemt'
import { EXAM_DEADLINE, EXAM_LIMIT_MINUTES } from '../lib/exam'
import { answerText, type IntakeSubmission, type IntakeStatus } from '../lib/intake'

/**
 * The service commitment terms.
 *
 * DELIBERATELY EMPTY. How long a candidate commits to AMR after certification,
 * and what applies if they leave early, is contractual and is written down
 * nowhere in this codebase. Inventing plausible terms and emailing them to
 * staff would be worse than leaving a gap, so the generator emits a visible
 * placeholder and the dialog refuses to call the email ready until it is
 * filled in. Replace with the wording HR approves.
 */
export const SERVICE_COMMITMENT_TERMS = ''

const COMMITMENT_PLACEHOLDER =
  '[INSERT SERVICE COMMITMENT TERMS — length of commitment following certification, and what applies if employment ends before it is met.]'

/** Course logistics. Fill these in once and every email picks them up. */
export const COURSE_INFO = {
  startDate: '[START DATE]',
  orientation: '[ORIENTATION DATE & TIME]',
  /** How long an accepted candidate has to confirm their seat. */
  acceptBy: '[REPLY-BY DATE]',
}

export const SENDER = {
  name: 'Jordan Jones',
  title: 'Clinical Educator, AMR Kansas City',
  contact: '[phone] · [email]',
}

export const EXAM_URL = 'https://ces-nu.vercel.app/exam'

/** The shape of the program, without committing to an hour count. */
const PROGRAM_SHAPE = [
  `The AEMT course is a Kansas-approved (KBEMS) certification program that runs for 16 weeks.`,
  `Classroom and lab sessions are held at AMR Kansas City headquarters. Hospital clinical and field internship hours are completed at partner sites in the Kansas City area.`,
].join(' ')

export type EmailTemplateId = 'next-steps' | 'not-selected' | 'accepted'

export const EMAIL_TEMPLATES: { id: EmailTemplateId; label: string; note: string }[] = [
  { id: 'next-steps', label: 'Next steps', note: 'Take the selection exam' },
  { id: 'not-selected', label: 'Not selected', note: 'Declined for this cohort' },
  { id: 'accepted', label: 'Accepted', note: 'Offered a seat' },
]

/** Sensible default: follow the status already set on the candidate. */
export function templateForStatus(status: IntakeStatus): EmailTemplateId {
  if (status === 'Accepted') return 'accepted'
  if (status === 'Declined') return 'not-selected'
  return 'next-steps'
}

function firstName(full: string): string {
  const n = full.trim().split(/\s+/)[0]
  return n && n !== '—' ? n : 'there'
}

function clinicalMinimums(): string {
  return CLINICAL_REQUIREMENTS.map((r) => {
    const sub = r.subRequirement
      ? ` (including ${r.subRequirement.minimum} ${r.subRequirement.label})`
      : ''
    return `${r.minimum} ${r.label.toLowerCase()}${sub}`
  }).join(', ')
}

/**
 * Sentences that exist only because of what this candidate told us.
 *
 * The commonest way to lose a student is the clinical and field load landing
 * on top of commitments they already had, so name theirs rather than issuing a
 * general warning they will read past.
 */
function tailoredNotes(d: Record<string, unknown>, forOffer: boolean): string[] {
  const out: string[] = []
  const otherJob = answerText(d.otherJob) === 'Yes'
  const hours = answerText(d.otherJobHours)
  const inSchool = answerText(d.inSchool) === 'Yes'
  const school = answerText(d.schoolDetails)
  const lead = forOffer
    ? 'Before you accept, please look carefully at the schedule:'
    : 'Please look carefully at the schedule below before you commit:'

  if (otherJob && inSchool) {
    out.push(
      `You told us you work outside AMR${hours !== '—' ? ` (about ${hours} a week)` : ''} and are currently in school${school !== '—' ? ` — ${school}` : ''}. ${lead} clinical and field shifts are 12 hours each and are scheduled on top of your regular work schedule.`,
    )
  } else if (otherJob) {
    out.push(
      `You told us you work another job outside AMR${hours !== '—' ? ` (about ${hours} a week)` : ''}. ${lead} clinical and field shifts are 12 hours each and are scheduled on top of your regular work schedule.`,
    )
  } else if (inSchool) {
    out.push(
      `You told us you are currently enrolled in school${school !== '—' ? ` — ${school}` : ''}. ${lead} make sure the class and clinical schedule can sit alongside your coursework.`,
    )
  }

  const conflicts = answerText(d.conflicts)
  if (conflicts !== '—') {
    out.push(
      forOffer
        ? `We have the conflicts you listed on file: "${conflicts}". Bring them to orientation so we can plan around them.`
        : `You noted these known conflicts: "${conflicts}". Bring these up at the interview — we would rather plan around them now than discover them mid-course.`,
    )
  }

  if (!forOffer && answerText(d.canCommit) === 'Not sure yet') {
    out.push(
      `On the intake form you said you were not yet sure whether you could commit the time. That is a fair answer, and it is exactly what the detail below is for — read it, then decide. Nobody is served by starting a 16-week course that cannot be finished.`,
    )
  }

  return out
}

export interface GeneratedEmail {
  subject: string
  body: string
  /** Bracketed placeholders still in the text. Empty means ready to send. */
  unfilled: string[]
}

function nextSteps(d: Record<string, unknown>): { subject: string; lines: string[] } {
  const notes = tailoredNotes(d, false)
  return {
    subject: 'AEMT Program — Your Next Step (Selection Exam) & What to Expect',
    lines: [
      `Thank you for submitting your interest in the AMR Kansas City AEMT Program. This email covers three things: your next step, an overview of the program, and the expectations that come with a seat in it. Please read it in full before you take the exam.`,
      ``,
      ...(notes.length ? [...notes, ``] : []),
      `YOUR NEXT STEP — THE SELECTION EXAM`,
      ``,
      EXAM_URL,
      `Deadline: ${EXAM_DEADLINE.display}`,
      ``,
      `  • 50 multiple-choice questions, EMT-level material`,
      `  • ${EXAM_LIMIT_MINUTES}-minute time limit — the timer starts when you begin and keeps running even if you close the page`,
      `  • One attempt. Sit down somewhere quiet and undisturbed before you start`,
      `  • No login needed — just your name and your AMR email`,
      ``,
      `You will sign an Integrity Statement before beginning. Complete the exam on your own; giving or receiving help is a violation of AMR's Standards of Conduct and disqualifies you from selection.`,
      ``,
      `WHAT HAPPENS AFTER THE EXAM`,
      ``,
      `  1. Selection exam — by ${EXAM_DEADLINE.display}`,
      `  2. Structured interview — invitations go to advancing candidates`,
      `  3. Selection decision — you will be notified either way`,
      ``,
      `Selection considers four things: your exam score, the structured interview, your QA chart review over the trailing 12 months, and your attendance record over the same period. Current FTOs, and recent preceptors, CE instructors and peer mentors, receive additional consideration.`,
      ``,
      `THE PROGRAM AT A GLANCE`,
      ``,
      PROGRAM_SHAPE,
      ``,
      `You must also document these state-required clinical minimums: ${clinicalMinimums()}.`,
      ``,
      `WHAT IS EXPECTED OF YOU TO COMPLETE IT`,
      ``,
      `  • ${MIN_PASSING_PERCENT}% minimum to pass. Exams are 60% of your grade and quizzes/homework 40%; lab, clinical and field internship are satisfactory/unsatisfactory.`,
      `  • Attendance: missing more than ${MAX_ABSENT_HOURS} hours of scheduled class time fails the course.`,
      `  • Clinical and field shifts are 12 hours each and are scheduled IN ADDITION TO your regular work schedule. This is the single biggest demand of the program — plan for it now.`,
      `  • You are responsible for documenting your own clinical minimums as you go.`,
      ``,
      `CONTINUING WITH AMR KANSAS CITY`,
      ``,
      `AMR is investing in your certification. In return, candidates who accept a seat sign a service commitment agreement at acceptance.`,
      ``,
      SERVICE_COMMITMENT_TERMS.trim() || COMMITMENT_PLACEHOLDER,
      ``,
      `You will receive the full agreement to review before you are asked to sign anything. Beyond that, we expect you to maintain your certification and good standing, meet AMR's clinical and attendance standards, and practice within your scope under the direction of our medical director.`,
      ``,
      `QUESTIONS`,
      ``,
      `Reply to this email or contact me directly.`,
    ],
  }
}

function notSelected(): { subject: string; lines: string[] } {
  return {
    subject: 'AEMT Program — Selection Decision',
    lines: [
      `Thank you for putting your name forward for the AMR Kansas City AEMT Program, and for the time you gave to the intake form and the selection exam.`,
      ``,
      `This cohort had more qualified applicants than we have seats. After reviewing exam results, interviews, QA chart review and attendance records, I am sorry to tell you that you were not selected for this course.`,
      ``,
      `I want to be clear about what this is and is not. It is a decision about one cohort with a fixed number of seats. It is not a judgement on your work, and it carries no mark on your record or your standing with AMR.`,
      ``,
      `IF YOU WANT TO GO AGAIN`,
      ``,
      `  • We intend to run this course again. I would encourage you to apply.`,
      `  • I am glad to walk you through how you scored and what would strengthen a future application. Reply and we will find a time — this offer is genuine, not a formality.`,
      `  • Time as an FTO, preceptor, CE instructor or peer mentor is weighted in selection, and it is worth pursuing on its own merits.`,
      ``,
      `Thank you again for your interest, and for the work you do here.`,
    ],
  }
}

function accepted(d: Record<string, unknown>): { subject: string; lines: string[] } {
  const notes = tailoredNotes(d, true)
  return {
    subject: 'AEMT Program — You Have Been Selected',
    lines: [
      `Congratulations. You have been selected for the AMR Kansas City AEMT Program.`,
      ``,
      `This was a competitive cohort and you earned your seat on your exam, your interview and your record here. I am glad to have you in the course.`,
      ``,
      `PLEASE CONFIRM YOUR SEAT`,
      ``,
      `Reply to this email by ${COURSE_INFO.acceptBy} to accept. Seats are limited and an unconfirmed seat will be offered to the next candidate.`,
      ``,
      `KEY DATES`,
      ``,
      `  • Orientation: ${COURSE_INFO.orientation}`,
      `  • Course begins: ${COURSE_INFO.startDate}`,
      ``,
      PROGRAM_SHAPE,
      ``,
      ...(notes.length ? [...notes, ``] : []),
      `WHAT YOU ARE COMMITTING TO`,
      ``,
      `  • ${MIN_PASSING_PERCENT}% minimum to pass. Exams are 60% of your grade and quizzes/homework 40%; lab, clinical and field internship are satisfactory/unsatisfactory.`,
      `  • Attendance: missing more than ${MAX_ABSENT_HOURS} hours of scheduled class time fails the course. Build your schedule around this now.`,
      `  • Clinical and field shifts are 12 hours each and are scheduled IN ADDITION TO your regular work schedule.`,
      `  • You are responsible for documenting your own clinical minimums as you go: ${clinicalMinimums()}.`,
      ``,
      `THE SERVICE COMMITMENT AGREEMENT`,
      ``,
      `AMR is investing in your certification. In return, you will sign a service commitment agreement before the course begins.`,
      ``,
      SERVICE_COMMITMENT_TERMS.trim() || COMMITMENT_PLACEHOLDER,
      ``,
      `You will receive the full agreement to read before you are asked to sign it. Bring any questions to orientation — or ask me sooner.`,
      ``,
      `BEFORE THE FIRST CLASS`,
      ``,
      `  • Confirm your seat by replying to this email`,
      `  • Make sure your certification and required credentials are current in Ninth Brain`,
      `  • Talk to your supervisor about your schedule for the next 16 weeks`,
      ``,
      `Congratulations again. Reply with any questions.`,
    ],
  }
}

export function buildIntakeEmail(
  sub: IntakeSubmission,
  template: EmailTemplateId,
): GeneratedEmail {
  const d = sub.data
  const built =
    template === 'not-selected' ? notSelected() : template === 'accepted' ? accepted(d) : nextSteps(d)

  const body = [
    `Hi ${firstName(answerText(d.name))},`,
    ``,
    ...built.lines,
    ``,
    SENDER.name,
    SENDER.title,
    SENDER.contact,
  ].join('\n')

  // Anything still in brackets was never filled in. Surfacing all of them
  // beats checking for one known placeholder and shipping the rest.
  const unfilled = Array.from(new Set(body.match(/\[[^\]]+\]/g) ?? []))

  return { subject: built.subject, body, unfilled }
}
