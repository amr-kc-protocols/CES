"""Drop-in helper for the Ninth Brain Chart Review Agent to export a batch
that the CES QA Review Queue can import (see docs/bot-bridge.md).

No dependencies — standard library only. Copy this file next to the bot's
app.py and use CesBatch to collect scored charts, then write the JSON file
and import it in CES under QA -> period -> Add charts -> Bot reviews.
"""
from __future__ import annotations

import json
from typing import Any, Optional


class CesBatch:
    """Collects scored chart reviews and writes them in the CES bridge format."""

    def __init__(self) -> None:
        self.reviews: list[dict[str, Any]] = []

    def add(
        self,
        incident_number: str,
        score_pct: Optional[float] = None,
        *,
        provider: Optional[str] = None,
        crew: Optional[str] = None,
        chief_complaint: Optional[str] = None,
        acuity: Optional[str] = None,
        date: Optional[str] = None,           # ISO yyyy-mm-dd
        notes: Optional[str] = None,
        criteria: Optional[dict[str, str]] = None,  # {"vitals": "met", ...}
        flagged: Optional[bool] = None,
        reviewer: str = "Chart Review Agent",
    ) -> None:
        review: dict[str, Any] = {"incidentNumber": str(incident_number).strip()}
        if score_pct is not None:
            review["scorePct"] = round(float(score_pct))
        if provider:
            review["provider"] = provider
        if crew:
            review["crew"] = crew
        if chief_complaint:
            review["chiefComplaint"] = chief_complaint
        if acuity:
            review["acuity"] = acuity
        if date:
            review["date"] = date
        if notes:
            review["notes"] = notes
        if criteria:
            review["criteria"] = criteria
        if flagged is not None:
            review["flagged"] = bool(flagged)
        if reviewer:
            review["reviewer"] = reviewer
        self.reviews.append(review)

    def to_dict(self) -> dict[str, Any]:
        return {
            "source": "ninth-brain-chart-review-agent",
            "version": 1,
            "reviews": self.reviews,
        }

    def write(self, path: str = "ces_batch.json") -> str:
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(self.to_dict(), fh, indent=2)
        return path


if __name__ == "__main__":
    # Tiny demo / smoke check.
    b = CesBatch()
    b.add(
        "24001",
        92,
        provider="Medic X",
        chief_complaint="Chest pain",
        notes="All critical elements documented.",
        criteria={"vitals": "met", "meds": "partial"},
    )
    print(b.write("/tmp/ces_batch_demo.json"))
