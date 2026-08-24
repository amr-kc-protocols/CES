// ---------------------------------------------------------------------------
// Interview transcript assist.
//
// A Teams meeting transcript (uploaded as .docx, or pasted in) is parsed into
// speaker turns, the candidate's answers are lifted out against the six
// structured questions, and a 1-5 suggestion is computed for each from
// deterministic, explainable signals drawn from the scoring anchors.
//
// This is a CONVENIENCE, not a decision. A selection interview is an EEOC
// selection procedure; the interviewer remains the scorer of record. Every
// answer here is editable and every suggestion is overridable — the function of
// this file is to save the interviewer from scoring six answers from memory,
// and to show its reasoning so a suggestion can be argued with rather than
// trusted.
//
// Everything below is pure and synchronous except docxToText, which unzips the
// Word file. No content is transcribed here; the questions and anchors live in
// data/aemtSelection.ts.
// ---------------------------------------------------------------------------

import type { InterviewQuestion } from '../data/aemtSelection'

export interface TranscriptTurn {
  speaker: string
  /** As written in the transcript, e.g. "0:03" or "00:01:12". */
  time?: string
  text: string
}

// ----- parsing --------------------------------------------------------------

/**
 * Teams writes a turn as a header line carrying the speaker and a timestamp,
 * then the spoken text on the following line(s):
 *
 *     Jordan Jones   0:03
 *     Thanks for coming in today.
 *
 * Some exports put the name and text on one line ("Name: text"), and the VTT
 * form tags the speaker inline. We accept the common shapes and treat anything
 * that is not a recognised header as a continuation of the current turn, so a
 * messy paste still lands as readable turns rather than being dropped.
 */
const HEADER_TIME = /^(.{1,60}?)\s{2,}(\d{1,2}:\d{2}(?::\d{2})?)\s*$/
const HEADER_TIME_LOOSE = /^(.{1,60}?)\s+(\d{1,2}:\d{2}(?::\d{2})?)\s*$/
const INLINE_COLON = /^([A-Z][^:]{1,48}?):\s+(\S.*)$/

export function parseTranscript(raw: string): TranscriptTurn[] {
  const turns: TranscriptTurn[] = []
  if (!raw) return turns
  const lines = raw.replace(/\r/g, '').split('\n')
  let current: TranscriptTurn | null = null
  const push = () => {
    if (current && current.text.trim()) {
      current.text = current.text.trim()
      turns.push(current)
    }
    current = null
  }
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      // Blank line ends a turn but is not itself content.
      continue
    }
    const mTime = HEADER_TIME.exec(line) || HEADER_TIME_LOOSE.exec(line)
    if (mTime && !/[.?!]$/.test(mTime[1])) {
      // "Name   0:03" — a header. The trailing-punctuation guard stops a spoken
      // sentence that merely ends in a clock-like token being read as a header.
      push()
      current = { speaker: mTime[1].trim(), time: mTime[2], text: '' }
      continue
    }
    const mColon = INLINE_COLON.exec(line)
    if (mColon && mColon[1].split(/\s+/).length <= 5) {
      // "Name: text" on one line.
      push()
      current = { speaker: mColon[1].trim(), text: mColon[2].trim() }
      continue
    }
    if (!current) {
      // Content before any header — an unattributed preamble.
      current = { speaker: '', text: line }
    } else {
      current.text += (current.text ? ' ' : '') + line
    }
  }
  push()
  return turns
}

/** Distinct speakers, most-spoken first — for choosing who the candidate is. */
export function listSpeakers(turns: TranscriptTurn[]): { name: string; turns: number; words: number }[] {
  const by = new Map<string, { name: string; turns: number; words: number }>()
  for (const t of turns) {
    const name = t.speaker || '(unlabelled)'
    const e = by.get(name) || { name, turns: 0, words: 0 }
    e.turns += 1
    e.words += t.text.split(/\s+/).filter(Boolean).length
    by.set(name, e)
  }
  return [...by.values()].sort((a, b) => b.words - a.words)
}

/**
 * Guess which speaker is the candidate: of the labelled speakers, the one who
 * says the most. In a structured interview the interviewers ask short questions
 * and the candidate does most of the talking, so word count separates them
 * cleanly. Always a guess the interviewer confirms.
 */
export function guessCandidate(turns: TranscriptTurn[]): string {
  const s = listSpeakers(turns).filter((x) => x.name !== '(unlabelled)')
  return s.length ? s[0].name : ''
}

// ----- segmentation ---------------------------------------------------------

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ')

