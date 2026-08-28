// ---------------------------------------------------------------------------
// Where students are placed, and what each department actually produces.
//
// The `produces` lists are the difference between a calendar and a scheduling
// tool. A student projecting fourteen of twenty venipunctures does not need "a
// shift" — they need pre-op, because that is where the sticks are. Everything
// downstream that routes a student somewhere reads these lists.
//
// CAMPUS IS LOAD-BEARING. The October 2026 cohort is one class run jointly by
// AMR Kansas City and AMR Wichita, and the didactic is genuinely shared — same
// schedule, same gates, same standard. Clinical and field placement is not.
// A Wichita student is not driving to Merriam for six 12-hour shifts, and the
// affiliation agreements are per-market anyway. So every site carries the
// campus it serves, every student carries the campus they belong to, and the
// board refuses to cross them. Capacity arithmetic is per campus too — four
// Kansas City students against the AdventHealth departments is a different
// problem from two Wichita students against Ascension, and averaging them
// hides both.
//
// The weekly caps are a WORKING ASSUMPTION, not a commitment. Neither hospital
// has answered on capacity, so every hospital department is seeded at one
// student per week, which is the conservative reading and also the number that
// makes the schedule hard. Caps are editable per unit — when the real numbers
// arrive it is a form, not a code change.
//
// Prairie Star is present and inactive. It is covered by the same affiliation
// agreement, but patient volume there is too low to be worth a rotation, so it
// stays on file as a toggle rather than being deleted and re-entered if that
// ever changes. It is named on the KBEMS application regardless: adding a site
// mid-course means going back for a new approval, and naming one costs nothing.
// ---------------------------------------------------------------------------

import type { Market } from '../lib/market'
import type { AemtSite, AemtSiteUnit } from '../types'

/** A unit template — ids are assigned when a site is seeded onto a course. */
export interface UnitTemplate {
  name: string
  produces: string[]
  /** Omitted means the default hospital cap. */
  weeklySlotCap?: number
  notes?: string
}

/**
 * One student per department per week, until AdventHealth says otherwise.
 * Named rather than inlined so the assumption has one place to change.
 */
export const DEFAULT_UNIT_CAP = 1

/**
 * The AdventHealth department set. Both active campuses run the same list;
 * where a campus does not have a department, the instructor removes it rather
 * than the app guessing.
 */
export const HOSPITAL_UNITS: UnitTemplate[] = [
  {
    name: 'Pre-op / same-day surgery',
    produces: ['venipuncture', 'infusion'],
    notes: 'The venipuncture department. Scheduled starts mean predictable stick volume.',
  },
  {
    name: 'ED',
    produces: ['venipuncture', 'infusion', 'io', 'ecg', 'nebulizer', 'assessment'],
    notes: 'The broadest department, and the only hospital source for IO.',
  },
  { name: 'PACU', produces: ['injection', 'ecg'] },
  { name: 'Infusion center', produces: ['injection', 'venipuncture'] },
  { name: 'Med-surg', produces: ['injection', 'assessment'] },
  {
    name: 'Respiratory therapy',
    produces: ['nebulizer'],
    notes: 'One nebulized treatment is the whole program competency — half a shift covers it.',
  },
  {
    name: 'L&D',
    produces: ['assessment'],
    notes: 'Obstetric exposure. Produces little that is counted.',
  },
]

/**
 * Field capacity is FTO capacity.
 *
 * A hospital department takes one student because that is what the department
 * says. An EMS agency takes as many students as it has FTO-staffed trucks, and
 * that number is not known yet — it comes from the Independence CES. So the cap
 * here means "FTO-staffed trucks available per week" and is seeded at one,
 * which is deliberately pessimistic.
 *
 * It matters more than the hospital numbers do. Twelve of each student's
 * eighteen shifts are field shifts — seventy-two of the hundred and eight
 * placements across the joint cohort — so field capacity, not hospital
 * capacity, is what decides whether the rotation fits. At one truck per agency
 * per week the board reports a large shortfall, and it is right to: that is the
 * question to take to each operation's CES, not a bug to tune away.
 */
export const FIELD_UNITS: UnitTemplate[] = [
  {
    name: '911 ambulance',
    produces: ['assessment', 'assessmentField', 'calls', 'pcr', 'venipuncture', 'ecg'],
    notes:
      'Cap = FTO-staffed trucks that can take a student in a week. Seeded at one pending an answer from each operation.',
  },
]

