// ---------------------------------------------------------------------------
// Academy content transcribed from the AMR KC New Hire Academy source
// documents: the 5-day classroom schedule template (Academy_Plan_full.docx),
// the Day-1 Welcome Kit checklist, and the KC facility cheat sheet.
// The schedule template seeds a cohort's editable schedule; days and blocks
// flex from there to accommodate instructors and availability.
// ---------------------------------------------------------------------------

export interface TemplateBlock {
  time: string
  title: string
  note?: string
}

export interface TemplateDay {
  /** Offset in academy days (0 = day 1). Applied to consecutive weekdays. */
  title: string
  facilitators?: string
  location?: string
  note?: string
  blocks: TemplateBlock[]
}

/** The 5-day classroom week from the May 2026 plan. */
export const CLASSROOM_TEMPLATE: TemplateDay[] = [
  {
    title: 'HR & Systems Onboarding',
    facilitators: 'Jordan (CES) · Gabby (HR 1–3 PM) · Captains Dir & Curless (3–4 PM)',
    note: 'Pending confirmation: Captains availability for the 3–4 PM operations slot. Fallbacks: Tue end-of-day after EVOC, or Thu lunch-and-learn.',
    blocks: [
      { time: '0900–0915', title: 'Welcome, intros, group-text exercise', note: 'Sets the tone; from existing Captains’ deck.' },
      { time: '0915–1100', title: 'Day-1 Intro PPT — laptops open, do it live', note: 'Okta registration, NinthBrain, Cornerstone access, Respiratory Questionnaire all completed in the room.' },
      { time: '1100–1115', title: 'Break' },
      { time: '1115–1200', title: 'GPS Portal tasks · I-9 verification · Benefits orientation', note: 'Compress reference-only sections; focus on what must be done before first shift.' },
      { time: '1200–1300', title: 'Lunch + truck walk-around with Captains', note: 'Informal; gets trainees into a real ambulance.' },
      { time: '1300–1500', title: 'HR session with Gabby', note: 'Benefits enrollment · Leave · EAP · 401(k) · Bereavement.' },
      { time: '1500–1600', title: 'Captains Operations Part 1 (60 min)', note: 'Manifesting, BOS book, OOS, communications, "Four Things." Pause every 15 min for partner discussion.' },
      { time: '1600', title: 'Day-1 Retrieval Quiz (low-stakes, partner discuss) · Preview Tue' },
    ],
  },
  {
    title: 'EVOC Classroom (Corporate)',
    facilitators: 'Jessica Sexton · Jason Bardwell',
    note: 'Materials are corporate / read-only. No CES-level planning required; classroom is delivered against the GMR EVOC standard.',
    blocks: [
      { time: '0900–1600', title: 'EVOC classroom — GMR corporate curriculum' },
    ],
  },
  {
    title: 'EVOC Road Course (Corporate)',
    facilitators: 'McMullen · Curless · Dir · Hayden · Denk · Fournier',
    location: 'Meet HQ 7 AM → Independence course',
    note: 'CES is not present this day. Day is fully covered by the corporate EVOC team.',
    blocks: [
      { time: '0700–1600', title: 'EVOC road course — Independence' },
    ],
  },
  {
    title: 'PCR Documentation & ImageTrend',
    facilitators: 'Jordan (CES) · Joshua Hayden · Lanie McMullen',
    blocks: [
      { time: '0900–0915', title: 'Welcome back · Wed EVOC debrief · day intro', note: 'Quick roundtable: one EVOC takeaway per trainee.' },
      { time: '0915–1015', title: 'Clinical Mindset Primer (60 min)', note: 'Patient Population (15 min) + IFT Call Types (20 min) + KC Med Guidelines scope drill (25 min). Card-sort: ALS vs BLS.' },
      { time: '1015–1030', title: 'Break' },
      { time: '1030–1130', title: 'Narrative & Med Nec deck (60 min)', note: 'DCHART + weak-vs-strong examples. Class rewrites the 3 case denials together. Highest-engagement block — protect the time.' },
      { time: '1130–1230', title: 'Lunch' },
      { time: '1230–1315', title: 'ImageTrend Field — Foundations (45 min)', note: 'Login, home, CAD download, chart navigation, validation counter, right-rail Power Tools. Laptops out, demo creds verified.' },
      { time: '1315–1415', title: 'ImageTrend Field — Guided Chart (60 min)', note: 'Instructor enters BLS Scenario 1 on projector; students follow on devices. Pause after each accordion section.' },
      { time: '1415–1430', title: 'Break' },
      { time: '1430–1530', title: 'ImageTrend Field — Independent Entry (60 min)', note: 'EMTs: BLS Scenario 2. Paramedics: ALS Scenario 1 with instructor support. Captains spot-check live, flag missed Med Nec language.' },
      { time: '1530–1545', title: 'Narrative critique (anonymized projection)', note: 'Two or three student narratives read against DCHART + Med Nec criteria.' },
      { time: '1545–1600', title: 'Day wrap + Retrieval Quiz · Friday preview' },
    ],
  },
  {
    title: 'Stretcher & Equipment Check-Off',
    facilitators: 'Lanie McMullen · Joshua Hayden · Frank Alba',
    note: 'Runs against the existing Stretcher Handling deck and equipment check-off sheet (GMR Safe Stretcher Handling v3.2). Close with the Day-5 retrieval quiz and final sign-offs.',
    blocks: [
      { time: '0900–1200', title: 'Stretcher lab', note: 'PowerLoad + Stryker hand placement, stair chair.' },
      { time: '1200–1300', title: 'Lunch' },
      { time: '1300–1530', title: 'Equipment check-off' },
      { time: '1530–1600', title: 'Final sign-offs · Day-5 Retrieval Quiz' },
    ],
  },
]

