# Human Patient Simulation Platform

An instructor-driven patient simulator. One window is the **control panel** —
vitals, rhythms, medications, and the scripted states of each quarterly
simulation. A second window is the **patient monitor** the crew sees. The two
stay in step over a `BroadcastChannel`, with `localStorage` carrying the state
the monitor reads as it opens.

Served as static files from `public/simulator/`, the same way the two chart
review tools under `public/review/` and `public/necessity/` are.

## Status

**Not yet wired into the app.** The control panel and the monitor are both here
and work together; the platform landing page has not landed yet. No route and no
tab have been added — see the last section.

## The contract between the two windows

The control panel is the only writer. It publishes the whole state object on
every change:

- `bc.postMessage(S)` on a `BroadcastChannel` named `simState` — the live path.
- `localStorage['simState']`, as JSON — what a monitor window reads at load.
  Writes are coalesced on a 50ms trailing timer because a slider drag fires on
  every pixel; anything that hands off to another window (`Open Monitor`) calls
  `flushSave()` first so the monitor never opens against a stale write.
- `localStorage['simCmd12Lead']`, as `open:<timestamp>` / `close:<timestamp>` —
  a one-shot command rather than state. The monitor keeps a high-water mark of
  the timestamp it has seen, seeded at load from whatever is already stored, so
  a window opened tomorrow does not replay yesterday's command. It is still not
  part of `S`, which is why the two windows can disagree about whether the
  12-lead is open (see Known gaps).

The key names and every field in `S` are exactly as delivered. Renaming them is
an integration task, not a review one — see below.

## The monitor

`patient_monitor_display.html` is the screen the crew sees. It reads state and
never writes it. Two skins: **ZX** (numerics down the right) and **LP**
(numerics down the left, LP-style palette); the switch is in the top bar.

Waveforms are Catmull-Rom splines through hand-authored keyframes, baked once
into 2048-entry lookup tables, then sampled per pixel. Each channel keeps its
own write head and only repaints the columns that advanced since the last frame,
the way a real monitor sweeps. Two things that matter if you touch that loop:

- **Erase, grid and trace are batched per frame, not per pixel.** The per-pixel
  version issued around nine hundred canvas stroke calls a frame and cost 2.0ms;
  batched it costs 0.05ms. On a classroom laptop that is the difference between
  a smooth sweep and a stuttering one.
- **A sample function may return `null`**, meaning "this channel has nothing to
  draw". That is how a disconnected patient shows blank traces instead of a flat
  green line — the one thing on this screen a student is trained to read as
  asystole.

The 12-lead is a **snapshot**, not a live view: it renders the rhythm as it
stands when the window opens and does not follow later changes. Its per-lead
modifiers (ST shift, hyperacute T, T inversion, Osborn wave, QT widening) are
deviations in the same normalised units as the lookup tables, where the R wave
is about 0.48. Do not scale them by the panel height — the y mapping already
does that, and doing it twice is what used to rail every ST-shifted lead against
the top of its box and draw it as a square.

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

`scripts/check-simulator.mjs` (`npm run check:sim`) drives both real pages in
jsdom through all of this. It skips itself if jsdom is not installed.

One of its checks reads *both* files: it takes the damping values the control
panel's select can emit and asserts the monitor's arterial trace distinguishes
each of them. That mismatch — panel sending `over`, monitor testing for
`overdamped` — meant two carefully built waveforms had never once rendered, and
neither file could have noticed on its own.

## Before this is wired into the app

Four things are known to need doing. All of them touch both windows at once,
which is why they were left until the pair was complete and checkable:

- **CSS collides with the app's.** The control panel defines `.card`, `.row`, `.grid`,
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

## Known gaps

- **The alarm is visual only.** The control panel offers alarm ON / MUTE and the
  monitor honours them, but only by blinking the banner — there is no tone. A
  browser will not start audio until the page itself has been interacted with,
  so a tone added naively would be silent until someone clicked the monitor,
  which is worse than clearly having none. If it is wanted, it needs an
  AudioContext resumed on first interaction and a visible indication of whether
  audio is armed.
- **P3 on the bottom bar is a placeholder** with no state behind it.
- **The 12-lead does not follow the rhythm** once open (see above), and closing
  it from the monitor's own `12` button leaves the control panel's toggle
  believing it is still open, so the next click there is swallowed.
- **Both pages assume a wide screen.** The monitor is an absolutely positioned
  fixed layout; the control panel's grid is authored against 960px with
  breakpoints below that. Neither is usable on a phone, which is worth knowing
  given CES is installed as a phone PWA.
