import { esc } from '../academy/docGen'
import { formatDate, formatDateTime } from '../../lib/date'
import type { SimRun } from '../../types'

// ---------------------------------------------------------------------------
// The printed check-off sheet.
//
// A megacode run is graded on the AHA Megacode Testing Checklist, and the
// student submits that sheet to the training centre for their card. So this is
// not a report about the run — it is the form itself, filled in: the same
// title block, the same Critical Performance Steps table with its red section
// bands and striped rows, the same inline CPR-quality row, the same STOP TEST,
// Test Results and Learning Station Competency blocks, the same copyright line,
// on one page as the published sheet is.
//
// Measured against the published PDF (ACLS Megacode Testing Checklists, © 2025
// American Heart Association) so the rows, the column split and the colours are
// the form's rather than an approximation: the bands are its red (#c9161d) and
// the striped rows its stone (#efe8d5).
//
// Two deliberate departures, both because this is a filled sheet rather than a
// blank one:
//
//   - The AHA mark is not reproduced. The header keeps the space it occupies on
//     the form, so a training centre that wants its own letterhead there has
//     room, and nothing here imitates the Association's branding.
//   - A single grey provenance line sits under the copyright line, naming the
//     run this sheet was printed from. It is what makes a printed copy traceable
//     back to the record.
//
// Everything else on the page comes from the run record, and nothing is filled
// in on the instructor's behalf: a step that was never checked prints an empty
// cell, exactly as it would if they had left it blank on paper.
//
// The quarterly scenarios have no such instrument — their approved documents
// define no outcome — so those runs print as a performance record instead, with
// no result and no instructor number.
// ---------------------------------------------------------------------------

const mmss = (sec: number): string => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

const CHECKED = '&#9745;' // ☑
const UNCHECKED = '&#9744;' // ☐
const TICK = '&#10003;' // ✓

/** ☑ / ☐ — for the boxes the form itself prints, in the CPR row and at PASS/NR. */
function box(on: boolean): string {
  return `<span class="bx">${on ? CHECKED : UNCHECKED}</span>`
}

/** A rule to write on, carrying whatever the record holds. */
function writ(value: string | undefined, width = 150): string {
  return `<span class="wl" style="min-width:${width}px">${value ? esc(value) : '&nbsp;'}</span>`
}

