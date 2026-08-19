# Human Patient Simulation Platform

An instructor-driven patient simulator. One window is the **control panel** —
vitals, rhythms, medications, and the scripted states of each quarterly
simulation. A second window is the **patient monitor** the crew sees. The two
stay in step over a `BroadcastChannel`, with `localStorage` carrying the state
the monitor reads as it opens.

Served as static files from `public/simulator/`, the same way the two chart
review tools under `public/review/` and `public/necessity/` are.

## Status

**Live at `/simulator`,** on the `Sim` tab in the bottom bar, for administrators.
`src/modules/simulator/SimulatorView.tsx` frames the control panel and opens the
monitor in its own window. The platform landing page that shipped with these two
files is not used: the CES tab replaces the chooser it offered.

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

## Facilitating and grading

One person runs these scenarios. They drive the patient and assess the crew at
the same time, so both live in one band across the top of the console: the
patient states on the left (click to drive), the state's **Expected Actions** in
the middle (tap as observed), and the transition triggers and facilitator notes
on the right. Ticking an action is the whole of grading.

The band is full width because it has to be. Measured at 1280×800 and 1440×900,
the same content inside the third-of-a-grid Simulation State card came to 895px
— the End run button and the last actions sat below the fold on every laptop.
Full width it is 350px and the entire run is on screen at once, which is the
point.

**There is no score.** The scenarios come from Medical Director-approved Word
documents, and neither carries a scoring rubric. Inventing one would assess
crews against something nobody approved. What a run records is what the
facilitator observed: which expected actions the crew performed, in which state,
and how long the patient spent in each. That is what a debrief is read from.

`SCENARIO_DOCS` in `control_panel.html` holds the transcription — the brief a
facilitator would otherwise keep the Word document open for (dispatch, hand-off,
SAMPLE, primary and secondary assessment, labs), plus per state the Expected
Actions and Transition Triggers. It sits beside `SIMULATIONS` rather than inside
it so the vitals table stays the vitals table. Only the quarterly scenarios are
graded; the quick scenarios are vitals presets with no approved action list.

Ending a run posts it to the CES app, which stamps the facilitator from
`Settings.reviewer` and writes a `SimRun` record. Records are listed on the
**Runs** tab beside the console, and sync between administrator devices like any
other CES record. Run the panel outside CES and the summary still appears on
screen — it simply says it was not saved.

Adding a scenario means adding its vitals states to `SIMULATIONS` and its
reference and actions to `SCENARIO_DOCS` under the same key. `npm run check:sim`
asserts the two stay in step — an action list per state, a trigger per state,
and a complete brief.

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

## How it is wired in

- **Framed, not ported.** `SimulatorView` puts the control panel in an iframe
  and gets out of the way. That is deliberate: the panel defines `.card`,
  `.row`, `.grid`, `.badge`, `.list` and `.subtitle` as its own, and
  `src/index.css` defines several of those globally. Framing keeps the two
  stylesheets apart. Lifting this markup into a React screen would mean
  renaming all of them first.
- **Paths keep their `.html` extension.** The Vercel rewrite
  (`/((?!assets/|.*\..*).*)`) and the service worker's
  `navigateFallbackDenylist` (`/\.[a-z0-9]+$/i`) both let a dotted path through
  and would otherwise hand back the CES shell — an iframe load counts as a
  navigation for both. `SimulatorView` checks the framed document's title and
  says so plainly if the shell came back instead. Same trap as `ReviewView`.
- **Two windows, on purpose.** The monitor opens with `window.open` rather than
  as a second panel, because it belongs on the screen the crew reads. The
  control panel's own `OPEN MONITOR` button resolves
  `patient_monitor_display.html` relative to this directory, so it works from
  inside the frame too, as long as both files stay here.
