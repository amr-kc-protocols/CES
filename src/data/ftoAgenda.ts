// ---------------------------------------------------------------------------
// FTO orientation agenda — Wichita.
//
// Transcribed from FTO_AgendaRed_Track.docx and FTO_AgendaGreen_Track.docx.
//
// This is a DIFFERENT ARTIFACT from Kansas City's Field Training Objectives
// Page (`ftObjectives.ts`), not a Wichita edition of it. KC's page is a
// cumulative competency tracker: sections A–G, each objective carrying a
// target like "5x" or "1+", marked off across six ride-alongs in any order.
// Wichita's is a day-by-day agenda: a fixed sequence of shifts, each with its
// own checklist, its own FTO guidance, and a comments box, ending in a
// release-or-remediate recommendation.
//
// Forcing one into the other would lose what makes each useful — the target
// counts on KC's side, the day ordering and the two tracks on Wichita's.
//
// TWO TRACKS. Red runs six days, Green runs nine. The extra three days in
// Green are all in the front half: a second Driving Only day and a second
// Driving/Beginning Patient Care day, so a Green orientee spends five shifts
// before taking primary patient care where a Red orientee spends three.
//
// Which track a hire gets is ASSIGNED, not inferred. Nothing in the source
// documents says what decides it, and guessing — from credential, from years
// of experience — would put a new hire on the wrong length of orientation.
// The FTO or manager picks, and the pick is recorded with who made it.
// ---------------------------------------------------------------------------

import { activeMarket, type Market } from '../lib/market'

export type FtoTrackId = 'red' | 'green'

export interface AgendaItem {
  /** Stable id — marks are stored against this, so it must not change. */
  id: string
  text: string
  /** The indented sub-list under an item, e.g. the steps of a call. */
  sub?: string[]
}

export interface AgendaDay {
  /** 1-based day number within the track. */
  day: number
  title: string
  /**
   * The "FTO:" guidance printed immediately before this day in the source.
   * It reads as instruction to the FTO for the day it precedes, so it is
   * attached to that day rather than to the one it follows on the page.
   */
  ftoNote?: string
  items: AgendaItem[]
  /** The five write-in lines for skills reviewed. Absent on the final day. */
  skillsPractice?: boolean
}

export interface AgendaTrack {
  id: FtoTrackId
  label: string
  /** Days in the track, used everywhere a length is shown. */
  length: number
  days: AgendaDay[]
}

/** Shown to the orientee at the top of the agenda, verbatim from the source. */
export const AGENDA_ORIENTEE_NOTE =
  'Please complete the following. Deviation from the schedule, including increasing or ' +
  'decreasing the number of orientation days, is permissible at the discretion of the FTO.'

/** The two boxes at the foot of the agenda. Exactly one gets picked. */
export const AGENDA_RECOMMENDATIONS = [
  { id: 'remediate', text: 'Requires remediation/additional orientation' },
  { id: 'release', text: 'Release from orientation' },
] as const

export type AgendaRecommendationId = (typeof AGENDA_RECOMMENDATIONS)[number]['id']

/* ------------------------------------------------------------ shared text */
/* Several days repeat the same checklist verbatim across both tracks. These
 * are defined once so a correction lands everywhere it should — but the item
 * IDS are per-day, because a mark on Day 4 is not a mark on Day 7. */

const CALL_DUTIES = [
  'Obtain paperwork/PCS',
  'Interactions with staff/patients',
  'Patient assessment',
  'Treatment and monitoring/reassessment',
  'Hand-off report',
  'Obtain signatures',
  'Reset/restock',
]

/** The FTO guidance that introduces each stage, verbatim from the source. */
const NOTE_DRIVING =
  'If no FTO/EVOC instructor is available to monitor the orientee during vehicle operation, ' +
  'the orientee should observe/assist the FTO with patient care throughout transport.'
// Verbatim from both source documents, including the sentence ending at
// "patient." — the word "care" is missing in Cassie's original. Transcribed
// as written rather than silently corrected; it is her document to fix.
const NOTE_BEGIN_CARE =
  'When the FTO feels the orientee is proficient in vehicle operation, the orientee may ' +
  'begin performing patient.'
const NOTE_REVIEW_CHARTS =
  'Please review all charts written by the orientee and provide guidance/feedback, as needed.'
const NOTE_LITTLE_ASSISTANCE =
  'Orientee should be performing duties of the primary care provider and completing charts ' +
  'with little assistance.'
const NOTE_FINAL_ASSESSMENT =
  'Assess the orientee’s knowledge of operations and procedures, daily duties, location of ' +
  'equipment and medications, protocols, and skills. Ensure the orientee can run a call ' +
  'independently from start to finish. Consider extending orientation for orientees who do ' +
  'not demonstrate proficiency or are unable to navigate calls independently.'

