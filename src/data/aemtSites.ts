// ---------------------------------------------------------------------------
// Where students are placed, and what each department actually produces.
//
// The `produces` lists are the difference between a calendar and a scheduling
// tool. A student projecting fourteen of twenty venipunctures does not need "a
// shift" — they need pre-op, because that is where the sticks are. Everything
// downstream that routes a student somewhere reads these lists.
//
// The weekly caps are a WORKING ASSUMPTION, not a commitment. AdventHealth has
// not answered on capacity, so every hospital department is seeded at one
// student per week, which is the conservative reading and also the number that
// makes the schedule hard: five students against six departments means no two
// people in pre-op in the same week. Caps are editable per unit — when the real
// numbers arrive it is a form, not a code change.
//
// Prairie Star is present and inactive. It is covered by the same affiliation
// agreement, but patient volume there is too low to be worth a rotation, so it
// stays on file as a toggle rather than being deleted and re-entered if that
// ever changes.
// ---------------------------------------------------------------------------

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
 * eighteen shifts are field shifts — sixty of the ninety placements — so field
 * capacity, not hospital capacity, is what decides whether the rotation fits.
 * At one truck per agency per week the board reports a large shortfall, and it
 * is right to: that is the question to take to the CES, not a bug to tune away.
 */
export const FIELD_UNITS: UnitTemplate[] = [
  {
    name: '911 ambulance',
    produces: ['assessment', 'assessmentField', 'calls', 'pcr', 'venipuncture', 'ecg'],
    notes:
      'Cap = FTO-staffed trucks that can take a student in a week. Seeded at one pending the Independence CES.',
  },
]

export interface SiteTemplate {
  name: string
  kind: 'clinical' | 'field'
  active: boolean
  units: UnitTemplate[]
  note?: string
}

export const SITE_TEMPLATES: SiteTemplate[] = [
  {
    name: 'AdventHealth Shawnee Mission',
    kind: 'clinical',
    active: true,
    units: HOSPITAL_UNITS,
  },
  {
    name: 'AdventHealth South Overland Park',
    kind: 'clinical',
    active: true,
    units: HOSPITAL_UNITS,
    note: 'Second active campus under the same agreement. Doubles the venipuncture capacity, which the Phase 2 arithmetic depends on.',
  },
  {
    name: 'AdventHealth Prairie Star',
    kind: 'clinical',
    active: false,
    units: HOSPITAL_UNITS,
    note: 'Covered by the agreement but not rotated through — patient volume too low to be worth a placement.',
  },
  {
    name: 'AMR Independence',
    kind: 'field',
    active: true,
    units: FIELD_UNITS,
    note: 'Urban 911. Placement depends on FTO availability, which comes from the Independence CES.',
  },
  {
    name: 'AMR Linn County',
    kind: 'field',
    active: true,
    units: FIELD_UNITS,
    note: 'Rural 911. Lower call volume, longer transports.',
  },
]

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
 */
export function unitsProducing(sites: AemtSite[], targetKey: string): {
  site: AemtSite
  unit: AemtSiteUnit
}[] {
  const out: { site: AemtSite; unit: AemtSiteUnit }[] = []
  for (const site of sites) {
    if (site.active === false) continue
    for (const unit of site.units ?? []) {
      if (unit.produces.includes(targetKey)) out.push({ site, unit })
    }
  }
  return out
}
