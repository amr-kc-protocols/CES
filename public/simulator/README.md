# Human Patient Simulation Platform

An instructor-driven patient simulator. One window is the **control panel** —
vitals, rhythms, medications, and the scripted states of each quarterly
simulation. A second window is the **patient monitor** the crew sees. The two
stay in step over a `BroadcastChannel`, with `localStorage` carrying the state
the monitor reads as it opens.

Served as static files from `public/simulator/`, the same way the two chart
review tools under `public/review/` and `public/necessity/` are.

## Status

**Partly delivered.** Only the control panel is here so far. The monitor
(`patient_monitor_display.html`) and the platform landing page have not landed
yet, so nothing in the app routes here and no tab has been added. `Open Monitor`
and the 12-lead button both address a file that does not exist yet.

## The contract between the two windows

The control panel is the only writer. It publishes the whole state object on
every change:

- `bc.postMessage(S)` on a `BroadcastChannel` named `simState` — the live path.
- `localStorage['simState']`, as JSON — what a monitor window reads at load.
  Writes are coalesced on a 50ms trailing timer because a slider drag fires on
  every pixel; anything that hands off to another window (`Open Monitor`) calls
  `flushSave()` first so the monitor never opens against a stale write.
- `localStorage['simCmd12Lead']`, as `open:<timestamp>` / `close:<timestamp>` —
  a one-shot command rather than state. It is not part of `S`, so a monitor
  opened afterwards does not know the 12-lead was left open. Worth folding into
  `S` when the monitor arrives.

The key names and every field in `S` were left exactly as delivered, because
the monitor was written against them and is not here to be changed with them.
Renaming them is an integration task, not a review one — see below.

## Physiology lock

On by default. It exists so an instructor cannot broadcast a combination that
cannot exist — V-Fib with a blood pressure, a diastolic above the systolic. It
**corrects** state; it does not **pin** it:

- Arrest rhythms (V-Fib, asystole) hold 0/0 on both the cuff and the arterial
  line, whether or not the A-Line is linked. An A-Line left free is a way to
  put a pressure back onto a fibrillating patient, since it mirrors into the
  cuff reading.
- V-Tach caps pressure and saturation. It does not fix EtCO₂ and RR, which
  would leave those two sliders inert for as long as V-Tach is up.
- Rate bounds apply only while the HR slider is being dragged. Applied to every
  change they rewrote vitals a scenario author set deliberately — the pediatric
  TBI states carry HR 67 and 72 on a sinus bradycardia, correct for a
  5-year-old, and both were being pulled down to 60.

Turning the lock off (**FREE PLAY**) leaves every value alone, including the
snap that selecting an arrest rhythm would otherwise apply.

## Medications

`DRUGS[key].effect(base, p)` returns the vitals that drug alone would produce,
given the patient's undrugged baseline and its progress from 0 to 1. Two rules
hold the model together:

1. **Every curve must return to `base` at `p = 1`.** A drug still holding an
   effect when its duration runs out alters the patient permanently. The
   infusions use `ramp()` — onset, plateau, washout over the last quarter —
   rather than a monotonic climb that stops dead at the end.
2. **The baseline belongs to the patient, not to the drug.** One `drugBase` is
   captured when the first drug goes on board, and each tick recomputes
   baseline plus the sum of every active drug's deviation from it. Capturing
   live vitals per drug — which is what this did originally — meant a second
   drug adopted the first one's effect as the patient's own state, and the
   patient never came back down.

`STOP` cancels everything on board and adopts the current numbers as the
patient's state, so it neither snaps the vitals back nor strands an effect.
Applying a scenario or simulation state does the same, since that is a new
patient state rather than a drugged one.

`scripts/check-simulator.mjs` (`npm run check:sim`) drives the real page in
jsdom through all of this. It skips itself if jsdom is not installed.

## Before this is wired into the app

Four things are known to need doing, none of them safe to do while the monitor
is still unseen:

- **CSS collides with the app's.** This page defines `.card`, `.row`, `.grid`,
  `.badge`, `.list` and `.subtitle` as its own, and `src/index.css` defines
  several of those globally. Fine while it is a separate document; not fine if
  the markup is ever lifted into a React screen rather than framed in an
  iframe. Framing it, as `/review` does, avoids the problem entirely.
- **`localStorage` keys are unnamespaced.** Everything else this app stores is
  under `ces.*` (`ces.db.v1`, `ces.market.active`, `ces.cloud.config`). Renaming
  `simState` to `ces.sim.state` has to happen in both windows at once.
- **Paths must keep their `.html` extension.** Both the Vercel rewrite and the
  service worker's `navigateFallback` treat an extensionless path as an SPA
  route and hand back the CES shell — an iframe load counts as a navigation for
  both. This is the same trap documented in `src/modules/review/ReviewView.tsx`.
  `openMonitor()` opens `patient_monitor_display.html` relative to this
  directory, which resolves correctly as long as both files stay here.
- **Admin gate.** The feature is for administrators only, which in this app is
  the `manageAcademy` capability plus a route-level `Gated` wrapper — hiding
  the tab is not access control, since a bookmark still resolves.
