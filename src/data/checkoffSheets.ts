// ---------------------------------------------------------------------------
// Digital check-off sheets for the hands-on academy days, transcribed from the
// printable compliance documents (complianceDocs.ts) so the digital and paper
// versions stay in lockstep:
//   - Safe Stretcher Handling (GMR v3.2): pass / needs-practice per station.
//   - EVOC Track Skill Sheet: stations with observable items, checked off
//     step-by-step like the Linn medic sheet; a station passes when every
//     item is satisfactory.
// Together with the clinical sheets (skillSheets.ts) they form one registry;
// every sheet stores per-trainee as a SkillCheck record.
// ---------------------------------------------------------------------------

import type { OperationId, SkillSheetId, Trainee } from '../types'
import { activeMarket, type Market } from '../lib/market'
import { BLS_SKILLS, LINN_MEDIC_SKILLS, RSI_SKILLS, VENT_SKILLS, type SkillDef } from './skillSheets'

/** Safe Stretcher Handling v3.2 — stations flattened to one pass line each. */
export const STRETCHER_SKILLS: SkillDef[] = [
  { id: 'unload_antler', label: 'Unloading — Performance Load / Side Locking Bar (Antler)' },
  { id: 'unload_powerload', label: 'Unloading — PowerLoad™' },
  { id: 'slopes', label: 'Traversing slopes' },
  { id: 'moveable_hazards', label: 'Managing moveable hazards' },
  { id: 'immoveable_hazards', label: 'Traversing immoveable hazards' },
  { id: 'broken_surfaces', label: 'Traversing broken / uneven surfaces' },
  { id: 'flat_surfaces', label: 'Traversing flat / smooth surfaces' },
  { id: 'tight_turns', label: 'Navigating tight turns / pivot' },
  { id: 'stairchair_up', label: 'Stair chair — up' },
  { id: 'stairchair_down', label: 'Stair chair — down' },
  { id: 'stairchair_tread', label: 'Stair chair — StairTread™' },
  { id: 'tip_recovery', label: 'Stretcher tip recovery' },
  { id: 'rotating', label: 'Rotating / lateral movement' },
  { id: 'load_antler', label: 'Loading — Performance Load / Side Locking Bar (Antler)' },
  { id: 'load_powerload', label: 'Loading — PowerLoad™' },
]

/** EVOC track stations — the printable sheet's S/U items become steps. */
export const EVOC_TRACK_SKILLS: SkillDef[] = [
  {
    id: 'six_point',
    label: 'Six Point / Intersection',
    steps: ['Speed control', 'Braking', 'Steering (pivot/reference point)', 'Cone avoidance', 'Right turn forward', 'Left turn forward', 'Right turn backward', 'Left turn backward'],
  },
  {
    id: 't_box',
    label: 'T-Box',
    steps: ['Alignment (vehicle position)', 'Steering (stop and steer)', 'Backing (policy compliant)', 'Cone avoidance', 'Right turn backward', 'Good communication with spotter'],
  },
  { id: 'fwd_serpentine', label: 'Forward Serpentine', steps: ['Speed', 'Braking', 'Steering (pivot/reference point)', 'Cone avoidance'] },
  { id: 'rev_serpentine', label: 'Reverse Serpentine', steps: ['Speed', 'Braking', 'Steering (pivot/reference point)', 'Cone avoidance'] },
  { id: 'controlled_braking', label: 'Controlled Braking', steps: ['Speed', 'Reaction time', 'Braking', 'Lane changes', 'Cone avoidance'] },
  { id: 'safe_response', label: 'Safe Response to Directions', steps: ['Speed', 'Reaction time', 'Braking', 'Lane changes', 'Cone avoidance'] },
  { id: 'dragon', label: 'Dragon', steps: ['Speed', 'Steering (pivot/reference point)', "Follows spotter's directions", 'Cone avoidance'] },
  { id: 'diminishing_lane', label: 'Diminishing Lane', steps: ['Speed', 'Braking', 'Cone avoidance'] },
]

export interface SheetMeta {
  label: string
  /** Short label for chips on the trainee card. */
  short: string
  icon: string
  skills: SkillDef[]
  /** Reminder shown on the sheet (e.g. upload obligations from the paper form). */
  note?: string
}