// ----- Day-1 Welcome Kit ----------------------------------------------------

export interface KitItem {
  item: string
  source: string
}

export const WELCOME_KIT_ITEMS: KitItem[] = [
  { item: 'Printed schedule (1-page color, landscape)', source: 'Academy schedule — print from CES' },
  { item: 'Printed Field Training Objectives Page', source: 'Generated per trainee from CES (≈3 pages)' },
  { item: 'KC Facility Cheat Sheet', source: 'Print 1 page from CES' },
  { item: 'Local protocol pocket reference (if available)', source: 'Existing AMR KC protocol pocket guide' },
  { item: 'Name tag', source: 'Front desk / printable badge' },
  { item: 'Pen', source: 'Office supply' },
  { item: 'Notepad / steno book', source: 'Office supply' },
  { item: 'Building access card / parking pass', source: 'Confirm with HR' },
]

export const ROOM_SETUP_ITEMS = [
  'Folders on each seat',
  'Coffee + water + snacks (long admin day)',
  'Projector + screen tested with Day-1 Intro PPT loaded',
  'Laptops or toughbooks at trainee seats — Chrome/Edge installed, demo creds verified',
  'Printed roster for Captains so they know who they’re meeting',
  'Group photo location identified (do this before lunch — sets cohort tone)',
]

// ----- KC Facility Cheat Sheet ----------------------------------------------

export interface Facility {
  name: string
  address: string
  notes: string
}

export const KC_FACILITIES: Facility[] = [
  { name: 'KU Medical Center', address: '4000 Cambridge St, Kansas City, KS 66160', notes: 'Stroke center · Trauma · Thrombectomy capability' },
  { name: "Saint Luke's Mid America Heart Institute", address: '4401 Wornall Rd, Kansas City, MO 64111', notes: 'STEMI / cath lab · Cardiology' },
  { name: 'Research Medical Center', address: '2316 E Meyer Blvd, Kansas City, MO 64132', notes: 'Trauma · ED' },
  { name: 'North Kansas City Hospital', address: '2800 Clay Edwards Dr, North KC, MO 64116', notes: 'ED · Cardiac · Stroke' },
  { name: "Children's Mercy Hospital", address: '2401 Gillham Rd, Kansas City, MO 64108', notes: 'Pediatric — primary peds receiving' },
  { name: "Saint Luke's Hospital of Kansas City (Plaza)", address: '4401 Wornall Rd, Kansas City, MO 64111', notes: 'General med-surg · Cancer' },
  { name: 'Truman Medical Center / University Health', address: '2301 Holmes St, Kansas City, MO 64108', notes: 'Trauma · Behavioral health' },
  { name: 'Overland Park Regional Medical Center', address: '10500 Quivira Rd, Overland Park, KS 66215', notes: 'ED · Trauma · Cardiac' },
  { name: 'Menorah Medical Center', address: '5721 W 119th St, Overland Park, KS 66209', notes: 'ED · Med-surg' },
  { name: 'AdventHealth Shawnee Mission', address: '9100 W 74th St, Shawnee Mission, KS 66204', notes: 'ED · Cardiac · Stroke' },
]

export const FACILITY_KEY_POINTS = [
  "STEMI transfers → Saint Luke's Mid America or KU Med (cath capability).",
  'Stroke / thrombectomy → KU Med or Saint Luke’s stroke center. Time-critical.',
  'Pediatric anything → Children’s Mercy is the answer for IFT in KC.',
  'Trauma centers in network → KU Med, Research, Truman, Overland Park.',
  'When in doubt, ask dispatch — facility capabilities change and your manual is the source of truth.',
]
