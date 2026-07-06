import { useState } from 'react'
import { Modal } from '../../components/ui'
import { CE_LOCATIONS, CE_DISCIPLINES } from '../../data/operations'
import { addDays, formatDate, todayISO } from '../../lib/date'
import { addCEClass, updateCEClass, deleteCEClass, CE_WINDOW_DAYS } from './ceStore'
import type { CEClass, CELocation } from '../../types'

export default function CEForm({
  editing,
  onClose,
}: {
  editing?: CEClass
  onClose: () => void
}) {
  const [instructor, setInstructor] = useState(editing?.instructor ?? '')
  const [location, setLocation] = useState<CELocation>(editing?.location ?? 'kc')
  const [classDate, setClassDate] = useState(editing?.classDate ?? todayISO())
  const [discipline, setDiscipline] = useState(editing?.discipline ?? 'ACLS')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [error, setError] = useState('')

  const due = classDate ? addDays(classDate, CE_WINDOW_DAYS) : ''

  function save() {
    if (!instructor.trim()) return setError('Instructor is required.')
    if (!classDate) return setError('Class date is required.')
    if (editing) {
      updateCEClass(editing.id, { instructor, location, classDate, discipline, notes })
    } else {
      addCEClass({ instructor, location, classDate, discipline, notes })
    }
    onClose()
  }

  function remove() {
    if (editing && confirm('Delete this class? This cannot be undone.')) {
      deleteCEClass(editing.id)
      onClose()
    }
  }

  return (
    <Modal title={editing ? 'Edit class' : 'Add class'} onClose={onClose}>
      {error && <div className="banner crit">{error}</div>}

      <div className="field">
        <label>Instructor</label>
        <input
          value={instructor}
          onChange={(e) => setInstructor(e.target.value)}
          placeholder="e.g. J. Smith"
          autoFocus
        />
      </div>

      <div className="field-row">
        <div className="field">
          <label>Location</label>
          <select value={location} onChange={(e) => setLocation(e.target.value as CELocation)}>
            {CE_LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Discipline</label>
          <input
            list="ce-disciplines"
            value={discipline}
            onChange={(e) => setDiscipline(e.target.value)}
          />
          <datalist id="ce-disciplines">
            {CE_DISCIPLINES.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
      </div>

      <div className="field">
        <label>Class date</label>
        <input type="date" value={classDate} onChange={(e) => setClassDate(e.target.value)} />
        {due && (
          <div className="help-text">
            KBEMS submission due <strong>{formatDate(due)}</strong> ({CE_WINDOW_DAYS} days after class).
          </div>
        )}
      </div>

      <div className="field">
        <label>Notes (optional)</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <div className="btn-row" style={{ marginTop: 8 }}>
        <button className="btn primary" onClick={save}>
          {editing ? 'Save changes' : 'Add class'}
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
