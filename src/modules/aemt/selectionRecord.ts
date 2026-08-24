// ---------------------------------------------------------------------------
// Candidate selection record.
//
// A defensible, filed document of how a candidate was scored for a cohort seat.
// It records the interview in full — every question, every interviewer's 1-5
// and what the candidate actually said — sets it inside the whole composite,
// and then JUSTIFIES the procedure: the weights and thresholds, the two-scorer
// method, the fairness rules, and the instruments it all comes from. A record
// that has to stand up in an HR file or under the EEOC Uniform Guidelines has
// to explain itself, not just report a number.
//
// Built as HTML and handed to the same printDoc / downloadDoc the rest of the
// app uses (browser print -> PDF, or an editable .doc), and fingerprinted with
// a SHA-256 over the scoring facts so a filed copy is tamper-evident — the same
// idea as the course audit package.
//
// The instruments are docs/aemt-selection-test.md and
// docs/aemt-selection-interview.md; the numbers all come from
// data/aemtSelection.ts. Nothing here invents a weight or a threshold.
// ---------------------------------------------------------------------------

import { esc } from '../academy/docGen'
import { formatDateTime } from '../../lib/date'
import {
  SELECTION_WEIGHTS,
  BONUS_TIERS,
  THRESHOLDS,
  TEST_SECTIONS,
  INTERVIEW_QUESTIONS,
  INTERVIEW_MAX,
  ELIGIBILITY_GATES,
  PROHIBITED_TOPICS,
} from '../../data/aemtSelection'
import type { CandidateScore } from './aemtStore'
import type { AemtCandidate, AemtCourse } from '../../types'

// ----- provenance -----------------------------------------------------------

/**
 * A SHA-256 over the scoring facts (not the generation time), so a filed record
 * can be re-hashed and checked. On an insecure origin crypto.subtle is absent;
 * we return null and the record says the fingerprint is unavailable rather than
 * printing a fake one — the same honesty the audit package keeps.
 */
