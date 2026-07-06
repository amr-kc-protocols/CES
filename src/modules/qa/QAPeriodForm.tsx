import { useState } from 'react'
import { Modal } from '../../components/ui'
import { OPERATIONS, OPERATION_MAP } from '../../data/operations'
import { monthKey, monthLabel } from '../../lib/date'
import { getState } from '../../lib/store'
import { createPeriod, targetFor, periodId } from './qaStore'
import type { OperationId } from '../../types'

export default function QAPeriodForm({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated?: (id: string) => void
}) {
  const [operation, setOperation] = useState<OperationId>('kc')
  const [month, setMonth] = useState(monthKey())
  const defaultVol = OPERATION_MAP[operation].typicalVolume
  const [volume, setVolume] = useState<string>(defaultVol ? String(defaultVol) : '')
  const pct = getState().settings.samplePercent
  const [error, setError] = useState('')

  const volNum = Number(volume) || 0
  const target = targetFor(volNum, pct)

  function onOperationChange(op: OperationId) {
    setOperation(op)
    const v = OPERATION_MAP[op].typicalVolume
    setVolume(v ? String(v) : '')
  }

  function save() {
    if (!month) return setError('Select a month.')
    if (volNum <= 0) return setError('Enter this month’s call volume for the operation.')
    const p = createPeriod({ month, operation, monthlyVolume: volNum, samplePercent: pct })
    onCreated?.(p.id)
    onClose()
  }

  return (
    <Modal title="New review period" onClose={onClose}>
      {error && <div className="banner crit">{error}</div>}

      <div className="field-row">
        <div className="field">
          <label>Operation</label>
          <select value={operation} onChange={(e) => onOperationChange(e.target.value as OperationId)}>
            {OPERATIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Month</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>Monthly call volume</label>
        <input
          type="number"
          min={0}
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          placeholder="Total calls for this operation this month"
        />
        {OPERATION_MAP[operation].typicalVolume == null && (
          <div className="help-text">
            Volume for {OPERATION_MAP[operation].short} is an open item in the spec — enter the
            actual monthly count to size the sample.
          </div>
        )}
      </div>

      <div className="banner info">
        Sampling target: <strong>{target}</strong> charts ({Math.round(pct * 100)}% of {volNum || 0}
        ) for {OPERATION_MAP[operation].short}, {monthLabel(month)}.
        {getState().qaPeriods.some((p) => p.id === periodId(month, operation)) && (
          <> This will update the existing period.</>
        )}
      </div>

      <div className="btn-row">
        <button className="btn primary" onClick={save}>
          Create period
        </button>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  )
}
