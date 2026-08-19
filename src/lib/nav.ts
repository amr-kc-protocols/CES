import { useMemo } from 'react'
import { useCan } from './role'
import { useSyncStatus } from './sync'
import { QA_ENABLED, CE_ENABLED } from '../config/features'

// ---------------------------------------------------------------------------
// The navigation tree.
//
// One source of truth with two consumers: the bottom bar draws the sections,
// and each section's landing screen draws that section's items. They cannot
// drift, because neither one keeps its own list.
//
// Why sections at all. A tab used to be the only way in, so every feature
// added a cell to the bar and the administrator's reached ten of them — 37px
// wide on a 375px phone, under Apple's 44pt floor and Google's 48dp. Worse,
// the bar's shape changed with the account: five cells for an FTO, ten for an
// administrator, ten again on a signed-out local install. Nothing sat in a
// stable place, so there was no position to learn.
//
// Sections are fixed and the leaves move inside them. Routes are untouched —
// /academy, /aemt, /simulator, /history and the rest keep their paths — so
// bookmarks, shared links, the browser's last-visited URL and anything the
// service worker already cached all still resolve. A section tab lights up
// whenever the current path is one of its items' (or a child of one).
// ---------------------------------------------------------------------------

/**
 * What an account must be able to do for an item to appear.
 *
 * These are names of capabilities, not a second copy of the rules: every one
 * resolves through useCan(), which mirrors the server's row-level security.
 * `adminSignedIn` is the stricter gate History and CQMP have always used —
 * the signed-out "local admin" convenience deliberately does not satisfy it.
 */
export type NavGate = 'always' | 'manageAcademy' | 'manageAemt' | 'reviewCharts' | 'adminSignedIn'

export interface NavItem {
  to: string
  label: string
  icon: string
  /** One line under the label on the landing screen, when there is no live count to show instead. */
  blurb: string
  gate: NavGate
  /** Extra path roots that belong to this item — screens it owns that sit outside its own path. */
  match?: string[]
  /**
   * The screen supplies its own padding and chrome, so the shell drops the
   * 900px reading column. Declared here rather than as a path test in Layout:
   * it is a fact about the screen, and keeping it beside the route is what
   * stops the shell from growing a second list of paths.
   */
  fullBleed?: boolean
}

export interface NavSection {
  to: string
  /** Tab label. Kept to one word: at five cells there is room, but not for two. */
  label: string
  icon: string
  /** Heading on the landing screen. */
  title: string
  blurb: string
  items: NavItem[]
}

export const HOME = { to: '/', label: 'Home', icon: '🏠' }

export const SECTIONS: NavSection[] = [
  {
    to: '/training',
    label: 'Training',
    icon: '🎓',
    title: 'Training',
    blurb: 'The two programs that carry cohorts, students and records',
    items: [
      {
        to: '/academy',
        label: 'NEOP',
        icon: '🎓',
        blurb: 'New Employee Orientation — cohorts, checklists and FTO release',
        gate: 'always',
      },
      // AEMT holds Kansas certification records and cohort-selection data
      // about staff who are peers of the FTOs using this app daily, so it
      // keeps its own capability rather than riding on the plain admin flag.
      {
        to: '/aemt',
        label: 'AEMT',
        icon: '💉',
        blurb: 'Kansas-approved certification course — roster, hours and records',
        gate: 'manageAemt',
      },
    ],
  },
  {
    to: '/tools',
    label: 'Tools',
    icon: '🧰',
    title: 'Tools',
    blurb: 'Instruments you run against real charts and real crews',
    items: [
      // Chart review takes patient care reports as input and must stay hidden
      // from the crews whose own transports it reviews.
      {
        to: '/review',
        label: 'Chart review',
        icon: '🔎',
        blurb: 'Emergent-transport justification and medical necessity',
        gate: 'reviewCharts',
        // A dense chart table the reading column would squeeze into uselessness.
        fullBleed: true,
      },
      // The simulator holds no records; it is the instructor's console, and an
      // instructor running a scenario off a laptop is exactly who it is for —
      // hence manageAcademy rather than the stricter signed-in admin gate.
      {
        to: '/simulator',
        label: 'Simulator',
        icon: '🫀',
        blurb: 'Patient monitor and facilitator console for the quarterly scenarios',
        gate: 'manageAcademy',
        // Frames the facilitator console at whatever width the screen has.
        fullBleed: true,
      },
      ...(QA_ENABLED
        ? ([
            { to: '/qa', label: 'QA review', icon: '🩺', blurb: 'Sampling queue and chart scoring', gate: 'always' },
            { to: '/bot', label: 'QA Bot', icon: '🤖', blurb: 'Background chart folder sync', gate: 'always' },
          ] as NavItem[])
        : []),
    ],
  },
  {
    to: '/reference',
    label: 'Reference',
    icon: '📚',
    title: 'Reference',
    blurb: 'What to read, and what the regulators actually require',
    items: [
      {
        to: '/courses',
        label: 'Resources',
        icon: '📚',
        blurb: 'Self-study modules, field guides and how-tos',
        gate: 'always',
      },
      {
        to: '/ems',
        label: 'Regulations',
        icon: '⚖️',
        blurb: 'Kansas and Missouri EMS rules, CE requirements and regulators',
        gate: 'always',
      },
    ],
  },
  {
    to: '/more',
    label: 'More',
    icon: '⋯',
    title: 'More',
    blurb: 'Reporting, past classes and this device',
    items: [
      // Unredacted survey feedback naming FTOs. HistoryView enforces the same
      // rule again on the screen itself — hiding a tab is not access control.
      {
        to: '/history',
        label: 'Class history',
        icon: '📊',
        blurb: 'Past classes, exit surveys and FTO feedback',
        gate: 'adminSignedIn',
      },
      {
        to: '/cqmp',
        label: 'CQMP',
        icon: '📈',
        blurb: 'Monthly KPI review deck for clinical leadership',
        gate: 'adminSignedIn',
      },
      ...(CE_ENABLED
        ? ([{ to: '/ce', label: 'CE', icon: '📅', blurb: 'Kansas CE deadline tracker', gate: 'always' }] as NavItem[])
        : []),
      {
        to: '/settings',
        label: 'Settings',
        icon: '⚙️',
        blurb: 'Account, market, sync and the instrument templates',
        // Templates has no tab of its own; it is opened from Settings, and the
        // More tab should stay lit while you are in it.
        match: ['/templates'],
        gate: 'always',
      },
    ],
  },
]