export async function recordFingerprint(c: AemtCandidate, score: CandidateScore): Promise<string | null> {
  const facts = {
    id: c.id,
    name: c.name,
    employeeNumber: c.employeeNumber ?? null,
    examPercent: c.examPercent ?? null,
    testMarks: c.testMarks ?? null,
    qaPercent: c.qaPercent ?? null,
    attendancePercent: c.attendancePercent ?? null,
    bonusTier: c.bonusTier ?? 'none',
    gates: c.gates ?? {},
    interviews: (c.interviews ?? []).map((i) => ({ scorer: i.scorer, at: i.at, scores: i.scores, notes: i.notes ?? {} })),
    decision: c.decision ?? null,
    decidedBy: c.decidedBy ?? null,
    decidedAt: c.decidedAt ?? null,
    composite: Number(score.composite.toFixed(2)),
    base: Number(score.base.toFixed(2)),
    bonus: score.bonus,
  }
  const json = JSON.stringify(facts)
  if (!globalThis.crypto?.subtle) return null
  const bytes = new TextEncoder().encode(json)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ----- small helpers --------------------------------------------------------

const pct = (n: number | undefined) => (n === undefined ? '—' : `${n.toFixed(0)}%`)
const bonusLabel = (id: string | undefined) =>
  BONUS_TIERS.find((b) => b.id === (id ?? 'none'))?.label ?? 'None recorded'

function interviewTotals(c: AemtCandidate): { scorer: string; total: number; at: string }[] {
  return (c.interviews ?? []).map((i) => ({
    scorer: i.scorer,
    at: i.at,
    total: Object.values(i.scores).reduce((n, v) => n + v, 0),
  }))
}

/** Questions where the two interviewers differ by 2 or more — discuss, not average. */
function disagreements(c: AemtCandidate): string[] {
  const iv = c.interviews ?? []
  if (iv.length < 2) return []
  const out: string[] = []
  for (const q of INTERVIEW_QUESTIONS) {
    const vals = iv.map((i) => i.scores[q.id]).filter((v) => typeof v === 'number') as number[]
    if (vals.length >= 2 && Math.max(...vals) - Math.min(...vals) >= 2) out.push(q.label)
  }
  return out
}

// ----- sections -------------------------------------------------------------

function decisionBadge(c: AemtCandidate): string {
  const map: Record<string, string> = { advance: 'ADVANCE', hold: 'HOLD', declined: 'DO NOT ADVANCE' }
  const label = c.decision ? map[c.decision] : 'No final decision recorded'
  const colour = c.decision === 'advance' ? '#166534' : c.decision === 'declined' ? '#b91c1c' : '#92400e'
  const by = c.decidedBy ? ` &nbsp; <span class="sub2">by ${esc(c.decidedBy)}${c.decidedAt ? `, ${esc(formatDateTime(c.decidedAt))}` : ''}</span>` : ''
  return `<span class="badge" style="background:${colour}">${label}</span>${by}`
}

function compositeTable(c: AemtCandidate, score: CandidateScore): string {
  const rows = SELECTION_WEIGHTS.map((w) => {
    const raw = score[w.id]
    const weighted = raw === undefined ? 0 : (raw * w.weight) / 100
    return `<tr>
      <td>${esc(w.label)}</td>
      <td class="num">${w.weight}%</td>
      <td class="num">${pct(raw)}</td>
      <td class="num">${raw === undefined ? '—' : weighted.toFixed(1)}</td>
      <td>${esc(w.source)}</td>
    </tr>`
  }).join('')
  const passes = score.complete && score.composite >= THRESHOLDS.composite && score.blockers.length === 0
  return `
  <h2>Composite score</h2>
  <table>
    <tr><th>Component</th><th class="num">Weight</th><th class="num">Raw</th><th class="num">Weighted</th><th>Source</th></tr>
    ${rows}
    <tr><td colspan="3"><strong>Base (of 100)</strong></td><td class="num"><strong>${score.base.toFixed(1)}</strong></td><td>Sum of weighted components</td></tr>
    <tr><td colspan="3">Additional-duty bonus — ${esc(bonusLabel(c.bonusTier))}</td><td class="num">${score.bonus > 0 ? '+' + score.bonus : '0'}</td><td>Decides a tie only; cannot carry a candidate over threshold</td></tr>
    <tr><td colspan="3"><strong>Composite (of 105)</strong></td><td class="num"><strong>${score.composite.toFixed(1)}</strong></td><td>Threshold ${THRESHOLDS.composite}</td></tr>
  </table>
  <p><strong>Result against the ${THRESHOLDS.composite} threshold:</strong>
     ${passes ? '<span class="badge" style="background:#166534">Clears every threshold</span>'
              : '<span class="flag">Does not clear</span>'}
     ${score.complete ? '' : ' &nbsp; <span class="sub2">(not all components scored yet)</span>'}</p>
  ${score.blockers.length ? `<div class="note"><strong>Blocking advancement:</strong><ul>${score.blockers.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}`
}

function gatesTable(c: AemtCandidate): string {
  const rows = ELIGIBILITY_GATES.map((g) => {
    const met = c.gates?.[g.id] === true
    return `<tr><td>${esc(g.label)}</td><td>${met ? '✓ met' : '<span class="flag">not met</span>'}</td><td class="sub2">${esc(g.note)}</td></tr>`
  }).join('')
  return `
  <h2>Eligibility (pass / fail — a candidate failing any of these is not scored)</h2>
  <table><tr><th>Gate</th><th>Status</th><th>Note</th></tr>${rows}</table>`
}

function interviewSection(c: AemtCandidate, score: CandidateScore): string {
  const iv = c.interviews ?? []
  if (!iv.length) {
    return `<h2>Structured interview</h2><p class="note">No interview recorded for this candidate.</p>`
  }
  const totals = interviewTotals(c)
  const perScorer = iv
    .map((entry) => {
      const rows = INTERVIEW_QUESTIONS.map((q) => {
        const s = entry.scores[q.id]
        const note = entry.notes?.[q.id] ?? ''
        return `<tr>
          <td><strong>${esc(q.label)}</strong><div class="sub2">“${esc(q.question)}”</div></td>
          <td class="slot">${s ?? '—'}</td>
          <td>${note ? esc(note) : '<span class="sub2">— no note —</span>'}</td>
        </tr>`
      }).join('')
      const total = Object.values(entry.scores).reduce((n, v) => n + v, 0)
      return `
      <h3 style="margin:10px 0 4px">Interviewer: ${esc(entry.scorer)} <span class="sub2">${entry.at ? '· ' + esc(formatDateTime(entry.at)) : ''}</span></h3>
      <table>
        <tr><th>Question (scored 1–5 on the anchors below)</th><th class="slot">Score</th><th>What the candidate said</th></tr>
        ${rows}
        <tr><td><strong>Interview total</strong></td><td class="slot"><strong>${total}</strong></td><td>of ${INTERVIEW_MAX} · threshold ${THRESHOLDS.interview}</td></tr>
      </table>`
    })
    .join('')

  const dis = disagreements(c)
  const scorerNote =
    iv.length === 1
      ? `<div class="note">Scored by <strong>one</strong> interviewer (${esc(iv[0].scorer)}). The procedure has two interviewers score independently before conferring; a single-scorer interview is recorded but is not the full procedure.</div>`
      : dis.length
        ? `<div class="note"><strong>Interviewers differed by 2 or more on:</strong> ${esc(dis.join(', '))}. Per the guide these are discussed and re-scored, not averaged.</div>`
        : ''

  const averaged =
    score.interviewRaw !== undefined
      ? `<p><strong>Interview total used in the composite:</strong> ${score.interviewRaw.toFixed(1)} / ${INTERVIEW_MAX}
         ${totals.length > 1 ? `(averaged across ${totals.length} interviewers: ${totals.map((t) => `${esc(t.scorer)} ${t.total}`).join(', ')})` : ''}
         — threshold ${THRESHOLDS.interview}.</p>`
      : ''

  // The anchors, once, so a reader can see what each 1-5 was judged against.
  const anchors = INTERVIEW_QUESTIONS.map(
    (q) => `<tr><td><strong>${esc(q.label)}</strong></td><td>${esc(q.anchors[1])}</td><td>${esc(q.anchors[3])}</td><td>${esc(q.anchors[5])}</td></tr>`,
  ).join('')

  return `
  <h2>Structured interview</h2>
  ${scorerNote}
  ${perScorer}
  ${averaged}
  <h3 style="margin:12px 0 4px">Scoring anchors (what each 1–5 was judged against)</h3>
  <table><tr><th>Question</th><th>1</th><th>3</th><th>5</th></tr>${anchors}</table>`
}

function methodologySection(): string {
  const weightRows = SELECTION_WEIGHTS.map(
    (w) => `<tr><td>${esc(w.label)}</td><td class="num">${w.weight}%</td><td>${esc(w.source)}</td></tr>`,
  ).join('')
  const floorRows = TEST_SECTIONS.filter((s) => s.floor).map(
    (s) => `<li>${esc(s.label)} — floor ${s.floor}%${s.floorNote ? `: ${esc(s.floorNote)}` : ''}</li>`,
  ).join('')
  return `
  <h2>How this candidate was scored — methodology and justification</h2>
  <p>Selection measures one thing: <strong>who is most likely to complete the course and pass the
     certification examination.</strong> Retention is handled by the service commitment agreement
     signed at acceptance, not by selection, so nothing here scores anyone on how long they might
     stay.</p>

  <h3 style="margin:12px 0 4px">The composite</h3>
  <table><tr><th>Component</th><th class="num">Weight</th><th>What it is</th></tr>${weightRows}</table>
  <p>Each component is a percentage; the composite is their weighted sum out of 100. An unscored
     component contributes nothing rather than being normalised away, so a partially-scored candidate
     scores low, not proportionally — a partial record is never compared against a complete one as if
     equal.</p>

  <h3 style="margin:12px 0 4px">Thresholds and floors</h3>
  <ul>
    <li><strong>Composite ${THRESHOLDS.composite}</strong> of 105 to advance.</li>
    <li><strong>Selection test ${THRESHOLDS.test}%</strong> overall.</li>
    <li><strong>Interview ${THRESHOLDS.interview} / ${INTERVIEW_MAX}.</strong></li>
    ${floorRows}
  </ul>
  <p><strong>The seat is left empty before the bar is lowered.</strong> With a small number of seats
     and completion as the priority, a candidate below threshold costs the program more than an
     unfilled chair; the additional-duty bonus decides a tie but cannot carry a candidate over the
     threshold from a weak score.</p>

  <h3 style="margin:12px 0 4px">The structured interview</h3>
  <ul>
    <li>Two interviewers ask the <strong>same six questions in the same order</strong> of every
        candidate, with no improvised questions beyond the listed probes.</li>
    <li>Each interviewer scores <strong>independently, 1–5 against fixed behavioural anchors</strong>,
        before conferring. Where two scorers differ by 2 or more on a question they discuss and
        re-score rather than averaging.</li>
    <li>Notes record <strong>what the candidate said</strong>, not impressions.</li>
  </ul>

  <h3 style="margin:12px 0 4px">Fairness</h3>
  <p>The following are <strong>never asked and never scored</strong>, by either interviewer: ${esc(PROHIBITED_TOPICS.join('; '))}. Where a candidate volunteers any of it, it is not recorded and not
     followed up. On the commitment question, only the quality of the <em>plan</em> is scored — never
     the personal reason behind a constraint. Anything used to select employees for a funded program
     is a selection procedure under the EEOC Uniform Guidelines, and these records are discoverable.</p>

  <p class="sub2">Instruments: the selection test (docs/aemt-selection-test.md) and the structured
     interview guide with anchored scoring (docs/aemt-selection-interview.md), both requiring HR and,
     for the dosage section, Medical Director review before use.</p>`
}

function retentionSection(): string {
  return `
  <h2>Records and retention</h2>
  <p>This record is retained for <strong>every candidate, selected or not</strong>, under the
     employer's HR retention schedule — it is what demonstrates the procedure was applied consistently
     across the field. It is <strong>not</strong> a K.A.R. 109-17-3 program record and does not sit
     under that three-year clock, and it does not appear in the course audit package.</p>`
}

function provenanceFooter(actor: string, generatedAt: string, fingerprint: string | null): string {
  return `
  <h2>Provenance</h2>
  <table class="meta">
    <tr><td>Prepared by</td><td>${esc(actor)}</td></tr>
    <tr><td>Generated</td><td>${esc(generatedAt)}</td></tr>
    <tr><td>Content fingerprint (SHA-256)</td><td style="font-family:monospace;font-size:10px;word-break:break-all">${fingerprint ?? 'unavailable on this device (insecure origin)'}</td></tr>
  </table>
  <p class="sub2">The fingerprint covers the scoring facts, not the moment of printing. A filed copy
     whose contents no longer re-hash to this value has been altered since it was generated.</p>
  <div class="sig">
    <div style="margin-top:14px">Interviewer / Program Manager: <span></span> &nbsp; Date: <span style="min-width:120px"></span></div>
    <div style="margin-top:14px">Second interviewer: <span></span> &nbsp; Date: <span style="min-width:120px"></span></div>
  </div>
  <div class="footer">AMR Kansas City — AEMT cohort selection. This document records and justifies a
     selection decision; it is a confidential HR record.</div>`
}

// ----- documents ------------------------------------------------------------

export interface RecordMeta {
  actor: string
  generatedAt: string
  fingerprint: string | null
}

/** The per-candidate selection record body (goes inside printDoc / downloadDoc). */
export function candidateRecordBody(
  c: AemtCandidate,
  score: CandidateScore,
  course: AemtCourse,
  meta: RecordMeta,
): string {
  return `
  <h1>AEMT Cohort Selection — Candidate Record</h1>
  <p class="sub">${esc(course.label || 'AEMT cohort')} · <strong>${esc(c.name)}</strong>${c.employeeNumber ? ` · #${esc(c.employeeNumber)}` : ''}</p>
  <p style="margin:0 0 12px">${decisionBadge(c)}</p>
  ${compositeTable(c, score)}
  ${gatesTable(c)}
  ${interviewSection(c, score)}
  ${c.notes ? `<h2>Notes</h2><p>${esc(c.notes)}</p>` : ''}
  ${methodologySection()}
  ${retentionSection()}
  ${provenanceFooter(meta.actor, meta.generatedAt, meta.fingerprint)}`
}

export function candidateRecordTitle(c: AemtCandidate): string {
  return `AEMT Selection Record — ${c.name}`
}

/**
 * Cohort summary: every candidate on one ranked page with the same methodology
 * appended, so the record shows the procedure applied consistently across the
 * whole field rather than one candidate in isolation.
 */
export function cohortRecordBody(
  course: AemtCourse,
  rows: { candidate: AemtCandidate; score: CandidateScore }[],
  meta: Omit<RecordMeta, 'fingerprint'>,
): string {
  const body = rows
    .map(({ candidate: c, score }, i) => {
      const clear = score.complete && score.blockers.length === 0 && score.composite >= THRESHOLDS.composite
      const comps = SELECTION_WEIGHTS.map((w) => `<td class="num">${pct(score[w.id])}</td>`).join('')
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(c.name)}${c.employeeNumber ? `<div class="sub2">#${esc(c.employeeNumber)}</div>` : ''}</td>
        ${comps}
        <td class="num">${score.bonus > 0 ? '+' + score.bonus : '0'}</td>
        <td class="num"><strong>${score.composite.toFixed(1)}</strong></td>
        <td>${clear ? '<span class="badge" style="background:#166534">Clears</span>' : score.complete ? '<span class="flag">Below</span>' : '<span class="sub2">Incomplete</span>'}</td>
        <td>${c.decision ? esc(c.decision) : '—'}</td>
      </tr>`
    })
    .join('')
  const heads = SELECTION_WEIGHTS.map((w) => `<th class="num">${esc(w.label.split(' ')[0])}</th>`).join('')
  const clearing = rows.filter((r) => r.score.complete && r.score.blockers.length === 0 && r.score.composite >= THRESHOLDS.composite).length
  return `
  <h1>AEMT Cohort Selection — Process Summary</h1>
  <p class="sub">${esc(course.label || 'AEMT cohort')} · ${rows.length} candidate${rows.length === 1 ? '' : 's'} · ${clearing} clearing every threshold</p>
  <table>
    <tr><th class="num">#</th><th>Candidate</th>${heads}<th class="num">Bonus</th><th class="num">Composite</th><th>Threshold ${THRESHOLDS.composite}</th><th>Decision</th></tr>
    ${body}
  </table>
  <p class="sub2">Ranked with candidates clearing every threshold first, then by composite. A blocked
     candidate with a high raw composite is not the strongest applicant.</p>
  ${methodologySection()}
  ${retentionSection()}
  ${provenanceFooter(meta.actor, meta.generatedAt, null)}`
}

export function cohortRecordTitle(course: AemtCourse): string {
  return `AEMT Selection — Process Summary (${course.label || 'cohort'})`
}
