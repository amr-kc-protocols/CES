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
every change, over three paths:

- `bc.postMessage(S)` on a `BroadcastChannel` named `simState` — the live path.
- `localStorage['simState']`, as JSON — what a monitor window reads at load.
  Writes are coalesced on a 50ms trailing timer because a slider drag fires on
  every pixel; anything that hands off to another window (`Open Monitor`) calls
  `flushSave()` first so the monitor never opens against a stale write.
- **A Supabase Realtime channel**, when a session is running — the path that
  reaches a monitor on a *different device*. The two above are same-origin and
  same-**browser**: they carry two windows on one laptop and cannot reach an
  iPad across the room at all. See "A monitor on a second device" below.
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

It opens as a **separate window**, not an element in this document, so the only
handle on it is `w12Lead`. Everything that closes it goes through
`close12Lead()`; the old HOME SCREEN binding tested for an in-page element named
`lead12`, which has never existed, so the guard was always false and the key did
nothing — the crew at the unit had no way off the 12-lead. There are now four
ways out: the **✕ Close** button in the window's own bar, **Escape** inside it,
the **12-LEAD** key (a toggle), and **HOME SCREEN** (a way back, so it closes
but never opens). A popup this page did not open itself cannot always close
itself; when `window.close()` is refused the window shows a line telling the
reader to switch tabs rather than sitting there looking stuck.

## Pacing and capture

Reported twice from live scenarios: the bradycardia will not capture however
far the crew turn the current up. Two reasons.

**There was nowhere to say yes.** The pacing strip only ever existed inside the
graded run card, so on a quick preset — or a megacode scrolled far enough for
the card to condense — there was no control on the page and the pacer did
nothing at all, whatever the crew did. It is now rendered into every
`.pacer-prompt` on the page, and one of those lives in the ECG card, which is
up in every scenario.

**And capture was a press somebody had to find.** It now answers the current,
the way a patient does. A transcutaneous pacer captures somewhere around 40 to
100 mA on a real patient, so the threshold defaults to **70 mA** — seven presses
of CURRENT from zero — and the crew crossing it captures at the rate they
dialled in. Backing off below it loses capture; so does switching the pacer off;
and a rate change while capture is holding takes the patient with it.

The facilitator still owns the number, and both buttons move it rather than
setting a flag:

- **Give capture** at a current below the threshold means *this patient captures
  there*, so the threshold drops to it.
- **Take capture away** while the crew are at or above it means *this patient
  needs more than that*, so the threshold goes 10 mA above what they are giving
  — otherwise the next pacer press would hand capture straight back.

Two rules keep it honest. Pacing does nothing to VF or pulseless VT, so the
current is only answered where pacing is indicated; a simulator that converted
those on a current dial would teach the wrong thing. And capture is evaluated
**only on something the crew did at the pacer**, never on a timer — otherwise a
facilitator moving the patient to the next phase with the pacer still running
would be undone the moment compressions restarted.

The monitor still writes nothing. This is the panel deciding, on an event the
crew generated, and the boundary check on the monitor page is untouched.

## A monitor on a second device

The intended setup is the monitor on an iPad the crew reads and the panel on
the facilitator's laptop. That needs state to leave the machine, which
BroadcastChannel and localStorage cannot do.

The panel starts a **session** and shows a six-character code; the monitor
joins it. Both then talk over a Realtime channel on the Supabase project CES
already carries — broadcast, not the database, because the state a scenario is
in is worth nothing once the scenario is over and a row per slider drag would
be absurd. Nothing is persisted.

Three things worth knowing:

- **It is additive.** Two windows on one laptop keep working with no session
  and no network; a dropped connection degrades to that rather than to
  nothing. The panel publishes on both paths whenever a session is live.
- **One channel carries three kinds of message** — patient state down,
  heartbeats and device events up — so the monitor explicitly refuses to adopt
  a heartbeat or a device event as patient state. The same guard the
  same-machine channel needed, for the same reason.
- **Session codes drop the ambiguous characters.** No O/0, I/1/L, S/5 or B/8:
  they are read off a laptop screen and typed on an iPad by someone standing
  up.

### Why the iPad used to go blank

Reported from a live scenario: the iPad joined the session, drew a few seconds
of the relayed rhythm and went blank. Two independent causes, both of them
about localStorage being a *local* thing, and both reproduced before being
fixed.

