import { Link } from 'react-router-dom'
import { useSyncStatus, syncNow } from '../lib/sync'
import { usePersistFailed } from '../lib/store'

// The "is my work safe?" indicator, always visible in the top bar. The app
// has no save buttons — everything stores instantly and syncs itself — but
// an FTO who just filed an eval wants proof it left the phone. This chip is
// that proof, and tapping it forces a sync right now.

export default function SyncChip() {
  const { configured, signedIn, pending, syncing, lastSync, error } = useSyncStatus()
  const persistFailed = usePersistFailed()

  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    padding: '4px 11px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
    border: 'none',
    cursor: 'pointer',
    font: 'inherit',
  }

  // Device storage rejecting writes outranks every other state: changes are
  // surviving only in memory, and closing the app would lose them.
  if (persistFailed) {
    return (
      <Link to="/settings" style={{ ...base, background: '#fde2e1', color: '#991b1b', textDecoration: 'none' }} title="This device's storage is full or blocked — changes are NOT being saved locally. Export a backup and free space.">
        ⛔ Storage full — not saving
      </Link>
    )
  }

  if (!configured) return null

  // Signed out: nothing leaves this device — the one genuinely unsafe state.
  if (!signedIn) {
    return (
      <Link to="/settings" style={{ ...base, background: '#fde2e1', color: '#991b1b', textDecoration: 'none' }} title="Changes stay on this device until you sign in — tap to sign in">
        ⚠ Not backed up — sign in
      </Link>
    )
  }

  if (syncing) {
    return (
      <span style={{ ...base, background: '#e0ecf7', color: '#0b2e4f', cursor: 'default' }}>
        ⟳ Syncing…
      </span>
    )
  }

  // Queued work reads as the calm amber state even when the last attempt
  // errored (a dead zone IS an error) — the queue is safe and will retry.
  if (pending > 0) {
    return (
      <button
        style={{ ...base, background: '#fef3c7', color: '#92400e' }}
        onClick={() => void syncNow()}
        title={`${pending} change${pending === 1 ? '' : 's'} on this device waiting to upload — tap to sync now${error ? ` · last attempt: ${error}` : ''}`}
      >
        ⬆ {pending} to back up
      </button>
    )
  }

  if (error) {
    return (
      <button style={{ ...base, background: '#fde2e1', color: '#991b1b' }} onClick={() => void syncNow()} title={error}>
        ⚠ Sync issue — tap to retry
      </button>
    )
  }

  const at = lastSync
    ? new Date(lastSync).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''
  return (
    <button
      style={{ ...base, background: '#dcf5e4', color: '#166534' }}
      onClick={() => void syncNow()}
      title={`Everything on this device is in the cloud${at ? ` · last sync ${at}` : ''} — tap to sync again`}
    >
      ✓ Backed up{at ? ` · ${at}` : ''}
    </button>
  )
}
