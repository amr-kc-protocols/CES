// ---------------------------------------------------------------------------
// Build a retained program document inside the app.
//
// The four documents K.A.R. 109-17-3 keeps as documents — the syllabus, the
// curriculum and lesson plans, the clinical and field objectives, the policy
// manual — used to be producible only by someone with the repository and Node
// on their machine. The Records tab told a Program Manager to "run
// npm run doc:syllabus", which is not a thing a Program Manager can do, so in
// practice the documents existed wherever somebody had last saved a copy.
//
// They are built here now, from the same block trees the .docx generators
// render. Pressing Build produces the document, stores it as the retained
// record, and dates it — which is what closes the loop with filedStatus(): CES
// knows when the copy was produced and when the course record last changed, so
// nobody has to remember whether the copy on file still describes the course.
// ---------------------------------------------------------------------------

import { docHtml } from '../../lib/docHtml'
import type { Block } from '../../lib/docBlocks'
import {
  CURRICULUM_TITLE,
  OBJECTIVES_TITLE,
  POLICIES_TITLE,
  SYLLABUS_TITLE,
  curriculumBlocks,
  objectivesBlocks,
  policiesBlocks,
  syllabusBlocks,
} from '../../data/programDocs'

export interface ProgramDocBuilder {
  /** The npm script that produces the identical .docx, named on the page. */
  command: string
  title: string
  blocks: () => Block[]
}

/** Keyed by the REQUIRED_RECORDS id, so the Records tab can look one up. */
export const DOC_BUILDERS: Record<string, ProgramDocBuilder> = {
  syllabus: { command: 'npm run doc:syllabus', title: SYLLABUS_TITLE, blocks: syllabusBlocks },
  curriculum: { command: 'npm run doc:curriculum', title: CURRICULUM_TITLE, blocks: curriculumBlocks },
  objectives: { command: 'npm run doc:objectives', title: OBJECTIVES_TITLE, blocks: objectivesBlocks },
  policies: { command: 'npm run doc:policies', title: POLICIES_TITLE, blocks: policiesBlocks },
}

export interface BuiltDoc {
  title: string
  html: string
  blocks: number
}

export function buildProgramDoc(recordId: string): BuiltDoc | undefined {
  const b = DOC_BUILDERS[recordId]
  if (!b) return undefined
  const blocks = b.blocks()
  return { title: b.title, html: docHtml(b.title, blocks), blocks: blocks.length }
}

/**
 * A fingerprint of the document as issued.
 *
 * The same thing the audit package does for the evidence bundle, and for the
 * same reason: a retained copy that cannot be checked against anything is a
 * file, not a record. Two copies with the same fingerprint are the same
 * document, which is how "is the copy the board has the copy we kept" becomes
 * a question with an answer.
 */
export async function docFingerprint(html: string): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null
  const bytes = new TextEncoder().encode(html)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