export const SHEETS: Record<SkillSheetId, SheetMeta> = {
  // BLS applies to every hire; the ALS sheet to every paramedic. The
  // 'linn-medic' id is historical (it began Linn-only) and stays for the
  // sake of existing synced records.
  bls: { label: 'BLS clinical skills assessment', short: 'BLS', icon: '🩺', skills: BLS_SKILLS },
  'linn-medic': { label: 'ALS paramedic skill sheet', short: 'ALS', icon: '💉', skills: LINN_MEDIC_SKILLS },
  stretcher: {
    label: 'Safe stretcher handling (GMR v3.2)',
    short: 'Stretcher',
    icon: '🛏️',
    skills: STRETCHER_SKILLS,
    note: 'Passing every station attests competency per the GMR Safe Stretcher Handling Facilitator’s Guide. The signed paper form still uploads per AMR process.',
  },
  'evoc-track': {
    label: 'EVOC track skill sheet',
    short: 'EVOC track',
    icon: '🚗',
    skills: EVOC_TRACK_SKILLS,
    note: 'A station passes when every item is satisfactory. The EVOC certificate + track sheet still upload to Ninth Brain per the paper packet.',
  },
  rsi: {
    label: 'Rapid Sequence Intubation (RSI)',
    short: 'RSI',
    icon: '💨',
    skills: RSI_SKILLS,
    note: 'Linn County paramedics. Time-intensive — run as its own dedicated station, separate from the core ALS sheet.',
  },
  vent: {
    label: 'Ventilator Management (LTV 1200)',
    short: 'Vent',
    icon: '🫁',
    skills: VENT_SKILLS,
    note: 'KC / Cass paramedics. Time-intensive — run as its own dedicated station, separate from the core ALS sheet.',
  },
}

/**
 * A sheet's skills for one operation — RSI is Linn-only, ventilator
 * management is KC/Cass-only, everything else applies everywhere.
 */
export function skillsFor(sheet: SkillSheetId, operation: OperationId): SkillDef[] {
  return SHEETS[sheet].skills.filter((s) => !s.ops || s.ops.includes(operation))
}

/**
 * Does this market run the clinical skill sheets at all?
 *
 * Wichita does not. It runs no BLS sheet, no ALS sheet and no ventilator
 * sheet — its own skills checks are delivered in its NEOP week, split by
 * credential, and are not digitised here. Stretcher handling and the EVOC
 * track sheet are unaffected: both are corporate standards and both markets
 * run them.
 *
 * This is a decision about Wichita's programme rather than a gap. Leaving the
 * Kansas City sheets in place would put three forms in front of a Wichita
 * instructor that nobody agreed to fill in, and count them as outstanding work
 * on every trainee card.
 */
const CLINICAL_SHEETS_BY_MARKET: Record<Market, boolean> = { kc: true, wichita: false }

export const HAS_CLINICAL_SHEETS = CLINICAL_SHEETS_BY_MARKET[activeMarket()]

/**
 * The clinical sheets a trainee completes: BLS for every hire, the core ALS
 * sheet for every paramedic, plus the operation's advanced-airway sheet —
 * RSI for Linn County, Ventilator Management for KC/Cass.
 *
 * Empty in a market that does not run them.
 */
export function clinicalSheetsFor(t: Trainee): SkillSheetId[] {
  if (!HAS_CLINICAL_SHEETS) return []
  if (t.credential !== 'paramedic') return ['bls']
  return ['bls', 'linn-medic', t.operation === 'linn' ? 'rsi' : 'vent']
}

/**
 * Sheets that run in every market: both are corporate standards delivered
 * against the same materials wherever the truck is.
 */
const UNIVERSAL_SHEETS: SkillSheetId[] = ['stretcher', 'evoc-track']

/**
 * Every sheet this trainee may open — the clinical ones their market and
 * credential call for, plus the corporate standards.
 *
 * Views use this to refuse a sheet rather than trusting the URL. Without it a
 * deep link to `/skills/:id/bls` renders a Kansas City form in Wichita, and so
 * does a typo: the sheet param falls back to `bls` when it is unrecognised.
 */
export function sheetsForTrainee(t: Trainee): SkillSheetId[] {
  return [...clinicalSheetsFor(t), ...UNIVERSAL_SHEETS]
}

/** Academy sessions that carry a class-day digital check-off. */
const CHECKOFFS_BY_MARKET: Record<Market, Record<string, SkillSheetId[]>> = {
  kc: {
    p1s3: ['evoc-track'], // EVOC Road Course day
    // Stretcher day doubles as the BLS equipment check-off — every hire,
    // every operation. The ALS sheet is separate, done during FTO time.
    p1s5: ['stretcher', 'bls'],
  },
  // Wichita's stretcher day carries the stretcher check-off only; the BLS
  // equipment check-off that fills Kansas City's afternoon is not run there.
  wichita: {
    p1s3: ['evoc-track'],
    p1s5: ['stretcher'],
  },
}

export const SESSION_CHECKOFFS: Record<string, SkillSheetId[]> =
  CHECKOFFS_BY_MARKET[activeMarket()]