/**
 * Segment-aware prefix test: '/ems' matches '/ems' and '/ems/x', never
 * '/emsreference'. A plain startsWith would light the wrong tab the first time
 * two routes share an opening word.
 */
export function under(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(to.endsWith('/') ? to : `${to}/`)
}

/** Every path root a section owns — its own, its items', and their extras. */
export function rootsOf(section: NavSection): string[] {
  return [section.to, ...section.items.flatMap((i) => [i.to, ...(i.match ?? [])])]
}

/**
 * The section the current path belongs to, or undefined off-tree (the intake
 * and exam pages, which render outside the shell, and the catch-all).
 *
 * Matched against the full tree rather than the visible one: a deep link an
 * account cannot open still renders inside a section, and the gate screen it
 * lands on should not also strand the bar with nothing lit.
 */
export function sectionOf(pathname: string): NavSection | undefined {
  return SECTIONS.find((s) => rootsOf(s).some((r) => under(pathname, r)))
}

/** Whether the screen at this path drops the shell's reading column. */
export function isFullBleed(pathname: string): boolean {
  return SECTIONS.some((s) =>
    s.items.some((i) => i.fullBleed && [i.to, ...(i.match ?? [])].some((r) => under(pathname, r))),
  )
}

/** What the gates above resolve to for one account. */
export interface NavAccess {
  manageAcademy: boolean
  manageAemt: boolean
  reviewCharts: boolean
  adminSignedIn: boolean
}

/**
 * The tree this account can actually open.
 *
 * A section with nothing left in it is dropped rather than shown empty — a
 * signed-in FTO has neither chart review nor the simulator, so Tools would be
 * a tab leading to an apology. That is the one place the bar still changes
 * shape by role, and it costs a cell, not five.
 *
 * Pure, and separate from the hook, so the role matrix can be checked without
 * a browser or a signed-in session — see scripts/check-nav.mjs.
 */
export function visibleSections(access: NavAccess): NavSection[] {
  const allowed = (g: NavGate) => g === 'always' || access[g]
  return SECTIONS.map((s) => ({ ...s, items: s.items.filter((i) => allowed(i.gate)) })).filter(
    (s) => s.items.length > 0,
  )
}

export function useVisibleNav(): NavSection[] {
  const { manageAcademy, manageAemt, reviewCharts } = useCan()
  const { signedIn, role } = useSyncStatus()
  const adminSignedIn = signedIn && role === 'admin'
  return useMemo(
    () => visibleSections({ manageAcademy, manageAemt, reviewCharts, adminSignedIn }),
    [manageAcademy, manageAemt, reviewCharts, adminSignedIn],
  )
}

/** One section, filtered the same way — what its landing screen should list. */
export function useSection(to: string): NavSection | undefined {
  return useVisibleNav().find((s) => s.to === to)
}
