import { useSyncExternalStore } from 'react'
import type {
  DocAttempt,
  DocCaseAttempt,
  DocCompletion,
  DocLearner,
  DocPracticalReview,
  DocReview,
  DocSignoff,
  DocTrack,
} from '../../types'
import { COURSE_VERSION } from '../../data/docAcademy/lessons'
import { getState, setState, useSelector } from '../../lib/store'
import { getSyncStatus, useSyncStatus } from '../../lib/sync'
import { uid } from '../../lib/id'

// ---------------------------------------------------------------------------
// Documentation Academy records, on the shared store.
//
// Everything here goes through lib/store, so it syncs to Supabase like every
// other record (see lib/records.ts and the 2026-10-26-1 migration). A signed-in
// FTO or new hire owns exactly one learner record — the one carrying their
// userId — and the server refuses anything else they try to write. An
// administrator, or a signed-out instructor install, can keep records for
// anyone, which is how a classroom session on one laptop works.
//
// The screens read a composed view, LearnerRecord: the learner's own row, their
// attempts, and the reviewer's row, joined by learner id.
// ---------------------------------------------------------------------------

export type Attempt = DocAttempt
export type CaseAttempt = DocCaseAttempt
export type PracticalReview = DocPracticalReview
export type Signoff = DocSignoff
export type CompletionRecord = DocCompletion

export interface LearnerRecord extends DocLearner {
  attempts: DocAttempt[]
  practical?: DocPracticalReview
  coachingApproved?: DocSignoff
  auditPlanApproved?: DocSignoff
  completion?: DocCompletion
}

function compose(l: DocLearner, attempts: DocAttempt[], reviews: DocReview[]): LearnerRecord {
  const r = reviews.find((x) => x.learnerId === l.id)
  return {
    ...l,
    attempts: attempts.filter((a) => a.learnerId === l.id).sort((a, b) => a.at.localeCompare(b.at)),
    practical: r?.practical,
    coachingApproved: r?.coachingApproved,
    auditPlanApproved: r?.auditPlanApproved,
    completion: r?.completion,
  }
}

// ----- which learner this device is working as ------------------------------
// A per-device choice, not a record, so it stays out of the synced store.

const ACTIVE_KEY = 'ces.docacademy.active'
let activeId: string | undefined
try {
  activeId = localStorage.getItem(ACTIVE_KEY) ?? undefined
} catch {
  activeId = undefined
}
const activeListeners = new Set<() => void>()

export function setActive(id: string | undefined) {
  activeId = id
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Still selected for this session.
  }
  activeListeners.forEach((l) => l())
}

function useActiveId(): string | undefined {
  return useSyncExternalStore(
    (cb) => {
      activeListeners.add(cb)
      return () => activeListeners.delete(cb)
    },
    () => activeId,
    () => activeId,
  )
}

/** A signed-in non-admin keeps only their own record; everyone else may keep many. */
export function selfOnly(): boolean {
  const s = getSyncStatus()
  return s.signedIn && s.role !== 'admin'
}

export function useAcademy(): { learners: LearnerRecord[]; activeId?: string } {
  const learners = useSelector((db) => db.docLearners)
  const attempts = useSelector((db) => db.docAttempts)
  const reviews = useSelector((db) => db.docReviews)
  const id = useActiveId()
  return { learners: learners.map((l) => compose(l, attempts, reviews)), activeId: id }
}

export function useActiveLearner(): LearnerRecord | undefined {
  const { learners, activeId: id } = useAcademy()
  const { signedIn, role, userId } = useSyncStatus()
  // A signed-in learner is always themselves, whatever the device last chose.
  if (signedIn && role !== 'admin') return learners.find((l) => l.userId === userId)
  return learners.find((l) => l.id === id)
}

// ----- writes ------------------------------------------------------------------

function updateLearner(id: string, fn: (l: DocLearner) => DocLearner) {
  setState((db) => ({ ...db, docLearners: db.docLearners.map((l) => (l.id === id ? fn(l) : l)) }))
}

