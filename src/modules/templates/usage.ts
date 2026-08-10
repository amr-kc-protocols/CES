import { useMemo } from 'react'
import { useSelector } from '../../lib/store'
import type { TemplateKind } from '../../types'

// ---------------------------------------------------------------------------
// How much has already been assessed against an instrument.
//
// The editor needs this for two reasons. An admin about to change a sheet
// should be told how many records already point at it — "12 students, 3 of them
// signed off" is the difference between a free edit and a decision. And a
// custom instrument nothing has touched can simply be deleted, where one with
// records must be archived instead so those records still render.
// ---------------------------------------------------------------------------

export interface TemplateUsage {
  /** Records assessed against this instrument, any version. */
  records: number
  /** Of those, ones carrying a signature or sign-off. */
  signed: number
  /** Distinct pinned versions in use, oldest first. 0 = the bundled default. */
  versionsInUse: number[]
  /** Safe to delete outright rather than archive. */
  deletable: boolean
}

export function useTemplateUsage(kind: TemplateKind, templateId: string): TemplateUsage {
  const db = useSelector((d) => d)
  return useMemo(() => {
    let records = 0
    let signed = 0
    const versions = new Set<number>()

    const note = (v: number | undefined, isSigned: boolean) => {
      records++
      if (isSigned) signed++
      versions.add(v ?? 0)
    }

    if (kind === 'aemt-skill') {
      for (const c of db.aemtSkillChecks) {
        if (c.sheetId !== templateId) continue
        note(c.templateVersion, !!c.passedDate)
      }
    } else if (kind === 'aemt-form') {
      for (const r of db.aemtFormResponses) {
        if (r.formId !== templateId) continue
        note(r.templateVersion, false)
      }
    } else if (kind === 'neop-skill') {
      for (const c of db.skillChecks) {
        if (c.sheet !== templateId) continue
        note(c.templateVersion, !!c.evaluatorSignedAt)
      }
    } else {
      for (const e of db.dailyEvals) note(e.templateVersion, !!e.ftoInitialsAt)
    }

    return {
      records,
      signed,
      versionsInUse: [...versions].sort((a, b) => a - b),
      deletable: records === 0,
    }
  }, [db, kind, templateId])
}
