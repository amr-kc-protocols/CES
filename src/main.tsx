import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { initSync, onPullComplete, getSyncStatus, getCloudConfig } from './lib/sync'
import { initPWA } from './lib/pwa'
// Side-effect import: registers the bundled skill sheets and evaluation forms
// as version 0 of each editable instrument. Must run before anything resolves
// a template, so it sits at the entry point rather than inside a lazy chunk.
import './data/templateRegistry'
import './index.css'

// Register the service worker and keep it auto-updating to the latest deploy.
initPWA()

// Wire cloud sync (no-op until a Supabase project is configured in Settings).
initSync()

// Sweep records orphaned by pre-cascade deletions (a removed trainee's old
// evals, rides, attendance…). Admin devices only: other roles can't delete
// every collection, and their refused tombstones would bounce back on the
// next pull and retry forever. After a pull the local state mirrors the
// server, so anything parentless then is a true orphan — never a record
// whose parent just hasn't arrived yet. Dynamic import keeps the academy
// module out of the entry chunk.
const sweepOrphans = () => {
  if (getSyncStatus().role !== 'admin') return
  void import('./modules/academy/academyStore').then((m) => m.purgeOrphanTraineeRecords())
}
onPullComplete(sweepOrphans)
// Local-only devices never pull; their state is already complete, so sweep now.
if (!getCloudConfig()) sweepOrphans()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
