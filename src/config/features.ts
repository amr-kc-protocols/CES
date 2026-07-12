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

// CE_ENABLED gates the Kansas CE deadline tracker (CE tab, /ce route, the CE
// stats + "deadlines at risk" section on the dashboard, and the Class Builder
// URL setting). The app has refocused on the New Hire & FTO portal, so CE is
// OFF. Existing CE data stays in local storage and cloud sync untouched —
// flip this to `true` to bring it all back with no other changes.
export const CE_ENABLED = false
