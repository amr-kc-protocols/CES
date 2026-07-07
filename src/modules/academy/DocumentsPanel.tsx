import { CREDENTIAL_LABELS } from '../../data/academy'
import { useCohortDays } from './academyStore'
import {
  printDoc,
  downloadDoc,
  safeFilename,
  objectivesPageHTML,
  folderLabelHTML,
  welcomeKitHTML,
  facilitySheetHTML,
  scheduleHTML,
} from './docGen'
import type { AcademyCohort, Trainee } from '../../types'

// One name in, the whole packet out: each trainee's personalized documents
// plus the cohort-level docs, all print-ready or Word-downloadable.

export default function DocumentsPanel({
  cohort,
  trainees,
}: {
  cohort: AcademyCohort
  trainees: Trainee[]
}) {
  const days = useCohortDays(cohort.id)

  function traineePacket(t: Trainee): { title: string; html: string } {
    // Objectives page + folder cover in one print job, separated by a page break.
    const html = `${folderLabelHTML(t)}<div style="page-break-after: always"></div>${objectivesPageHTML(t)}`
    return { title: `${t.name} — New Hire Packet`, html }
  }

  function printAllPackets() {
    const html = trainees
      .map((t) => `${folderLabelHTML(t)}<div style="page-break-after: always"></div>${objectivesPageHTML(t)}`)
      .join('<div style="page-break-after: always"></div>')
    printDoc(`${cohort.label} — All New Hire Packets`, html)
  }

  const cohortDocs = [
    {
      label: '📋 Welcome Kit checklist',
      title: `${cohort.label} — Day 1 Welcome Kit`,
      file: `${cohort.label}_Welcome_Kit`,
      html: () => welcomeKitHTML(cohort, trainees),
      disabled: trainees.length === 0,
    },
    {
      label: '🏥 Facility cheat sheet',
      title: 'KC Facility Cheat Sheet',
      file: 'KC_Facility_Cheat_Sheet',
      html: () => facilitySheetHTML(),
      disabled: false,
    },
    {
      label: '🗓️ Schedule',
      title: `${cohort.label} — Schedule`,
      file: `${cohort.label}_Schedule`,
      html: () => scheduleHTML(cohort, days),
      disabled: days.length === 0,
    },
  ]

  return (
    <div>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Per-trainee packets</div>
        <div className="subtle" style={{ marginBottom: 10 }}>
          Folder cover label + personalized Field Training Objectives Page (EMT or Paramedic
          version, name/position/hire date filled in).
        </div>
        {trainees.length === 0 ? (
          <div className="subtle">Add trainees to the roster to generate their packets.</div>
        ) : (
          <>
            <div className="list" style={{ gap: 6 }}>
              {trainees.map((t) => {
                const packet = traineePacket(t)
                return (
                  <div key={t.id} className="row" style={{ padding: '8px 12px' }}>
                    <div className="grow">
                      <span style={{ fontWeight: 600 }}>{t.name}</span>{' '}
                      <span className="subtle">· {CREDENTIAL_LABELS[t.credential]}</span>
                    </div>
                    <div className="btn-row" style={{ gap: 6 }}>
                      <button className="btn sm" onClick={() => printDoc(packet.title, packet.html)}>
                        🖨 Print
                      </button>
                      <button
                        className="btn sm"
                        onClick={() =>
                          downloadDoc(safeFilename(`${t.name}_New_Hire_Packet`), packet.title, packet.html)
                        }
                      >
                        ⬇ Word
                      </button>
                    </div>
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
        </div>
      </div>
    </div>
  )
}
