import { useSyncExternalStore } from 'react'
import type { Track } from '../../data/docAcademy/types'
import { COURSE_VERSION } from '../../data/docAcademy/lessons'
import type { Answers, DomainScore, PracticalInput } from './scoring'
import type { RubricDomainId } from '../../data/docAcademy/types'
import { uid } from '../../lib/id'

// ---------------------------------------------------------------------------
// Pilot persistence for the Documentation Academy: this device only.
//
// The brief is explicit that a local-only prototype may save device progress
// but must say so, and cannot promise shared dashboards or durable completion
// records. So this is its own localStorage key, deliberately outside the
// synced store — and every screen that shows a result says where it lives.
// Moving to server-authoritative records is the step after the pilot.
//
// Only staff names, answers and synthetic-case work are kept here. No patient
// information, ever: the narrative workspace refuses text that looks like an
// identifier before it is saved.
// ---------------------------------------------------------------------------

const KEY = 'ces.docacademy.v1'

export interface Attempt {
  id: string
  form: 'baseline' | 'A'
  at: string
  courseVersion: string
  answers: Answers
  correct: number
  total: number
  pct: number
  passed: boolean
}

export interface CaseAttempt {
  id: string
  caseId: string
  at: string
  courseVersion: string
  picked: string[]
  insufficient: boolean
}

export interface Signoff {
  by: string
  at: string
}

export interface PracticalReview {
  caseId: string
  reviewer: string
  at: string
  courseVersion: string
  scores: Partial<Record<RubricDomainId, DomainScore>>
  naJustification: PracticalInput['naJustification']
  criticalErrors: PracticalInput['criticalErrors']
  feedback: string
}

export interface CompletionRecord {
  id: string
  learner: string
  track: Track
  courseVersion: string
  examPct: number
  practicalPct: number
  reviewer: string
  date: string
  instructionalMinutes: number
}

export interface LearnerRecord {
  id: string
  name: string
  track: Track
  createdAt: string
  lessonsDone: Record<string, { at: string; version: string }>
  attempts: Attempt[]
  caseAttempts: CaseAttempt[]
  drafts: Record<string, string>
  practical?: PracticalReview
  coachingApproved?: Signoff
  auditPlanApproved?: Signoff
  /** Never rewritten once issued; a later course version gets an update module instead. */
  completion?: CompletionRecord
}

interface Shape {
  learners: LearnerRecord[]
  activeId?: string
}

function read(): Shape {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Shape
  } catch {
    // Private window or blocked storage: run without persistence.
  }
  return { learners: [] }
}

let state: Shape = read()
const listeners = new Set<() => void>()

function commit(next: Shape) {
  state = next
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Still usable for this session.
  }
  listeners.forEach((l) => l())
}

export function getAcademy(): Shape {
  return state
}

export function useAcademy(): Shape {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => state,
  )
}

export function useActiveLearner(): LearnerRecord | undefined {
  const s = useAcademy()
  return s.learners.find((l) => l.id === s.activeId)
}

function update(id: string, fn: (l: LearnerRecord) => LearnerRecord) {
  commit({ ...state, learners: state.learners.map((l) => (l.id === id ? fn(l) : l)) })
}

export function addLearner(name: string, track: Track): string {
  const l: LearnerRecord = {
    id: uid('dl'),
    name: name.trim(),
    track,
    createdAt: new Date().toISOString(),
    lessonsDone: {},
    attempts: [],
    caseAttempts: [],
    drafts: {},
  }
  commit({ learners: [...state.learners, l], activeId: l.id })
  return l.id
}

export function setActive(id: string | undefined) {
  commit({ ...state, activeId: id })
}

export function removeLearner(id: string) {
  commit({ learners: state.learners.filter((l) => l.id !== id), activeId: state.activeId === id ? undefined : state.activeId })
}

export function markLesson(id: string, lessonId: string, version: string, done: boolean) {
  update(id, (l) => {
    const lessonsDone = { ...l.lessonsDone }
    if (done) lessonsDone[lessonId] = { at: new Date().toISOString(), version }
    else delete lessonsDone[lessonId]
    return { ...l, lessonsDone }
  })
}

/** Idempotent by attempt id, so a double-submit or a replay cannot duplicate an attempt. */
export function recordAttempt(id: string, a: Omit<Attempt, 'at' | 'courseVersion'>) {
  update(id, (l) =>
    l.attempts.some((x) => x.id === a.id)
      ? l
      : { ...l, attempts: [...l.attempts, { ...a, at: new Date().toISOString(), courseVersion: COURSE_VERSION }] },
  )
}

export function recordCaseAttempt(id: string, a: Omit<CaseAttempt, 'at' | 'courseVersion'>) {
  update(id, (l) =>
    l.caseAttempts.some((x) => x.id === a.id)
      ? l
      : { ...l, caseAttempts: [...l.caseAttempts, { ...a, at: new Date().toISOString(), courseVersion: COURSE_VERSION }] },
  )
}

export function saveDraft(id: string, caseId: string, text: string) {
  update(id, (l) => ({ ...l, drafts: { ...l.drafts, [caseId]: text } }))
}

export function savePractical(id: string, p: Omit<PracticalReview, 'at' | 'courseVersion'>) {
  update(id, (l) => ({ ...l, practical: { ...p, at: new Date().toISOString(), courseVersion: COURSE_VERSION } }))
}

export function setSignoff(id: string, which: 'coachingApproved' | 'auditPlanApproved', by: string | undefined) {
  update(id, (l) => ({ ...l, [which]: by?.trim() ? { by: by.trim(), at: new Date().toISOString() } : undefined }))
}

export function issueCompletion(id: string, rec: Omit<CompletionRecord, 'id' | 'courseVersion'>) {
  update(id, (l) => (l.completion ? l : { ...l, completion: { ...rec, id: uid('dc'), courseVersion: COURSE_VERSION } }))
}

export function latestExam(l: LearnerRecord, form: Attempt['form'] = 'A'): Attempt | undefined {
  return [...l.attempts].reverse().find((a) => a.form === form)
}

export function newAttemptId(): string {
  return uid('da')
}
