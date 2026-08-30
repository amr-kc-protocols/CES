# AMR Clinical Education Suite (CES)

An installable, offline-capable Progressive Web App for the AMR Clinical
Education Specialist role (Kansas City · Cass County · Linn County). It gives a
system to the two highest-volume / highest-risk workflows that otherwise live in
Hunter's head:

- **Module A — QA Review Queue:** monthly chart sampling at 20% per operation,
  structured rubric scoring, progress tracking, and CQMP-ready exports.
- **Module B — Kansas CE Deadline Tracker:** guarantees no KBEMS CE submission
  passes its 30-day window unseen (color-coded urgency, overdue items pinned).
- **Module D — New Hire Academy:** cohort rosters, the academy curriculum
  checklist (general AMR block + KC paramedic critical-care specialization),
  and post-academy FTO ride tracking to the 20–30 patient-contact release.
  Includes the **Academy Builder**: a flexible day/block schedule editor
  (seedable from the 5-day classroom template, days re-date to flex around
  instructor availability) and a **document generator** that produces each
  new hire's packet from just their roster entry — personalized Field
  Training Objectives Page (EMT/Paramedic variants), folder cover label,
  compliance & skills forms (Hep B registration/refusal, PPD skin test, mask
  fit test, EVOC certificate + track skill sheet, GMR Safe Stretcher Handling
  v3.2 — name/operation/employee # pre-filled, new-hire boxes pre-checked),
  Day-1 Welcome Kit checklist, facility cheat sheet, a one-page at-a-glance
  agenda, and printable schedule, all print-ready or downloadable as
  Word-openable .doc files. The schedule also exports an **`.ics` calendar
  file** (one timed event per block) for Outlook / Google / Apple Calendar
  (content data: `src/data/ftObjectives.ts`, `src/data/academyTemplate.ts`,
  `src/modules/academy/complianceDocs.ts`, `src/modules/academy/calendar.ts`).
  Module D also carries the **NEOP selection exam** (`/neop-exam`): a public,
  one-attempt exam for external applicants to the Kansas City interfacility
  operation. Three sections — patient care at newly-qualified EMT level,
  an **unscored** preference section, and comprehension of the operation's own
  written description of the job, which sits above the Start button and is
  untimed to read. The preference items come *before* the operations section
  and none of them announces what it is for: every option is a defensible
  answer and several ask what an applicant has already done rather than what
  they intend, because the problem this addresses — applicants heading for a
  911 or fire role who use interfacility as a way in — is one that an obvious
  question only teaches them to answer. Those answers are never scored; the
  interviewer gets a tally and a probe to ask next. Content:
  `src/data/kcOperation.ts` (the reading), `scripts/neop-exam-bank.mjs` (the
  questions, deliberately outside `src/`), `src/data/neopSelection.ts` (the
  interview probes). Written up in `docs/neop-selection-exam.md`.
- **Module G — AEMT program (`/aemt`):** the Kansas-approved Advanced EMT
  initial course, end to end — candidate selection, roster, the dated class
  schedule, psychomotor skill sheets, clinical and field placement, the
  K.A.R. 109-11-8 minimums, and the completion record the primary instructor
  signs. The **October 2026 cohort is run jointly by AMR Kansas City and AMR
  Wichita**: one class, one schedule, one standard, with the didactic shared
  and clinical placement local to each operation. That split is why students
  and sites carry a `campus`, and why the placement board counts capacity per
  campus rather than pooling it — Kansas City's four students cannot use
  Wichita's slack, and averaging the two hides a shortfall on either side.
  The agreed schedule is dated at source in `src/data/aemt.ts`: sixteen
  instructional weeks over eighteen calendar weeks, Tuesdays and Thursdays
  0900–1300, with Thanksgiving surrendered rather than fought (week 8 runs
  Tuesday only, ACLS moves to a Saturday) and a deliberate two-week break that
  is loaded with clinical shifts and dated retrieval work rather than left
  idle. Graded structure — three blueprint-weighted mastery gates, twelve
  cumulative closed-book retrieval quizzes, two full-length 135-item
  simulations — lives in `src/data/aemtAssessments.ts`; the rotation cadence,
  its phases and the five dated deficit checkpoints in
  `src/data/aemtPhases.ts`. What Navigate actually ships per chapter — module
  run times, Skill Drills with page numbers, the ride-along videos — is
  transcribed from the Jones & Bartlett instructor guide into
  `src/data/navigateAssets.ts`, and the schedule's pre-class hours are derived
  from it rather than typed. Two **Word documents** generate straight from that
  data: `npm run doc:application` builds the KBEMS Initial Course Approval
  application, and `npm run doc:student` builds the student course guide —
  sixteen dated weeks of readings, modules, drills and graded events, with the
  rotation phase on the same page as the reading. Neither can drift from the
  calendar the coordinator works to. `npm run check:plan` and `check:skills`
  assert the arithmetic, the calendar and the coverage.
- **Module E — Dashboard:** one glance at what's at risk right now.
- **Module F — CQMP KPI review (administrators only):** the monthly Clinical
  Quality Management Plan deck. Enter each KPI off the GMR Clinical Analytics
  dashboards, attach the dashboard screenshot (file picker, drag-and-drop, or
  Ctrl+V straight from the Snipping Tool), add the notes that explain the
  number, and generate a **PowerPoint** — title slide, a summary table of every
  measure against target and last month, one slide per measure with its capture
  and notes, and a closing summary. Which operations report which measures is
  `src/data/cqmp.ts`; the deck is built in `src/modules/cqmp/deck.ts`.

Built from the role map & build spec. Remaining phase-2 module: PODS intake
log (Module C).

## Tech stack

- **React 18 + TypeScript + Vite**
- **vite-plugin-pwa** (Workbox) — installable, offline app shell, auto-update
- **React Router** — client-side navigation
- Local-first persistence (see below)

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
npm run icons      # regenerate PWA icons from assets/logo.svg
```

## Deployment (Vercel)

The repo is Vercel-ready. `vercel.json` provides the SPA rewrite so client-side
routes (e.g. deep links into a QA period) resolve to `index.html`. Framework
preset: **Vite**. Build command `npm run build`, output `dist/`.

## Architecture

```
src/
  lib/            storage (local-first store), csv, date, id helpers
  data/           operations config + default QA rubric
  components/     Layout (nav) + shared UI primitives
  modules/
    dashboard/    Module E — Today / at-risk view
    qa/           Module A — periods, CSV import, sampling, rubric review
    ce/           Module B — CE deadline tracker
    cqmp/         Module F — monthly KPI review + PowerPoint generator
    academy/      Module D — cohorts, curriculum checklist, FTO release
    aemt/         Module G — the AEMT initial course, selection to completion
    sections/     the four section landings behind the bottom bar
    settings/     reviewer/sample defaults, data backup, about
```

All state flows through `src/lib/store.ts`. Reads/writes go through that one
module, so the persistence layer can be swapped without touching UI or domain
logic.

## Navigation

The bottom bar holds **Home and four sections** — Training, Tools, Reference,
More — and every screen lives inside one of them. It used to be flat, one cell
per feature, which reached ten cells for an administrator: 37px wide on a 375px
phone, under Apple's 44pt touch minimum and Google's 48dp, and a different
shape for every role. Sections are fixed; the leaves move inside them.

`src/lib/nav.ts` is the whole tree, and the only place it is written down. The
bar reads it and so does each section landing, so the two cannot disagree.
Adding a screen means adding one item there — its path, its icon, the line its
row shows, and which capability guards it — plus its route in `App.tsx`. No new
tab, and nothing to add to `Layout.tsx`.

Two things stay true when you do:

- **Routes never change.** `/academy`, `/simulator`, `/history` and the rest
  keep the paths they always had, so bookmarks, shared links and anything the
  service worker cached still resolve.
- **Hiding is not access control.** The gate on a nav item decides whether a
  row is drawn; the route gates in `App.tsx` and the screens themselves decide
  whether the data renders. Both are required.

`npm run check:nav` verifies the tree against the router and against the gate
policy — that every destination is a real route, that no path is claimed twice,
that each capability withholds exactly the screens it should, and that the bar
never grows past five cells.

## Decisions made in this build (spec §8 open questions)

The spec left several items open. Defensible defaults were chosen so the MVP
ships; each is easy to revisit:

1. **Persistence — local-first (device-only `localStorage`).** Zero-config
   deploy and true offline support. The store is isolated behind one module, so
   a shared backend (Supabase / Vercel Postgres) can be layered in later for
   cross-device reporting. Settings → Data lets you export/import a JSON backup.
2. **QA data source — both.** Module A imports a call-list **CSV** (with an
   auto-detecting column mapper that tolerates unknown Ninth Brain / ImageTrend
   export formats) **and** supports manual chart entry.
3. **QA rubric — the real Ninth Brain instrument.** `src/data/qaRubric.ts`
   encodes the 15 standardized chart-review questions from the Ninth Brain QA
   form (sourced from the Chart Review Agent), so manual CES reviews and
   imported bot reviews score on the same scale. Q14/Q15 are stated positively
   here (the form asks them in reverse); see `docs/bot-bridge.md`.
4. **Cass & Linn volumes — entered per review period.** Still open items in the
   spec; the QA period form prompts for the month's actual volume to size the
   sample.
5. **CE alerts — in-app** (urgency colors, overdue pinning, tab badge). A
   Teams/email push layer via the existing Power Automate setup can be added
   later.
6. **Class Builder — linked, not rebuilt.** Set the Kansas Class Builder URL in
   Settings; the tracker/dashboard link out to it (spec §6 / §7).

## QA bot bridge

The Ninth Brain Chart Review Agent's reviews import straight into the QA
queue (QA → period → Add charts → Bot reviews). Convert its existing
`chart_reviews.xlsx` with `scripts/xlsx_to_ces.py`, or drop
`scripts/ces_export.py` next to the bot's `app.py` for automatic per-review
export. Details and payload schema: `docs/bot-bridge.md`.

## Key logic

- **CE due date** = `class date + 30 days`; urgency: green > 14d, amber 7–14d,
  red < 7d or overdue. Overdue-unsubmitted items sort to the top and never hide.
- **QA target** = `ceil(monthly_volume × 20%)` per operation. The sampler draws
  that many charts at random (Fisher–Yates) from the imported pool into the
  review queue. Chart state: unreviewed → in-progress → scored. Providers with
  repeat low scores surface for coaching follow-up.
- **CQMP measures** are set per operation in `src/data/cqmp.ts`. Kansas City,
  Wichita and Winfield are interfacility and report blood glucose verification
  and advanced airway verification; Linn County is the Rule 901 ground
  operation and adds stroke and STEMI bundle compliance. Targets are entered,
  not hard-coded — they carry forward from the previous month, and a measure
  with no target prints its result with no met/not-met call rather than being
  judged against a number nobody set. A measure with no result prints "Not
  reported", never a zero.
- **CQMP screenshots** are downscaled to 1600px JPEG and kept in their own
  IndexedDB store (`src/modules/cqmp/images.ts`), NOT in the synced record.
  Numbers, targets and notes sync between administrator devices; the images
  stay on the machine that captured them, so build the deck there. Screenshots
  of reports that were deleted are swept the next time the CQMP list opens.