const SHEET_CSS = `
  /* One page, as the form is. The shared document CSS sets a print margin for
     ordinary documents; the sheet sets its own so the table lands where the
     published one does. */
  @page { size: letter; margin: 11mm; }
  @media print { body { margin: 0; } }
  .aha { font-family: 'Segoe UI', Arial, Helvetica, sans-serif; color: #000; }
  .aha-head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 9px; }
  .aha-title { font-size: 16.5px; font-weight: 800; line-height: 1.3; margin: 0; color: #000; }
  /* The space the Association's mark occupies on the published form, left
     empty on purpose — see the note at the top of this file. */
  .aha-mark { flex: 0 0 150px; }
  .aha-names { font-size: 11.5px; margin-bottom: 5px; white-space: nowrap; }
  .aha-names .lbl { margin-right: 2px; }
  .wl { display: inline-block; border-bottom: 1px solid #000; padding: 0 4px; }
  .bx { font-size: 13px; line-height: 1; }

  /* The steps table. It flows rather than being kept whole — the shared CSS
     keeps tables together, which for a 25-row form would push the whole thing
     onto a second page and leave the first empty. */
  table.aha-t { border-collapse: collapse; width: 100%; table-layout: fixed;
                page-break-inside: auto; margin: 0; }
  table.aha-t tr { page-break-inside: avoid; }
  table.aha-t td, table.aha-t th { border: 1px solid #c9c3b4; padding: 2.5px 8px;
                vertical-align: middle; font-size: 11.5px; line-height: 1.28; }
  table.aha-t th { background: #c9161d; color: #fff; font-weight: 700; text-align: center; }
  table.aha-t th.steps { font-style: italic; font-size: 12.5px; }
  table.aha-t th.tick, table.aha-t td.tick { width: 118px; text-align: center; }
  table.aha-t th.tick { font-size: 11px; }
  table.aha-t td.tick { font-size: 15px; font-weight: 700; }
  table.aha-t tr.sec td { background: #c9161d; color: #fff; font-weight: 700;
                border-color: #c9161d; padding: 3px 8px; }
  table.aha-t tr.alt td { background: #efe8d5; }
  /* The high-quality-CPR row: one step on the left, five measures across it. */
  table.aha-q { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 0; }
  table.aha-q td { border: 0; padding: 1px 4px; text-align: center; font-size: 9px;
                line-height: 1.2; vertical-align: top; }
  table.aha-q td.phrase { text-align: left; font-size: 11.5px; width: 168px; padding-left: 0; }
  table.aha-q .val { display: inline-block; min-width: 54px; border-bottom: 1px solid #000;
                font-size: 10.5px; }

  /* The quarterly performance record borrows the table, not the form's livery:
     navy headings and a grey band, so a record of a practice scenario is never
     mistaken across a desk for a certification document. */
  table.aha-t.rec th { background: #0b2e4f; }
  table.aha-t tr.rec-sec td { background: #e8eef5; color: #0b2e4f; font-weight: 700;
                border-color: #c9c3b4; }

  .stop { text-align: center; font-weight: 700; font-size: 12px; margin: 5px 0 3px; }
  table.aha-res { border-collapse: collapse; width: 100%; margin: 0 0 7px;
                page-break-inside: avoid; }
  table.aha-res td { border: 1px solid #000; padding: 5px 8px; font-size: 11.5px; }
  table.aha-res td.pick { width: 96px; text-align: center; font-weight: 700; white-space: nowrap; }
  /* The copyright line and the stamp under it belong to the page above them. */
  .aha-copy { font-size: 9px; margin-top: 6px; page-break-before: avoid; }
  .aha-prov { font-size: 8px; color: #777; margin-top: 2px; line-height: 1.45;
              page-break-before: avoid; page-break-inside: avoid; }
  /* The debrief note, on the quarterly record only — the megacode sheet is one
     page and stays one page. */
  .rec-notes { margin-top: 10px; page-break-inside: avoid; }
  .rec-notes-h { font-weight: 700; font-size: 11.5px; margin-bottom: 3px; }
  .rec-notes p { font-size: 11.5px; line-height: 1.45; }
`

/**
 * What the sheet needs on top of the shared document CSS. Carried in the body
 * rather than the head: printDoc owns the shell, and a sheet is a document
 * fragment it is handed.
 */
function styleTag(): string {
  return `<style>${SHEET_CSS}</style>`
}

/**
 * One step, and the cell the instructor checks.
 *
 * An unchecked step prints an empty cell, not an empty box: the published form
 * has no box in that column — it is a space to put a check in — and a sheet
 * that has been filled in has to read as one.
 */
function stepRow(text: string, done: boolean, alt: boolean): string {
  return `<tr${alt ? ' class="alt"' : ''}><td>${esc(text)}</td><td class="tick">${done ? TICK : ''}</td></tr>`
}

function sectionRow(title: string): string {
  return `<tr class="sec"><td colspan="2">${esc(title)}</td></tr>`
}

/**
 * The Team Leader/Team Members block, in the form's own order: the two team
 * steps with the high-quality-CPR row between them.
 *
 * The five CPR measures are labelled as the published form labels them. The app
 * stores them as three booleans and two written-in numbers, which is what the
 * form asks for; only the wording is restated here, to the form's.
 */
function teamBlock(run: SimRun): string {
  const team = run.team ?? []
  const c = run.cpr
  const quality = `<tr><td>
      <table class="aha-q"><tr>
        <td class="phrase">Ensures high-quality<br>CPR at all times</td>
        <td>Compression<br>rate 100-120/min<br>${box(!!c?.rate)}</td>
        <td>Compression<br>depth of ≥2 inches<br>${box(!!c?.depth)}</td>
        <td>Chest compression<br>fraction &gt;80%<br><span class="val">${c?.fraction ? esc(c.fraction) : '&nbsp;'}</span>%</td>
        <td>Chest<br>recoil<br>${box(!!c?.recoil)}</td>
        <td>Ventilation<br>rate<br><span class="val">${c?.ventRate ? esc(c.ventRate) : '&nbsp;'}</span></td>
      </tr></table>
    </td><td class="tick"></td></tr>`
  return (
    sectionRow('Team Leader/Team Members') +
    (team[0] ? stepRow(team[0].text, team[0].done, true) : '') +
    quality +
    (team[1] ? stepRow(team[1].text, team[1].done, true) : '')
  )
}

