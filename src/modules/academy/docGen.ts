import { FT_SECTIONS, FT_SLOTS, EXPOSURE_GROUPS, EXPOSURE_SLOTS } from '../../data/ftObjectives'
import {
  WELCOME_KIT_ITEMS,
  ROOM_SETUP_ITEMS,
  KC_FACILITIES,
  FACILITY_KEY_POINTS,
} from '../../data/academyTemplate'
import { CREDENTIAL_LABELS } from '../../data/academy'
import {
  PHASE2_TEMPLATE,
  WEEK_LABELS,
  educationMinutes,
  isUnderMinHours,
  timeline,
} from '../../data/academyPhase2'
import { resourceFor, resourceUrl } from '../../data/fieldGuide'
import { operationName } from '../../data/operations'
import { formatDate, fromISODate } from '../../lib/date'
import type {
  AcademyCohort,
  AcademyDay,
  AcademyDayRef,
  AttendanceStatus,
  SessionArrangement,
  TemplateSession,
  Trainee,
} from '../../types'

const fmtHours = (min: number): string => {
  const h = min / 60
  return Number.isInteger(h) ? `${h}` : h.toFixed(1)
}

// ---------------------------------------------------------------------------
// New-hire document generator. Every document is built as a standalone,
// print-ready HTML string from the roster + schedule — one name in, the whole
// packet out. Documents open in a print window (browser print -> paper/PDF)
// or download as .doc (HTML with a Word MIME type, which Word opens and
// keeps editable).
// ---------------------------------------------------------------------------

