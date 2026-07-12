import { useSyncStatus } from './sync'

// ---------------------------------------------------------------------------
// What the signed-in role may do, mirrored from the server's row-level
// security so the UI never offers an action the database would refuse.
// Signed-out (local-only) devices are their own admin.
// ---------------------------------------------------------------------------

export interface Capabilities {
  /** Cohorts, schedules, roster membership, releases, CE, settings. */
  manageAcademy: boolean
  /** Checklist marks, contacts, attendance, ride assignments. */
  editRideWork: boolean
}

export function useCan(): Capabilities {
  const { role } = useSyncStatus()
  return {
    manageAcademy: role === 'admin',
    editRideWork: role === 'admin' || role === 'fto',
  }
}
