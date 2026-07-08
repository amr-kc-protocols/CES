// ---------------------------------------------------------------------------
// Feature flags.
//
// QA_ENABLED gates the entire QA function (QA Review Queue + QA Bot tab and its
// background folder sync). It is turned OFF for now — the QA workflow needs
// more planning before it ships to users. All QA code remains in the tree and
// wired up; flip this to `true` to bring the tabs, routes, background sync, and
// dashboard sections back with no other changes.
// ---------------------------------------------------------------------------

export const QA_ENABLED = false
