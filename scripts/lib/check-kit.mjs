// Shared behaviour for the check scripts, in one place because getting it
// wrong is silent by construction.
//
// A check has three outcomes, not two: it passed, it failed, or it never ran.
// The third is the dangerous one. `npm run check` chains twenty scripts with
// `&&`, so the only thing separating "green" from "nothing happened" is a line
// of console output nobody reads on the way past.
//
// Two of those have already cost real coverage in this repo:
//
//   - check-simulator and check-checkoff exit 0 on a checkout with no jsdom,
//     which is every fresh clone until `npm install`. `npm run check` prints
//     "skipping" twice and still exits 0, and 734 assertions did not run.
//   - check-reach held its 44pt list in a selector string. Three of the names
//     in it were deleted along with the UI they described, and a selector that
//     matches nothing raises nothing: the panel's grading controls stopped
//     being measured while the check went on reporting a pass.
//
// So: skips say SKIPPED in a shape that greps, name what would make them run,
// and CES_CHECK_STRICT=1 turns them into failures for anywhere that wants
// "ran and passed" rather than "did not fail".

export const STRICT = process.env.CES_CHECK_STRICT === '1'

// Exits: 0 normally, 1 under CES_CHECK_STRICT. Never returns.
export function skip(script, reason, hint = '') {
  const how = hint ? `  (${hint})` : ''
  if (STRICT) {
    console.error(`${script}: SKIPPED — ${reason}${how}`)
    console.error(`${script}: CES_CHECK_STRICT is set, and a check that did not run is not a pass.`)
    process.exit(1)
  }
  console.log(`${script}: SKIPPED — ${reason}${how}`)
  console.log(`${script}: nothing was verified. Set CES_CHECK_STRICT=1 to make this a failure.`)
  process.exit(0)
}

// A selector list that has gone stale is the same failure wearing different
// clothes: it reports a pass because it asked nothing. Give it the selectors
// that were actually seen to match something, and it names the ones that never
// did rather than letting them sit in the list looking like coverage.
export function unmatched(selectors, seen) {
  return selectors.filter((s) => !seen.has(s))
}