**The 250ms poll was clobbering the relay.** The monitor reads `simState` from
localStorage on load and polls it every 250ms as the fallback for browsers
where BroadcastChannel is unavailable. On one machine that is the panel's own
state. On a second device it is the leftovers of whatever was last run *on that
device* — and any iPad the panel has ever been open on carries a `simState`
with `patientConnected:false`, which is exactly how this screen draws "no
patient": blank traces, not a flatline. So relayed state landed and was merged
back over four times a second. The poll now stands down as soon as something
better is proven to work: a joined relay session (this device is a client of
another machine, and its own disk has nothing to say about the patient) or a
BroadcastChannel that has actually delivered (the fallback is not needed). A
join that *failed* is not a source, so local state comes back rather than
leaving the screen stuck.

**Nothing was published to a monitor that joined late.** Broadcast keeps no
history, so a monitor only ever hears what is said after it subscribes, and the
panel publishes on change. The normal order is the facilitator starting the
session and the crew typing the code afterwards, which meant the iPad sat on
the monitor's defaults — `patientConnected:false` again — until the next slider
moved. The same after every reconnect, and an iPad that sleeps for a moment
reconnects. The panel now republishes the whole of `S` every two seconds while
a session is live: one small message against an `eventsPerSecond` budget of 20,
and the monitor merges it, so a repeat of what it already has is a no-op.

Both are covered end to end by a test that runs the panel and the monitor in
two isolated browser contexts — separate localStorage, separate
BroadcastChannel namespace — with a broker standing in for Supabase, and checks
that a monitor joining mid-scenario picks the patient up, holds it with nobody
touching anything, and is drawing the relayed rhythm rather than merely
holding the numbers.

The relay is built as its own Vite entry at a stable filename
(`/simulator/relay.js`) so the two static pages can load it without a bundler
of their own, and Supabase sits in its own chunk — left in the shared app
chunk, loading the relay on the monitor would have dragged React and the whole
CES bundle onto a page whose entire job is painting canvases at 60fps.

## Pacing capture

The crew can pace, and nothing happens — which is correct, and was still a
usability failure. Capture is the patient answering the impulse, so it belongs
to the facilitator; but "set the rhythm to Paced and the rate to theirs" is not
something anyone should have to know under time pressure.

So when PACER comes on with current set, the run card surfaces the crew's rate
and milliamps with one button that gives electrical capture at their rate.
Losing capture returns the rhythm that was there before, not a generic
bradycardia. Both land on the same timeline as the crew's presses, so the
debrief reads as one sequence.

Worth remembering for Megacode 1: **not capturing is the point.** Its brief has
the pacing impulse producing VT with no pulse, and the crew is expected to stop
pacing and defibrillate. The prompt offers capture; it does not assume it.

## The LIFEPAK 15 skin

The LP skin is the whole unit, not just its screen. Laid out from Figure 3-1 and
the front-face photograph the operation supplied: carry handle over the top,
Area 4 keys low on the left face, the display under its `LIFEPAK 15
MONITOR/DEFIBRILLATOR` label, the printer door along the bottom, and Area 1
over Areas 3 and 2 — which sit **side by side**, monitoring keys to the left of
pacing keys — with the speed dial in the bottom corner.

The outline is the LIFEPAK's, but not to the millimetre. The printer, the
speaker grille and the cable connectors are all inert here — nothing prints,
nothing sounds through them, nothing plugs in — and between them they were
spending a third of the unit's height and a tenth of its width on decoration.
The speaker and the connectors are gone and the printer is a slim door; the
display went from 54% of the unit's width and 58% of its height to 59% and
75%. What is kept exact is where the controls sit relative to each other,
because that is the part a crew is learning.

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

### On an iPad

The unit is worked with gloved thumbs on a tablet, so control sizes are not
styling. Measured before the usability pass, **twelve of eighteen controls were
under Apple's 44pt minimum on every iPad**, and the three rockers — ENERGY
SELECT, RATE and CURRENT, the ones tapped repeatedly under pressure — were 20
to 23pt, half the floor.

Every control is now at least 48 design pixels in its smallest dimension. 48
rather than 44 because the chassis scales: the worst landscape scale it reaches
is about 0.93 on an iPad mini, and 48 x 0.93 is 44.6. Verified at iPad Pro 11,
iPad 10.9, iPad 10.2 and iPad mini — 0 of 18 under 44pt at all four.