/**
 * Lift the candidate's answer to each question out of the turns. Walk the
 * transcript; when a NON-candidate turn contains a question's match phrase, the
 * candidate turns that follow — up to the next question — are that answer.
 *
 * Returns qid -> answer text (empty where a question could not be located, so
 * the interviewer fills it in). Order of questions in the transcript is assumed
 * to follow the guide ("same questions, same order, every candidate"), but each
 * is matched independently so a skipped or re-ordered one does not cascade.
 */
export function segmentAnswers(
  turns: TranscriptTurn[],
  candidate: string,
  questions: InterviewQuestion[],
): Record<string, string> {
  const out: Record<string, string> = {}
  // Index of the turn where each question is asked.
  const askedAt = new Map<string, number>()
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i]
    if (t.speaker === candidate) continue
    const text = norm(t.text)
    for (const q of questions) {
      if (askedAt.has(q.id)) continue
      if (q.matchPhrases.some((p) => text.includes(norm(p)))) askedAt.set(q.id, i)
    }
  }
  const asked = [...askedAt.entries()].sort((a, b) => a[1] - b[1])
  for (let k = 0; k < asked.length; k++) {
    const [qid, start] = asked[k]
    const end = k + 1 < asked.length ? asked[k + 1][1] : turns.length
    const said: string[] = []
    for (let i = start + 1; i < end; i++) {
      if (turns[i].speaker === candidate) said.push(turns[i].text)
    }
    out[qid] = said.join('\n').trim()
  }
  for (const q of questions) if (!(q.id in out)) out[q.id] = ''
  return out
}

// ----- suggestion -----------------------------------------------------------

export interface Suggestion {
  score: number
  /** Plain-language reasons, shown so the suggestion can be argued with. */
  rationale: string[]
  confidence: 'low' | 'medium' | 'high'
}

const has = (text: string, res: RegExp[]) => res.some((r) => r.test(text))

