import { useState } from 'react'
import { Modal } from '../../components/ui'
import { addDays, formatDate, todayISO } from '../../lib/date'
import { ACADEMY_LENGTH_DAYS } from '../../data/academy'
import { addCohort, defaultCohortLabel, updateCohort, deleteCohort } from './academyStore'
import type { AcademyCohort } from '../../types'

export default function CohortForm({
  editing,
  onClose,
  onCreated,
  onDeleted,
}: {
  editing?: AcademyCohort
  onClose: () => void
  onCreated?: (id: string) => void
  onDeleted?: () => void
}) {
  const [startDate, setStartDate] = useState(editing?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(editing?.endDate ?? '')
  const [label, setLabel] = useState(editing?.label ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState('')

  const effectiveEnd = endDate || addDays(startDate, ACADEMY_LENGTH_DAYS)

  function save() {
    if (!startDate) return setError('Start date is required.')
    if (effectiveEnd < startDate) return setError('End date is before the start date.')
    if (editing) {
      updateCohort(editing.id, {
        startDate,
        endDate: effectiveEnd,
        label: label.trim() || defaultCohortLabel(startDate),
        notes: notes.trim() || undefined,
      })
    } else {
      const c = addCohort({ startDate, endDate: endDate || undefined, label, notes })
      onCreated?.(c.id)
    }
    onClose()
  }

  function remove() {
    if (editing && confirm('Delete this cohort and its entire roster, schedule, and documents?')) {
      deleteCohort(editing.id)
      onClose()
      onDeleted?.()
    }
  }

  return (
    <Modal title={editing ? 'Edit cohort' : 'New cohort'} onClose={onClose}>
      {error && <div className="banner crit">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Start date</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>End date</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <div className="help-text">
            Blank = start + {ACADEMY_LENGTH_DAYS} days ({formatDate(addDays(startDate, ACADEMY_LENGTH_DAYS))}).
          </div>
        </div>
      </div>

      <div className="field">
        <label>Label</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={defaultCohortLabel(startDate)}
        />
      </div>

      <div className="field">
        <label>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={save}>
          {editing ? 'Save changes' : 'Create cohort'}
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <div className="spacer" />
        {editing && (
          <button className="btn danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
    </Modal>
  )
}