Alongside the sizes:

- **The chassis is `position:fixed`.** At 1141px wide, positioned absolutely it
  widened the layout viewport on a touch device: `innerWidth` came back as 1141
  instead of the iPad's 834, and the fit concluded the unit already fitted. In
  portrait it never scaled at all.
- **Zoom is off** — `maximum-scale=1, user-scalable=no`. This is a fixed-layout
  instrument that fits itself to the screen; pinching only hides half of it,
  and a stray double-tap zoom mid-code is a crew that cannot find the shock
  button.
- **Long press does not raise the iOS callout.** Holding ON to power the unit
  down looks exactly like a text selection to iOS.
- **Hover styles sit behind `@media (hover:hover)`.** iOS leaves `:hover` stuck
  on whatever was tapped last, so a key looked held long after it was let go.
- **The speed dial claims its own gesture** with `touch-action:none`, or
  dragging it scrolls the page instead of turning it.
- **The fit follows `visualViewport`** where it exists — Safari's toolbar
  slides and `innerHeight` lags behind it, leaving the unit hanging off the
  bottom for the length of the animation.
- **Short screens drop the carry handle and the hazard strip.** They are the
  last two parts of the chassis that carry nothing, and 36px of them is the
  difference between a 43pt key and a 45pt one on an iPad mini.

**Portrait shows a rotate prompt rather than a stacked layout.** A LIFEPAK is a
landscape object and where its controls sit is half of what a crew is here to
learn; rearranging them into a column would teach the wrong muscle memory, and
at the 0.73 scale portrait allows every control would fall under the touch
floor anyway. The unit stays live behind the prompt.

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

### The speed dial

"Scrolls through and selects screen **or menu** items" — Table 3-3, and both
halves matter. Turning it inside a menu moves the selection; turning it on the
home screen moves a highlight across the parameter blocks and the ECG channel,
which is the half that did nothing at all.

Pressing on a highlighted item opens its menu. The ECG channel reaches the
lead and size lists and picking from them drives the real controls — this is a
second route to LEAD and SIZE, not a display of them. A parameter opens a
read-out of the alarm limits actually in force, and says plainly when there are
none. Those are deliberately read-only: limits are the facilitator's to set
from the panel, and a monitor-side edit would be overwritten by the panel's
next broadcast a second later.

One defect worth recording. Drag-versus-press was decided on the step
remainder — the leftover pixels after the 14px detent — so a drag that happened
to land on an exact multiple of the step size was read as a press. In the EVENT
menu that silently logged an event nobody chose, straight into the run
timeline the facilitator grades from. It is decided on total distance
travelled now.

### Checked against the manufacturer's tables

Every control was audited against Tables 3-1 to 3-4 by driving it and reading
what happened, not by reading the code. Six deviations came out of that, all
now fixed and all under check:

| Table says | It was doing |
| --- | --- |
| ANALYZE: "LED illuminated when AED is analyzing" | Flashing while analyzing |
| ANALYZE: "flashes when user is prompted to push ANALYZE" | Never flashed — there was no prompt state |
| SYNC: "flashes with detection of each QRS" | Never flashed at all |
| PACER: "flashes with each current pulse" | Flashed on a fixed half-second animation, unrelated to the pacing rate |
| ALARMS: "LED illuminated when alarms are enabled" | Went dark when silenced, telling a crew the alarms were off when they had two minutes of quiet |
| ENERGY SELECT and CHARGE: "in Manual mode" | Both worked during a Shock Advisory analysis |

The two patient-driven LEDs are the ones worth describing. **SYNC** is a real
detector: it runs over the samples the ECG channel is drawn from — about one
every 8ms — and fires on the rising edge of each R wave with 200ms of
refractory blanking. Measured, it flashes at 40, 60, 100 and 150/min against
those heart rates, not at all in asystole, and erratically in VF, which is the
point: a crew has to be able to see that the unit cannot lock onto a
fibrillating rhythm before they try to cardiovert it. It also marks each
detected complex on the trace, because confirming the markers land on R waves
is the whole reason to press SYNC. **PACER** runs off the same clock as the
pacing spikes, so the LED and the trace cannot disagree about when the pacer
fired, and `PAUSE` drops it to a quarter rate while held.