// Signal vocabularies. Deliberately broad and shallow — this is a keyword
// proxy for the anchors, not comprehension, and it is labelled as such.
const SIG = {
  example: [/\b(for example|for instance|one time|last (year|month|week)|a few (months|weeks)|back when|there was a time|i remember)\b/],
  structure: [/\b(schedule|scheduled|every (morning|night|day|week)|each (morning|night|day)|routine|set aside|blocked out|block off|carved out|plan(ned|s|ning)?|a bit each|study(ing)? plan|flash ?cards|broke it (down|into)|arranged?|arranging|lined up|line up|set (it |things )?up|worked out|sorted (it |things )?out|talked to my|spoke to my|backup|cover(age|ed)?|swapped? shifts|moved my shifts)\b/],
  change: [/\b(changed|since then|from then on|started (to|doing)|now i|what i did differently|the next time|i began|i made sure|i learned to|as a result|going forward)\b/],
  progress: [/\b(passed|scored|improved|got faster|knew (it was working|i was)|tracked|kept (a )?track|quiz(zed|zes)?|tested myself|measured)\b/],
  earlyComms: [/\b(told (my|them|the)|let (them|him|her|everyone) know|gave (them )?notice|ahead of time|in advance|flagged it early|as soon as)\b/],
  triage: [/\b(prioriti[sz]ed|triage|trade[- ]?off|decided (to|what)|had to choose|dropped|put (.*)on hold|first thing was)\b/],
  ownership: [/\b(my (fault|mistake)|i was wrong|i owned|i should have|i take responsibility|on me|i messed up|i dropped the ball|i got it wrong)\b/],
  clarify: [/\b(asked (them |him |her )?(why|what|to explain)|wanted to understand|asked for (feedback|clarification)|went back and)\b/],
  roleTie: [/\b(patients?|practi[sc]e|scope of practice|als|advanced|skills|assessments?|the road|stay(ing)? (on|in) (the )?(road|field|truck)|long[- ]term|career (here|in ems)|this (service|company)|our (patients|community))\b/],
  dismissive: [/\b(no problem|not a problem|won'?t be an issue|it'?ll be fine|i'?ll (just )?make it work|nothing i can'?t handle|easy|piece of cake)\b/],
  blame: [/\b(their fault|not my fault|unfair|they were wrong|the (system|shift|schedule) (was|is)|because of (them|him|her)|wasn'?t my)\b/],
  payOnly: [/\b(money|pay|raise|paycheck|bump in pay|more per hour|financial)\b/],
  neverHappened: [/\b(never (really )?happened|can'?t think of|doesn'?t happen to me|that'?s never)\b/],
}

/**
 * A 1-5 suggestion for one answer, from the anchors' own signals. The shape is
 * the same for every question — an example, a structure/plan, a change or
 * outcome, plus one question-specific "5" signal — with a few negatives that
 * cap a weak answer. Everything it found (and did not) is returned as rationale.
 */
export function suggestScore(qid: string, answerRaw: string): Suggestion {
  const answer = norm(answerRaw)
  const words = answerRaw.split(/\s+/).filter(Boolean).length
  const rationale: string[] = []

  if (words < 8) {
    return {
      score: 1,
      confidence: answerRaw.trim() ? 'low' : 'low',
      rationale: [answerRaw.trim() ? 'Answer is very short — too little to assess.' : 'No answer text located — score by hand.'],
    }
  }

  const example = has(answer, SIG.example)
  const structure = has(answer, SIG.structure)
  const change = has(answer, SIG.change) || has(answer, SIG.progress)

  let score = 1
  // The first point is for substance — a real, developed answer. Gating it on a
  // *past* example alone under-scored the two forward-looking questions
  // (planning, motivation), which are specific in a different way.
  if (words >= 25) { score += 1; rationale.push('A substantial, developed answer (+1).') }
  else rationale.push('Fairly brief — the anchors reward a fuller, more specific answer.')
  if (example) rationale.push('Includes a specific example.')
  if (structure) { score += 1; rationale.push('Describes a plan, structure, or concrete arrangement (+1).') }
  if (change) { score += 1; rationale.push('Names a change, outcome, or how they knew it worked (+1).') }

  // Question-specific "5" signal.
  const five: Record<string, { ok: boolean; why: string }> = {
    q1: { ok: structure && change, why: 'protected time plus a way they knew it was working' },
    q2: { ok: has(answer, SIG.triage) && has(answer, SIG.earlyComms), why: 'triage/trade-offs and telling people early' },
    q3: { ok: has(answer, SIG.ownership) && change, why: 'specific ownership plus the change they made' },
    q4: { ok: structure && /\b(already|arranged|lined up|talked to|spoke to|set (it |things )?up|worked out|have (a )?plan)\b/.test(answer), why: 'specific arrangements already made' },
    q5: { ok: has(answer, SIG.clarify) && change, why: 'sought clarification and changed their practice' },
    q6: { ok: has(answer, SIG.roleTie), why: 'tied to how they want to practise and staying in the role' },
  }
  const f = five[qid]
  if (f?.ok) { score += 1; rationale.push(`Hits the top anchor — ${f.why} (+1).`) }

  // Negatives: cap a weak or off-key answer.
  if (has(answer, SIG.neverHappened)) { score = Math.min(score, 2); rationale.push('Claims it never happened — the anchors treat this as a 1-2.') }
  if (qid === 'q4' && has(answer, SIG.dismissive)) { score = Math.min(score, 2); rationale.push('Dismisses the difficulty ("no problem") — a worse bet than naming a real constraint.') }
  if ((qid === 'q3' || qid === 'q5') && has(answer, SIG.blame) && !has(answer, SIG.ownership)) {
    score = Math.min(score, 2); rationale.push('Frames it as someone else’s fault without owning it — a 1-2 on this question.')
  }
  if (qid === 'q6' && has(answer, SIG.payOnly) && !has(answer, SIG.roleTie)) {
    score = Math.min(score, 2); rationale.push('Motivation reads as pay alone — the anchors put this at 1.')
  }

  score = Math.max(1, Math.min(5, score))

  // Confidence: how much the text gives us to go on.
  const signalCount = [example, structure, change, f?.ok].filter(Boolean).length
  const confidence: Suggestion['confidence'] =
    words >= 60 && signalCount >= 2 ? 'high' : words >= 25 ? 'medium' : 'low'

  return { score, rationale, confidence }
}

// ----- .docx extraction -----------------------------------------------------

/**
 * Pull the plain text out of a Word .docx (a zip of XML). Teams writes one
 * paragraph per line, which is exactly the shape parseTranscript expects, so we
 * join paragraphs with newlines and let the parser take it from there.
 *
 * jszip is imported dynamically so it is only fetched when someone actually
 * uploads a file — a pasted transcript pulls in nothing.
 */
export async function docxToText(buf: ArrayBuffer): Promise<string> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(buf)
  const doc = zip.file('word/document.xml')
  if (!doc) throw new Error('That does not look like a Word document (no word/document.xml inside).')
  const xml = await doc.async('string')
  return docxXmlToText(xml)
}

/** Exported for testing without a real zip. */
export function docxXmlToText(xml: string): string {
  // Paragraph and line breaks become newlines; tab elements become spaces;
  // then w:t text runs are read in order and all remaining tags stripped.
  const withBreaks = xml
    .replace(/<w:tab\b[^>]*\/?>/g, '\t')
    .replace(/<w:br\b[^>]*\/?>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
  const texts: string[] = []
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|\n/g
  let m: RegExpExecArray | null
  while ((m = re.exec(withBreaks))) texts.push(m[1] === undefined ? '\n' : m[1])
  return decodeXmlEntities(texts.join(''))
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
}
