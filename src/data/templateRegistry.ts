import { registerBundled } from '../lib/templates'
import { AEMT_SKILL_SHEETS, SKILL_SCOPE } from './aemtSkills'
import { AEMT_FORMS } from './aemtForms'
import { SHEETS } from './checkoffSheets'
import type { DailyEvalTemplate, SkillSheetId } from '../types'

// ---------------------------------------------------------------------------
// Binds the definitions that ship with the app to the versioned registry.
//
// Imported once for its side effect (see main.tsx). Kept apart from
// lib/templates so that module stays generic — it versions and resolves a
// body and knows nothing about what a skill sheet is — and apart from the
// individual data modules so none of them has to depend on the store.
//
// Everything registered here is VERSION 0: the definition as shipped. An admin
// edit publishes version 1 on top; a record pinned to 0, or with no pin at all,
// still resolves to exactly what is written in these files.
// ---------------------------------------------------------------------------

const SCOPE_GROUP: Record<string, string> = {
  advanced: 'AEMT skills',
  bls: 'EMT level',
  paramedic: 'Above AEMT scope',
}

registerBundled(
  'aemt-skill',
  AEMT_SKILL_SHEETS.map((s) => ({
    templateId: s.id,
    body: s,
    label: s.title,
    group: SCOPE_GROUP[SKILL_SCOPE[s.id] ?? 'advanced'] ?? 'AEMT skills',
  })),
)

registerBundled(
  'aemt-form',
  AEMT_FORMS.map((f) => ({
    templateId: f.id,
    body: f,
    label: f.title,
    group:
      f.cadence === 'shift' ? 'Per shift' : f.cadence === 'course' ? 'End of course' : 'Ongoing',
  })),
)

/**
 * The NEOP check-off sheets.
 *
 * The whole SheetMeta is the body — label, icon, note and skills together —
 * because an operation editing a sheet may well want to change the reminder
 * printed on it, not only its skills.
 */
registerBundled(
  'neop-skill',
  (Object.keys(SHEETS) as SkillSheetId[]).map((id) => ({
    templateId: id,
    body: SHEETS[id],
    label: SHEETS[id].label,
    group: 'Academy check-off sheets',
  })),
)

/**
 * The FTO end-of-shift daily performance evaluation.
 *
 * This one had no data definition at all — its six rating categories were keys
 * on a TypeScript interface, so changing them was a schema change. The ids
 * below are exactly those keys, which is what lets every evaluation ever
 * recorded keep reading correctly against version 0.
 *
 * `strengths`, `improvements`, `truckWashed`, `spotter` and `readyIndependent`
 * are likewise the historical field names; DailyEval still stores those five in
 * their original columns, and anything an operation adds goes into the generic
 * maps beside them.
 */
export const NEOP_DAILY_EVAL_ID = 'neop-daily'

export const BUNDLED_DAILY_EVAL: DailyEvalTemplate = {
  id: NEOP_DAILY_EVAL_ID,
  title: 'Daily Performance Evaluation',
  categories: [
    { id: 'professionalism', label: 'Overall professionalism' },
    { id: 'teamwork', label: 'Teamwork & communication' },
    { id: 'patientCare', label: 'Patient care skills' },
    { id: 'driving', label: 'Vehicle driving' },
    { id: 'stretcher', label: 'Patient movement (stretcher handling)' },
    { id: 'pcr', label: 'PCR documentation' },
  ],
  checks: [
    { id: 'truckWashed', label: 'Truck washed & patient compartment cleaned at end of shift' },
    { id: 'spotter', label: 'Ambulance always backed with a spotter' },
  ],
  texts: [
    { id: 'strengths', label: 'Strengths' },
    { id: 'improvements', label: 'Areas to improve' },
  ],
  readinessLabel: 'Ready to work independently without an FTO',
}

registerBundled('neop-daily-eval', [
  {
    templateId: NEOP_DAILY_EVAL_ID,
    body: BUNDLED_DAILY_EVAL,
    label: BUNDLED_DAILY_EVAL.title,
    group: 'Field training',
  },
])