/** Day 1 is identical in both tracks. */
function observationDay(): AgendaDay {
  return {
    day: 1,
    title: 'Observation only',
    items: [
      { id: 'd1-vehicle', text: 'Introduction to vehicle, supplies, and equipment' },
      { id: 'd1-narcbox', text: 'Access narcotics boxes' },
      { id: 'd1-pstrax', text: 'Log in to PSTrax' },
      { id: 'd1-imagetrend', text: 'Log in to Image Trend' },
      { id: 'd1-hospitals', text: 'Tour hospitals' },
      { id: 'd1-station', text: 'Review station duties/daily expectations' },
      { id: 'd1-restock', text: 'Demonstrate process of narcotics restock' },
      { id: 'd1-observe', text: 'Observe calls:', sub: CALL_DUTIES },
      { id: 'd1-charting', text: 'Demonstrate proper charting technique and review DCHARTE format' },
    ],
    skillsPractice: true,
  }
}

/** The first Driving Only day — identical in both tracks. */
function firstDrivingDay(day: number): AgendaDay {
  return {
    day,
    title: 'Driving only',
    ftoNote: NOTE_DRIVING,
    items: [
      { id: `d${day}-layout`, text: 'Familiarization with truck layout and equipment/medications' },
      { id: `d${day}-pstrax`, text: 'Complete PSTrax for truck and narcotics' },
      { id: `d${day}-zoll`, text: 'Log in to Zoll Respond' },
      { id: `d${day}-restock`, text: 'Review process of narcotics restock' },
      { id: `d${day}-driving`, text: 'Vehicle operations/driving practice' },
      { id: `d${day}-navigate`, text: 'Navigate to hospitals' },
      { id: `d${day}-radio`, text: 'Introduce radio traffic' },
      { id: `d${day}-charts`, text: 'Review charts written by primary provider' },
      { id: `d${day}-ppp`, text: 'PPP Agency: protocol and medication familiarization' },
      { id: `d${day}-secondary`, text: 'Introduce expectations of the secondary provider during a call' },
    ],
    skillsPractice: true,
  }
}

/** Green track only: a second Driving Only day, with "review" wording. */
function repeatDrivingDay(day: number): AgendaDay {
  return {
    day,
    title: 'Driving only',
    items: [
      { id: `d${day}-layout`, text: 'Review truck layout and locate equipment/medications' },
      { id: `d${day}-pstrax`, text: 'Complete PSTrax for truck and narcotics' },
      { id: `d${day}-zoll`, text: 'Log in to Zoll Respond' },
      { id: `d${day}-driving`, text: 'Vehicle operations/driving practice' },
      { id: `d${day}-navigate`, text: 'Navigate to hospitals' },
      { id: `d${day}-radio`, text: 'Review radio traffic' },
      { id: `d${day}-charts`, text: 'Review charts written by primary provider' },
      { id: `d${day}-ppp`, text: 'PPP Agency: protocol and medication familiarization' },
      { id: `d${day}-secondary`, text: 'Review expectations of the secondary provider during a call' },
    ],
    skillsPractice: true,
  }
}

function beginningCareDay(day: number, ftoNote?: string): AgendaDay {
  return {
    day,
    title: 'Driving / beginning patient care',
    ftoNote,
    items: [
      { id: `d${day}-layout`, text: 'Review truck layout and locate equipment/medications' },
      { id: `d${day}-pstrax`, text: 'Complete PSTrax for truck and narcotics' },
      { id: `d${day}-zoll`, text: 'Log in to Zoll Respond' },
      { id: `d${day}-driving`, text: 'Vehicle operations/driving practice' },
      { id: `d${day}-navigate`, text: 'Navigate to hospitals' },
      { id: `d${day}-radio`, text: 'Radio traffic' },
      { id: `d${day}-charts`, text: 'Review charts written by primary provider' },
      { id: `d${day}-ppp`, text: 'PPP Agency: protocol and medication familiarization' },
      { id: `d${day}-assist`, text: 'Assist secondary provider on scene/at destination' },
      { id: `d${day}-begincare`, text: 'Begin patient care (at FTO discretion)' },
    ],
    skillsPractice: true,
  }
}

/**
 * A patient-care day.
 *
 * `assisted` distinguishes the earlier days, where the orientee performs the
 * primary role with help and is "beginning" to chart, from the later ones
 * where both are unqualified.
 */
