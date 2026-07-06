"""CES bridge exporter for the Ninth Brain Chart Review Agent.

Drop this file next to app.py, then add two lines to app.py:

    from ces_export import append_review          # top of file, with the other imports

    save_review_to_excel(run_details, categories, suggestions, answers)   # existing line
    append_review(run_details, categories, suggestions, answers)          # <- add this

Every submitted review is then also written to ces_batch_kc.json /
ces_batch_linn.json (per business unit) next to app.py, ready to import in
CES: QA -> open the period -> Add charts -> Bot reviews. Re-reviewing a run
replaces its entry (dedup by Run ID), so the files can be imported any time —
CES also dedupes on import by incident number.

Standard library only. Mirrors the conversion rules of scripts/xlsx_to_ces.py:
Q14/Q15 are asked in reverse on the Ninth Brain form, so they are inverted
(a "No" imports as Met) and a "Yes" on either sets the coaching flag.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Optional

# Ordered question keys, matching app.py's REVIEW_QUESTIONS and the CES rubric.
QUESTION_KEYS = [f"q{i}" for i in range(1, 16)]
INVERTED = {"q14", "q15"}

_UNIT_PATTERNS = [
    ("kc", re.compile(r"kansas\s*city", re.I)),
    ("linn", re.compile(r"linn", re.I)),
    ("cass", re.compile(r"cass", re.I)),
]


def _unit_of(business_unit: str) -> str:
    for op, pat in _UNIT_PATTERNS:
        if pat.search(business_unit or ""):
            return op
    return "other"


def _iso_date(v: str) -> str:
    m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", v or "")
    if m:
        return f"{m.group(3)}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
    return (v or "").strip()


def build_review(run_details: dict, categories: dict,
                 suggestions: dict, final_answers: dict) -> dict[str, Any]:
    """Convert one submitted review into the CES bridge format."""
    criteria: dict[str, str] = {}
    deficiencies: list[str] = []
    flagged = False
    for key in QUESTION_KEYS:
        answer = str(final_answers.get(key, "") or "").strip().capitalize()
        if answer not in ("Yes", "No"):
            continue
        good = answer == "Yes"
        if key in INVERTED:
            if answer == "Yes":
                flagged = True
            good = not good
        criteria[key] = "met" if good else "not_met"
        if not good:
            sug = suggestions.get(key)
            rationale = sug.get("rationale", "") if isinstance(sug, dict) else ""
            if rationale:
                deficiencies.append(f"{key.upper()}: {rationale}")

    note_parts: list[str] = []
    synopsis = str(suggestions.get("synopsis", "") or "")
    findings = str(suggestions.get("findings", "") or "")
    rules = ", ".join(run_details.get("matched_rules", []) or [])
    if synopsis:
        note_parts.append(synopsis)
    if findings:
        note_parts.append(f"Findings: {findings}")
    if rules:
        note_parts.append(f"Matched rules: {rules}")
    if deficiencies:
        note_parts.append("Deficiencies:\n" + "\n".join(deficiencies))

    review: dict[str, Any] = {
        "incidentNumber": str(run_details.get("run_id", "")).strip(),
        "reviewer": "Chart Review Agent",
        "flagged": flagged,
    }
    d = _iso_date(str(run_details.get("run_date", "")))
    if d:
        review["date"] = d
    acuity = str(suggestions.get("care_level", "") or "")
    if acuity:
        review["acuity"] = acuity
    if criteria:
        review["criteria"] = criteria
    if note_parts:
        review["notes"] = "\n\n".join(note_parts)
    return review


def append_review(run_details: dict, categories: dict,
                  suggestions: dict, final_answers: dict,
                  directory: Optional[str] = None) -> Optional[str]:
    """Add/replace one review in the unit's ces_batch_<unit>.json. Never raises
    (bridge export must not break the main Excel save)."""
    try:
        review = build_review(run_details, categories, suggestions, final_answers)
        if not review["incidentNumber"]:
            return None
        unit = _unit_of(str(run_details.get("business_unit", "")))
        directory = directory or os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(directory, f"ces_batch_{unit}.json")

        batch: dict[str, Any] = {
            "source": "ninth-brain-chart-review-agent",
            "version": 1,
            "reviews": [],
        }
        if os.path.exists(path):
            try:
                with open(path, encoding="utf-8") as fh:
                    existing = json.load(fh)
                if isinstance(existing.get("reviews"), list):
                    batch["reviews"] = existing["reviews"]
            except Exception:
                pass  # corrupt file -> start fresh rather than fail the save

        inc = review["incidentNumber"]
        batch["reviews"] = [r for r in batch["reviews"]
                            if str(r.get("incidentNumber", "")) != inc]
        batch["reviews"].append(review)
        batch["updated"] = time.strftime("%Y-%m-%d %H:%M")

        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(batch, fh, indent=2)
        os.replace(tmp, path)
        return path
    except Exception:
        return None


if __name__ == "__main__":
    # Smoke check with the shapes app.py passes.
    p = append_review(
        {"run_id": "73193106", "run_date": "6/11/2026",
         "business_unit": "Kansas City Metro, MO (20450)", "matched_rules": ["New Hire"]},
        {"review_types": ["New Hire"]},
        {"care_level": "ALS", "synopsis": "Test synopsis.", "findings": "Test findings.",
         "q14": {"answer": "Yes", "rationale": "Patient ingested a non-prescribed medication."}},
        {**{f"q{i}": "Yes" for i in range(1, 14)}, "q14": "Yes", "q15": "No"},
        directory="/tmp",
    )
    print("wrote", p)
