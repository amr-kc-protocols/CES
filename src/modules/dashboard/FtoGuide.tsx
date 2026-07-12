import { Link } from 'react-router-dom'
import { useSyncStatus } from '../../lib/sync'

// First-run guide for FTOs. Owns the home screen before first sign-in (a
// fresh device is almost certainly a new FTO — the admin's devices are
// already signed in), stays one tap away for signed-in FTOs, and disappears
// for admins.

function GuideBody() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>1 · Sign in — once</div>
        <div className="subtle" style={{ lineHeight: 1.55 }}>
          Tap <strong>Settings</strong> (⚙️ bottom-right) → <strong>Cloud sync</strong> → enter your
          work email and the password the Clinical Educator gave you → <strong>Sign in</strong>. The
          cohort, your trainees, and their checklists load on their own. You stay signed in from
          then on.
        </div>
        <Link to="/settings" className="btn sm primary" style={{ marginTop: 8 }}>
          Go to sign in →
        </Link>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>2 · On a ride — the checklist is the job</div>
        <div className="subtle" style={{ lineHeight: 1.55 }}>
          <strong>Academy</strong> (🎓) → the cohort → your trainee → <strong>📋 Field checklist</strong>.
          At the top, set which shift number you're on (1–6) and your initials. Then, as the trainee
          completes an objective, tap <strong>+ Mark</strong> next to it — that's your initials on
          the slot, same as the old paper sheet. Use the A–I chips to jump between sections, log
          call types under <strong>Exposure</strong>, and fix a mis-tap with <strong>−</strong>.
        </div>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>3 · Before you clear the truck</div>
        <div className="subtle" style={{ lineHeight: 1.55 }}>
          On the trainee's card: <strong>+1 contact</strong> for each patient contact they ran, and
          mark the day on the <strong>Attendance</strong> tab. That's the whole shift's paperwork.
        </div>
      </div>

      <div className="banner info" style={{ margin: 0 }}>
        <strong>No signal? Keep working.</strong> Everything saves to your phone instantly and syncs
        itself when you're back in coverage. There is no save button anywhere.
      </div>

      <div className="subtle" style={{ fontSize: 12, lineHeight: 1.5 }}>
        Schedules, rosters, and CE are view-only for FTOs — if something there needs changing, tell
        the Clinical Educator. At the end of field training, the trainee fills out the exit survey
        from their card (📝), and the educator handles release.
      </div>
    </div>
  )
}

export default function FtoGuide() {
  const { signedIn, role } = useSyncStatus()

  // Admins built the thing; they don't need the tour.
  if (signedIn && role === 'admin') return null

  if (!signedIn) {
    return (
      <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: 'var(--navy-600)' }}>
        <h2 style={{ fontSize: 17, margin: '0 0 2px' }}>👋 Welcome — Field Training Officers start here</h2>
        <div className="subtle" style={{ marginBottom: 12 }}>
          Three things to know, then this app replaces the paper packet.
        </div>
        <GuideBody />
      </div>
    )
  }

  // Signed-in FTO (or new hire): keep the guide one tap away.
  return (
    <details className="card" style={{ padding: 14, marginBottom: 16 }}>
      <summary style={{ cursor: 'pointer', fontWeight: 700 }}>📖 FTO quick guide</summary>
      <div style={{ marginTop: 12 }}>
        <GuideBody />
      </div>
    </details>
  )
}
