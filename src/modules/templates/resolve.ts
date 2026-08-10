import { useMemo } from 'react'
import { getState } from '../../lib/store'
import {
  activeTemplateIds,
  bundledTemplates,
  currentVersionNumber,
  resolveAt,
  resolveCurrent,
  useTemplates,
} from '../../lib/templates'
import { SKILL_SCOPE } from '../../data/aemtSkills'
import { BUNDLED_DAILY_EVAL, NEOP_DAILY_EVAL_ID } from '../../data/templateRegistry'
import type { AemtSkillSheet } from '../../data/aemtSkills'
import type { AemtFormDef } from '../../data/aemtForms'
import type { SkillDef } from '../../data/skillSheets'
import type { DailyEvalTemplate, OperationId, SkillSheetId, TemplateKind } from '../../types'

// ---------------------------------------------------------------------------
// Typed access to whichever version of an instrument is in force.
//
// Every surface that renders a sheet or form goes through here rather than
// reading src/data directly, so an admin edit reaches the whole app. Two
// distinct questions, and confusing them is how a record comes to say something
// it did not:
//
//   liveX()  — what to ASSESS against now. The published version, else bundled.
//   xAtVersion() — what a RECORD was assessed against. Pinned, never current.
// ---------------------------------------------------------------------------

// ----- AEMT skill sheets -------------------------------------------------------

export function liveSkillSheet(id: string): AemtSkillSheet | undefined {
  return resolveCurrent<AemtSkillSheet>('aemt-skill', id)
}

export function skillSheetAtVersion(
  id: string,
  version: number | undefined,
): { sheet?: AemtSkillSheet; exact: boolean } {
  const r = resolveAt<AemtSkillSheet>('aemt-skill', id, version)
  return { sheet: r.body, exact: r.exact }
}

/**
 * Scope for a sheet. Custom sheets have no entry in the bundled scope table;
 * they are treated as advanced, because an operation that authored a sheet for
 * its AEMT course means it to appear there.
 */
function scopeOf(id: string): string {
  return SKILL_SCOPE[id] ?? 'advanced'
}

/**
 * The advanced sheets for one course: the common set, plus only the monitor
 * that operation runs. Hidden sheets are excluded; custom ones are included.
 */
export function useSheetsForCourse(monitorSheetId: string | undefined): AemtSkillSheet[] {
  const all = useTemplates()
  return useMemo(() => {
    return activeTemplateIds('aemt-skill')
      .filter((id) => scopeOf(id) === 'advanced')
      .map((id) => resolveCurrent<AemtSkillSheet>('aemt-skill', id))
      .filter((s): s is AemtSkillSheet => !!s)
      .filter((s) => s.equipmentGroup !== 'monitor' || s.id === monitorSheetId)
    // `all` is the dependency that makes this recompute after an edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, monitorSheetId])
}

/** Monitor sheets for the course-setup picker, current wording. */
export function useMonitorSheets(): AemtSkillSheet[] {
  const all = useTemplates()
  return useMemo(() => {
    return activeTemplateIds('aemt-skill')
      .map((id) => resolveCurrent<AemtSkillSheet>('aemt-skill', id))
      .filter((s): s is AemtSkillSheet => !!s && s.equipmentGroup === 'monitor')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all])
}

/** Sheets excluded from the AEMT course, by scope — for the "what was left out" note. */
export function useSheetsByScope(scope: string): AemtSkillSheet[] {
  const all = useTemplates()
  return useMemo(() => {
    return activeTemplateIds('aemt-skill')
      .filter((id) => scopeOf(id) === scope)
      .map((id) => resolveCurrent<AemtSkillSheet>('aemt-skill', id))
      .filter((s): s is AemtSkillSheet => !!s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, scope])
}

// ----- AEMT evaluation forms ---------------------------------------------------

export function liveAemtForm(id: string): AemtFormDef | undefined {
  return resolveCurrent<AemtFormDef>('aemt-form', id)
}

export function aemtFormAtVersion(
  id: string,
  version: number | undefined,
): { form?: AemtFormDef; exact: boolean } {
  const r = resolveAt<AemtFormDef>('aemt-form', id, version)
  return { form: r.body, exact: r.exact }
}

export function useAemtForms(): AemtFormDef[] {
  const all = useTemplates()
  return useMemo(() => {
    return activeTemplateIds('aemt-form')
      .map((id) => resolveCurrent<AemtFormDef>('aemt-form', id))
      .filter((f): f is AemtFormDef => !!f)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all])
}

// ----- NEOP check-off sheets ---------------------------------------------------

export interface NeopSheetMeta {
  label: string
  short: string
  icon: string
  note?: string
  skills: SkillDef[]
}

export function liveNeopSheet(id: SkillSheetId): NeopSheetMeta | undefined {
  return resolveCurrent<NeopSheetMeta>('neop-skill', id)
}

/**
 * Always returns something renderable. A sheet id can outlive its definition —
 * a custom sheet deleted while a record still names it — and a screen that
 * renders nothing at all is worse than one that says the sheet is missing.
 */
export function neopSheetMeta(id: SkillSheetId): NeopSheetMeta {
  return (
    resolveCurrent<NeopSheetMeta>('neop-skill', id) ?? {
      label: `Unknown sheet (${id})`,
      short: String(id),
      icon: '❓',
      skills: [],
    }
  )
}

export function neopSheetAtVersion(
  id: SkillSheetId,
  version: number | undefined,
): { sheet?: NeopSheetMeta; exact: boolean } {
  const r = resolveAt<NeopSheetMeta>('neop-skill', id, version)
  return { sheet: r.body, exact: r.exact }
}

/** A sheet's skills for one operation, at whichever version applies. */
export function neopSkillsFor(
  id: SkillSheetId,
  operation: OperationId,
  version?: number,
): SkillDef[] {
  const sheet = version === undefined ? liveNeopSheet(id) : neopSheetAtVersion(id, version).sheet
  return (sheet?.skills ?? []).filter((s) => !s.ops || (s.ops as string[]).includes(operation))
}

// ----- NEOP daily evaluation ---------------------------------------------------

export function liveDailyEvalTemplate(): DailyEvalTemplate {
  return resolveCurrent<DailyEvalTemplate>('neop-daily-eval', NEOP_DAILY_EVAL_ID) ?? BUNDLED_DAILY_EVAL
}

export function dailyEvalTemplateAtVersion(version: number | undefined): {
  template: DailyEvalTemplate
  exact: boolean
} {
  const r = resolveAt<DailyEvalTemplate>('neop-daily-eval', NEOP_DAILY_EVAL_ID, version)
  return { template: r.body ?? BUNDLED_DAILY_EVAL, exact: r.exact }
}

export function useDailyEvalTemplate(): DailyEvalTemplate {
  const all = useTemplates()
  return useMemo(
    () =>
      resolveCurrent<DailyEvalTemplate>('neop-daily-eval', NEOP_DAILY_EVAL_ID) ?? BUNDLED_DAILY_EVAL,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all],
  )
}

// ----- version pinning ---------------------------------------------------------

/**
 * The version a new assessment against this instrument must be pinned to.
 *
 * Deliberately not a hook: it is read at the moment of writing, so a record
 * pins the version that was in force when it was assessed rather than whatever
 * the screen last rendered.
 */
export function versionToPin(kind: TemplateKind, templateId: string): number {
  return currentVersionNumber(getState().templates, kind, templateId)
}

/** Ids that still have a bundled definition, for "as shipped" labelling. */
export function isBundledTemplate(kind: TemplateKind, templateId: string): boolean {
  return bundledTemplates(kind).some((b) => b.templateId === templateId)
}
