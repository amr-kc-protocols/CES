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

`patient_monitor_display.html` is the screen the crew sees. It reads patient
state and never writes it. Two skins: **ZX** (numerics down the right) and
**LP** — a LIFEPAK 15, chassis and all; the switch floats in the bottom-right
corner.

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

## The LIFEPAK 15 skin

The LP skin is the whole unit, not just its screen. Laid out from Figure 3-1 and
the front-face photograph the operation supplied: carry handle over the top,
connector strip down the left edge, Area 4 keys low on the left face with the
round speaker grille beneath them, the display under its `LIFEPAK 15
MONITOR/DEFIBRILLATOR` label, printer door and therapy port along the bottom,
and Area 1 over Areas 3 and 2 — which sit **side by side**, monitoring keys to
the left of pacing keys — with the speed dial in the bottom corner.

The two-column arrangement is worth calling out because the manual hides it:
Areas 2 and 3 are separate figures and separate tables, which reads as two
stacked groups. The photograph shows them shoulder to shoulder, and the
highlighted regions on the device thumbnails in Figures 3-3 and 3-4 agree. Control grouping,
labels, LED behaviour and the numbered 1-2-3 therapy path come from Figures
3-2 to 3-5 and Tables 3-1 to 3-4 of the LIFEPAK 15 operating instructions. The
home-screen layout — parameter column left, three waveform channels right,
channel labels at the right-hand end of each trace — follows the reference
screen the operation supplied.

The chassis is laid out fluidly rather than drawn at a fixed size and scaled.
A transform would keep the proportions exact at any window size, but it also
scales the waveform canvases, and a trace resampled by the compositor is the
one thing on this screen that has to stay sharp.

### Who owns what

One boundary carries the whole design:

- **The facilitator owns the patient.** The control panel is still the only
  writer of rhythm, pressure, saturation, EtCO₂ — everything in `S`.
- **The crew owns the device.** Selected energy, charge state, lead, ECG size,
  pacing rate and current, alarm silence, display mode and the shock count live
  in `D` on the monitor and never leave the page except as an event.

So a shock is charged, delivered, announced and logged, and the patient does
not change until the facilitator changes it — which is how a megacode station
is run. `check-simulator.mjs` runs a whole resuscitation through the device and
asserts that not one field of `S` moved; that check is what fails the day
somebody makes the shock button convert the rhythm to make a demo look right.

Two things are the unit's own output rather than the patient's response, and
are drawn:

- **Pacing spikes** appear as soon as pacing current is set. **Capture** is the
  patient answering them, and stays the facilitator's to give.
- **ECG size** is display gain. It scales the trace about the baseline, so it
  can never turn a flat line into a complex.

### What the keys do

`ON` (hold to switch off) · `CPR` metronome at 110/min · `ANALYZE` runs an
eight-second analysis and advises — and says `CONNECT ELECTRODES` rather than
"no shock advised" when it has no ECG at the pads, because advising against a
shock it cannot see teaches a crew to trust the one reading that means nothing
· `LEAD` and `SIZE` cycle · `SYNC` · `ENERGY SELECT` walks the manual-mode
ladder and throws away any charge when it moves · `CHARGE` takes 5.2s with a
rising tone and disarms itself after 60s · `SHOCK` only fires armed · `PACER`
with `RATE`, `CURRENT` and hold-to-`PAUSE` · `NIBP` takes the reading away for
25s while the cuff cycles · `ALARMS` enables, then silences for two minutes ·
`OPTIONS` and `EVENT` open menus the `SPEED DIAL` scrolls and selects ·
`HOME SCREEN` · the display-mode key toggles **SunVue**, the unit's
high-contrast outdoor mode, which repaints the canvases on a light ground with
dark traces rather than recolouring the chrome.

Area 4 follows Table 3-4 exactly: `12-LEAD` acquires and prints one record,
`TRANSMIT` sends it, `CODE SUMMARY` prints the critical event record, and
`PRINT` **starts and stops** the printer — it is a toggle running a continuous
strip, not a one-shot like the two record keys beside it.

### The timeline

Every press posts `{__device: event}` on the same `simState` channel the panel
pushes state down. It is one-way — the panel ignores it as state, and so does
the monitor, which hears its own posts because a channel delivers to every
other subscriber in the page as well as to other tabs.

The panel timestamps each event against the run, shows it live in an **At the
monitor** column, and saves it with the record. That timeline is what answers
the questions the checklist asks and nobody can measure while both facilitating
and grading: time to first shock, the energies used, how long the pause around
one ran, whether compressions came straight back.

### Auto-ticking, and its limits

