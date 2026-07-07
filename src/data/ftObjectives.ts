// ---------------------------------------------------------------------------
// Field Training Objectives Page — the cumulative competency tracker across
// the 6 FTO ride-along shifts, transcribed from the AMR KC IFT source
// document (Field_Training_Objectives_Page.docx). Used to generate each
// trainee's personalized printable objectives page.
//
// Each objective has 6 signature slots (one per shift); `target` says how
// many must be filled. Section G applies to paramedics only.
// ---------------------------------------------------------------------------

export interface FTObjective {
  id: string
  text: string
  target: string
}

export interface FTSection {
  id: string
  title: string
  paramedicOnly?: boolean
  objectives: FTObjective[]
}

export const FT_SLOTS = 6

export const FT_SECTIONS: FTSection[] = [
  {
    id: 'A',
    title: 'A. Operations & Truck',
    objectives: [
      { id: 'A1', text: 'Manifest completed independently on 1 ambulance', target: '1' },
      { id: 'A2', text: 'BOS check completed independently', target: '5x' },
      { id: 'A3', text: 'EOS completed independently', target: '5x' },
      { id: 'A4', text: 'VFR submitted on identified issue', target: '1+' },
      { id: 'A5', text: 'QR code submitted (supplies, equipment, or shift)', target: '1+' },
      { id: 'A6', text: 'Truck restock completed at EOS', target: '3x' },
      { id: 'A7', text: 'Power-cycle demonstrated: AVL or radio base or GFI/inverter reset', target: '1+' },
      { id: 'A8', text: '"Four Things" recognition: identify a LifePak / stair chair / stretcher / vent issue and notify supervisor (sim acceptable)', target: '1' },
      { id: 'A9', text: 'Drug cabinet temperature check performed at BOS (36–108°F range; out-of-range = ALL meds + IVs disposed)', target: '5x' },
      { id: 'A10', text: 'OOS notification process demonstrated — notify Comm Center + Ops Supervisor (sim acceptable)', target: '1' },
    ],
  },
  {
    id: 'B',
    title: 'B. Communications',
    objectives: [
      { id: 'B1', text: 'Radio report given to receiving facility', target: '2+' },
      { id: 'B2', text: 'Bedside patient handoff (SBAR or service standard)', target: '5+' },
      { id: 'B3', text: 'Dispatch comms demonstrated (OOS / EOS / post change)', target: '3+' },
      { id: 'B4', text: 'Group-text Captain on shift issue (real or sim)', target: '1' },
      { id: 'B5', text: 'Receiving-facility phone report ahead of arrival', target: '1+' },
      { id: 'B6', text: '"Code Purple" recognized — knows when to use it and what dispatch does in response (verbal)', target: '1' },
      { id: 'B7', text: 'Enroute within 90 seconds of dispatch alert (KC Metro standard)', target: '5+' },
    ],
  },
  {
    id: 'C',
    title: 'C. Navigation & Logistics',
    objectives: [
      { id: 'C1', text: "Navigate without GPS prompt to: KU Med · St. Luke's Mid-America Heart · Research Medical · North KC Hospital · Children's Mercy · [add 3–5 local SNFs / Rehab]", target: 'All' },
      { id: 'C2', text: 'All assigned KC posts located independently', target: '1 round' },
      { id: 'C3', text: 'Knox Box / facility access procedure demonstrated', target: '1+' },
      { id: 'C4', text: 'Long-distance transfer protocol acknowledged (verbal: O2 supply 2x calculated, supervisor notified at 3-hr threshold)', target: '1' },
      { id: 'C5', text: 'Specialty transport role understood — NICU / Maternal-Fetal / ECMO / IABP / Impella support role (verbal)', target: '1' },
      { id: 'C6', text: 'Secure / behavioral transport protocol understood — 2 providers, KU police escort, belongings stay in driver compartment (verbal)', target: '1' },
      { id: 'C7', text: 'MKC Downtown KC Airport tour completed — access gates, tarmac / helipad locations, security + escort procedures', target: '1' },
    ],
  },
  {
    id: 'D',
    title: 'D. Patient Care — BLS',
    objectives: [
      { id: 'D1', text: 'Patient assessment (1° + 2°) — independent', target: '5+' },
      { id: 'D2', text: 'Vitals collected, documented, and interpreted', target: '5+' },
      { id: 'D3', text: 'O2 setup + delivery (NC, NRB, BVM-ready)', target: '3+' },
      { id: 'D4', text: 'Glucometry performed', target: '1+' },
      { id: 'D5', text: 'HIPAA-compliant patient transfer + handoff', target: '5+' },
      { id: 'D6', text: 'XD restraint application drilled (sim acceptable)', target: '1' },
      { id: 'D7', text: 'Isotonic IV fluid monitoring observed (scope familiarity)', target: '1+' },
      { id: 'D8', text: 'Recognized deterioration en route + escalated (real or table-top sim with FTO)', target: '1' },
    ],
  },
  {
    id: 'E',
    title: 'E. Documentation',
    objectives: [
      { id: 'E1', text: 'Complete PCR using DCHART format, validation = 0 before post', target: '5+' },
      { id: 'E2', text: 'Narrative meets Med Nec standard (FTO reads + signs off)', target: '3+' },
      { id: 'E3', text: 'Times entered correctly (en route / on scene / transport / arrival)', target: '5+' },
      { id: 'E4', text: 'Signatures captured (patient or designee)', target: '5+' },
      { id: 'E5', text: 'Chart posted within 4 hours of EOS', target: '5+' },
    ],
  },
  {
    id: 'F',
    title: 'F. Equipment',
    objectives: [
      { id: 'F1', text: 'Stretcher loaded + unloaded with PowerLoad', target: '3+' },
      { id: 'F2', text: 'Stryker stretcher hand placement + height per training', target: '5+' },
      { id: 'F3', text: 'Stair chair used on patient transfer (real or sim)', target: '1+' },
      { id: 'F4', text: 'Equipment check-off completed (Fri classroom)', target: '1' },
      { id: 'F5', text: 'Stretcher cleaned per SOG post-call', target: '5+' },
    ],
  },
  {
    id: 'G',
    title: 'G. ALS-Specific (Paramedics only)',
    paramedicOnly: true,
    objectives: [
      { id: 'G1', text: 'Complete ALS PCR using DCHART, validation = 0', target: '5+' },
      { id: 'G2', text: 'Vent monitoring on call (LTV 1200 or Z-Vent)', target: '1+' },
      { id: 'G3', text: 'Vasopressor monitoring (norepinephrine per protocol)', target: '1+' },
      { id: 'G4', text: 'IV/IO access maintained during transport', target: '3+' },
      { id: 'G5', text: 'Defended ALS-vs-BLS scope decision on dispatched call', target: '1+' },
      { id: 'G6', text: 'CS box check-in/out per shift + waste documented with second witness (per operation: §415 KC / §416 Linn / §417 Cass)', target: '5x' },
    ],
  },
  {
    id: 'H',
    title: 'H. Professionalism',
    objectives: [
      { id: 'H1', text: 'Uniform standard met every shift (slots = Shifts 1–6)', target: 'All 6' },
      { id: 'H2', text: 'On-time arrival every shift (BOS via UKG)', target: 'All 6' },
      { id: 'H3', text: 'No supervisor escalations for behavior / scope', target: 'All 6' },
    ],
  },
]

/** Call-type exposure log (Section I) — exposure tracking, not competency. */
export interface ExposureGroup {
  label: string
  types: string[]
}

export const EXPOSURE_SLOTS = 10

export const EXPOSURE_GROUPS: ExposureGroup[] = [
  {
    label: 'BLS',
    types: [
      'Routine BLS',
      'Dialysis',
      'Post-op transfer (ortho / surgical)',
      'SNF / LTAC admit or return',
      'Behavioral health (stable)',
      'Pediatric',
      'Bariatric',
      'Higher-acuity BLS',
      'Refusal / cancellation on scene',
      'Deterioration en route (any)',
    ],
  },
  {
    label: 'ALS',
    types: [
      'STEMI / Acute MI',
      'Acute stroke (thrombectomy / tPA)',
      'Sepsis / septic shock',
      'Vent transfer (LTV / Z-Vent)',
      'Active drip / vasopressor',
    ],
  },
  {
    label: 'Specialty',
    types: ['NICU / Maternal-Fetal / ECMO / Impella / IABP', 'Long-distance (>100 mi)'],
  },
]
