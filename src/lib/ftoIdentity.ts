// ---------------------------------------------------------------------------
// Who is this FTO? Maps a signed-in account email to the canonical FTO name
// (accounts follow firstname.lastname@gmr.net), and matches canonical names
// against free-text facilitator lines on academy schedule days ("Sexton",
// "Kenny", "Jessica Sexton or Miranda Burgoon" all count for scoring).
// ---------------------------------------------------------------------------

const FTO_BY_EMAIL_PREFIX: Record<string, string> = {
  'frank.alba': 'Frank Alba',
  'jason.bardwell': 'Jason Bardwell',
  'miranda.burgoon': 'Miranda Burgoon',
  'kenneth.denk': 'Kenny Denk',
  'eric.fournier': 'Eric Fournier',
  'joshua.hayden': 'Joshua Hayden',
  'david.richardson': 'David Richardson',
  'jessica.sexton': 'Jessica Sexton',
}

/** Canonical FTO name for a signed-in account, or undefined for non-FTOs. */
export function ftoNameForEmail(email?: string | null): string | undefined {
  if (!email) return undefined
  return FTO_BY_EMAIL_PREFIX[email.trim().toLowerCase().split('@')[0]]
}

// Nicknames and last names an admin might type on a schedule day.
const FTO_MATCHERS: Record<string, RegExp> = {
  'Frank Alba': /\bfrank\b|\balba\b/i,
  'Jason Bardwell': /\bjason\b|\bbardwell\b/i,
  'Miranda Burgoon': /\bmiranda\b|\bburgoon\b/i,
  'Kenny Denk': /\bkenn?y\b|\bkenneth\b|\bdenk\b/i,
  'Eric Fournier': /\beric\b|\bfournier\b/i,
  'Joshua Hayden': /\bjosh(ua)?\b|\bhayden\b/i,
  'David Richardson': /\bdav(id|e)\b|\brichardson\b/i,
  'Jessica Sexton': /\bjess(ica)?\b|\bsexton\b/i,
  'Jordan Jones': /\bjordan\b|\bjones\b/i,
}

/** Does a free-text facilitator line name this FTO? */
export function facilitatorLineNames(facilitators: string | undefined, ftoName: string): boolean {
  if (!facilitators) return false
  const re = FTO_MATCHERS[ftoName]
  return re ? re.test(facilitators) : facilitators.toLowerCase().includes(ftoName.toLowerCase())
}

/** Split a ' · '-joined facilitator line into trimmed, non-empty tokens. */
export function facilitatorTokens(facilitators: string | undefined): string[] {
  return (facilitators ?? '').split('·').map((t) => t.trim()).filter(Boolean)
}

/**
 * Add or remove an FTO from a facilitator line, preserving every other token
 * (CES, HR, corporate instructors, free-text names). Removing drops any token
 * that names this FTO (full name or the nickname/last name the matcher knows).
 */
export function toggleFacilitator(facilitators: string | undefined, ftoName: string): string {
  const tokens = facilitatorTokens(facilitators)
  if (facilitatorLineNames(facilitators, ftoName)) {
    const re = FTO_MATCHERS[ftoName]
    return tokens
      .filter((t) => !(re ? re.test(t) : t.toLowerCase().includes(ftoName.toLowerCase())))
      .join(' · ')
  }
  return [...tokens, ftoName].join(' · ')
}