function updateReview(learnerId: string, fn: (r: DocReview) => DocReview) {
  setState((db) => {
    const learner = db.docLearners.find((l) => l.id === learnerId)
    const existing = db.docReviews.find((r) => r.learnerId === learnerId)
    const base: DocReview = existing ?? { id: learnerId, learnerId, userId: learner?.userId }
    const next = fn(base)
    return {
      ...db,
      docReviews: existing ? db.docReviews.map((r) => (r === existing ? next : r)) : [...db.docReviews, next],
    }
  })
}

export function addLearner(name: string, track: DocTrack): string {
  const s = getSyncStatus()
  const own = selfOnly()
  if (own) {
    // One record per account: re-enrolling selects the one that exists.
    const mine = getState().docLearners.find((l) => l.userId === s.userId)
    if (mine) return mine.id
  }
  const l: DocLearner = {
    id: uid('dl'),
    userId: own ? s.userId : undefined,
    name: name.trim(),
    track,
    createdAt: new Date().toISOString(),
    lessonsDone: {},
    caseAttempts: [],
    drafts: {},
  }
  setState((db) => ({ ...db, docLearners: [...db.docLearners, l] }))
  setActive(l.id)
  return l.id
}

/** Administrators only — the server keeps a learner's rows from anyone else. */
export function removeLearner(id: string) {
  setState((db) => ({
    ...db,
    docLearners: db.docLearners.filter((l) => l.id !== id),
    docAttempts: db.docAttempts.filter((a) => a.learnerId !== id),
    docReviews: db.docReviews.filter((r) => r.learnerId !== id),
  }))
  if (activeId === id) setActive(undefined)
}

export function markLesson(id: string, lessonId: string, version: string, done: boolean) {
  updateLearner(id, (l) => {
    const lessonsDone = { ...l.lessonsDone }
    if (done) lessonsDone[lessonId] = { at: new Date().toISOString(), version }
    else delete lessonsDone[lessonId]
    return { ...l, lessonsDone }
  })
}

/** Idempotent by attempt id, so a double-submit or a replay cannot duplicate an attempt. */
export function recordAttempt(learnerId: string, a: Omit<DocAttempt, 'at' | 'courseVersion' | 'learnerId' | 'userId'>) {
  setState((db) => {
    if (db.docAttempts.some((x) => x.id === a.id)) return db
    const learner = db.docLearners.find((l) => l.id === learnerId)
    const row: DocAttempt = {
      ...a,
      learnerId,
      userId: learner?.userId,
      at: new Date().toISOString(),
      courseVersion: COURSE_VERSION,
    }
    return { ...db, docAttempts: [...db.docAttempts, row] }
  })
}

export function recordCaseAttempt(id: string, a: Omit<DocCaseAttempt, 'at' | 'courseVersion'>) {
  updateLearner(id, (l) =>
    l.caseAttempts.some((x) => x.id === a.id)
      ? l
      : { ...l, caseAttempts: [...l.caseAttempts, { ...a, at: new Date().toISOString(), courseVersion: COURSE_VERSION }] },
  )
}

export function saveDraft(id: string, caseId: string, text: string) {
  updateLearner(id, (l) => ({ ...l, drafts: { ...l.drafts, [caseId]: text } }))
}

export function savePractical(learnerId: string, p: Omit<DocPracticalReview, 'at' | 'courseVersion'>) {
  updateReview(learnerId, (r) => ({ ...r, practical: { ...p, at: new Date().toISOString(), courseVersion: COURSE_VERSION } }))
}

export function setSignoff(learnerId: string, which: 'coachingApproved' | 'auditPlanApproved', by: string | undefined) {
  updateReview(learnerId, (r) => ({ ...r, [which]: by?.trim() ? { by: by.trim(), at: new Date().toISOString() } : undefined }))
}

export function issueCompletion(learnerId: string, rec: Omit<DocCompletion, 'id' | 'courseVersion'>) {
  updateReview(learnerId, (r) => (r.completion ? r : { ...r, completion: { ...rec, id: uid('dc'), courseVersion: COURSE_VERSION } }))
}

export function latestExam(l: LearnerRecord, form: DocAttempt['form'] = 'A'): DocAttempt | undefined {
  return [...l.attempts].reverse().find((a) => a.form === form)
}

export function newAttemptId(): string {
  return uid('da')
}