Sampling per animation frame was the trap here. A 60fps loop gives one reading
every 17ms and an R wave is narrow enough to fall between two of them, so beats
went missing and the flash rate stopped tracking the heart rate. Detection has
to happen on the drawn samples.

Three LEDs are stated rather than simulated: **AC** and **BATTERY** are held
illuminated (a trainer on mains with full batteries), and **SERVICE** stays
dark because there is no fault model to light it.

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
`HOME SCREEN` clears any selection and closes menus · the display-mode key toggles **SunVue**, the unit's
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

## Reachability, and the check that measures it

Every simulator defect reported from a live scenario so far has been the same
shape. Not one was a missing feature; every one was a control that existed with
a dead path to it:

- the 12-lead popup had no close button, and HOME SCREEN tested for an in-page
  element that has never existed;
- the pacing strip was rendered only inside the graded run card, so on a quick
  preset there was nothing on the page to press;
- the condensed run bar shrank in the flow, which fought the scroll and pinned
  the page near the top;
- the ENERGY, RATE and CURRENT rockers fell to 43.5pt at the chassis scale a
  1024x768 iPad reaches, behind a floor that looked correct.

That last one says why `check-simulator.mjs` could never have caught any of
them. It runs in jsdom, which has no layout, so it can only assert what the
stylesheet *says* — and the rule was right: `min-height:48px` set the arrow's
**width**. Its height came from the key around it, landed at 46, and scaled to
43.5. **A declaration is not a result.**

`scripts/check-reach.mjs` opens the real pages in a real browser and measures
what a thumb would hit. For every control that is actually displayed, across a
matrix of viewports and states, it asks: does it have a box, can it be scrolled
into view, does the page answer with *it* at its own centre, can the keyboard
get to it, and does it clear 44pt where a finger is plausible. Run it with
`npm run check:reach` (or `npm run check:all` for everything). It needs a build
and Playwright's Chromium, and skips cleanly without either — it is not in
`npm run check`, which stays a three-second command.

Two things it deliberately does *not* flag, both of which it flagged first:

- A control inside a `display:none` ancestor reports its own computed `display`
  as normal, so testing the element alone lets an entire hidden skin through as
  "zero-sized". `checkVisibility()` walks the ancestry.
- A control mid-fade — opacity still 1, `pointer-events` already `none` — fails
  a hit test while being deliberately out of play.

And one thing it looks for that nothing else would: the inverse. A control with
no box, or one behind an overlay, that the keyboard can still reach and fire.
That is how the portrait notice was caught — `#rotate` covers the unit and says
to turn the iPad round, but covering is only paint, and the whole chassis stayed
in the tab order behind it, SHOCK included. It is `inert` in portrait now, which
takes it out of hit-testing and the tab order together.

It then caught the same shape twice more on the panel, in work that landed
while this check was waiting to merge:

- **"Save this run anyway?" left the page live behind it.** The veil is opaque
  and the dialog is `aria-modal`, but neither is a barrier: the rhythm buttons,
  the drug log, the sheet's tick rows and PASS / NR were all still tabbable, so
  the question could be answered by changing the run it was asked about.
  `setResult()` and `giveDrug()` fire with nothing on screen to say they did.
  The page goes `inert` while the prompt is up.
- **The condensed run card covered the page header.** The bar is fixed at
  `top:0`, and the header is the one thing that can never be scrolled out from
  under it — at `scrollY` 0 the monitor chip, CONNECT and PHYS LOCK sit inside
  its band. Unclickable, still tabbable, still firing. Collapsing now reserves
  the bar's measured height (it declares 52px and wraps to 116 on a 1440-wide
  window) so the header starts below it.

Both are the inverse case rather than a small target, and neither is visible to
a check that cannot lay the page out.

**Where the 44pt floor applies.** On the monitor, at the sizes an iPad presents
— not every small window. A 960x720 browser window on a laptop is a mouse, and
holding it to a thumb's minimum would be measuring a room nobody is in. On the
panel, only the controls tapped *while a code is running*: the expected
actions, the check-off sheet's own rows and fields, the result, the patient
states and the way out. That list is held by a selector, and a selector that
matches nothing is not a passing check — it is a check that stopped running,
which is what the `.cl-*` names in it became when the sheet replaced that UI.
The
vitals sliders, rhythm buttons and setup selects stay at the density a pointer
wants — this page is compact on purpose, and every pixel above the cards is a
pixel of the scenario the facilitator cannot see.

