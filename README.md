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
  Day-1 Welcome Kit checklist, facility cheat sheet, and printable schedule,
  all print-ready or downloadable as Word-openable .doc files
  (content data: `src/data/ftObjectives.ts`, `src/data/academyTemplate.ts`).
- **Module E — Dashboard:** one glance at what's at risk right now.

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
    academy/      Module D — cohorts, curriculum checklist, FTO release
    settings/     reviewer/sample defaults, data backup, about
```

All state flows through `src/lib/store.ts`. Reads/writes go through that one
module, so the persistence layer can be swapped without touching UI or domain
logic.

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
