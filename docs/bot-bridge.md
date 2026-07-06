# QA Bot → CES file bridge

Connects the **Ninth Brain Chart Review Agent** ("the bot") to the CES **QA
Review Queue** without a backend: the bot's reviews become a JSON batch, and
CES imports it — automatically via the **QA Bot tab's folder sync** (see
below), or manually from **QA → open a period → Add charts → Bot reviews**.

## Live sync & embedded bot (QA Bot tab)

The **QA Bot** tab in CES does two things:

1. **Embeds the bot's UI** — set the bot's local URL (e.g.
   `http://localhost:5000`) in the tab or in Settings and review charts
   without leaving CES. Works even when CES is served over HTTPS, because
   browsers treat `http://localhost` as a trustworthy origin. "Open in new
   tab" is always available as a fallback.
2. **Watches the bot's batch folder** — pick the folder containing `app.py`
   (where `ces_export.py` / `xlsx_to_ces.py` write `ces_batch_*.json`) once;
   CES re-scans it every ~15 s while open and imports anything new or
   changed. Unchanged files are skipped (tracked by modification time), and
   re-imports are safe — reviews dedupe by incident number.

Synced reviews are **auto-routed**: each review goes to the period matching
its run date's month and the file's unit suffix (`ces_batch_kc.json` → KC),
and the period is created automatically if it doesn't exist yet — with a
monthly volume of 0, so open the period and enter the real volume for the
20% target to be right. A plain `ces_batch.json` (single-unit export) routes
to the unit chosen in the tab's sync settings.

Folder sync needs Chrome or Edge (File System Access API) and, because the
browser only remembers the folder — not unattended access — may ask you to
click **Resume access** after a browser restart. On other browsers, use the
manual import below.

Imported reviews are matched to charts in that period **by incident number**
(the bot's *Run ID*). A match attaches the score to the existing chart and
marks it *scored*; an unmatched review is added as a new scored chart so
nothing the bot reviewed is lost. Bot-scored charts count toward the 20%
target and flow into progress, provider stats, and the CSV exports.

The CES rubric **is** the Ninth Brain form: the same 15 standardized questions
(`q1`–`q15`, see `src/data/qaRubric.ts`), so manual and bot reviews score on
one instrument. Two questions are asked in reverse on the form and are
inverted on import:

- **Q14** *"Were there any near misses, errors, and/or patient safety
  concerns…?"* — a form **No** imports as **Met**; a form **Yes** also sets
  the coaching **flag**.
- **Q15** *"Does this chart need further review by clinical leadership?"* —
  same inversion; a form **Yes** sets the flag.

CES computes the weighted score from the criteria (Q5/Q13/Q14 carry double
weight). The bot's Synopsis, Findings, matched rules, category follow-ups
(STEMI / Trauma / Stroke / AMS), and rationales for deficient answers land in
the review's notes. The report has no provider column — when the batch matches
a chart imported from the monthly call list, the chart's provider is kept, so
provider stats still work.

## Option 1 (no code changes): convert chart_reviews.xlsx

`scripts/xlsx_to_ces.py` reads the workbook the bot already writes:

```bash
python3 xlsx_to_ces.py chart_reviews.xlsx              # writes per-unit batches
python3 xlsx_to_ces.py chart_reviews.xlsx --dry-run    # show counts only
python3 xlsx_to_ces.py chart_reviews.xlsx --unit kc    # one operation only
```

Because CES imports into one operation's period at a time, output is split by
Business Unit — `ces_batch_kc.json`, `ces_batch_linn.json` (a single file when
only one unit is present). The *Code 3 Case Presentations* sheet is a separate
CQMP work product and is skipped. Spreadsheets that aren't the bot's report
fall back to generic column auto-detection (incident / score / provider /
notes aliases). Requires `openpyxl`, which the bot's launcher already installs.

## Option 2 (two lines in app.py): emit batches during review

Drop `scripts/ces_export.py` next to `app.py`, then:

```python
from ces_export import append_review              # with the other imports

# in api_done(), right after the existing save:
save_review_to_excel(run_details, categories, suggestions, answers)
append_review(run_details, categories, suggestions, answers)   # <- add
```

Each submitted review is then also written to `ces_batch_<unit>.json` next to
`app.py`, deduped by Run ID (re-reviewing a chart replaces its entry), and the
export never raises — a bridge failure can't break the Excel save. Import the
file into CES whenever convenient; CES dedupes again on import.

## Payload format (for anything else that wants to write it)

JSON — a bare array of reviews or `{"reviews": [...]}`:

```json
{
  "source": "ninth-brain-chart-review-agent",
  "version": 1,
  "reviews": [
    {
      "incidentNumber": "73193106",
      "date": "2026-06-11",
      "acuity": "ALS",
      "flagged": true,
      "reviewer": "Chart Review Agent",
      "notes": "Synopsis…\n\nFindings: …",
      "criteria": { "q1": "met", "q13": "met", "q14": "not_met" }
    }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `incidentNumber` | **yes** | Match key (Run ID). Aliases accepted: `incident`, `run`, `pcr`, `id`. |
| `criteria` | recommended | Keys are CES criterion ids `q1`–`q15` (or their labels); values `met` / `partial` / `not_met` / `na` (synonyms like `yes` / `no` / `n/a` accepted). CES computes the weighted score from these. **Send post-inversion values** — `q14: met` means *no safety concerns*. |
| `scorePct` | optional | 0–100 override; skips the computed score. |
| `flagged` | optional | Coaching follow-up. Defaults to `true` when the computed score is below 80%. |
| `date`, `provider`, `crew`, `chiefComplaint`, `acuity`, `notes`, `reviewer` | optional | Chart metadata; existing chart values win on match. |

CSV is also accepted for flat rows (`incidentNumber,scorePct,provider,notes,…`)
— per-criterion detail needs JSON.
