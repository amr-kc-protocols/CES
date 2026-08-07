// ---------------------------------------------------------------------------
// Kansas / Missouri EMS regulatory reference — curated, static, offline.
//
// This is the "Browse" half of the planned EMS expert tool: verified reference
// content, not model-generated answers. Every figure here traces to a named
// statute or regulation. Scope tags drive the jurisdiction view — a Wichita
// device is Kansas-only; a Kansas City device is bi-state (KS + MO, bridged
// operationally by MARCER).
//
// NOT medical direction and NOT legal advice. An agency medical director's
// approved protocol governs, and may NARROW but never EXPAND state scope.
// ---------------------------------------------------------------------------

import type { Market } from '../lib/market'

export type Scope = 'ks' | 'mo' | 'bistate'
export type View = 'ks' | 'mo' | 'both'

/** Which view a market opens on. Wichita is Kansas-only; KC is bi-state. */
export function defaultView(market: Market): View {
  return market === 'wichita' ? 'ks' : 'both'
}

export function inView(scope: Scope, view: View): boolean {
  if (view === 'both') return true
  return scope === view
}

// ----- Authority hierarchy ---------------------------------------------------

export const AUTHORITY_TIERS: { tier: number; label: string; examples: string }[] = [
  { tier: 1, label: 'Statute & regulation', examples: 'K.S.A. Ch. 65 Art. 61 · K.A.R. 109 · RSMo Ch. 190 · 19 CSR 30-40, plus lists/plans adopted by reference' },
  { tier: 2, label: 'State & regional protocol', examples: '19 CSR 30-40.790/.792 (MO field protocols) · MARCER Time-Critical-Diagnosis plan' },
  { tier: 3, label: 'Agency protocol', examples: 'Your medical-director-approved local protocol (e.g. AMR)' },
  { tier: 4, label: 'National standard & evidence', examples: 'NHTSA Scope of Practice Model · NREMT NCCP · NASEMSO guidelines · AHA / BTF / ACS' },
]

export const DIRECTIONAL_RULE =
  'A medical director and local protocol may NARROW but never EXPAND state-authorized scope. Kansas: K.A.R. 109-2-5(u)–(v), K.S.A. 65-6112. Missouri: RSMo 190.142.4, 19 CSR 30-40.303.'

// ----- Continuing education --------------------------------------------------

export interface CeRow { level: string; ks?: string; mo?: string }
export const CE_ROWS: CeRow[] = [
  { level: 'EMR', ks: '16 h', mo: '—' },
  { level: 'EMT', ks: '28 h', mo: 'EMT-B — 100 h' },
  { level: 'AEMT', ks: '44 h', mo: 'EMT-I — 144 h' },
  { level: 'Paramedic', ks: '60 h', mo: 'EMT-P — 144 h (96 core / 48 elective)' },
]
export const CE_NOTE_KS =
  'Per 2-year biennium — K.A.R. 109-5-1a–1d. Kansas certification expires Dec 31 of the 2nd full calendar year (109-6-2).'
export const CE_NOTE_MO = 'Per license cycle — 19 CSR 30-40.342. EMT-Community Paramedic adds 4 h/yr on top of the paramedic hours (30-40.800).'
export const CE_NOTE_NREMT =
  'NREMT NCCP (2025) is SEPARATE: EMR 16 · EMT 40 · AEMT 50 · Paramedic 60 (30 National / 15 Local-State / 15 Individual; ≥10% of National credits pediatric). A provider who holds both state and NREMT certification must satisfy the HIGHER of the two.'

// ----- Provider levels & nomenclature ---------------------------------------

export const NOMENCLATURE: { note: string; scope: Scope }[] = [
  { scope: 'ks', note: 'Kansas uses EMR · EMT · AEMT · Paramedic (K.A.R. 109-3-3 / -3-4 / -3-5).' },
  { scope: 'mo', note: 'Missouri regulation still uses EMT-B · EMT-I · EMT-P (19 CSR 30-40.342) — map national terms before searching MO rules.' },
  { scope: 'mo', note: 'Missouri EMT-I may perform all AEMT-level (2007 SOPM) skills EXCEPT intraosseous infusion.' },
  { scope: 'mo', note: 'Missouri EMT-B additions beyond the 2007 SOPM: blood-glucose analysis, 12-lead acquisition & transmission, and non-tracheal airway devices.' },
]

