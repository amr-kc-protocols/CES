import { useState } from 'react'
import { CREDENTIAL_LABELS } from '../../data/academy'
import { useScheduleDays } from './academyStore'
import {
  printDoc,
  downloadDoc,
  safeFilename,
  folderLabelHTML,
  welcomeKitHTML,
  facilitySheetHTML,
  scheduleHTML,
  agendaHTML,
} from './docGen'
import { scheduleICS, downloadICS } from './calendar'
import { COMPLIANCE_DOCS } from './complianceDocs'
import type { AcademyCohort, AcademyDay, Trainee } from '../../types'

// One name in, the whole packet out: each trainee's personalized documents
// plus the cohort-level docs, all print-ready or Word-downloadable.

const PAGE_BREAK = '<div style="page-break-after: always"></div>'

/** Every per-trainee document, in packet print order. */
function traineeDocs(
  t: Trainee,
  cohort: AcademyCohort,
  days: AcademyDay[],
): { id: string; label: string; html: string }[] {
  return [
    { id: 'label', label: 'Folder cover label', html: folderLabelHTML(t) },
    ...(days.length
      ? [{ id: 'agenda', label: 'One-page agenda', html: agendaHTML(cohort, days, t) }]
      : []),
    ...COMPLIANCE_DOCS.map((d) => ({ id: d.id, label: d.label, html: d.html(t) })),
  ]
}

function packetHTML(t: Trainee, cohort: AcademyCohort, days: AcademyDay[]): string {
  return traineeDocs(t, cohort, days)
    .map((d) => d.html)
    .join(PAGE_BREAK)
}

export default function DocumentsPanel({
  cohort,
  trainees,
}: {
  cohort: AcademyCohort
  trainees: Trainee[]
}) {
  const days = useScheduleDays(cohort.id)
  const [expanded, setExpanded] = useState<string | null>(null)

  function printAllPackets() {
    printDoc(
      `${cohort.label} — All New Hire Packets`,
      trainees.map((t) => packetHTML(t, cohort, days)).join(PAGE_BREAK),
    )
  }

  const cohortDocs = [
    {
      label: '📋 Welcome Kit checklist',
      title: `${cohort.label} — Day 1 Welcome Kit`,
      file: `${cohort.label}_Welcome_Kit`,
      html: () => welcomeKitHTML(cohort, trainees),
      disabled: trainees.length === 0,
      disabledReason: 'Add trainees to the roster first',
    },
    {
      label: '🏥 Facility cheat sheet',
      title: 'KC Facility Cheat Sheet',
      file: 'KC_Facility_Cheat_Sheet',
      html: () => facilitySheetHTML(),
      disabled: false,
      disabledReason: '',
    },
    {
      label: '📆 One-page agenda',
      title: `${cohort.label} — Agenda`,
      file: `${cohort.label}_Agenda`,
      html: () => agendaHTML(cohort, days),
      disabled: days.length === 0,
      disabledReason: 'Set session dates on the Schedule tab first',
    },
    {
      label: '🗓️ Schedule (full)',
      title: `${cohort.label} — Schedule`,
      file: `${cohort.label}_Schedule`,
      html: () => scheduleHTML(cohort, days),
      disabled: days.length === 0,
      disabledReason: 'Set session dates on the Schedule tab first',
    },
  ]

  return (
    <div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Per-trainee packets</div>
        <div className="subtle" style={{ marginBottom: 10 }}>
          The new-hire paperwork that still gets signed on paper: folder cover, Hep B, PPD, mask fit
          test, and the EVOC certificate — name, operation, and employee # filled in, new-hire boxes
          pre-checked. Stretcher and EVOC-track check-offs are now done digitally on the skill
          sheets.
        </div>
        {trainees.length === 0 ? (
          <div className="subtle">Add trainees to the roster to generate their packets.</div>
        ) : (
          <>
            <div className="list" style={{ gap: 6 }}>
              {trainees.map((t) => {
                const docs = traineeDocs(t, cohort, days)
                const isOpen = expanded === t.id
                return (
                  <div key={t.id} className="row" style={{ padding: '8px 12px', flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="grow">
                        <span style={{ fontWeight: 600 }}>{t.name}</span>{' '}
                        <span className="subtle">· {CREDENTIAL_LABELS[t.credential]} · {docs.length} documents</span>
                      </div>
                      <div className="btn-row" style={{ gap: 6 }}>
                        <button
                          className="btn sm primary"
                          onClick={() => printDoc(`${t.name} — New Hire Packet`, packetHTML(t, cohort, days))}
                        >
                          🖨 Packet
                        </button>
                        <button
                          className="btn sm"
                          onClick={() =>
                            downloadDoc(
                              safeFilename(`${t.name}_New_Hire_Packet`),
                              `${t.name} — New Hire Packet`,
                              packetHTML(t, cohort, days),
                            )
                          }
                        >
                          ⬇ Word
                        </button>
                        <button className="btn sm ghost" onClick={() => setExpanded(isOpen ? null : t.id)}>
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {docs.map((d) => (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                            <span className="subtle grow" style={{ flex: 1 }}>
                              {d.label}
                            </span>
                            <button className="btn sm" onClick={() => printDoc(`${t.name} — ${d.label}`, d.html)}>
                              🖨
                            </button>
                            <button
                              className="btn sm"
                              onClick={() => downloadDoc(safeFilename(`${t.name}_${d.label}`), `${t.name} — ${d.label}`, d.html)}
                            >
                              ⬇
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <button className="btn primary" style={{ marginTop: 10 }} onClick={printAllPackets}>
              🖨 Print all {trainees.length} packets
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ padding: 14, marginTop: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Cohort documents</div>
        <div className="subtle" style={{ marginBottom: 10 }}>
          Built from the roster and schedule — regenerate any time either changes.
        </div>
        <div className="list" style={{ gap: 6 }}>
          {cohortDocs.map((d) => (
            <div key={d.label} className="row" style={{ padding: '8px 12px' }}>
              <div className="grow" style={{ fontWeight: 600 }}>
                {d.label}
                {d.disabled && (
                  <div className="help-text" style={{ fontWeight: 400 }}>
                    {d.disabledReason}
                  </div>
                )}
              </div>
              <div className="btn-row" style={{ gap: 6 }}>
                <button className="btn sm" disabled={d.disabled} onClick={() => printDoc(d.title, d.html())}>
                  🖨 Print
                </button>
                <button
                  className="btn sm"
                  disabled={d.disabled}
                  onClick={() => downloadDoc(safeFilename(d.file), d.title, d.html())}
                >
                  ⬇ Word
                </button>
              </div>
            </div>
          ))}
          <div className="row" style={{ padding: '8px 12px' }}>
            <div className="grow" style={{ fontWeight: 600 }}>
              📅 Calendar file (.ics)
              <div className="subtle" style={{ fontWeight: 400, fontSize: 12 }}>
                Import into Outlook / Google / Apple Calendar, or email to instructors.
              </div>
              {days.length === 0 && (
                <div className="help-text" style={{ fontWeight: 400 }}>
                  Set session dates on the Schedule tab first
                </div>
              )}
            </div>
            <div className="btn-row" style={{ gap: 6 }}>
              <button
                className="btn sm"
                disabled={days.length === 0}
                onClick={() => downloadICS(safeFilename(`${cohort.label}_Academy`), scheduleICS(cohort, days))}
              >
                ⬇ .ics
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
