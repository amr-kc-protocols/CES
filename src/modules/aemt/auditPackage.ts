import { formatDate } from '../../lib/date'
import {
  KAR_109_11_8,
  PROGRAM_COMPETENCIES,
  PRECEPTOR_LABELS,
  MAX_ABSENT_HOURS,
  RULE_SETS,
} from '../../data/aemt'
import type { PreceptorCredential } from '../../data/aemt'
import {
  REQUIRED_RECORDS,
  retentionUntil,
  RETENTION_YEARS,
  agreementStatus,
  docStatus,
} from '../../data/aemtRecords'
import {
  attestationIsEvidence,
  clearanceGate,
  encounterCounts,
  isClassroomSession,
  skillSignoffIsEvidence,
  standingFor,
} from './aemtStore'
import type { AemtSkillSheet } from '../../data/aemtSkills'
import type {
  AemtAuditEvent,
  AemtClinicalShift,
  AemtCompletion,
  AemtCourse,
  AemtDeadlineRecord,
  AemtEncounter,
  AemtFormResponse,
  AemtRecordDoc,
  AemtSession,
  AemtSkillCheck,
  AemtStudent,
} from '../../types'

// ---------------------------------------------------------------------------
// Course audit package — one document containing what a KBEMS audit asks for:
// the approval data and its receipts, the schedule with hours and times, the
// roster, attendance, clinical and field records with their preceptors,
// psychomotor competency, evaluations, completions with any overrides, and the
// audit trail.
//
// Records the app does not hold are listed with where they live rather than
// omitted, so the package is honest about its own boundaries.
// ---------------------------------------------------------------------------

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * A numeric field, rendered.
 *
 * The store is hydrated by JSON.parse from localStorage, by importDB, and by
 * applyRemote from rows another device wrote — all with unchecked casts, so a
 * field typed `number` is only as trustworthy as its source. Numbers used to be
 * interpolated raw on the grounds that their type made escaping unnecessary.
 * Anything that is not actually a number is escaped and flagged rather than
 * printed into the document.
 */
function num(v: unknown, digits?: number): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    return `<span class="crit">${esc(v ?? '—')}</span>`
  }
  return digits === undefined ? String(v) : v.toFixed(digits)
}

const CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color:#0f172a;line-height:1.45;margin:0;padding:28px;font-size:12px}
  h1{font-size:20px;margin:0 0 2px;color:#0b2e4f}
  h2{font-size:14px;margin:22px 0 6px;color:#0b2e4f;border-bottom:2px solid #0b2e4f;padding-bottom:3px}
  .sub{color:#475569;font-size:12px;margin-bottom:4px}
  table{border-collapse:collapse;width:100%;margin:6px 0 2px;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#f1f5f9;font-weight:700}
  .muted{color:#64748b}
  .warn{color:#b45309;font-weight:600}
  .crit{color:#b91c1c;font-weight:600}
  .ok{color:#166534;font-weight:600}
  .note{background:#f8fafc;border-left:3px solid #94a3b8;padding:6px 9px;margin:6px 0;font-size:11px}
  @media print{h2{break-after:avoid}table{break-inside:auto}tr{break-inside:avoid}}
`

export interface AuditPackageInput {
  course: AemtCourse
  students: AemtStudent[]
  sessions: AemtSession[]
  attendance: { studentId: string; sessionId: string; status: string; hours?: number }[]
  shifts: AemtClinicalShift[]
  encounters: AemtEncounter[]
  skillChecks: AemtSkillCheck[]
  forms: AemtFormResponse[]
  completions: AemtCompletion[]
  deadlines: AemtDeadlineRecord[]
  recordDocs: AemtRecordDoc[]
  audit: AemtAuditEvent[]
}

export function auditPackageHTML(
  d: AuditPackageInput,
  provenance?: { hash: string | null; actor: string; manifest: { record: string; count: number }[] },
  /**
   * The sheets this course checks off on, resolved to the version in force.
   * Passed in so the packet lists the same sheets the Skills tab does — a
   * bundled lookup would miss anything the operation authored or hid.
   */
  sheets: AemtSkillSheet[] = [],
): string {
  const { course } = d
  const cred = (c?: string) => (c ? PRECEPTOR_LABELS[c as PreceptorCredential] ?? c : '—')
  const nameOf = (id?: string) => d.students.find((s) => s.id === id)?.name ?? '—'

  const generated = new Date().toISOString().replace('T', ' ').slice(0, 16)

  const rows = (arr: string[]) => arr.join('')

  // ----- schedule -----
  const schedule = d.sessions
    .map(
      (s) => `<tr><td>${esc(formatDate(s.date))}</td>
      <td>${esc(s.startTime ?? '')}${s.endTime ? `–${esc(s.endTime)}` : ''}${!s.startTime ? '<span class="warn">no time</span>' : ''}</td>
      <td>${esc(s.title || '—')}</td><td>${esc(s.kind)}</td>
      <td style="text-align:right">${num(s.hours)}</td><td>${esc(s.instructor ?? '—')}</td></tr>`,
    )
    .join('')

  // ----- attendance & hours -----
  // Classroom hours come from attendance, clinical and field from attested
  // shifts. An auditor adds all three; so does this table, and it shows the
  // shortfall rather than only the totals.
  const t = d.course.targets
  // Classroom needs both halves filed: attendance mixes didactic and lab, so
  // one number alone cannot be compared against earned classroom hours.
  const classTarget =
    typeof t?.didactic === 'number' && typeof t?.lab === 'number' ? t.didactic + t.lab : undefined
  const filedTotal = [classTarget, t?.clinical, t?.field]
    .filter((x): x is number => typeof x === 'number')
    .reduce((a, x) => a + x, 0)
  const cell = (n: number, target: number | undefined) =>
    typeof target !== 'number'
      ? `<td style="text-align:right" class="muted">${num(n, 2)} <span class="warn">/ not filed</span></td>`
      : `<td style="text-align:right" class="${n >= target ? 'ok' : 'crit'}">${num(n, 2)} / ${num(target)}</td>`
  const attendance = d.students
    .map((st) => {
      let earned = 0
      let absent = 0
      for (const s of d.sessions) {
        const rec = d.attendance.find((a) => a.studentId === st.id && a.sessionId === s.id)
        // Classroom kinds only, from the store's single definition — this used
        // to be written inversely here (`kind !== 'clinical'`), and clinical
        // rotation hours were credited as classroom time on top of counting
        // again through their attested shift.
        if (!isClassroomSession(s.kind)) continue
        if (rec?.status === 'present') earned += rec.hours ?? s.hours
        if (rec?.status === 'absent') absent += s.hours
      }
      const mine = d.shifts.filter((s) => s.studentId === st.id && attestationIsEvidence(s))
      const clin = mine.filter((s) => s.setting === 'hospital').reduce((a, s) => a + s.hours, 0)
      const field = mine.filter((s) => s.setting === 'field').reduce((a, s) => a + s.hours, 0)
      const over = absent > MAX_ABSENT_HOURS
      return `<tr><td>${esc(st.name)}</td><td>${esc(st.certNumber ?? '—')}</td>
        ${cell(earned, classTarget)}${cell(clin, t?.clinical)}${cell(field, t?.field)}
        <td style="text-align:right"><strong>${num(earned + clin + field, 2)}</strong>${
          filedTotal > 0 ? ` / ${num(filedTotal)}` : ''
        }</td>
        <td style="text-align:right" class="${over ? 'crit' : ''}">${num(absent, 2)}</td>
        <td>${over ? '<span class="crit">over policy</span>' : '<span class="ok">within policy</span>'}</td></tr>`
    })
    .join('')

  // ----- clinical minimums -----
  // Statutory minimums and program competencies are tabulated separately: an
  // auditor must never see something the program chose to track presented as
  // a number Kansas requires.
  const reqRow = (reqs: typeof KAR_109_11_8) => (st: (typeof d.students)[number]) => {
      const cells = reqs.map((req) => {
        const mine = d.encounters.filter(
          (e) => e.studentId === st.id && e.requirementId === req.id,
        )
        // Same rule as the screen — imported, not restated.
        const counted = mine.filter((e) =>
          encounterCounts(e, req, d.shifts.find((x) => x.id === e.shiftId), st),
        )
        const n = counted.reduce((a, e) => a + e.count, 0)
        const met = n >= req.minimum
        return `<td style="text-align:right" class="${met ? 'ok' : 'crit'}">${num(n)}/${num(req.minimum)}</td>`
      }).join('')
      return `<tr><td>${esc(st.name)}</td>${cells}</tr>`
  }
  const clinical = d.students.map(reqRow(KAR_109_11_8)).join('')
  const competencies = d.students.map(reqRow(PROGRAM_COMPETENCIES)).join('')

  // ----- individual encounter evidence -----
  // Section 4 gives totals; an auditor asked to accept a total is entitled to
  // the rows behind it, including the ones that did not count.
  const REQ_LABEL = new Map(
    [...KAR_109_11_8, ...PROGRAM_COMPETENCIES].map((r) => [r.id, r.label]),
  )
  const encounterRows = [...d.encounters]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => {
      const sh = d.shifts.find((x) => x.id === e.shiftId)
      const req = [...KAR_109_11_8, ...PROGRAM_COMPETENCIES].find((r) => r.id === e.requirementId)
      const st = d.students.find((x) => x.id === e.studentId)
      const counts = req ? encounterCounts(e, req, sh, st) : false
      const why = e.voidedAt
        ? `void — ${esc(e.voidReason ?? 'no reason recorded')}`
        : e.outcome === 'attempt'
          ? 'unsuccessful attempt'
          : !e.shiftId
            ? 'no linked shift'
            : !sh
              ? 'shift missing'
              : !attestationIsEvidence(sh)
                ? 'shift not signed by an identified preceptor'
                : req && !req.allowedSettings.includes(e.siteKind)
                  ? 'setting not allowed for this requirement'
                  : req && clearanceGate(st, req.id, sh.date).blocked
                    ? 'student not checked off on this skill by the date of the shift'
                    : 'supervisor not eligible for this requirement'
      return `<tr><td>${esc(formatDate(e.date))}</td><td>${esc(nameOf(e.studentId))}</td>
      <td>${esc(REQ_LABEL.get(e.requirementId) ?? e.requirementId)}</td>
      <td>${esc(e.siteKind)}</td>
      <td style="text-align:right">${num(e.count)}${e.count > 1 ? ' <span class="warn">batch</span>' : ''}</td>
      <td>${e.outcome ? esc(e.outcome) : '<span class="warn">not stated</span>'}</td>
      <td>${e.sourceRef ? esc(e.sourceRef) : '<span class="warn">none</span>'}</td>
      <td>${esc(e.preceptor ?? '—')}</td>
      <td class="${counts ? 'ok' : 'crit'}">${counts ? 'counts' : why}</td></tr>`
    })
    .join('')

  // ----- shifts -----
  const shifts = d.shifts
    .map(
      (s) => `<tr><td>${esc(formatDate(s.date))}</td><td>${esc(nameOf(s.studentId))}</td>
      <td>${esc(s.setting)}</td><td>${esc(s.site)}</td><td style="text-align:right">${num(s.hours)}</td>
      <td>${esc(s.preceptorName)} (${esc(cred(s.preceptorCredential))}${s.preceptorCertNumber ? ` #${esc(s.preceptorCertNumber)}` : ''})</td>
      <td class="${attestationIsEvidence(s) ? 'ok' : 'warn'}">${
        attestationIsEvidence(s)
          ? `signed ${esc(s.attestation!.by)} (${esc(cred(s.attestation!.credential))}${s.attestation!.certNumber ? ` #${esc(s.attestation!.certNumber)}` : ''}) ${esc(s.attestation!.at.slice(0, 10))}`
          : s.attestedAt
            ? 'UNATTRIBUTED — no signer recorded'
            : 'NOT attested'
      }</td></tr>`,
    )
    .join('')

  // ----- corrections after signature -----
  // The revision trail was captured on the record but never printed, so the
  // packet showed the corrected values without showing that they had been
  // corrected — the one thing a reviewer most wants from a signed record.
  const revisionRows = d.shifts
    .flatMap((s) => (s.revisions ?? []).map((r) => ({ shift: s, rev: r })))
    .sort((a, b) => a.rev.at.localeCompare(b.rev.at))
    .map(
      ({ shift: s, rev: r }) => `<tr><td>${esc(r.at.replace('T', ' ').slice(0, 16))}</td>
      <td>${esc(nameOf(s.studentId))}</td>
      <td>${esc(formatDate(s.date))} · ${esc(s.site)}</td>
      <td>${esc(r.actor)}</td>
      <td class="${r.reason === 'not stated' ? 'warn' : ''}">${esc(r.reason)}</td>
      <td>${
        r.changed.length
          ? r.changed.map((c) => `${esc(c.field)}: ${esc(c.from)} → ${esc(c.to)}`).join('<br>')
          : '<span class="muted">signature withdrawn, no field changed</span>'
      }</td>
      <td class="${r.invalidated ? 'crit' : 'muted'}">${
        r.invalidated
          ? `${esc(r.invalidated.by)} (${esc(cred(r.invalidated.credential))}${
              r.invalidated.certNumber ? ` #${esc(r.invalidated.certNumber)}` : ''
            }) ${esc(r.invalidated.at.slice(0, 10))}`
          : 'none'
      }</td></tr>`,
    )
    .join('')

  // ----- skills -----
  // Held to the same bar as a shift attestation. This section used to print a
  // green date for any `passedDate`, so a sign-off with nobody behind it — the
  // state the app's own UI calls "does not count toward completion" — was shown
  // to an auditor as satisfied competency. It now distinguishes a signed sheet
  // from an unattributed one, and from one the recorded results contradict.
  const skills = d.students
    .map((st) => {
      const standing = standingFor(d.skillChecks, st.id, sheets)
      const cells = standing
        .map((s) => {
          const c = s.check
          if (!c?.passedDate) return '<td class="crit">—</td>'
          if (s.contradicted) {
            return `<td class="crit">${esc(formatDate(c.passedDate))}<div class="crit">CONTRADICTED — recorded results do not support this sign-off</div></td>`
          }
          if (!skillSignoffIsEvidence(c)) {
            return `<td class="warn">${esc(formatDate(c.passedDate))}<div class="warn">UNATTRIBUTED — no signer recorded</div></td>`
          }
          const a = c.attestation!
          // The version signed against, not the version in force — an edited
          // sheet must not restate what an evaluator already put a name to.
          const v = c.templateVersion
          return `<td class="ok">${esc(formatDate(c.passedDate))}<div class="muted">${esc(a.by)} (${esc(
            cred(a.credential),
          )}${a.certNumber ? ` #${esc(a.certNumber)}` : ''})</div><div class="muted">sheet ${
            v ? `v${num(v)}` : 'as shipped'
          }</div></td>`
        })
        .join('')
      return `<tr><td>${esc(st.name)}</td>${cells}</tr>`
    })
    .join('')

  // ----- completions -----
  const completions = d.students
    .map((st) => {
      const c = d.completions.find((x) => x.studentId === st.id)
      if (!c)
        return `<tr><td>${esc(st.name)}</td><td colspan="4" class="muted">${esc(st.status)}</td></tr>`
      return `<tr><td>${esc(st.name)}</td><td>${esc(formatDate(c.completedDate))}</td>
        <td style="text-align:right">${num(c.finalGradePercent)}%</td><td>${esc(c.verifiedBy)}</td>
        <td class="${c.override ? 'crit' : 'ok'}">${
          c.override
            ? `OVERRIDE — bypassed ${esc(c.override.unmetChecks.join(', '))}; approved by ${esc(c.override.approver)}: ${esc(c.override.reason)}`
            : 'all checks met'
        }</td></tr>`
    })
    .join('')

  // ----- submissions -----
  const submissions = d.deadlines
    .map(
      (r) => `<tr><td>${esc(r.deadlineId)}</td><td>${esc(r.status)}</td>
      <td>${esc(formatDate(r.submittedDate))}</td><td>${esc(r.submittedBy)}</td>
      <td class="${r.confirmationNumber ? '' : 'warn'}">${esc(r.confirmationNumber ?? 'none recorded')}</td></tr>`,
    )
    .join('')

  // ----- record inventory -----
  // "Held in CES" now has to be true. For a record CES owns, the claim is
  // checked against the records actually stored; for one kept elsewhere, the
  // status is derived from the fields rather than read off a stored label.
  const evidenceCount: Record<string, number> = {
    attendance: d.attendance.length,
    skillChecks: d.skillChecks.length,
    encounters: d.encounters.length,
    formResponses: d.forms.length,
    students: d.students.length,
    sessions: d.sessions.length,
    completions: d.completions.length,
  }
  const records = REQUIRED_RECORDS.map((r) => {
    const doc = d.recordDocs.find((x) => x.typeId === r.id)
    if (r.source === 'ces') {
      const n = r.evidence ? evidenceCount[r.evidence] : undefined
      const empty = n === 0
      return `<tr><td>${esc(r.label)}</td>
        <td class="${empty ? 'warn' : 'ok'}">${
          n === undefined ? 'held in CES' : empty ? 'EMPTY — nothing recorded' : `held in CES (${n} records)`
        }</td>
        <td>${esc(`CES — ${r.tab} tab`)}</td><td>—</td></tr>`
    }
    const st = docStatus(doc)
    return `<tr><td>${esc(r.label)}</td>
      <td class="${st.pill === 'ok' ? 'ok' : st.pill === 'crit' ? 'crit' : 'warn'}">${esc(st.label)}${
        st.missing.length ? `<div class="warn">missing: ${esc(st.missing.join(', '))}</div>` : ''
      }</td>
      <td>${esc(doc?.location ?? '—')}</td>
      <td>${esc(doc?.owner ?? '—')}${doc?.version ? ` v${esc(doc.version)}` : ''}</td></tr>`
  }).join('')

  // ----- audit trail -----
  const auditRows = d.audit
    .map(
      (e) => `<tr><td>${esc(e.at.replace('T', ' ').slice(0, 16))}</td><td>${esc(e.actor)}</td>
      <td>${esc(e.action)}</td><td>${esc(e.detail)}</td></tr>`,
    )
    .join('')

  return `<!doctype html><html><head><meta charset="utf-8">
<title>${esc(course.label)} — course audit package</title><style>${CSS}</style></head><body>
<h1>${esc(course.label)} — Course Audit Package</h1>
<div class="sub">${esc(course.organization ?? 'Organization not recorded')}${
    course.courseNumber ? ` · KSBEMS #${esc(course.courseNumber)}` : ''
  } · ${esc(formatDate(course.startDate))} – ${esc(formatDate(course.endDate))}</div>
<div class="sub">Program manager: ${esc(course.coordinator ?? '—')} · Primary instructor: ${esc(
    course.primaryInstructor ?? '—',
  )} (${esc(cred(course.primaryInstructorCredential))}) · Medical director: ${esc(
    course.medicalDirector ?? '—',
  )}</div>
<div class="sub">Generated ${esc(generated)} · retain until ${esc(
    formatDate(retentionUntil(course.endDate)),
  )} (${RETENTION_YEARS} years, K.A.R. 109-17-3)</div>

<div class="note">This package covers the records held in CES. Records kept elsewhere are listed in
the inventory with their location — it does not reproduce their contents. No patient identifiers
appear anywhere in this document.</div>

<h2>0 · Provenance and integrity</h2>
${
  provenance
    ? `<table>
<tr><th style="width:180px">Generated by</th><td>${esc(provenance.actor)}</td></tr>
<tr><th>Evidence fingerprint</th><td style="font-family:ui-monospace,Menlo,monospace">${esc(
        provenance.hash ? provenance.hash.toUpperCase().match(/.{1,8}/g)!.join(' ') : 'unavailable',
      )}</td></tr>
<tr><th>Algorithm</th><td>SHA-256 over the canonical evidence records and rule-set versions</td></tr>
</table>
<div class="note"><strong>How to check this packet.</strong> The same fingerprint was written to
this course's audit trail when the packet was generated, and to the accompanying
<code>.json</code> evidence bundle. Re-hashing that bundle must reproduce the value above, and the
audit trail must contain a matching export entry. A packet that fails either check is not the
packet CES produced. This document is HTML and can be edited — the fingerprint, not the file
format, is what makes alteration detectable.</div>
<h2 style="font-size:12px;border:0;margin:10px 0 2px">Record manifest</h2>
<table><tr><th>Record type</th><th style="text-align:right">Count</th></tr>
${provenance.manifest.map((m) => `<tr><td>${esc(m.record)}</td><td style="text-align:right">${num(m.count)}</td></tr>`).join('')}
</table>`
    : '<div class="note crit">Generated without an integrity fingerprint. Use the Records tab export, which computes one.</div>'
}
<h2 style="font-size:12px;border:0;margin:14px 0 2px">Rule sets applied</h2>
<table><tr><th>Citation</th><th>Effective</th><th>Scope</th><th>Verified against</th></tr>
${RULE_SETS.map(
  (r) =>
    `<tr><td>${esc(r.citation)}</td><td>${esc(r.effectiveDate)}</td><td>${esc(r.scope)}</td><td>${esc(r.verifiedAgainst)}</td></tr>`,
).join('')}
</table>

<h2>1 · Sites and affiliation agreements</h2>
<table><tr><th>Site</th><th>Type</th><th>Agreement</th><th>Signed</th><th>Effective</th>
<th>Permitted scope</th><th>Document</th></tr>
${
  (course.sites ?? []).length
    ? rows(
        (course.sites ?? []).map((s) => {
          const a = agreementStatus(s, course)
          return `<tr><td>${esc(s.name)}</td><td>${esc(s.kind)}</td>
            <td class="${a.pill === 'ok' ? 'ok' : a.pill === 'warn' ? 'warn' : 'crit'}">${esc(a.label)}${
              a.missing.length ? `<div class="warn">missing: ${esc(a.missing.join(', '))}</div>` : ''
            }</td>
            <td>${s.signedDate ? esc(s.signedDate) : '<span class="crit">not signed</span>'}${
              s.signedBySite || s.signedByProgram
                ? `<div class="muted">${esc(s.signedBySite ?? '—')} / ${esc(s.signedByProgram ?? '—')}</div>`
                : ''
            }</td>
            <td>${s.effectiveFrom ? esc(s.effectiveFrom) : '<span class="crit">—</span>'}${
              s.effectiveTo ? ` – ${esc(s.effectiveTo)}` : ''
            }${a.outOfPeriod ? '<div class="crit">does not span the course</div>' : ''}</td>
            <td>${s.permits ? esc(s.permits) : '<span class="crit">not recorded</span>'}</td>
            <td>${s.agreementRef ? esc(s.agreementRef) : '<span class="crit">no document</span>'}</td></tr>`
        }),
      )
    : '<tr><td colspan="7" class="crit">No sites recorded</td></tr>'
}</table>
<div class="note">Agreement status is derived from the evidence recorded against each site — a
document location, both signatures, an effective period covering the course, and the scope it
permits. It is not a label anyone selected.</div>

<h2>2 · Schedule (${d.sessions.length} sessions)</h2>
<table><tr><th>Date</th><th>Time</th><th>Subject</th><th>Type</th><th>Hrs</th><th>Instructor</th></tr>
${schedule || '<tr><td colspan="6" class="crit">No sessions</td></tr>'}</table>

<h2>3 · Attendance and contact hours</h2>
<table><tr><th>Student</th><th>Cert #</th><th>Classroom</th><th>Clinical</th><th>Field</th><th>Total</th><th>Class hours missed</th><th>Policy (max ${MAX_ABSENT_HOURS} h)</th></tr>
${attendance || '<tr><td colspan="8" class="muted">No students</td></tr>'}</table>
<div class="note">${
  filedTotal > 0
    ? 'Hours shown against the targets filed for this course; a category marked "not filed" is recorded but reconciles against no commitment. Clinical and field count only from attested shifts.'
    : '<span class="crit">This course filed no comparable hour targets, so nothing reconciles these totals against a commitment.</span>'
}</div>

<h2>4 · Clinical minimums (K.A.R. 109-11-8(a)(4))</h2>
<table><tr><th>Student</th>${KAR_109_11_8.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr>
${clinical || '<tr><td class="muted">No students</td></tr>'}</table>
<div class="note">The seven categories at K.A.R. 109-11-8(a)(4)(A)-(G), current as of the
6 March 2026 amendment. Counts include only reps in an allowed setting, supervised by an
eligible credential, on an attested shift.</div>

<h2>4a · Program competencies (not K.A.R. minimums)</h2>
<table><tr><th>Student</th>${PROGRAM_COMPETENCIES.map((r) => `<th>${esc(r.label)}</th>`).join('')}</tr>
${competencies || '<tr><td class="muted">No students</td></tr>'}</table>
<div class="note">Tracked by this program under K.A.R. 109-11-8(a)(2), which requires practical
skills be completed to the primary instructor's satisfaction. These are not numbered minimums
and do not gate completion.</div>

<h2>4b · Individual clinical and field evidence</h2>
<table><tr><th>Date</th><th>Student</th><th>Requirement</th><th>Setting</th><th>Reps</th>
<th>Outcome</th><th>Reference</th><th>Preceptor</th><th>Counts</th></tr>
${encounterRows || '<tr><td colspan="9" class="muted">No encounters logged</td></tr>'}</table>
<div class="note">Every logged performance, counting or not, with the reason it does not count where
that applies. Rows marked "batch" represent more than one performance under a single outcome and
reference; rows marked "void" were corrected and are retained rather than deleted.</div>

<h2>5 · Clinical and field shifts</h2>
<table><tr><th>Date</th><th>Student</th><th>Setting</th><th>Site</th><th>Hrs</th><th>Preceptor</th><th>Attestation</th></tr>
${shifts || '<tr><td colspan="7" class="muted">No shifts recorded</td></tr>'}</table>

<h2>6 · Psychomotor competency</h2>
<table><tr><th>Student</th>${sheets.map((s) => `<th>${esc(s.title)}</th>`).join('')}</tr>
${skills || '<tr><td class="muted">No students</td></tr>'}</table>
<div class="note">A sheet counts toward K.A.R. 109-11-8(a)(2) only where an identified evaluator
signed it, with a credential and licence number, and the recorded criteria still support that
signature. Sheets marked UNATTRIBUTED or CONTRADICTED are shown and do not count. Each sign-off
names the sheet version it was made against; an instrument edited later publishes a new version and
leaves these untouched.${
    course.monitorSheetId
      ? ''
      : ' <span class="crit">This course names no cardiac monitor, so no monitor sheet is required of any student — the column is absent above rather than unmet.</span>'
  }</div>

<h2>5a · Corrections after signature</h2>
<table><tr><th>When</th><th>Student</th><th>Shift</th><th>By</th><th>Reason</th><th>Changed</th><th>Signature invalidated</th></tr>
${
  revisionRows ||
  '<tr><td colspan="7" class="muted">No attested record has been corrected</td></tr>'
}</table>
<div class="note">A material change to an attested shift clears the signature and is retained here
rather than overwriting what was signed. An empty table means no signed record was ever altered.</div>

<h2>7 · Evaluations on file</h2>
<table><tr><th>Form</th><th>Count</th></tr>
${
  rows(
    [...new Set(d.forms.map((f) => f.formId))].map(
      (id) =>
        `<tr><td>${esc(id)}</td><td style="text-align:right">${
          d.forms.filter((f) => f.formId === id).length
        }</td></tr>`,
    ),
  ) || '<tr><td colspan="2" class="muted">None recorded</td></tr>'
}</table>

<h2>8 · Completions</h2>
<table><tr><th>Student</th><th>Completed</th><th>Grade</th><th>Verified by</th><th>Basis</th></tr>
${completions || '<tr><td colspan="5" class="muted">No students</td></tr>'}</table>

<h2>9 · KBEMS submissions</h2>
<table><tr><th>Submission</th><th>Status</th><th>Date</th><th>By</th><th>Confirmation</th></tr>
${submissions || '<tr><td colspan="5" class="crit">Nothing submitted</td></tr>'}</table>

<h2>10 · Record inventory (K.A.R. 109-17-3)</h2>
<table><tr><th>Record</th><th>Status</th><th>Location</th><th>Owner</th></tr>${records}</table>

<h2>11 · Audit trail</h2>
<table><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr>
${auditRows || '<tr><td colspan="4" class="muted">No events</td></tr>'}</table>

</body></html>`
}
