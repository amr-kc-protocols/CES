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

### Negation

Matching ignores anything the chart rules out. Without this the tool read

> "Patient is **not** bed bound and is able to ambulate independently… **No**
> oxygen required and **no** cardiac monitor was applied. There are **no**
> isolation precautions."

as a documented functional limitation plus two documented reasons an ambulance
was needed, and scored that chart **78 of 100** — the clearest possible
*not necessary* record, told its documentation was good. Structured fields did
the same from the other side: `Oxygen: None` and `Restraints: N/A` counted as
reasons.

The rule is a cut-down NegEx. Looking backwards from a match, inside its own
clause, for a trigger (`no`, `not`, `denies`, `without`, `no longer`, `ruled
out`…); and forwards for a `label: value` tail that means "did not apply".
Full stops end a negation's reach, and `but` / `however` / `except` cancel one,
so *"no history of falls **but** is a high fall risk today"* still counts. Every
occurrence of a phrase is scanned, not just the first, so *"no cardiac monitor
on arrival. Cardiac monitor applied before departure."* counts too.

It is deliberately conservative, because the two errors are not equal. Missing
a negation credits a crew for something they explicitly ruled out — that is how
the tool told people the opposite of the truth. Over-negating costs a "not
documented" finding on something that was, which is recoverable and visible in
the citation. Phrases that contain a negative word themselves — `unable to
ambulate`, `not available at` — are unaffected.

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

## Feedback for the author

Every scored chart produces a short message addressed to whoever wrote it,
with a **Copy** button — the point of the review is the conversation it
starts, so the words for that conversation ship with it. It also goes into the
workbook and onto the print sheet.

```
K. Vance — incident FB-001

1. Administrative reason with no clinical reason beside it. The record gives
   "facility requested" and nothing clinical. This is the pattern that reads
   worst on review.
2. Name what made an ambulance necessary — the monitor, the oxygen, the
   infusion, the positioning, the fall risk. One clause is enough.
3. Record vitals and a mental status. One blood pressure does more for this
   chart than a paragraph.

(4 more in the full review.)
```

Three lines maximum. Three is what someone reads; eight is what they skim.
Contradictions come first, then the heaviest missing elements — *"you wrote
ambulatory and moved them by stretcher"* is more useful to hear than *"add a
second set of vitals"*, because a reviewer who finds a contradiction starts
doubting the rest of the record rather than just that line.

A chart with nothing wrong says so. Coaching that only ever arrives when
something is wrong stops being read.

### Who the author is

The **author** is the technician who took patient care and wrote the narrative
— `Primary Patient Caregiver` in ImageTrend, or an `author` column on import.
Deliberately not the crew: counting a chart against everyone who was on the
truck tells a partner they write badly when they may not have written a word
of it.

Where a chart names no author the first crew member is assumed, and it is
labelled **assumed** everywhere it appears — in the grid, in the drawer, and as
its own column in the workbook. Coaching the wrong person is worse than having
to ask who wrote it.

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
- `css/styles.css` — same base, with additions appended, and `--navy` set to
  the host app's masthead navy so the two headers do not stack in near-but-not-
  quite the same colour
- `lib/` — its own copy of pdf.js and SheetJS

It shares no data. Separate IndexedDB (`ems-necessity-review`), separate charts.
That is correct rather than wasteful: emergent transports and non-emergency IFT
are disjoint populations, so one store would mean two queues fighting over one
table.

`js/necessity.js` and `js/app.js` and `js/exporter.js` are original.

### Reading the real PDF

The report is a **two-column form, and both halves of a pair wrap vertically**:

```
       Incident   75123459          <- label starts, value sits beside it
             # :                    <- label finishes, colon lands here

       Destination Name  : AdventHealth
                           Shawnee Mission     <- value continues below
```

A per-label regex cannot read that. `field('Incident #')` never matches, because
the two halves of the label are on different lines and the value is beside the
first. `field('Destination Name')` stops at the line break and returns half a
hospital. Against three real charts the original approach produced an empty
incident number, an empty origin, `"UNIVERSITY OF"` for a destination and
`"Non-"` for a transport mode — **56% parse completeness**.

`layoutPairs()` instead finds every colon, walks **up** for the rest of the
label and the start of the value, walks **down** for the rest of the value, and
cuts at column gaps. Hyphen splits rejoin (`"Non-"` + `"Emergent"`), and
footer/URL fragments that bleed in from neighbouring columns are dropped.

Labels are matched **loosely**, because column slicing shaves characters off the
front of a wrapped one — the real export yields `"f Patient During Transport"`
and `"Crew Member mpleting this Report"`. Matching on the distinctive tail is
stable against that.

Two findings from the real export worth knowing:

- **`Incident Name` is the origin.** For an interfacility transport the
  "incident" happens at the sending facility, so ImageTrend's Incident Name and
  Incident Type are the pickup facility and its type.
- **The author is `Crew Member Completing this Report`**, which is exactly the
  field this tool needs and not the same as the crew list.

Validated against three real "EMS Patient Care Report (3.5)" charts: **100%
parse completeness on all three**, with transport mode, patient position,
acuity, level of service, movement method and author all correct. The old
per-label regexes remain as a fallback for exports whose layout differs again.

CSV/JSON import is unchanged and still the simplest path where you can produce
it — see `ALIASES` in `js/parser.js`.

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