function resultsBlock(run: SimRun): string {
  return `<div class="stop">STOP TEST</div>
    <table class="aha-res">
      <tr>
        <td><strong>Test Results</strong> &nbsp; Check <strong>PASS</strong> or <strong>NR</strong>
            to indicate pass or needs remediation:</td>
        <td class="pick">${box(run.result === 'pass')} PASS</td>
        <td class="pick">${box(run.result === 'nr')} NR</td>
      </tr>
      <tr>
        <td colspan="3">Instructor Initials ${writ(run.instructorInitials, 84)}
          &nbsp; Instructor Number ${writ(run.instructorNumber, 200)}
          &nbsp; Date ${writ(formatDate(run.endedAt.slice(0, 10)), 150)}</td>
      </tr>
    </table>
    <table class="aha-res">
      <tr><td><strong>Learning Station Competency</strong><br>
        ${UNCHECKED} Bradycardia &nbsp; ${UNCHECKED} Tachycardia &nbsp;
        ${UNCHECKED} Cardiac Arrest/Post–Cardiac Arrest Care &nbsp;
        ${UNCHECKED} Megacode Practice</td></tr>
    </table>`
}

/**
 * Where this sheet came from, so a filed copy can be traced back to the run.
 *
 * One line, and it has to stay one line: the form fills the page, and a stamp
 * that wraps takes itself onto a second sheet of paper. The scenario is named
 * by its short title for the same reason.
 */
function provenance(run: SimRun, observed: number, total: number, seconds: number): string {
  const scenario = run.scenarioName.split(' — ')[0]
  return `<div class="aha-prov">
    Printed from CES · ${esc(scenario)} · ${esc(formatDateTime(run.startedAt))} ·
    run time ${mmss(seconds)} · ${observed} of ${total} steps checked${
      run.facilitator ? ` · facilitated by ${esc(run.facilitator)}` : ''
    }
  </div>`
}

/**
 * The debrief note. On the quarterly performance record only.
 *
 * It is deliberately NOT on the megacode sheet. That sheet is a submission: it
 * is one page, the same one page the training centre already knows, and a
 * second sheet of paper stapled behind it is a second thing to lose or to
 * question. The note is not lost — it stays on the run in CES, where the
 * debrief is read from.
 */
function notesBlock(run: SimRun): string {
  if (!run.notes?.trim()) return ''
  return `<div class="rec-notes">
    <div class="rec-notes-h">Instructor notes</div>
    <p>${esc(run.notes.trim())}</p>
  </div>`
}

/**
 * The filled AHA Megacode Testing Checklist for a megacode run.
 *
 * `checklistName` was stored as "Scenarios 1/3/8 — Bradycardia → Pulseless VT →
 * PEA → PCAC"; the first half names the sheet and the second is its path, which
 * is exactly how the two lines of the form's title read.
 */
