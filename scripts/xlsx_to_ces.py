#!/usr/bin/env python3
"""Convert the Chart Review Agent's Excel report into a CES bot batch.

The Ninth Brain Chart Review Agent already writes its results to an .xlsx
file (via openpyxl). This script reads that report and emits ces_batch.json
in the CES bridge format (docs/bot-bridge.md) — no changes to the bot's
app.py required:

    python3 xlsx_to_ces.py ChartReview_Results.xlsx
    python3 xlsx_to_ces.py results.xlsx -o july_batch.json --sheet "QA"

Then in CES: QA -> open the period -> Add charts -> Bot reviews -> load the
JSON file.

Column names are auto-detected with the same alias logic the CES importer
uses, so the bot's exact headers don't matter. Columns that aren't core
fields but whose values look like met / partial / not met / n/a are treated
as per-criterion rubric results. Run with --dry-run to see the detected
mapping without writing anything.

Requires: openpyxl (already installed for the bot).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime
from typing import Any, Optional

try:
    from openpyxl import load_workbook
except ImportError:  # pragma: no cover
    sys.exit("openpyxl is required (pip3 install openpyxl)")


def norm(s: Any) -> str:
    return re.sub(r"[^a-z0-9]", "", str(s).lower())


# Core-field aliases, mirrored from the CES importer (botBridge.ts).
FIELD_ALIASES: dict[str, list[str]] = {
    "incidentNumber": ["incidentnumber", "incident", "run", "runnumber", "pcr", "report", "callnumber", "call", "id"],
    "date": ["date", "calldate", "servicedate", "dispatchdate"],
    "provider": ["provider", "primary", "medic", "clinician", "author", "crewlead", "attendant"],
    "crew": ["crew", "unit", "partner", "vehicle"],
    "chiefComplaint": ["chiefcomplaint", "complaint", "chief", "impression", "reason", "nature"],
    "acuity": ["acuity", "priority", "severity", "level"],
    "scorePct": ["scorepct", "score", "qascore", "percent", "scorepercent", "overall", "grade"],
    "flagged": ["flagged", "flag", "followup", "coaching"],
    "notes": ["notes", "summary", "findings", "comment", "comments", "narrative", "feedback"],
    "reviewer": ["reviewer", "agent", "model"],
}

STATUS_WORDS = {
    "met", "yes", "y", "pass", "passed", "true", "1", "complete", "compliant", "ok",
    "present", "documented", "satisfactory",
    "partial", "partially", "part", "incomplete", "some",
    "notmet", "no", "n", "fail", "failed", "false", "0", "missing", "absent",
    "deficient", "noncompliant",
    "na", "notapplicable", "none",
}

TRUTHY = {"true", "yes", "1", "y", "flag", "flagged"}


def cell_str(v: Any) -> str:
    if v is None:
        return ""
    if isinstance(v, (datetime, date)):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def detect_mapping(headers: list[str]) -> dict[str, int]:
    """Map CES field -> column index. Exact alias match wins, then contains."""
    mapping: dict[str, int] = {}
    used: set[int] = set()
    normed = [norm(h) for h in headers]
    for field, aliases in FIELD_ALIASES.items():
        # pass 1: exact
        for i, h in enumerate(normed):
            if i not in used and h in aliases:
                mapping[field] = i
                used.add(i)
                break
        else:
            # pass 2: contains
            for i, h in enumerate(normed):
                if i in used or not h:
                    continue
                if any(a in h for a in aliases):
                    mapping[field] = i
                    used.add(i)
                    break
    return mapping


def looks_like_criterion(values: list[str]) -> bool:
    """A column is a rubric criterion if its non-empty values are status words."""
    non_empty = [v for v in values if v]
    if not non_empty:
        return False
    hits = sum(1 for v in non_empty if norm(v) in STATUS_WORDS)
    return hits / len(non_empty) >= 0.8


def convert(path: str, sheet: Optional[str]) -> tuple[list[dict[str, Any]], dict[str, str], list[str]]:
    wb = load_workbook(path, data_only=True, read_only=True)
    ws = wb[sheet] if sheet else wb.worksheets[0]
    rows = [[cell_str(c) for c in row] for row in ws.iter_rows(values_only=True)]
    wb.close()
    rows = [r for r in rows if any(v for v in r)]
    if len(rows) < 2:
        sys.exit(f"No data rows found in sheet '{ws.title}'.")

    headers = rows[0]
    data = rows[1:]
    mapping = detect_mapping(headers)
    if "incidentNumber" not in mapping:
        sys.exit(
            "Could not find an incident / run number column.\n"
            f"Headers seen: {headers}\n"
            "Rename the column (e.g. to 'Incident #') or share the file so the aliases can be extended."
        )

    # Leftover columns whose values look like statuses -> rubric criteria.
    core_cols = set(mapping.values())
    criterion_cols: dict[int, str] = {}
    for i, h in enumerate(headers):
        if i in core_cols or not h:
            continue
        col_values = [r[i] if i < len(r) else "" for r in data]
        if looks_like_criterion(col_values):
            criterion_cols[i] = h

    reviews: list[dict[str, Any]] = []
    for r in data:
        get = lambda f: cell_str(r[mapping[f]]) if f in mapping and mapping[f] < len(r) else ""
        inc = get("incidentNumber")
        if not inc:
            continue
        review: dict[str, Any] = {"incidentNumber": inc}
        for f in ("date", "provider", "crew", "chiefComplaint", "acuity", "notes", "reviewer"):
            v = get(f)
            if v:
                review[f] = v
        score = get("scorePct")
        if score:
            try:
                n = float(score.rstrip("%"))
                review["scorePct"] = round(n * 100) if n <= 1 else round(n)
            except ValueError:
                pass
        flag = get("flagged")
        if flag:
            review["flagged"] = norm(flag) in TRUTHY
        criteria = {}
        for i, name in criterion_cols.items():
            v = r[i] if i < len(r) else ""
            if v:
                criteria[name] = v
        if criteria:
            review["criteria"] = criteria
        reviews.append(review)

    human_mapping = {f: headers[i] for f, i in mapping.items()}
    return reviews, human_mapping, list(criterion_cols.values())


def main() -> None:
    ap = argparse.ArgumentParser(description="Convert a Chart Review Agent .xlsx report to a CES bot batch.")
    ap.add_argument("xlsx", help="Path to the bot's Excel report")
    ap.add_argument("-o", "--out", default="ces_batch.json", help="Output JSON path (default ces_batch.json)")
    ap.add_argument("--sheet", help="Worksheet name (default: first sheet)")
    ap.add_argument("--dry-run", action="store_true", help="Show the detected mapping and row count, write nothing")
    args = ap.parse_args()

    reviews, mapping, criteria = convert(args.xlsx, args.sheet)
    print(f"Detected columns: {json.dumps(mapping, indent=2)}")
    if criteria:
        print(f"Rubric criterion columns: {criteria}")
    print(f"Reviews found: {len(reviews)}")
    if args.dry_run:
        return
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(
            {"source": "ninth-brain-chart-review-agent", "version": 1, "reviews": reviews},
            fh,
            indent=2,
        )
    print(f"Wrote {args.out} — import it in CES under QA -> period -> Add charts -> Bot reviews.")


if __name__ == "__main__":
    main()
