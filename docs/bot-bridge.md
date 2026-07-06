# QA Bot → CES file bridge

Connects the **Ninth Brain Chart Review Agent** ("the bot") to the CES **QA
Review Queue** without a backend: the bot writes a batch file, and CES imports
it from **QA → open a period → Add charts → Bot reviews**.

Imported reviews are matched to charts in that period **by incident number**.
A match attaches the score to the existing chart and marks it *scored*; an
unmatched review is added as a new scored chart so nothing the bot reviewed is
lost. Bot-scored charts count toward the 20% target and flow into progress,
provider stats, and the CSV exports.

## Payload format

JSON (preferred) or CSV. JSON is either a bare array of reviews or an object
with a `reviews` array:

```json
{
  "source": "ninth-brain-chart-review-agent",
  "version": 1,
  "reviews": [
    {
      "incidentNumber": "24001",
      "date": "2026-07-03",
      "provider": "Medic X",
      "chiefComplaint": "Chest pain",
      "acuity": "emergent",
      "scorePct": 92,
      "flagged": false,
      "notes": "All critical elements documented. Reassessment after NTG present.",
      "reviewer": "Chart Review Agent",
      "criteria": {
        "vitals": "met",
        "meds": "partial",
        "handoff": "met"
      }
    }
  ]
}
```

### Fields

| Field | Required | Notes |
|---|---|---|
| `incidentNumber` | **yes** | Match key. Also accepts `incident`, `run`, `pcr`, `id`. |
| `scorePct` | recommended | Overall QA score 0–100. If omitted, CES computes it from `criteria`. |
| `criteria` | optional | Per-criterion results. Keys are CES criterion **ids or labels** (case/spacing-insensitive); values are `met` / `partial` / `not_met` / `na` (many synonyms accepted, e.g. `yes`, `pass`, `no`, `n/a`). |
| `flagged` | optional | Coaching follow-up. If omitted, CES flags scores below 80%. |
| `notes` | optional | The bot's narrative / findings — shown on the review. |
| `date`, `provider`, `crew`, `chiefComplaint`, `acuity`, `reviewer` | optional | Fill chart metadata; used for provider stats. |

CES criterion ids: `dispatch, cc_hpi, vitals, exam, impression, interventions,
meds, protocol, reassess, transport, handoff, narrative` (plus KC-only `vent,
infusions`). See `src/data/qaRubric.ts`. You can also key `criteria` by the
human label — `"Vitals documented"` resolves to `vitals`.

**CSV alternative:** one row per chart with columns like
`incidentNumber,scorePct,provider,date,chiefComplaint,flagged,notes`
(per-criterion detail isn't supported in CSV — use JSON for that).

## Emitting the batch from the bot

`scripts/ces_export.py` is a drop-in helper. In the bot, after you've scored a
chart, append a dict and write the batch:

```python
from ces_export import CesBatch

batch = CesBatch()
for chart in scored_charts:            # your existing loop
    batch.add(
        incident_number=chart["incident"],
        score_pct=chart["qa_score"],     # 0–100
        provider=chart.get("provider"),
        chief_complaint=chart.get("complaint"),
        notes=chart["claude_summary"],
        criteria=chart.get("criteria"),  # optional {"vitals": "met", ...}
        flagged=chart["qa_score"] < 80,
    )

batch.write("ces_batch.json")          # then import this in CES
```

Once you share `app.py`, this can be wired directly into the bot's existing
scoring loop and Excel export so the CES batch is produced in the same run.
