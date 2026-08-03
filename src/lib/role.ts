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
  /**
   * The AEMT program — see, and do anything within.
   *
   * Separate from manageAcademy because the two carry different exposure. NEOP
   * is where FTOs work daily; AEMT holds Kansas certification records, student
   * cert numbers, and cohort-selection data that includes candidates'
   * corrective-action status. FTOs are peers of those candidates.
   *
   * The signed-out local-admin convenience deliberately does NOT apply where
   * cloud sync is configured: without that, an FTO who signs out would inherit
   * admin and regain everything this gate exists to withhold. Where sync is
   * NOT configured there are no roles at all and the device is its own admin,
   * which is the documented local-only model — the same rule useRecordSafety
   * applies.
   */
  manageAemt: boolean
}

export function useCan(): Capabilities {
  const { role, configured, signedIn } = useSyncStatus()
  return {
    manageAcademy: role === 'admin',
    editRideWork: role === 'admin' || role === 'fto',
    manageAemt: configured ? signedIn && role === 'admin' : true,
  }
}