export interface SiteTemplate {
  name: string
  kind: 'clinical' | 'field'
  campus: Market
  active: boolean
  units: UnitTemplate[]
  note?: string
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  // ----- Kansas City ---------------------------------------------------------
  {
    name: 'AdventHealth Shawnee Mission',
    kind: 'clinical',
    campus: 'kc',
    active: true,
    units: HOSPITAL_UNITS,
    note: '504-bed tertiary teaching hospital, Merriam KS. Roughly 22,000 inpatient and 200,000+ outpatient admissions a year — that outpatient volume is the asset, so do not spend all six hospital shifts in the ED.',
  },
  {
    name: 'AdventHealth South Overland Park',
    kind: 'clinical',
    campus: 'kc',
    active: true,
    units: HOSPITAL_UNITS,
    note: 'Second active campus under the same agreement. Doubles the venipuncture capacity, which the Phase 2 arithmetic depends on.',
  },
  {
    name: 'AdventHealth Prairie Star',
    kind: 'clinical',
    campus: 'kc',
    active: false,
    units: HOSPITAL_UNITS,
    note: 'Covered by the agreement and named on the application for overflow, but not rotated through — patient volume too low to be worth a placement.',
  },
  {
    name: 'AMR Independence',
    kind: 'field',
    campus: 'kc',
    active: true,
    units: FIELD_UNITS,
    note: 'Urban 911. Placement depends on FTO availability, which comes from the Independence CES.',
  },
  {
    name: 'AMR Linn County',
    kind: 'field',
    campus: 'kc',
    active: true,
    units: FIELD_UNITS,
    note: 'Rural 911. Lower call volume, longer transports.',
  },

  // ----- Wichita -------------------------------------------------------------
  //
  // Carried from the 2025 Wichita course approval, which is the only record of
  // them this program holds. Every one needs confirming with Wichita before the
  // application is filed: an affiliation agreement that lapsed, or a service
  // that will not take students this cycle, is a Phase 2 that never starts.
  {
    name: 'Ascension Via Christi St Francis',
    kind: 'clinical',
    campus: 'wichita',
    active: true,
    units: HOSPITAL_UNITS,
    note: 'Wichita clinical site. Seeded with the same department set as the Kansas City hospitals; remove any department this campus does not have rather than leaving the app to guess.',
  },
  {
    name: 'Sedgwick County EMS',
    kind: 'field',
    campus: 'wichita',
    active: true,
    units: FIELD_UNITS,
    note: 'Urban 911 for the Wichita students.',
  },
  {
    name: 'Butler County EMS',
    kind: 'field',
    campus: 'wichita',
    active: true,
    units: FIELD_UNITS,
    note: 'Rural response for the Wichita students — the Wichita half of the urban/rural split.',
  },
]

/**
 * The campus a site serves. Absent means Kansas City: every site on file before
 * the two builds were merged was one, and a missing tag must not quietly make a
 * site unreachable.
 */
export function siteCampus(site: { campus?: Market }): Market {
  return site.campus ?? 'kc'
}

/** Sites a given campus rotates through. */
export function sitesForCampus(sites: AemtSite[], campus: Market): AemtSite[] {
  return sites.filter((s) => siteCampus(s) === campus)
}

/** Build the units for a site, giving each a stable id derived from its name. */
export function seedUnits(siteId: string, templates: UnitTemplate[]): AemtSiteUnit[] {
  return templates.map((t) => ({
    id: `${siteId}:${t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name: t.name,
    weeklySlotCap: t.weeklySlotCap ?? DEFAULT_UNIT_CAP,
    produces: [...t.produces],
    notes: t.notes,
  }))
}

/**
 * Which departments produce a given skill, across the sites a course actually
 * has. Replaces the static SKILL_DEPARTMENTS map for anything that needs to
 * name a real place rather than a category.
 *
 * Pass a campus for anything a student will act on. "Book pre-op" is only
 * useful if the pre-op named is one they can reach.
 */
export function unitsProducing(
  sites: AemtSite[],
  targetKey: string,
  /** Restrict to one campus. Omit to search every site the course has. */
  campus?: Market,
): {
  site: AemtSite
  unit: AemtSiteUnit
}[] {
  const out: { site: AemtSite; unit: AemtSiteUnit }[] = []
  for (const site of sites) {
    if (site.active === false) continue
    if (campus && siteCampus(site) !== campus) continue
    for (const unit of site.units ?? []) {
      if (unit.produces.includes(targetKey)) out.push({ site, unit })
    }
  }
  return out
}