export const esc = (s: string | undefined): string =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const DOC_CSS = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #111; margin: 24px; font-size: 12px; }
  h1 { font-size: 20px; margin: 0 0 2px; color: #0b2e4f; }
  h2 { font-size: 14px; margin: 18px 0 6px; color: #0b2e4f; border-bottom: 2px solid #0b2e4f; padding-bottom: 3px; page-break-after: avoid; }
  .sub { color: #555; margin: 0 0 14px; }
  table { border-collapse: collapse; width: 100%; margin: 6px 0 12px; page-break-inside: avoid; }
  th, td { border: 1px solid #999; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #e8eef5; font-size: 11px; }
  .slot { width: 34px; text-align: center; }
  .num { width: 30px; }
  .target { width: 52px; text-align: center; white-space: nowrap; }
  .sig { margin: 6px 0 2px; }
  .sig span { display: inline-block; border-bottom: 1px solid #333; min-width: 240px; margin: 0 24px 0 6px; }
  .meta td { border: none; padding: 3px 6px 3px 0; }
  .meta .line { border-bottom: 1px solid #333; min-width: 220px; display: inline-block; }
  .badge { display: inline-block; background: #0b2e4f; color: #fff; border-radius: 4px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
  .note { background: #fef9e7; border: 1px solid #e7d9a0; padding: 6px 8px; margin: 6px 0; }
  .res { font-size: 10px; margin-top: 2px; }
  .res a { color: #0b5cad; }
  .sub2 { color: #555; font-size: 11px; }
  .flag { background: #fde2e1; color: #b91c1c; border-radius: 4px; padding: 1px 6px; font-size: 10px; font-weight: 700; }
  .footer { margin-top: 18px; color: #777; font-size: 10px; }
  .cover { text-align: center; padding-top: 200px; }
  .cover .first { font-size: 84px; font-weight: 800; color: #0b2e4f; }
  .cover .full { font-size: 20px; color: #555; margin-top: 8px; }
  ul.check { list-style: none; padding-left: 0; }
  ul.check li { padding: 3px 0; }
  ul.check li::before { content: '\\2610\\00a0\\00a0'; }
  /* One-page agenda */
  .agenda-cols { column-count: 2; column-gap: 20px; }
  .agenda-day { break-inside: avoid; page-break-inside: avoid; margin-bottom: 10px; }
  .agenda-day .dh { font-weight: 700; color: #0b2e4f; font-size: 12px; border-bottom: 1.5px solid #0b2e4f; padding-bottom: 2px; margin-bottom: 3px; }
  .agenda-day .fac { font-weight: 400; color: #555; font-size: 10px; }
  .agenda-day table { margin: 0; }
  .agenda-day td { border: none; border-bottom: 1px solid #e5e5e5; padding: 2px 4px; font-size: 10.5px; vertical-align: top; }
  .agenda-day td.t { white-space: nowrap; color: #0b2e4f; font-weight: 600; width: 78px; }
  @media print { body { margin: 10mm; } .no-print { display: none; } }
`

function docShell(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${DOC_CSS}</style></head><body>${body}</body></html>`
}

/** Open a print window for the document. */
export function printDoc(title: string, body: string): void {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Pop-up blocked — allow pop-ups for this site to print documents.')
    return
  }
  w.document.write(docShell(title, body))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

/** Download as a .doc file (HTML with Word MIME — opens editable in Word). */
export function downloadDoc(filename: string, title: string, body: string): void {
  const blob = new Blob([docShell(title, body)], { type: 'application/msword' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.doc') ? filename : `${filename}.doc`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function safeFilename(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
}

// ----- Field Training Objectives Page ---------------------------------------

export function objectivesPageHTML(t: Trainee): string {
  const isMedic = t.credential === 'paramedic'
  const sections = FT_SECTIONS.filter((s) => !s.paramedicOnly || isMedic)
  const slotHead = Array.from({ length: FT_SLOTS }, (_, i) => `<th class="slot">${i + 1}</th>`).join('')
  // Marks recorded on the digital checklist print into their slots (FTO
  // initials + short date), so the paper copy matches the app state.
  const shortDate = (iso: string) => {
    const [, m, d] = iso.split('-')
    return `${Number(m)}/${Number(d)}`
  }
  const slotCellsFor = (objectiveId: string) => {
    const marks = t.fieldMarks?.[objectiveId] ?? []
    return Array.from({ length: FT_SLOTS }, (_, i) => {
      const m = marks[i]
      return m
        ? `<td class="slot">${m.fto ? `${esc(m.fto)}<br/>` : ''}<span style="font-size:8px">${esc(shortDate(m.date))}</span></td>`
        : '<td class="slot">&nbsp;</td>'
    }).join('')
  }

  const sectionHtml = sections
    .map(
      (s) => `
    <h2>${esc(s.title)}</h2>
    <table>
      <tr><th class="num">#</th><th>Objective</th><th class="target">Target</th>${slotHead}</tr>
      ${s.objectives
        .map(
          (o) =>
            `<tr><td class="num">${o.id}</td><td>${esc(o.text)}</td><td class="target">${esc(o.target)}</td>${slotCellsFor(o.id)}</tr>`,
        )
        .join('')}
    </table>
    <p class="sig">Trainee acknowledges all of Section ${s.id} is complete: <span>&nbsp;</span> Date <span style="min-width:110px">&nbsp;${t.sectionAck?.[s.id] ? esc(formatDate(t.sectionAck[s.id])) : ''}&nbsp;</span></p>`,
    )
    .join('')

  const exposureHtml = `
    <h2>I. Call Type Exposure</h2>
    <p>Track exposure to call types across the 6-shift ride-along. Each occurrence = one cell ticked (X or shift number). This is an exposure log, not a competence checkoff — use it to identify gaps for targeted shift planning.</p>
    ${EXPOSURE_GROUPS.map(
      (g) => `
      <table>
        <tr><th>${esc(g.label)} — call type</th>${Array.from({ length: EXPOSURE_SLOTS }, (_, i) => `<th class="slot">${i + 1}</th>`).join('')}</tr>
        ${g.types
          .map((ct) => {
            const hits = t.exposure?.[ct] ?? []
            const cells = Array.from({ length: EXPOSURE_SLOTS }, (_, i) =>
              hits[i] ? `<td class="slot">S${hits[i]}</td>` : '<td class="slot">&nbsp;</td>',
            ).join('')
            return `<tr><td>${esc(ct)}</td>${cells}</tr>`
          })
          .join('')}
      </table>`,
    ).join('')}
    <p>Total unique call types exposed: ${
      Object.values(t.exposure ?? {}).some((v) => v.length > 0)
        ? `<strong>${Object.values(t.exposure ?? {}).filter((v) => v.length > 0).length}</strong>`
        : '_____'
    } &nbsp;&nbsp; Gaps identified — schedule a targeted shift for: <span style="display:inline-block;border-bottom:1px solid #333;min-width:300px">&nbsp;</span></p>`

  const signoffRows = FT_SECTIONS.map((s) => {
    const na = s.paramedicOnly && !isMedic ? ' — N/A' : ''
    return `<tr><td>${esc(s.title)}${na}</td><td class="slot">☐</td><td style="width:90px">&nbsp;</td><td style="width:90px">&nbsp;</td></tr>`
  }).join('')

  return `
    <h1>${isMedic ? 'Paramedic' : 'EMT'} Field Training Objectives Page</h1>
    <p class="sub">AMR KC IFT — Cumulative competency tracker across 6 FTO ride-along shifts</p>
    <table class="meta"><tr>
      <td><strong>Trainee name</strong> <span class="line">&nbsp;${esc(t.name)}&nbsp;</span></td>
      <td><strong>Hire date</strong> <span class="line" style="min-width:120px">&nbsp;${t.hireDate ? esc(formatDate(t.hireDate)) : ''}&nbsp;</span></td>
    </tr><tr>
      <td><strong>Position</strong> <span class="line">&nbsp;${esc(CREDENTIAL_LABELS[t.credential])}${t.employment ? ` — ${t.employment === 'ft' ? 'Full-Time' : 'Per Diem'}` : ''} · ${esc(operationName(t.operation))}&nbsp;</span></td>
      <td><strong>FTOs assigned</strong> <span class="line" style="min-width:160px">&nbsp;${esc(t.ftos)}&nbsp;</span></td>
    </tr></table>
    <div class="note"><strong>How this works:</strong> Each numbered slot (1–6) is one occurrence. When the trainee completes an objective, the FTO writes their initials + date in the next available slot. The target tells you how many to fill. Trainee signs once per section at the bottom when all required slots are signed.</div>
    ${sectionHtml}
    ${exposureHtml}
    <h2>Final Cumulative Sign-Off</h2>
    <p>Completed at end of Shift 6. CES reviews every section before clearing for solo shift.</p>
    <table><tr><th>Section</th><th class="slot">Complete?</th><th>CES initials</th><th>Date</th></tr>${signoffRows}</table>
    <p>Cleared for solo shift: &nbsp; ☐ Yes &nbsp;&nbsp; ☐ Yes with notes &nbsp;&nbsp; ☐ Remediation plan attached</p>
    <p class="sig">CES signature: <span>&nbsp;</span> Date <span style="min-width:110px">&nbsp;</span></p>
    <p class="sig">Trainee signature: <span>&nbsp;</span> Date <span style="min-width:110px">&nbsp;</span></p>
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}

// ----- Folder cover label ----------------------------------------------------

export function folderLabelHTML(t: Trainee): string {
  const first = t.name.trim().split(/\s+/)[0] || t.name
  return `
    <div class="cover">
      <div class="badge">AMR KC — NEW HIRE ACADEMY</div>
      <div class="first">${esc(first)}</div>
      <div class="full">${esc(t.name)} · ${esc(CREDENTIAL_LABELS[t.credential])}${t.employment ? ` — ${t.employment === 'ft' ? 'Full-Time' : 'Per Diem'}` : ''}</div>
    </div>`
}

// ----- Welcome kit checklist ---------------------------------------------------

export function welcomeKitHTML(cohort: AcademyCohort, trainees: Trainee[]): string {
  const n = trainees.length
  return `
    <h1>Day 1 Welcome Kit — Assembly Checklist</h1>
    <p class="sub">${esc(cohort.label)} · Build ${n} folder${n === 1 ? '' : 's'} before ${esc(formatDate(cohort.startDate))}, 9 AM</p>
    <h2>Each folder contains</h2>
    <table><tr><th class="slot">☐</th><th>Item</th><th>Source</th></tr>
      ${WELCOME_KIT_ITEMS.map((k) => `<tr><td class="slot">☐</td><td>${esc(k.item)}</td><td>${esc(k.source)}</td></tr>`).join('')}
    </table>
    <div class="note"><strong>Folder cover label:</strong> add a label to the front of each folder with the trainee's first name (print covers from CES). Personalized = small touch, big first impression.</div>
    <h2>Trainee folder list</h2>
    <table><tr><th class="slot">☐</th><th>Name</th><th>Position</th></tr>
      ${trainees
        .map(
          (t) =>
            `<tr><td class="slot">☐</td><td>${esc(t.name)}</td><td>${esc(CREDENTIAL_LABELS[t.credential])}${t.employment ? ` — ${t.employment === 'ft' ? 'FT' : 'per diem'}` : ''}</td></tr>`,
        )
        .join('')}
    </table>
    <h2>Day 1 setup (the room itself)</h2>
    <ul class="check">
      <li>${n} folders on each seat</li>
      ${ROOM_SETUP_ITEMS.slice(1)
        .map((i) => `<li>${esc(i.replace('Laptops or toughbooks', `${n} laptops or toughbooks`))}</li>`)
        .join('')}
    </ul>
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}

// ----- Facility cheat sheet ----------------------------------------------------

export function facilitySheetHTML(): string {
  return `
    <h1>AMR Kansas City — IFT Receiving Facilities</h1>
    <p class="sub">Quick reference for new hires</p>
    <h2>Major hospitals</h2>
    <table><tr><th>Facility</th><th>Address</th><th>Specialty / notes</th></tr>
      ${KC_FACILITIES.map((f) => `<tr><td>${esc(f.name)}</td><td>${esc(f.address)}</td><td>${esc(f.notes)}</td></tr>`).join('')}
    </table>
    <h2>Key things to know</h2>
    <ul>${FACILITY_KEY_POINTS.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
    <div class="note">Verify before printing: confirm addresses and specialty designations against the current local protocol manual before distributing — facilities update designations regularly.</div>
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}

// ----- Phase 2 (Clinical) structured schedule ----------------------------------

const KIND_TAG: Record<string, string> = {
  education: 'Education',
  'hands-on': 'Hands-on',
  assessment: 'Assessment',
  break: 'Break',
  lunch: 'Lunch',
  closeout: 'Housekeeping',
}

function resourceLinks(refs: string[] | undefined): string {
  if (!refs || refs.length === 0) return ''
  const links = refs
    .map((ref) => {
      const r = resourceFor(ref)
      const url = resourceUrl(ref)
      return r && url ? `<a href="${esc(url)}">${esc(r.label)}</a>` : ''
    })
    .filter(Boolean)
    .join(' · ')
  return links ? `<div class="res">↗ ${links}</div>` : ''
}

/**
 * Trainee-facing academy schedule (both weeks): an arc map (advance organizer)
 * grouped by week, plus each session's computed timeline, education-time total,
 * and Field Guide links. Academy completion is an internal record only — no CE.
 */
export function phase2ScheduleHTML(
  cohort: AcademyCohort,
  arrangements: Record<string, SessionArrangement>,
  sessionList?: TemplateSession[],
): string {
  const t = PHASE2_TEMPLATE
  const allSessions = sessionList ?? t.sessions
  const weeks: (1 | 2)[] = [1, 2]

  // Same date-aware sort as the on-screen schedule: dated sessions in calendar
  // order, undated ones after in template order.
  const byDate = (a: TemplateSession, b: TemplateSession): number => {
    const da = arrangements[a.id]?.date || ''
    const db = arrangements[b.id]?.date || ''
    if (da && db) return da.localeCompare(db) || a.order - b.order
    if (da) return -1
    if (db) return 1
    return a.order - b.order
  }

  const arc = weeks
    .map((wk) => {
      const wkSessions = allSessions.filter((s) => s.week === wk).sort(byDate)
      if (!wkSessions.length) return ''
      return `
        <h2>${esc(WEEK_LABELS[wk])}</h2>
        <table><tr><th class="num">#</th><th>Session</th><th>Focus</th></tr>
          ${wkSessions
            .map(
              (s) =>
                `<tr><td class="num">${s.custom ? '+' : s.order}</td><td><strong>${esc(s.title)}</strong>${s.custom ? ' <span class="badge">Added</span>' : ''}${s.mode === 'at-home' ? ' <span class="badge">At home</span>' : ''}${s.location ? ' <span class="badge">Offsite</span>' : ''}</td><td>${esc(s.objectives[0] ?? '')}</td></tr>`,
            )
            .join('')}
        </table>`
    })
    .join('')

  const renderSession = (s: TemplateSession): string => {
      const arr = arrangements[s.id]
      // A class's edited blocks override the template default.
      const blocks = arr?.blocks && arr.blocks.length ? arr.blocks : s.blocks
      const eduMin = educationMinutes(s, blocks)
      const under = isUnderMinHours(s, t.minEducationHoursPerDay, blocks)
      const when = arr?.date ? formatDate(arr.date) : 'Date TBD'
      const facil = arr?.facilitators || (s.facilitatorRoles ?? []).map((r) => r.role + (r.lead ? ' (lead)' : '')).join(' · ')

      const objectives = `<ul>${s.objectives.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>`

      let body = ''
      if (s.mode === 'at-home') {
        body = `
          <table><tr><th class="slot">☐</th><th>Segment</th><th>Notes</th></tr>
            ${(s.segments ?? [])
              .map(
                (seg) =>
                  `<tr><td class="slot">☐</td><td><strong>${esc(seg.title)}</strong>${seg.hours ? ` — ${seg.hours} hrs` : ''}${resourceLinks(seg.resources)}</td><td>${esc(seg.notes ?? seg.submit ?? '')}${seg.gatesSession ? `<br/><em>Must finish before Session ${allSessions.find((x) => x.id === seg.gatesSession)?.order ?? '?'}.</em>` : ''}</td></tr>`,
              )
              .join('')}
          </table>`
      } else {
        const rows = timeline(s, arr?.startTime || s.defaultStart, blocks)
        if (rows) {
          body = `<table><tr><th style="width:96px">Time</th><th>Block</th><th style="width:80px">Kind</th></tr>
            ${rows
              .map(
                (r) =>
                  `<tr><td>${r.start}–${r.end}</td><td><strong>${esc(r.block.title)}</strong>${r.block.notes ? `<br/><span class="sub2">${esc(r.block.notes)}</span>` : ''}${resourceLinks(r.block.resources)}</td><td>${esc(KIND_TAG[r.block.kind] ?? r.block.kind)}</td></tr>`,
              )
              .join('')}
          </table>`
        } else {
          // No start time arranged yet — show durations instead of clock times.
          body = `<table><tr><th style="width:96px">Duration</th><th>Block</th><th style="width:80px">Kind</th></tr>
            ${(blocks ?? [])
              .map(
                (b) =>
                  `<tr><td>${b.durationMin}m</td><td><strong>${esc(b.title)}</strong>${b.notes ? `<br/><span class="sub2">${esc(b.notes)}</span>` : ''}${resourceLinks(b.resources)}</td><td>${esc(KIND_TAG[b.kind] ?? b.kind)}</td></tr>`,
              )
              .join('')}
          </table>`
        }
      }

      return `
        <h2>${s.custom ? `${esc(s.title)} (added)` : `Session ${s.order} — ${esc(s.title)}`}${s.mode === 'at-home' ? ' · at home' : ''}</h2>
        <p class="sub">${esc(when)}${arr?.startTime || s.defaultStart ? ` · starts ${esc(arr?.startTime || s.defaultStart || '')}` : ''} · ${esc(facil)}${s.location ? ` · 📍 ${esc(s.location)}` : ''}</p>
        <p><strong>Education time:</strong> ${fmtHours(eduMin)} hrs${under ? ` <span class="flag">below ${t.minEducationHoursPerDay}-hr minimum</span>` : ''}${s.mode === 'at-home' ? ' (LMS + flipped)' : ''}</p>
        ${objectives}
        ${body}`
  }

  const sessionsHtml = weeks
    .map((wk) => {
      const wkSessions = allSessions.filter((s) => s.week === wk).sort(byDate)
      if (!wkSessions.length) return ''
      return `<h1 style="margin-top:22px">${esc(WEEK_LABELS[wk])}</h1>${wkSessions.map(renderSession).join('')}`
    })
    .join('')

  return `
    <h1>${esc(cohort.label)} — Academy Schedule</h1>
    <p class="sub">${esc(t.name)} · internal academy record (not CE)</p>
    ${arc}
    ${sessionsHtml}
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())} · Field Guide links open the teaching content; CES orchestrates, the Field Guide delivers.</p>`
}

// ----- Printable schedule ------------------------------------------------------

export function scheduleHTML(cohort: AcademyCohort, days: AcademyDay[]): string {
  const dayHtml = days
    .map(
      (d) => `
    <h2>${esc(formatDate(d.date))} — ${esc(d.title || 'Academy day')}</h2>
    ${d.facilitators ? `<p class="sub">Facilitators: ${esc(d.facilitators)}</p>` : ''}
    ${d.location ? `<p class="sub">${esc(d.location)}</p>` : ''}
    ${d.note ? `<div class="note">${esc(d.note)}</div>` : ''}
    ${
      d.blocks.length
        ? `<table><tr><th style="width:110px">Time</th><th>Block</th><th>Notes</th></tr>
      ${d.blocks.map((b) => `<tr><td>${esc(b.time)}</td><td>${esc(b.title)}</td><td>${esc(b.note)}</td></tr>`).join('')}
    </table>`
        : ''
    }`,
    )
    .join('')

  return `
    <h1>${esc(cohort.label)} — Schedule</h1>
    <p class="sub">${esc(formatDate(cohort.startDate))} – ${esc(formatDate(cohort.endDate))}${cohort.notes ? ` · ${esc(cohort.notes)}` : ''}</p>
    ${dayHtml || '<p>No days scheduled yet.</p>'}
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}

// ----- One-page agenda (packet insert) --------------------------------------

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/**
 * Condensed at-a-glance agenda designed to fit a single page: days flow in two
 * columns, block notes are dropped, times and titles only. Personalized with
 * the trainee's first name when one is supplied.
 */
export function agendaHTML(cohort: AcademyCohort, days: AcademyDay[], trainee?: Trainee): string {
  const first = trainee ? trainee.name.trim().split(/\s+/)[0] || trainee.name : ''
  const daysHtml = days
    .map((d) => {
      const wd = WEEKDAYS[fromISODate(d.date).getDay()]
      const rows = d.blocks.length
        ? d.blocks
            .map((b) => `<tr><td class="t">${esc(b.time)}</td><td>${esc(b.title)}</td></tr>`)
            .join('')
        : '<tr><td class="t"></td><td class="sub">No blocks scheduled</td></tr>'
      return `
      <div class="agenda-day">
        <div class="dh">${esc(wd)} ${esc(formatDate(d.date))} — ${esc(d.title || 'Academy day')}${
          d.facilitators ? ` <span class="fac">· ${esc(d.facilitators)}</span>` : ''
        }</div>
        <table>${rows}</table>
      </div>`
    })
    .join('')

  return `
    <h1>${esc(cohort.label)} — Agenda</h1>
    <p class="sub">${first ? `Welcome, ${esc(first)}. Your week at a glance — ` : ''}${esc(formatDate(cohort.startDate))} – ${esc(formatDate(cohort.endDate))}${
      cohort.notes ? ` · ${esc(cohort.notes)}` : ''
    }</p>
    <div class="agenda-cols">${daysHtml || '<p>No days scheduled yet.</p>'}</div>
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}

// ----- Attendance sheet ------------------------------------------------------

/**
 * Printable attendance matrix (trainees × academy days, both phases). `map` is
 * keyed `${traineeId}|${dayKey}` -> status, matching academyStore.attKey.
 */
export function attendanceSheetHTML(
  cohort: AcademyCohort,
  days: AcademyDayRef[],
  trainees: Trainee[],
  map: Map<string, AttendanceStatus>,
): string {
  const head = days
    .map(
      (d) =>
        `<th class="slot" style="min-width:40px">P${d.phase}<br/>${d.date ? esc(formatDate(d.date)) : 'TBD'}</th>`,
    )
    .join('')
  const rows = trainees
    .map((t) => {
      const cells = days
        .map((d) => {
          const s = map.get(`${t.id}|${d.key}`)
          const mark = s === 'present' ? 'P' : s === 'absent' ? 'A' : ''
          return `<td class="slot">${mark}</td>`
        })
        .join('')
      return `<tr><td>${esc(t.name)}</td>${cells}</tr>`
    })
    .join('')

  return `
    <h1>${esc(cohort.label)} — Attendance</h1>
    <p class="sub">${esc(formatDate(cohort.startDate))} – ${esc(formatDate(cohort.endDate))} · P = present, A = absent</p>
    <div class="table-wrap">
      <table>
        <tr><th>Trainee</th>${head}</tr>
        ${rows || '<tr><td>No trainees</td></tr>'}
      </table>
    </div>
    <p class="footer">Generated by AMR KC Academy · ${esc(formatDate())}</p>`
}
