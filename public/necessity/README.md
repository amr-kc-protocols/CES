# Medical Necessity Review

An offline documentation-coaching tool for non-emergency interfacility
transports. It reads IFT ePCR exports, grades each chart against the seven
medical-necessity elements from the AMR Kansas City IFT Field Handbook, and
reports which ones the documentation establishes — and which question a claim
reviewer would be left asking.

Served as static files from `public/necessity/` and rendered in an iframe at
`/review/necessity`, behind the same admin gate as the emergent review tool.

## What it scores, and what it does not

**It scores the record.** Not the transport, not the crew, not the patient.

The tool never concludes that a transport was or was not medically necessary.
It cannot see the patient, and the whole problem it exists to solve is that the
chart does not say. What it reports is narrower and answerable: whether a claim
reviewer reading this chart could reach that conclusion, and if not, which
question stopped them.

So **"Not established" means the documentation does not establish it.** A
perfectly necessary transport can score badly here, and that is the finding —
the trip was justified and the record does not show it. That is a coaching
problem, which is what this tool is for.

This is the same boundary the emergent review tool holds: it declines to assign
the justification score, because that judgement is the reviewer's. Here the
judgement being declined is the necessity determination itself.

## The rubric

Straight out of the IFT Field Handbook's "Medical Necessity — what claim
reviewers look for", made mechanical. Its four sentences are elements 1–4, in
order, and they carry 75 of the 100 points.

| # | Element | Weight | Established by |
|---|---|---:|---|
| 1 | Functional status | 25 | What the patient could not do — ambulate, transfer, sit upright. "Patient unable to…" stated directly |
| 2 | Why other transport was not an option | 20 | Monitoring, oxygen, infusion, positioning, behavioural or fall risk, isolation, devices |
| 3 | Objective findings | 15 | Vitals and a mental status. Numbers rather than adjectives |
| 4 | Why this facility | 15 | What the receiving site provides that the sending one did not |
| 5 | Reason for transport | 10 | A clinical reason, not only an administrative one |
| 6 | Level of service support | 10 | For ALS, a documented ALS assessment or intervention |
| 7 | Narrative substance | 5 | Long and specific enough to carry the argument |

Each element resolves to **Established / Partial / Missing** and carries its own
citation — the sentence it fired on. A finding you cannot check is a finding you
cannot coach from.

**Bands:** 85+ Defensible · 70–84 Thin · 50–69 At risk · under 50 Not established.

### Record flags

Separate from the score, because a contradiction inside a chart is worse than a
gap. A gap is an omission; a contradiction invites a question about everything
else in the record.

narrative says ambulatory while the movement field says stretcher · a conclusion
asserted with no objective data behind it · an administrative reason standing
alone with nothing clinical beside it · ALS level with no ALS content ·
scheduled transport with no PCS referenced · **narrative nearly identical to
another chart** · incomplete extraction

Copy-forward detection compares every narrative against every other loaded
chart at 85% word overlap. Templated narratives are a standard audit trigger,
because they cannot all be describing the same patient.

## Scope

Non-emergency interfacility only. Emergent transports and scene responses are
still parsed and still shown, but they are **not scored** — grading a 911
cardiac arrest against "did you record why a car was not enough" produces a
number that means nothing and would drag a crew's average down for doing their
job correctly. Use the emergent review tool for those.

The scope filter defaults to in-scope charts. `inScope()` in `js/necessity.js`
is the whole rule.

## Coaching view

Two aggregates, both across every loaded chart rather than the current filter —
a coaching list built from "the charts I filtered to the worst band" would say
everyone is bad.

- **What this sample misses most** — element gaps ranked by how often they are
  absent. The top row is the one worth a shift briefing.
- **By crew member** — ordered by chart count, *not* by score. This is
  employment data about identifiable staff, and the useful output is "three
  people never record functional status", a class to teach — not a league table.
  Samples under four charts are labelled as such.

## Relationship to the emergent review tool

Sibling, not a fork of the product. It shares:

- `js/parser.js` — forked from `public/review/js/parser.js`, plus origin,
  crew, position, transfer method, level of service and PCS extraction, and a
  completeness check weighted toward the fields this rubric reads
- `js/store.js` — identical but for the IndexedDB name
- `css/styles.css` — same base, with additions appended
- `lib/` — its own copy of pdf.js and SheetJS

It shares no data. Separate IndexedDB (`ems-necessity-review`), separate charts.
That is correct rather than wasteful: emergent transports and non-emergency IFT
are disjoint populations, so one store would mean two queues fighting over one
table.

`js/necessity.js` and `js/app.js` and `js/exporter.js` are original.

### Parser caveat

The base parser carries a 13-chart validation against real ImageTrend "EMS
Patient Care Report (3.5)" exports. **The fields added for this tool do not.**
That ground truth predates them.

They are written defensively — miss rather than guess — because a miss costs a
"not documented" finding, which is recoverable, while a wrong value is a
confident false pass, which is not. Every added field also has a CSV/JSON
column alias, and **that is the ingestion path to prefer** until the PDF anchors
are checked against real charts.

`origin`, `crew`, `level of service`, `patient moved to ambulance`,
`transfer method`, `patient position`, `pcs` — see `ALIASES` in `js/parser.js`.

## Before this goes near real charts

- `js/necessity.js` is written to be read by a biller or an educator. The phrase
  banks and the weights should be reviewed by whoever owns billing compliance —
  they encode a house opinion about what a reviewer looks for, and that opinion
  should be theirs.
- The PDF field anchors above need checking against a real IFT export.
- The crew-trend screen names identifiable employees. Confirm that is
  appropriate use before it is shown to anyone but the reviewer.

## Privacy

No network code path. Verified:

```
$ grep -rn "fetch(\|XMLHttpRequest\|WebSocket\|sendBeacon" js/
(no matches)
```

Charts and coaching notes live in IndexedDB on the device. Not in
`src/lib/records.ts` `SLICES`, so **nothing syncs to Supabase**. "Clear all
data" empties the store; use it on a shared machine.