function patientCareDay(day: number, assisted: boolean, ftoNote?: string): AgendaDay {
  return {
    day,
    title: 'Patient care',
    ftoNote,
    items: [
      { id: `d${day}-layout`, text: 'Review truck layout and locate equipment/medications' },
      { id: `d${day}-pstrax`, text: 'Complete PSTrax for truck and narcotics' },
      { id: `d${day}-zoll`, text: 'Log in to Zoll Respond' },
      { id: `d${day}-ppp`, text: 'PPP Agency: protocol and medication familiarization' },
      { id: `d${day}-driving`, text: 'Vehicle operations/driving practice (if call is outside scope of practice)' },
      { id: `d${day}-radio`, text: 'Radio traffic' },
      {
        id: `d${day}-primary`,
        text: assisted
          ? 'Perform duties of primary provider (with assistance):'
          : 'Perform duties of primary provider:',
        sub: CALL_DUTIES,
      },
      { id: `d${day}-chart`, text: assisted ? 'Begin charting in Image Trend' : 'Chart in Image Trend' },
      { id: `d${day}-secondary`, text: 'Perform duties of secondary provider (if call is outside scope of practice)' },
    ],
    skillsPractice: true,
  }
}

/** The final day. Ends in a skills check rather than skills practice. */
function primaryProviderDay(day: number): AgendaDay {
  return {
    day,
    title: 'Primary care provider',
    ftoNote: NOTE_FINAL_ASSESSMENT,
    items: [
      { id: `d${day}-layout`, text: 'Demonstrate knowledge of truck layout and location of equipment/medications' },
      { id: `d${day}-pstrax`, text: 'Complete PSTrax for truck and narcotics' },
      { id: `d${day}-zoll`, text: 'Log in to Zoll Respond' },
      { id: `d${day}-protocols`, text: 'Demonstrate comprehension of protocols and medications' },
      { id: `d${day}-navigate`, text: 'Navigate to hospitals independently' },
      { id: `d${day}-radio`, text: 'Radio traffic' },
      { id: `d${day}-primary`, text: 'Perform duties of primary provider (independently):', sub: CALL_DUTIES },
      { id: `d${day}-chart`, text: 'Chart in Image Trend' },
      { id: `d${day}-secondary`, text: 'Perform duties of secondary provider (if call is outside scope of practice)' },
      { id: `d${day}-skillscheck`, text: 'Skills check' },
    ],
  }
}

/* ------------------------------------------------------------------ tracks */

const RED_TRACK: AgendaTrack = {
  id: 'red',
  label: 'Red track',
  length: 6,
  days: [
    observationDay(),
    firstDrivingDay(2),
    beginningCareDay(3, NOTE_BEGIN_CARE),
    patientCareDay(4, true, NOTE_REVIEW_CHARTS),
    patientCareDay(5, false, NOTE_LITTLE_ASSISTANCE),
    primaryProviderDay(6),
  ],
}

const GREEN_TRACK: AgendaTrack = {
  id: 'green',
  label: 'Green track',
  length: 9,
  days: [
    observationDay(),
    firstDrivingDay(2),
    repeatDrivingDay(3),
    beginningCareDay(4, NOTE_BEGIN_CARE),
    beginningCareDay(5),
    patientCareDay(6, true, NOTE_REVIEW_CHARTS),
    patientCareDay(7, true),
    patientCareDay(8, false, NOTE_LITTLE_ASSISTANCE),
    primaryProviderDay(9),
  ],
}

const WICHITA_TRACKS: AgendaTrack[] = [RED_TRACK, GREEN_TRACK]

/* ---------------------------------------------------------------------------
 * Per-market selection.
 *
 * Kansas City has no day-by-day agenda — it runs the A–G objectives page in
 * `ftObjectives.ts` instead. An empty list here is what makes the agenda
 * screens stay out of Kansas City's way, rather than a flag threaded through
 * every component.
 *
 * Read once at module load, which is safe because switching markets reloads
 * the page (see setActiveMarket).
 * ------------------------------------------------------------------------ */

const TRACKS_BY_MARKET: Record<Market, AgendaTrack[]> = { kc: [], wichita: WICHITA_TRACKS }

export const FTO_TRACKS: AgendaTrack[] = TRACKS_BY_MARKET[activeMarket()]

/** Does this market run the day-by-day agenda at all? */
export const HAS_FTO_AGENDA = FTO_TRACKS.length > 0

export function trackById(id: FtoTrackId | undefined): AgendaTrack | undefined {
  return id ? FTO_TRACKS.find((t) => t.id === id) : undefined
}

/** Every checkable item id in a track, for progress maths. */
export function trackItemIds(track: AgendaTrack): string[] {
  return track.days.flatMap((d) => d.items.map((i) => i.id))
}
