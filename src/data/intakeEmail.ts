// ---------------------------------------------------------------------------
// The candidate email, generated from a candidate's own intake answers.
//
// Every program figure is IMPORTED from data/aemt.ts rather than retyped, so
// the hours, the pass mark and the clinical minimums quoted to a candidate are
// the same ones the program is run against. A number that drifts between the
// email and the course is a number somebody was told wrong.
// ---------------------------------------------------------------------------

import {
  CLINICAL_REQUIREMENTS,
  KC_HOUR_TARGETS,
  KC_TOTAL_TARGET,
  MAX_ABSENT_HOURS,
  MIN_PASSING_PERCENT,
} from './aemt'
import { EXAM_DEADLINE, EXAM_LIMIT_MINUTES } from '../lib/exam'
import { answerText, type IntakeSubmission } from '../lib/intake'

/**
 * The service commitment terms.
 *
 * DELIBERATELY EMPTY. This is a contractual obligation — how long a candidate
 * commits to AMR after certification, and what happens if they leave early —
 * and it is not written down anywhere in this codebase. Inventing plausible
 * terms and emailing them to staff would be worse than leaving a gap, so the
 * generator emits a visible placeholder and the UI refuses to pretend the
 * email is finished until this is filled in.
 *
 * Fill it in with the wording HR approves, then it appears in every email.
 */
export const SERVICE_COMMITMENT_TERMS = ''

export const COMMITMENT_PLACEHOLDER =
  '[INSERT SERVICE COMMITMENT TERMS — length of commitment following certification, and what applies if employment ends before it is met.]'

/** Who the email comes from. */
export const SENDER = {
  name: 'Jordan Jones',
  title: 'Clinical Educator, AMR Kansas City',
  contact: '[phone] · [email]',
}

export const EXAM_URL = 'https://ces-nu.vercel.app/exam'

function firstName(full: string): string {
  const n = full.trim().split(/\s+/)[0]
  return n && n !== '—' ? n : 'there'
}

/** Sentence(s) that exist only because of what this candidate told us. */
function tailoredNotes(d: Record<string, unknown>): string[] {
  const out: string[] = []

  const otherJob = answerText(d.otherJob) === 'Yes'
  const hours = answerText(d.otherJobHours)
  const inSchool = answerText(d.inSchool) === 'Yes'
  const school = answerText(d.schoolDetails)

  // The single biggest reason people fail out is the clinical/field load
  // landing on top of commitments they already had. Name theirs specifically.
  if (otherJob && inSchool) {
    out.push(
      `You told us you work outside AMR${hours !== '—' ? ` (about ${hours} a week)` : ''} and are currently in school${school !== '—' ? ` — ${school}` : ''}. Please look carefully at the clinical and field shifts below before you commit: they are 12 hours each and are scheduled on top of your regular work schedule.`,
    )
  } else if (otherJob) {
    out.push(
      `You told us you work another job outside AMR${hours !== '—' ? ` (about ${hours} a week)` : ''}. Please look carefully at the clinical and field shifts below before you commit: they are 12 hours each and are scheduled on top of your regular work schedule.`,
    )
  } else if (inSchool) {
    out.push(
      `You told us you are currently enrolled in school${school !== '—' ? ` — ${school}` : ''}. Please look carefully at the class and clinical schedule below and make sure it can sit alongside your coursework.`,
    )
  }

  const conflicts = answerText(d.conflicts)
  if (conflicts !== '—') {
    out.push(
      `You noted these known conflicts: "${conflicts}". Bring these up at the interview — we would rather plan around them now than discover them mid-course.`,
    )
  }

  const commit = answerText(d.canCommit)
  if (commit === 'Not sure yet') {
    out.push(
      `On the intake form you said you were not yet sure whether you could commit the time. That is a fair answer, and it is exactly what the detail below is for — read it, then decide. Nobody is served by starting a 16-week course that cannot be finished.`,
    )
  }

  return out
}

function hoursTable(): string {
  return KC_HOUR_TARGETS.map(
    (t) => `  • ${t.label} — ${t.hours} hours${t.note ? ` (${t.note})` : ''}`,
  ).join('\n')
}

function clinicalMinimums(): string {
  return CLINICAL_REQUIREMENTS.map((r) => {
    const sub = r.subRequirement
      ? ` (including ${r.subRequirement.minimum} ${r.subRequirement.label})`
      : ''
    return `${r.minimum} ${r.label.toLowerCase()}${sub}`
  }).join(', ')
}

export interface GeneratedEmail {
  subject: string
  body: string
  /** True when the commitment terms are still a placeholder. */
  needsCommitmentTerms: boolean
}

export function buildIntakeEmail(sub: IntakeSubmission): GeneratedEmail {
  const d = sub.data
  const name = answerText(d.name)
  const notes = tailoredNotes(d)
  const commitment = SERVICE_COMMITMENT_TERMS.trim() || COMMITMENT_PLACEHOLDER

  const body = [
    `Hi ${firstName(name)},`,
    ``,
    `Thank you for submitting your interest in the AMR Kansas City AEMT Program. This email covers three things: your next step, an overview of the program, and the expectations that come with a seat in it. Please read it in full before you take the exam.`,
    ``,
    ...(notes.length ? [...notes, ``] : []),
    `YOUR NEXT STEP — THE SELECTION EXAM`,
    ``,
    `${EXAM_URL}`,
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
    `The AEMT course is a Kansas-approved (KBEMS) certification program — 16 weeks, approximately ${KC_TOTAL_TARGET} hours:`,
    ``,
    hoursTable(),
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
    commitment,
    ``,
    `You will receive the full agreement to review before you are asked to sign anything. Beyond that, we expect you to maintain your certification and good standing, meet AMR's clinical and attendance standards, and practice within your scope under the direction of our medical director.`,
    ``,
    `QUESTIONS`,
    ``,
    `Reply to this email or contact me directly.`,
    ``,
    SENDER.name,
    SENDER.title,
    SENDER.contact,
  ].join('\n')

  return {
    subject: `AEMT Program — Your Next Step (Selection Exam) & What to Expect`,
    body,
    needsCommitmentTerms: !SERVICE_COMMITMENT_TERMS.trim(),
  }
}