// ----- Conflicts & traps (the high-value answer templates) ------------------

export interface Trap {
  id: string
  scope: Scope
  title: string
  body: string
  cite: string
}

export const TRAPS: Trap[] = [
  {
    id: 'ce-hours',
    scope: 'ks',
    title: 'Kansas CE hours are NOT the NREMT numbers',
    body: 'Kansas requires EMR 16 / EMT 28 / AEMT 44 / Paramedic 60 per biennium. Commercial vendors advertising "Kansas: EMT 40 / AEMT 50" are quoting NREMT NCCP totals, not Kansas rule. Kansas and NREMT are separate credentials with separate requirements.',
    cite: 'K.A.R. 109-5-1a–1d',
  },
  {
    id: 'ks-trauma-jurisdiction',
    scope: 'ks',
    title: 'Kansas: two different agencies',
    body: 'KSBEMS regulates providers and services. KDHE — a different agency — regulates trauma-center designation (K.S.A. 75-5663 et seq.). Sending a trauma-designation question to KSBEMS is a common wrong-agency error.',
    cite: 'K.S.A. 65-6102 (KSBEMS) · 75-5663 (KDHE trauma)',
  },
  {
    id: 'ks-no-stemi-stroke',
    scope: 'ks',
    title: 'Kansas has no state STEMI / stroke center designation',
    body: 'Kansas has no statute designating STEMI or stroke centers. Kansas facilities carry national accreditations instead (AHA Mission: Lifeline, Joint Commission). Missouri, by contrast, designates them by rule.',
    cite: 'contrast RSMo 190.241 · 19 CSR 30-40.710–.760',
  },
  {
    id: 'ks-register-authoritative',
    scope: 'ks',
    title: 'Kansas rules are actively changing — the Register wins',
    body: 'KSBEMS amends K.A.R. 109 regularly (a hearing on course-completion rules was held Feb 2026). The consolidated PDF on ksbems.org can lag. Treat the Kansas Register as authoritative and the PDF as convenience.',
    cite: 'Kansas Register (sos.ks.gov)',
  },
  {
    id: 'ks-fee-drift',
    scope: 'ks',
    title: 'Fee figures drift between the PDF and the Register',
    body: 'The consolidated PDF lists a $50 CHRC fee; an Oct 2024 Register amendment lists $60. Always prefer the most recent Register issue for any fee.',
    cite: 'K.A.R. 109-7-1',
  },
  {
    id: 'mo-sopm-tension',
    scope: 'mo',
    title: 'Missouri: 2007 SOPM by rule vs. current standards by statute',
    body: 'Missouri regulation incorporates the 2007 Scope of Practice Model and expressly excludes later amendments (19 CSR 30-40.331/.342). But RSMo 190.900 and 190.142.2(2), and DHSS hospital-paramedic guidance, reference the CURRENT standards and the 2019 SOPM. This statute/regulation tension is unresolved — check both, do not assume.',
    cite: 'RSMo 190.142 / 190.900 vs 19 CSR 30-40.342 / .331',
  },
  {
    id: 'mo-closest-center',
    scope: 'mo',
    title: 'Missouri: transport to the closest appropriate designated center',
    body: 'RSMo 190.243 requires transport to the closest appropriate DESIGNATED center by estimated transport time — ground or air, even outside the service area. This overrides ordinary destination preference; stabilize at the nearest facility when transport is prolonged.',
    cite: 'RSMo 190.243',
  },
  {
    id: 'mo-emtcp-ce',
    scope: 'mo',
    title: 'Missouri EMT-Community Paramedic: extra CE',
    body: 'The EMT-CP requires 4 hours of CE per year IN ADDITION TO the 144-hour paramedic requirement.',
    cite: '19 CSR 30-40.800',
  },
  {
    id: 'bistate-tcd',
    scope: 'bistate',
    title: 'KC metro: MARCER bridges the STEMI/stroke asymmetry',
    body: 'Because Kansas has no state STEMI/stroke designation and Missouri does, the KC metro relies on the MARCER Time-Critical-Diagnosis plan (effective 17 Jan 2025) to define receiving-center categories that hold on BOTH sides of the state line.',
    cite: 'MARCER TCD Plan (2025)',
  },
  {
    id: 'bistate-nomenclature',
    scope: 'bistate',
    title: 'KC metro: translate the level before you cite',
    body: 'A crew moving across the state line changes vocabularies: a Kansas AEMT maps to a Missouri EMT-I (minus IO). Cite the rule for the state you are operating in, not the label on the patch.',
    cite: 'K.A.R. 109-3-5 · 19 CSR 30-40.342',
  },
]