export function megacodeSheetHTML(run: SimRun): string {
  const [scenarios, path] = (run.checklistName ?? '').split(' — ')
  const observed = run.states.reduce((n, s) => n + s.actions.filter((a) => a.done).length, 0)
  const total = run.states.reduce((n, s) => n + s.actions.length, 0)
  const seconds = run.states.reduce((n, s) => n + s.seconds, 0)

  const sections = run.states
    .map((st) => {
      if (!st.actions.length) return ''
      return (
        // Section headings are the published ones, kept on the record at run
        // time; older records that predate that fall back to the phase label.
        sectionRow(st.section || st.label) +
        // Striping restarts at each band, as it does on the form.
        st.actions.map((a, i) => stepRow(a.text, a.done, i % 2 === 0)).join('')
      )
    })
    .join('')

  return `${styleTag()}
    <div class="aha">
      <div class="aha-head">
        <div class="grow">
          <div class="aha-title">Megacode Testing Checklist${scenarios ? `: ${esc(scenarios)}` : ''}<br>
            ${esc(path ?? '')}</div>
        </div>
        <div class="aha-mark"></div>
      </div>
      <div class="aha-names">
        <span class="lbl">Student Name</span> ${writ(run.crew, 330)}
        &nbsp; <span class="lbl">Date of Test</span> ${writ(formatDate(run.startedAt.slice(0, 10)), 160)}
      </div>
      <table class="aha-t">
        <tr><th class="steps">Critical Performance Steps</th><th class="tick">Check if done<br>correctly</th></tr>
        ${teamBlock(run)}
        ${sections}
      </table>
      ${resultsBlock(run)}
      <div class="aha-copy">© 2025 American Heart Association</div>
      ${provenance(run, observed, total, seconds)}
    </div>`
}

/**
 * A quarterly scenario run. Same record, no result: those documents are an
 * approved list of expected actions and define no pass mark, so printing one
 * with a PASS box would invent an outcome the program never set.
 */
export function scenarioRecordHTML(run: SimRun): string {
  const observed = run.states.reduce((n, s) => n + s.actions.filter((a) => a.done).length, 0)
  const total = run.states.reduce((n, s) => n + s.actions.length, 0)
  const seconds = run.states.reduce((n, s) => n + s.seconds, 0)

  // Deliberately not the AHA sheet's furniture — no red bands, no result, no
  // instructor number. This is the program's own record and should not be
  // mistaken across a desk for a certification document.
  const sections = run.states
    .map((st) => {
      if (!st.actions.length && !st.seconds) return ''
      const done = st.actions.filter((a) => a.done).length
      const tally = st.actions.length
        ? `${done}/${st.actions.length} · ${mmss(st.seconds)}`
        : mmss(st.seconds)
      return (
        `<tr class="rec-sec"><td>${esc(st.section || st.label)}</td><td class="tick">${esc(tally)}</td></tr>` +
        st.actions
          .map(
            (a) =>
              `<tr><td>${esc(a.text)}</td><td class="tick">${a.done ? TICK : ''}</td></tr>`,
          )
          .join('')
      )
    })
    .join('')

  return `${styleTag()}
    <div class="aha">
      <div class="aha-title" style="margin-bottom:8px">Simulation performance record<br>
        <span style="font-weight:400;font-size:12px">${esc(run.scenarioName)}</span></div>
      <div class="aha-names" style="white-space:normal">
        <span class="lbl">Crew</span> ${writ(run.crew, 260)}
        &nbsp; <span class="lbl">Date</span> ${writ(formatDate(run.startedAt.slice(0, 10)), 150)}<br>
        <span class="lbl">Facilitator</span> ${writ(run.facilitator, 260)}
        &nbsp; <span class="lbl">Expected actions observed</span> ${observed} of ${total}
      </div>
      <table class="aha-t rec">
        <tr><th class="steps">Expected actions</th><th class="tick">Observed</th></tr>
        ${sections}
      </table>
      <div class="aha-prov">
        Recorded in CES · run time ${mmss(seconds)} · ${esc(formatDateTime(run.startedAt))} to
        ${esc(formatDateTime(run.endedAt))}. Expected actions are the scenario's own, as approved
        for this quarter. This scenario defines no pass mark, so this record states what was
        observed and nothing more.
      </div>
      ${notesBlock(run)}
    </div>`
}

/** Whichever sheet this run is entitled to. */
export function runSheetHTML(run: SimRun): string {
  return run.checklist ? megacodeSheetHTML(run) : scenarioRecordHTML(run)
}

export function runSheetTitle(run: SimRun): string {
  const who = run.crew?.trim() || 'Unnamed'
  return run.checklist
    ? `Megacode Testing Checklist — ${who}`
    : `Simulation record — ${who}`
}

export function runSheetFilename(run: SimRun): string {
  const who = run.crew?.trim() || 'unnamed'
  const day = run.startedAt.slice(0, 10)
  return `${run.checklist ? 'Megacode-checklist' : 'Sim-record'}-${who}-${day}`
}