Three checklist steps tick themselves from the device, and deliberately no
more. Most of the AHA megacode checklist is about recognition, verbalisation
and clinical appropriateness — "Verbalizes potential reversible causes",
"Administers appropriate drug(s) and doses" — and a button press is no evidence
of any of it. Ticking those from the device would be fabricating the
assessment.

What is left is where the press and the step are the same fact:

| Event | Step |
| --- | --- |
| `SHOCK ADVISED` after the crew pressed ANALYZE | Recognizes VF / pVT |
| CPR metronome started within 15s of a shock | Immediately resumes CPR after shocks |
| Pacing switched on | Prepares for second-line treatment |

Only in the phase the facilitator currently has the patient in — a step belongs
to its section, and ticking one three phases ahead marks something that has not
been asked for yet. Every auto-tick is labelled **from monitor** in the console
and comes off on a click, and the click makes it the facilitator's: they remain
the assessor of record.

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

## ACLS megacodes

Megacodes 1–5 from the AHA ACLS Instructor Manual (pp. 235–239), graded against
the **AHA Megacode Testing Checklist, © 2025 American Heart Association**, as
used by this AHA Training Center for megacode testing.

These differ from the quarterly scenarios in one way that matters: the checklist
**is** an approved instrument, with critical performance steps and a PASS / NR
the instructor circles. So a megacode run records an outcome where a quarterly
run does not.

The published steps live once, in `ACLS_CHECKLISTS`. A scenario names the
checklist it is tested against and its per-phase expected actions are filled
from it at load — they are never transcribed a second time, so a run cannot be
graded against a stale copy. Three of the six published checklists are here,
covering megacodes 1–5:

| Checklist | Path | Megacodes |
|---|---|---|
| `brady_pvt_pea` | Bradycardia → Pulseless VT → PEA → PCAC | 1, 3 |
| `brady_vf_asys` | Bradycardia → VF → Asystole → PCAC | 2, 5 |
| `tachy_vf_pea` | Tachycardia → VF → PEA → PCAC | 4 |

The checklist also assesses two things once for the whole code rather than in
any one rhythm — Team Leader/team behaviour and CPR quality (rate, depth and
recoil ticked; compression fraction and ventilation rate written in). Those sit
in a strip under the run header with the PASS / NR buttons, so they are never
mistaken for a step in the rhythm on screen.

**Where the manual leaves a vital blank**, the value in `SIMULATIONS` is ours,
inferred from the rhythm and the described state, and `SCENARIO_DOCS` says so
in the brief. Nobody should mistake a clinical inference of ours for something
the AHA specified.

### Two physiology-lock rules this content corrected

- **EtCO₂ is no longer pinned in arrest.** It was forced to 7 in V-Fib and 0 in
  asystole, on the reasoning that neither perfuses. But an arrest being *run*
  has CPR in progress, and EtCO₂ is the one number that reflects how good those
  compressions are — under 10 means push harder, an abrupt rise is ROSC. The
  megacodes run at 22, 25 and 48 mmHg mid-arrest. Ceiling only now (50), above
  which it implies a perfusing rhythm rather than compressions.
- **V-Tach is capped at 110/70, not 62/30.** The old cap assumed pulseless or
  near-pulseless VT, which made unstable-VT-with-a-pulse unreachable — Megacode
  4 runs monomorphic wide-complex tachycardia at 84/54 with palpable carotid and
  radial pulses, and that patient is the whole reason the tachycardia algorithm
  exists. These are upper bounds, so pulseless VT at 0/0 is still expressible.

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

- **Alarms are still visual only.** The device keys have tones — charging,
  charge-ready, the CPR metronome, the shock, menu clicks — because pressing a
  key is itself the gesture a browser needs before it will start audio. The
  *alarm* has no tone for the same reason it never did: nothing guarantees
  anyone has touched the monitor window before a parameter goes out of range,
  and an alarm that is silent until someone clicks the screen is worse than one
  that is clearly visual. Arming it properly needs a visible "audio on"
  affordance, which is still unbuilt.
- **The crew cannot reach the keys on a wall display.** The full chassis is
  drawn on the assumption the crew works the unit on a touchscreen or laptop.
  Thrown on a TV it is still readable, but the buttons are then decoration.
- **P3 on the bottom bar is a placeholder** with no state behind it.
- **The 12-lead does not follow the rhythm** once open (see above), and closing
  it from the monitor's own `12` button leaves the control panel's toggle
  believing it is still open, so the next click there is swallowed.
- **Both pages assume a wide screen.** The monitor is an absolutely positioned
  fixed layout; the control panel's grid is authored against 960px with
  breakpoints below that. Neither is usable on a phone, which is worth knowing
  given CES is installed as a phone PWA.