// ----- Browse index (canonical sources) -------------------------------------

export interface RefDoc {
  scope: Scope
  code: string
  title: string
  tier: number
  url: string
  sections?: { cite: string; subject: string }[]
}

export const REF_DOCS: RefDoc[] = [
  {
    scope: 'ks',
    code: 'K.S.A. Ch. 65, Art. 61',
    title: 'Kansas EMS statute',
    tier: 1,
    url: 'https://ksrevisor.gov/statutes/chapters/ch65/',
    sections: [
      { cite: '65-6112', subject: 'Definitions (medical director, protocol, attendant…)' },
      { cite: '65-6119', subject: 'Paramedic — authorized activities' },
      { cite: '65-6120', subject: 'AEMT — authorized activities' },
      { cite: '65-6121', subject: 'EMT — authorized activities' },
      { cite: '65-6144', subject: 'EMR authorized activities; naloxone' },
      { cite: '65-6126', subject: 'Medical director duties' },
      { cite: '65-6129', subject: 'Certification; 2-yr renewal; CE requirement' },
      { cite: '65-6135', subject: 'Staffing — attendant in patient compartment' },
    ],
  },
  {
    scope: 'ks',
    code: 'K.A.R. Agency 109',
    title: 'KSBEMS regulations',
    tier: 1,
    url: 'https://www.ksbems.org/html%20pages/KAR%20109%20EMS.pdf',
    sections: [
      { cite: '109-3-3 / -3-4 / -3-5', subject: 'Authorized activities — EMR / EMT / AEMT' },
      { cite: '109-5-1a–1d', subject: 'Continuing education — 16 / 28 / 44 / 60 h' },
      { cite: '109-2-5', subject: 'Service operational standards; quarterly QI' },
      { cite: '109-6-2', subject: 'Certification expiry (Dec 31, 2nd full year)' },
      { cite: '109-7-1', subject: 'Fees' },
      { cite: '109-8-1', subject: 'NREMT cognitive exam adopted' },
      { cite: '109-11-8', subject: 'Successful course completion' },
    ],
  },
  {
    scope: 'ks',
    code: 'Adopted by reference',
    title: 'Binding lists & plans (incorporated by rule)',
    tier: 1,
    url: 'https://www.ksbems.org/ems/?page_id=6325',
    sections: [
      { cite: 'Approved medication list (5 Apr 2019)', subject: 'EMR & EMT meds — via 109-3-3(i)' },
      { cite: 'Advanced EMT medication list (6 Nov 2013)', subject: 'AEMT meds — via 109-3-5(c)(2)' },
      { cite: 'Kansas CE Plan (Feb 2019)', subject: 'Core-topic distribution — via 109-5-1a' },
    ],
  },
  {
    scope: 'ks',
    code: 'KDHE Trauma Program',
    title: 'Kansas trauma system (separate agency)',
    tier: 1,
    url: 'https://www.kdhe.ks.gov/1140/Kansas-Trauma-Program',
    sections: [
      { cite: 'K.S.A. 75-5663–5670', subject: 'Advisory Committee on Trauma' },
      { cite: 'Designation map', subject: 'Trauma center designations (reviewed every 3 yrs)' },
    ],
  },
  {
    scope: 'mo',
    code: 'RSMo Ch. 190',
    title: 'Missouri EMS statute',
    tier: 1,
    url: 'https://revisor.mo.gov/main/OneSection.aspx?section=190.100',
    sections: [
      { cite: '190.100', subject: 'Definitions (STEMI/stroke center, TCD…)' },
      { cite: '190.103', subject: 'Regional EMS medical director; protocols' },
      { cite: '190.142', subject: 'EMT licensure; scope tied to training + order' },
      { cite: '190.241', subject: 'Trauma / STEMI / stroke center designation' },
      { cite: '190.243', subject: 'Transport to closest appropriate center' },
      { cite: '190.900', subject: 'EMS Compact (REPLICA)' },
    ],
  },
  {
    scope: 'mo',
    code: '19 CSR 30-40',
    title: 'Missouri comprehensive EMS regulations',
    tier: 1,
    url: 'https://www.sos.mo.gov/adrules/csr/csr',
    sections: [
      { cite: '30-40.342', subject: 'EMT-B / EMT-I / EMT-P licensure; CE hours' },
      { cite: '30-40.303', subject: 'Medical director required' },
      { cite: '30-40.309', subject: 'Ground ambulance licensure' },
      { cite: '30-40.790', subject: 'State transport protocol — stroke & STEMI' },
      { cite: '30-40.792', subject: 'State field triage & transport — trauma' },
      { cite: '30-40.600', subject: 'Outside-the-Hospital DNR (OHDNR)' },
      { cite: '30-40.800', subject: 'EMT-Community Paramedic' },
    ],
  },
  {
    scope: 'mo',
    code: 'Missouri TCD system',
    title: 'Time-Critical Diagnosis (trauma / STEMI / stroke)',
    tier: 2,
    url: 'https://health.mo.gov/living/healthcondiseases/chronic/tcdsystem/pdf/TCD_Overview_Factsheet.pdf',
    sections: [{ cite: 'DHSS designated-facility lists', subject: 'Current trauma / STEMI / stroke centers by level' }],
  },
  {
    scope: 'bistate',
    code: 'MARCER',
    title: 'Mid-America Regional Council Emergency Rescue Committee',
    tier: 2,
    url: 'https://www.marc.org/committees/mid-america-regional-council-emergency-rescue',
    sections: [
      { cite: 'MARCER TCD Plan (eff. 17 Jan 2025)', subject: 'Bi-state STEMI/stroke receiving-center categories' },
      { cite: 'Med Channel / EMSystem', subject: 'KC-area hospital status & diversion' },
    ],
  },
  {
    scope: 'bistate',
    code: 'National standards',
    title: 'NHTSA / NREMT / NASEMSO (public domain)',
    tier: 4,
    url: 'https://rosap.ntl.bts.gov/view/dot/56917',
    sections: [
      { cite: 'National EMS Scope of Practice Model 2019', subject: 'incl. Change Notices 1.0 & 2.0' },
      { cite: 'NREMT NCCP (2025 model)', subject: 'EMR 16 / EMT 40 / AEMT 50 / Para 60' },
      { cite: 'NASEMSO Model Clinical Guidelines', subject: 'Clinical backbone where no state protocol' },
    ],
  },
]

