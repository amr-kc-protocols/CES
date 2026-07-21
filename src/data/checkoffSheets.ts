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

import type { SkillSheetId } from '../types'
import { BLS_SKILLS, LINN_MEDIC_SKILLS, type SkillDef } from './skillSheets'

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
  bls: { label: 'BLS clinical skills assessment', short: 'Clinical', icon: '🩺', skills: BLS_SKILLS },
  'linn-medic': { label: 'Linn County paramedic skill sheet', short: 'Clinical', icon: '🩺', skills: LINN_MEDIC_SKILLS },
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
}

/** Academy sessions that carry a class-day digital check-off. */
export const SESSION_CHECKOFFS: Record<string, SkillSheetId[]> = {
  p1s3: ['evoc-track'], // EVOC Road Course day
  // Stretcher day doubles as the BLS equipment check-off — both sheets run.
  // 'bls' resolves per trainee on the class page (Linn medics get their own
  // clinical sheet).
  p1s5: ['stretcher', 'bls'],
}
