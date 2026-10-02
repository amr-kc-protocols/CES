import type { NeopProgram } from '../../../types'

/** What every setup step is handed: the draft, a way to change it, and what is already in use. */
export interface StepProps {
  draft: NeopProgram
  update: (fn: (p: NeopProgram) => NeopProgram) => void
  /**
   * Ids that existing records already point at. A step can still remove one —
   * nothing breaks — but it says so, because "why did this hire's station turn
   * into a code" is a worse question to get later than a note now.
   */
  inUse: { locations: Set<string>; checklist: Set<string> }
}