// ----- Regulators ------------------------------------------------------------

export interface Regulator { scope: Scope; name: string; detail: string; phone?: string; url: string }
export const REGULATORS: Regulator[] = [
  {
    scope: 'ks',
    name: 'Kansas Board of EMS (KSBEMS)',
    detail: '900 SW Jackson St, Suite 1031, Topeka KS 66612 · Independent 15-member board, not under KDHE',
    phone: '785-296-7296',
    url: 'https://www.ksbems.org/',
  },
  {
    scope: 'ks',
    name: 'KDHE Trauma Program',
    detail: 'Kansas trauma-center designation (separate from KSBEMS)',
    url: 'https://www.kdhe.ks.gov/1140/Kansas-Trauma-Program',
  },
  {
    scope: 'mo',
    name: 'Missouri DHSS — Bureau of EMS',
    detail: 'PO Box 570, Jefferson City MO 65102 · EMSINFO@health.mo.gov',
    phone: '573-751-6356',
    url: 'https://health.mo.gov/safety/ems/index.php',
  },
  {
    scope: 'bistate',
    name: 'MARC / MARCER',
    detail: 'KC metro coordination — Cass, Clay, Jackson, Platte, Ray (MO) + Johnson, Leavenworth, Miami, Wyandotte (KS)',
    url: 'https://www.marc.org/committees/mid-america-regional-council-emergency-rescue',
  },
]