- **Admin gate.** `SimulatorOnly` in `src/App.tsx` and the `sim` tab flag in
  `Layout.tsx` both use the `manageAcademy` capability — not the plain `admin`
  flag History and CQMP use. Those two withhold records, and their rule also
  hides them on a local-only install where nobody is signed in and there are no
  roles to enforce. The simulator holds no records, and an instructor running a
  scenario off a laptop is exactly who it is for. The route is gated as well as
  the tab: hiding a tab is not access control, since a bookmark still resolves.

Still outstanding: **`localStorage` keys are unnamespaced.** Everything else
this app stores is under `ces.*` (`ces.db.v1`, `ces.market.active`,
`ces.cloud.config`). Renaming `simState` to `ces.sim.state` has to happen in
both windows at once, and buys nothing until something else wants that key.

## Usability

Both screens are read by different people under different conditions, and the
pass that shaped them worked from that rather than from the markup.

**The monitor is read from across a room.** Rendering it and shrinking it to the
visual angle of 2.5m and 4m showed the numerics (54-60px) survive and the alarm
banner (11px) does not. So a breached parameter now flashes red on the value
itself and turns its header bar red — the number is the only alarm signal that
carries at teaching distance, and it is also what the real equipment does. The
banner names what is wrong (`⚠ HR LOW`) rather than announcing `ALARM` and
leaving the crew to hunt. Only HR and SpO₂ can flash, because those are the only
two the control panel lets an instructor set limits for.

Muting hides the banner but leaves the parameter flashing: muting silences the
announcement, it does not make the value stop being out of range, and a monitor
that looks entirely normal while the patient is bradycardic teaches the wrong
thing.

**The control panel is driven mid-scenario, from a laptop, while watching a
crew.** It is 3.4 screens tall, and the header used to spend 440px of the first
one on a title, a subtitle and a connect bar whose work was already done — which
left two of the five simulation states visible on the card that drives the whole
scenario. The header is compact, the connect bar shrinks to a status line once
it has been used, and the two scenario pickers share a row. That reclaimed
256px and puts all five states, the full medication grid, the rhythm buttons and
HR/BP on the first screen.

**A facilitator cannot see the crew's screen.** Each open monitor announces
itself on the shared channel once a second (`{__monitor:1}`); the panel and the
CES bar both listen and say whether one is live. A monitor closed by accident is
otherwise completely silent — the scenario simply stops reaching anybody. The
indicator lives in the CES bar because that is the only part of the screen that
does not scroll away.

## Text tones

Both screens were audited by walking every rendered text run and computing its
contrast against its own composited background. The control panel failed 50 of
180 runs — it reached for `#333` through `#666` for anything secondary, which
lands between 1.4:1 and 3:1 on this background, so the drug doses, the scenario
notes and the empty states were effectively invisible in a lit classroom.

The panel now declares three tones in `:root`, all verified against both
surfaces it uses (`#0d1b2a` cards, `#0a0f1a` insets):

| token        | hex       | on cards | on insets |
|--------------|-----------|----------|-----------|
| `--t-strong` | `#e6edf5` | 14.7:1   | 16.2:1    |
| `--t`        | `#b6c2d1` | 9.6:1    | 10.6:1    |
| `--t-dim`    | `#8f9db0` | 6.3:1    | 7.0:1     |
| `--t-faint`  | `#6d7b8d` | 4.0:1    | 4.4:1     |

The three illegible greys collapsed into `--t-dim` — they were all unreadable,
so there was no hierarchy there to preserve. Three steps that each clear AA is
plenty, and the accent colours (cyan headings, orange medications, red
pressures) still carry most of the structure. `--t-faint` is large or
non-essential text only.

The monitor failed four runs, all in the 4.1–4.5 band, and all fixed by shifts
too small to see: `#cc00cc` → `#ce00ce` on the EtCO₂ header, `#0088aa` →
`#0081a1` on the P2 square, `#cc4444` → `#cc5555` on the arterial mean. Both
screens now pass AA on every text run. The rule for this screen is that it has
to keep reading as equipment — restyling it beyond a nudge is not an
improvement.

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