## Facilitating and grading

One person drives the scenario and grades the crew, so the layout is measured
against that. On a 1280x720 laptop the things touched every few seconds — the
patient states, the expected actions, the device timeline — were being pushed
below the fold by things touched once: two scenario pickers, the brief, and the
team/CPR/PASS-NR strip that is filled in at the debrief. The rhythm buttons and
the drug grid sat 800px further down again, so giving a drug meant losing sight
of the phase and the unticked actions.

Three changes, all measured:

- **The run card is sticky.** Scroll to the drug grid and the states, the
  expected actions and the device feed stay pinned at the top. It also carries
  its own max height, so it can never be taller than the screen it is stuck to.
- **The scenario pickers stand down during a run** and come back on a button
  that does not end it.
- **The debrief checklist is collapsed** behind a summary line carrying the
  tally and the result, because team behaviour, CPR quality and PASS / NR are
  graded once at the end.

Together those took the run card from about 500px to 397px and put everything
needed during a code above the fold at 1280x720.

That was not enough. Reported from a live ACLS megacode: the panel goes
"clunky" once a run is up, and the vitals, capnography and drug controls end up
in a strip below it. Measured mid-code, the card is 411px tall and the page is
capped at 960px wide, so a 1366x768 laptop was giving it 54% of the viewport
permanently. Two answers, by how much room there is:

- **Wide screens (≥1320px) get a rail.** The page never uses more than 960px,
  so a laptop has ~460px of dead margin either side — the card moves into it,
  fixed to the right edge, and costs no vertical space at all. Measured at
  1920, 1512, 1440 and 1366: the whole controls grid is on screen with the run
  alongside it, 100% of the viewport height free, no overlap and no horizontal
  scroll. Inside the rail the band goes to one column, which takes the
  expected-action rows from 127px wide and wrapping over two or three lines to
  347px and one line each.
- **Narrow screens condense.** Once the page scrolls past it the card drops to
  a 52px line — the phase in its own colour, the scenario, a running clock, the
  ticked-actions tally and an End button — and a tap puts the whole card back
  until the facilitator scrolls to the top again. Measured on iPad landscape
  and portrait: 93–95% of the viewport free where it used to be 46–54%.

The clock on that bar counts the state on screen, not just the banked totals:
`run.states[i].seconds` is only written when a state is *left*, so summing the
totals alone would show a run frozen at 0:00 until the first transition.

The condensed bar is **fixed, not shrunk in place**. Shrinking it looked right
and fought the page: collapsing 411px to 52px takes 357px out of the document
*above* the scroll position, which pulls the sentinel back into view, which
expands the card again. Reported as the panel being "sticky at the top and not
scrolling down properly" — measured, the page went 150 → 0 → 150 → 0 on
repeated wheel events and a `scrollTo(600)` settled at 244, exactly where the
sentinel's bottom edge sits. So the bar leaves the flow and `#runWrap` is
frozen at the height the card had, measured *before* the class changes. Nothing
about the layout moves when it condenses, so there is nothing to oscillate
against.

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

- **The crew cannot reach the keys on a wall display.** The chassis is drawn on
  the assumption the crew works the unit on a touchscreen or a laptop. Thrown
  on a TV it is still readable, but the buttons are then decoration. That is a
  consequence of drawing the whole unit rather than a defect in it.
- **The 12-lead is a snapshot.** It renders the rhythm as it stands when the
  window opens and does not follow later changes, which is what a printed
  acquisition is. Re-acquiring re-renders it.
- **The control panel assumes a wide screen.** Its grid is authored against
  960px with breakpoints below that, so it works on a laptop or a landscape
  iPad and not on a phone. The monitor no longer has this problem — it is a
  fixed layout scaled to the window, with a rotate prompt in portrait — but the
  panel has not had the same treatment. It is a facilitator's console rather
  than something carried, so this has not been worth the rework yet.
- **Three LEDs are stated rather than simulated.** AC and BATTERY are held
  illuminated — a trainer on mains with full batteries — and SERVICE stays dark
  because there is no fault model behind it.
- **Megacodes 6 to 12** exist on the AHA checklist but are not built: only
  pages 235-239 of the manual were scanned, so three of the six checklists are
  transcribed.
- **Adult Abdominal Trauma and Pediatric TBI have no source document.** They
  keep their vitals and notes but are not graded.
