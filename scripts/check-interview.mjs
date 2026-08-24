// Behaviour check for the interview transcript assist.
//
// The parsing, segmentation and scoring in src/lib/interviewTranscript.ts pre-
// fill the interview scoring form from a Teams transcript. It is a convenience,
// so the bar here is not that it scores perfectly — it cannot — but that it
// attributes the right speaker, lifts the right answer under the right
// question, and that its 1-5 suggestions move in the direction the anchors do:
// a strong answer high, a dismissive or pay-only answer low.
//
// Run: node scripts/check-interview.mjs  (or `npm run check:interview`)
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { rmSync } from 'node:fs'
import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')
const OUT = join(tmpdir(), `ces-interview-check-${process.pid}.mjs`)

await build({
  stdin: {
    contents: `
      export { parseTranscript, listSpeakers, guessCandidate, segmentAnswers,
               suggestScore, docxXmlToText, docxToText } from ${JSON.stringify(join(SRC, 'lib/interviewTranscript'))}
      export { INTERVIEW_QUESTIONS } from ${JSON.stringify(join(SRC, 'data/aemtSelection'))}
    `,
    resolveDir: SRC,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: OUT,
  // jszip is bundled (not external) so docxToText can be exercised end to end
  // against a real .docx below.
})
const m = await import(pathToFileURL(OUT).href)
rmSync(OUT, { force: true })

const { parseTranscript, guessCandidate, segmentAnswers, suggestScore, docxXmlToText, docxToText, INTERVIEW_QUESTIONS } = m

let checks = 0
const fails = []
const ok = (cond, msg) => {
  checks++
  if (!cond) fails.push(msg)
}

// A representative Teams-style transcript: "Name   m:ss" headers, then speech.
const TRANSCRIPT = `
Jordan Jones   0:03
Thanks for coming in. Tell me about something you've learned or gotten better at in the last year that nobody required you to. Walk me through how you actually went about it.

Alex Rivera   0:20
Sure. Last year I decided to get better at 12-lead interpretation. I set aside twenty minutes every morning before shift and worked through a deck of flashcards. I tracked how many I got right each week, and I knew it was working because my accuracy went from about half to nearly all of them.

Jordan Jones   1:10
Describe a stretch when work, home, and something else you'd committed to all landed at once. What did you actually do?

Alex Rivera   1:25
There was a time my overtime, a family move, and a CE deadline all landed the same week. I prioritized the CE because it had a hard date, told my partner early that I couldn't help that weekend, and dropped a gym commitment.

Jordan Jones   2:30
Tell me about a time you failed at something that mattered to you. What happened next?

Alex Rivera   2:40
I failed my first certification attempt. It was my fault, I hadn't studied enough. What I did differently was build a schedule, and I passed the second time.

Jordan Jones   3:30
You've heard what the schedule is. Looking at that against your next six months, where do you see the pressure points, and what's your plan for them?

Alex Rivera   3:45
The clinical shifts are the pressure point. I've already talked to my supervisor and arranged to move my regular shifts, and lined up a backup for the early mornings.

Jordan Jones   4:30
Tell me about a time someone corrected you on a call or on a report. How did you take it, and what happened after?

Alex Rivera   4:40
My FTO corrected my documentation. I asked them to explain what was missing, and from then on I changed how I write my narratives.

Jordan Jones   5:20
Why AEMT, and why now?

Alex Rivera   5:30
I want to expand my scope of practice so I can do more for my patients on the road, and I plan to stay in the field here long term.
`

const turns = parseTranscript(TRANSCRIPT)
ok(turns.length === 12, `parses 12 turns (got ${turns.length})`)
ok(turns[0].speaker === 'Jordan Jones' && turns[0].time === '0:03', 'reads the speaker and timestamp of a header')
ok(/Thanks for coming in/.test(turns[0].text), 'keeps the spoken text with its speaker')
ok(guessCandidate(turns) === 'Alex Rivera', `picks the candidate by word count (got "${guessCandidate(turns)}")`)

const ans = segmentAnswers(turns, 'Alex Rivera', INTERVIEW_QUESTIONS)
ok(INTERVIEW_QUESTIONS.every((q) => ans[q.id]), 'lifts an answer for every question')
ok(/12-lead interpretation/.test(ans.q1), 'q1 answer is the candidate’s, not the interviewer’s')
ok(!/Walk me through/.test(ans.q1), 'the interviewer’s question is not folded into the answer')
ok(/scope of practice/.test(ans.q6), 'q6 answer lands under q6, not an earlier question')

// Suggestions move with the anchors. The scripted candidate is strong.
for (const q of INTERVIEW_QUESTIONS) {
  const s = suggestScore(q.id, ans[q.id])
  ok(s.score >= 1 && s.score <= 5, `${q.id}: suggestion in range (got ${s.score})`)
  ok(Array.isArray(s.rationale) && s.rationale.length > 0, `${q.id}: suggestion carries its reasoning`)
}
ok(suggestScore('q1', ans.q1).score >= 4, `a strong self-directed-learning answer scores high (${suggestScore('q1', ans.q1).score})`)
ok(suggestScore('q3', ans.q3).score >= 4, `owning a failure with a named change scores high (${suggestScore('q3', ans.q3).score})`)
ok(suggestScore('q4', ans.q4).score >= 4, `specific arrangements already made scores high (${suggestScore('q4', ans.q4).score})`)

// The negatives cap weak answers.
const dismissive = suggestScore('q4', "Honestly no problem, I'll just make it work. It won't be an issue for me at all.")
ok(dismissive.score <= 2, `a dismissive "no problem" plan is capped low (${dismissive.score})`)
const payOnly = suggestScore('q6', 'Mostly the pay. The raise would really help me out financially right now.')
ok(payOnly.score <= 2, `motivation that is pay alone is capped low (${payOnly.score})`)
const blame = suggestScore('q3', "It wasn't my fault, the schedule was unfair and they set me up to fail.")
ok(blame.score <= 2, `blaming a failure without owning it is capped low (${blame.score})`)
const empty = suggestScore('q2', '')
ok(empty.score === 1 && /by hand|no answer/i.test(empty.rationale[0]), 'an empty answer defers to the interviewer')

// Two interviewers should get the same suggestion for the same text — it is a
// function of the words, nothing hidden.
ok(
  suggestScore('q1', ans.q1).score === suggestScore('q1', ans.q1).score,
  'suggestions are deterministic',
)

// .docx text extraction: paragraphs become lines, runs are joined, tags gone.
const XML =
  '<w:document><w:body>' +
  '<w:p><w:r><w:t>Jordan Jones</w:t></w:r><w:r><w:t xml:space="preserve">   0:03</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Tell me about</w:t></w:r><w:r><w:t xml:space="preserve"> something &amp; nothing.</w:t></w:r></w:p>' +
  '</w:body></w:document>'
const text = docxXmlToText(XML)
ok(/^Jordan Jones\s+0:03$/m.test(text), 'docx: a speaker header comes out on its own line')
ok(/Tell me about something & nothing\./.test(text), 'docx: runs join and entities decode')
ok(!/<w:/.test(text), 'docx: no XML tags survive')
const roundtrip = parseTranscript(text)
ok(roundtrip[0].speaker === 'Jordan Jones', 'docx text parses back into turns')

// A real .docx, end to end through jszip — the exact path a file upload hits.
// Build one with the same `docx` library the app already depends on, one
// paragraph per transcript line, then extract and run the whole pipeline.
{
  const { Document, Packer, Paragraph, TextRun } = await import('docx')
  const lines = TRANSCRIPT.split('\n')
  const doc = new Document({
    sections: [
      {
        children: lines.map(
          (l) => new Paragraph({ children: [new TextRun(l)] }),
        ),
      },
    ],
  })
  const buf = await Packer.toBuffer(doc)
  ok(buf && buf.length > 0, 'built a real .docx to test the upload path')
  const extracted = await docxToText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  ok(/Jordan Jones\s+0:03/.test(extracted), 'docxToText pulls the text out of a real Word file (jszip path)')
  const dturns = parseTranscript(extracted)
  ok(guessCandidate(dturns) === 'Alex Rivera', 'the extracted .docx identifies the candidate')
  const dans = segmentAnswers(dturns, 'Alex Rivera', INTERVIEW_QUESTIONS)
  ok(INTERVIEW_QUESTIONS.every((q) => dans[q.id]), 'the extracted .docx segments into all six answers')
  ok(suggestScore('q1', dans.q1).score >= 4, 'and scores the strong answer high end to end')

  // A file that is not a Word document fails cleanly rather than throwing raw.
  let msg = ''
  try {
    await docxToText(new TextEncoder().encode('this is not a zip').buffer)
  } catch (e) {
    msg = String(e.message || e)
  }
  ok(msg !== '', 'a non-.docx upload throws a handled error, not a crash')
}

// ----- parser robustness across the shapes a transcript arrives in ----------
{
  // Inline "Name: text", one line per turn.
  const inline = parseTranscript(
    'Jordan Jones: Why AEMT, and why now?\nAlex Rivera: I want to widen my scope of practice for my patients.',
  )
  ok(inline.length === 2 && inline[1].speaker === 'Alex Rivera', 'parses inline "Name: text" turns')
  ok(/scope of practice/.test(inline[1].text), 'inline: keeps the spoken text')

  // Hour-length timestamps (00:01:12) and multi-line answers.
  const hours = parseTranscript(
    'Interviewer   00:00:05\nTell me about a time you failed at something that mattered to you. What happened next?\nCandidate   00:01:12\nI failed a check-off.\nIt was my fault and I changed how I prepared.',
  )
  ok(hours.length === 2, 'parses HH:MM:SS headers')
  ok(/I failed a check-off\.\s+It was my fault/.test(hours[1].text), 'joins multi-line speech into one turn')

  // A clock-like sentence ending is not mistaken for a header.
  const notHeader = parseTranscript('Alex Rivera   0:20\nI got in at 8:30.')
  ok(notHeader.length === 1 && /8:30/.test(notHeader[0].text), 'a time inside a sentence is not read as a new speaker')

  // Segmentation degrades gracefully: a question never asked stays empty, and
  // the surrounding ones are unaffected.
  const partial = parseTranscript(
    'Jordan Jones   0:03\nWhy AEMT, and why now?\nAlex Rivera   0:10\nBecause I want to do more for patients on the road long term.',
  )
  const pans = segmentAnswers(partial, 'Alex Rivera', INTERVIEW_QUESTIONS)
  ok(/patients on the road/.test(pans.q6), 'the one question asked is captured')
  ok(pans.q1 === '' && pans.q2 === '', 'questions never asked are left empty for the interviewer')

  // No candidate speech at all -> all empty, no throw.
  const noCand = segmentAnswers(parseTranscript('Jordan Jones   0:03\nWhy AEMT, and why now?'), 'Nobody', INTERVIEW_QUESTIONS)
  ok(INTERVIEW_QUESTIONS.every((q) => noCand[q.id] === ''), 'no candidate speech yields empty answers, not a crash')

  // Determinism across the whole set, byte for byte.
  const once = INTERVIEW_QUESTIONS.map((q) => suggestScore(q.id, ans[q.id]).score).join(',')
  const twice = INTERVIEW_QUESTIONS.map((q) => suggestScore(q.id, ans[q.id]).score).join(',')
  ok(once === twice, 'the whole suggestion set is deterministic')
}

if (fails.length) {
  console.error(`check-interview: ${fails.length} of ${checks} checks failed\n`)
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`check-interview: ${checks} checks passed`)
