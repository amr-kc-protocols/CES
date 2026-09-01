// ---------------------------------------------------------------------------
// The icon set.
//
// This replaces emoji in the app's chrome — the bottom bar, the section
// landings, the page titles. Emoji were doing a job no emoji can do:
//
//   They are a different typeface. Every one is a full-colour bitmap drawn by
//   whichever platform is rendering it, so a nav bar of them is five unrelated
//   illustration styles sitting next to Public Sans. On Windows they are flat
//   and saturated, on macOS they are glossy and three-dimensional, and on
//   Android they are something else again. The app looked like a different
//   product on every device.
//
//   They cannot take a colour. An active tab could not tint its icon navy, so
//   the only available active state was making the emoji slightly bigger,
//   which reads as a rendering wobble rather than a selection.
//
//   They do not align. Emoji sit on their own baseline with their own optical
//   weight, which is why every icon-plus-text row in the app carried a
//   different ad-hoc nudge.
//
// These are single-path outline glyphs on a 24-unit grid, stroked rather than
// filled, inheriting `currentColor` and sized in `em` so they scale with the
// text they sit beside. One weight, one corner treatment, one visual density.
//
// SCOPE. Chrome only, deliberately. There are several hundred emoji left in
// prose and help text across the app, where an emoji in a sentence is a
// legitimate typographic mark rather than an interface element, and replacing
// those is a separate pass with a different argument behind it.
// ---------------------------------------------------------------------------

export type IconName =
  | 'home'
  | 'training'
  | 'academy'
  | 'aemt'
  | 'tools'
  | 'review'
  | 'simulator'
  | 'stethoscope'
  | 'bot'
  | 'reference'
  | 'book'
  | 'scales'
  | 'more'
  | 'chart'
  | 'trend'
  | 'calendar'
  | 'settings'
  | 'check'
  | 'alert'
  | 'clock'
  | 'ambulance'
  | 'clipboard'

/**
 * Path data only — every glyph shares the same `svg` element below, so stroke
 * width, cap and join are set once and cannot drift between icons.
 */
const PATHS: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.2V20h13V9.2M9.75 20v-5.5h4.5V20',
  training: 'M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Zm3.75 2.1v5.2c0 1.5 2.6 2.7 5.75 2.7s5.75-1.2 5.75-2.7v-5.2M20.5 9.2v5',
  academy: 'M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Zm3.75 2.1v5.2c0 1.5 2.6 2.7 5.75 2.7s5.75-1.2 5.75-2.7v-5.2M20.5 9.2v5',
  // A syringe: the AEMT credential's defining addition is vascular access.
  aemt: 'm13.5 5.5 5 5M16 3l5 5M4.5 19.5 3 21m1.5-1.5 2-6.5 6-6 4.5 4.5-6 6-6.5 2ZM9 12l3 3',
  tools: 'M4 8.5h16v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-10Zm5-.5V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V8M4 12.5h16',
  review: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 5 5',
  // A heart trace — the monitor is what the simulator drives.
  simulator: 'M3 12h3.5l2-4.5 3 9 2.5-6 1.5 3H21',
  stethoscope: 'M6 3v5a4.5 4.5 0 0 0 9 0V3M4.5 3H7m5.5 0H15m-4.5 9.5v2a5 5 0 0 0 10 0v-1.5m0-3.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5Z',
  bot: 'M12 3v3m-6 0h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm3 6v2m6-2v2m-6 5h6',
  reference: 'M6.5 3.5h11a1 1 0 0 1 1 1v13.2H7.2a2.7 2.7 0 0 0-2.7 2.7V6.2a2.7 2.7 0 0 1 2.7-2.7Zm-2 15.9a2.7 2.7 0 0 0 2.7 2.1h11.3M9.5 8h6',
  book: 'M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2.5 2.5 0 0 1 2 1 2.5 2.5 0 0 1 2-1h4.5A1.5 1.5 0 0 1 20 5.5v11a1.5 1.5 0 0 1-1.5 1.5H14a2.5 2.5 0 0 0-2 1 2.5 2.5 0 0 0-2-1H5.5A1.5 1.5 0 0 1 4 16.5v-11ZM12 6v12',
  scales: 'M12 4v16m-5.5 0h11M12 6.5 5 9m7-2.5L19 9M5 9l-2.5 5.5h5L5 9Zm14 0-2.5 5.5h5L19 9Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chart: 'M4 20V4m0 16h16M8 16.5v-5m4 5v-9m4 9v-3',
  trend: 'M4 20V4m0 16h16m-13-4.5 3.5-4 3 2.5L20 8m0 0h-3.5M20 8v3.5',
  calendar: 'M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-11ZM8 3.5V7m8-3.5V7M4 11h16',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-2.1a7.6 7.6 0 0 0 0-1.8l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-1.6-.9L15.1 3H8.9l-.4 2.4a7.5 7.5 0 0 0-1.6.9l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 1.8l-2 1.5 2 3.4 2.3-1c.5.4 1 .7 1.6.9l.4 2.4h6.2l.4-2.4c.6-.2 1.1-.5 1.6-.9l2.3 1 2-3.4-2-1.5Z',
  check: 'm5 12.5 4.5 4.5L19 7',
  alert: 'M12 8.5v4.5m0 3h.01M10.3 4.2 2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  clock: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 3.5V12l3 2',
  ambulance: 'M2.5 7.5A1.5 1.5 0 0 1 4 6h9.5a1.5 1.5 0 0 1 1.5 1.5V9h2.6a2 2 0 0 1 1.7 1l1.7 3v3.5h-2M2.5 16.5h1.6m5.3 0h5.7M15 16.5h1M2.5 7.5v9h1.6M15 9v7.5M6 18a1.9 1.9 0 1 0 0-3.8A1.9 1.9 0 0 0 6 18Zm11 0a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8ZM8.75 9v3.5M7 10.75h3.5',
  clipboard: 'M9 4.5H7.5A1.5 1.5 0 0 0 6 6v13a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V6a1.5 1.5 0 0 0-1.5-1.5H15M9 4.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 4.5M9 4.5A1.5 1.5 0 0 0 10.5 6h3A1.5 1.5 0 0 0 15 4.5M9 11.5h6m-6 4h4',
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[]

export function isIconName(v: string): v is IconName {
  return v in PATHS
}

export default function Icon({
  name,
  /** Multiplier on the current font size. 1 = cap height of the text beside it. */
  size = 1,
  className,
  title,
}: {
  name: IconName
  size?: number
  className?: string
  title?: string
}) {
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      viewBox="0 0 24 24"
      width={`${size}em`}
      height={`${size}em`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Decorative by default: every icon in this app sits beside its own
      // label, so announcing it again is noise for a screen reader. A `title`
      // is only passed where the icon stands alone.
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      focusable="false"
    >
      {title && <title>{title}</title>}
      {/* The ellipsis is the one glyph that is dots rather than a line, so a
          round-capped stroke rendered it as three hairlines. Filled circles
          at the same optical weight as the other icons' strokes. */}
      {name === 'more' ? (
        <g fill="currentColor" stroke="none">
          <circle cx="5.5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="18.5" cy="12" r="1.6" />
        </g>
      ) : (
        <path d={PATHS[name]} />
      )}
    </svg>
  )
}
