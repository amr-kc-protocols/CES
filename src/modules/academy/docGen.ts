import { FT_SECTIONS, FT_SLOTS, EXPOSURE_GROUPS, EXPOSURE_SLOTS } from '../../data/ftObjectives'
import {
  WELCOME_KIT_ITEMS,
  ROOM_SETUP_ITEMS,
  KC_FACILITIES,
  FACILITY_KEY_POINTS,
} from '../../data/academyTemplate'
import { CREDENTIAL_LABELS } from '../../data/academy'
import { operationName } from '../../data/operations'
import { formatDate, fromISODate } from '../../lib/date'
import type { AcademyCohort, AcademyDay, Trainee } from '../../types'

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
  const slotCells = Array.from({ length: FT_SLOTS }, () => '<td class="slot">&nbsp;</td>').join('')

  const sectionHtml = sections
    .map(
      (s) => `
    <h2>${esc(s.title)}</h2>
    <table>
      <tr><th class="num">#</th><th>Objective</th><th class="target">Target</th>${slotHead}</tr>
      ${s.objectives
        .map(
          (o) =>
            `<tr><td class="num">${o.id}</td><td>${esc(o.text)}</td><td class="target">${esc(o.target)}</td>${slotCells}</tr>`,
        )
        .join('')}
    </table>
    <p class="sig">Trainee acknowledges all of Section ${s.id} is complete: <span>&nbsp;</span> Date <span style="min-width:110px">&nbsp;</span></p>`,
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
          .map(
            (ct) =>
              `<tr><td>${esc(ct)}</td>${Array.from({ length: EXPOSURE_SLOTS }, () => '<td class="slot">&nbsp;</td>').join('')}</tr>`,
          )
          .join('')}
      </table>`,
    ).join('')}
    <p>Total unique call types exposed: _____ &nbsp;&nbsp; Gaps identified — schedule a targeted shift for: <span style="display:inline-block;border-bottom:1px solid #333;min-width:300px">&nbsp;</span></p>`

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
    <p class="footer">Generated by AMR CES · ${esc(formatDate())}</p>`
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
    <p class="footer">Generated by AMR CES · ${esc(formatDate())}</p>`
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
    <p class="footer">Generated by AMR CES · ${esc(formatDate())}</p>`
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
    <p class="footer">Generated by AMR CES · ${esc(formatDate())}</p>`
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
    <p class="footer">Generated by AMR CES · ${esc(formatDate())}</p>`
}
