"""Expand a crop's calendar template into dated tasks. Pure functions — no I/O.

Template entries (stored on `crops.calendar_template`):
    {"type": "fertilizer", "key": "top_dress_urea", "day": 21, "window": 3}
    {"type": "irrigation", "key": "irrigate", "every": 10, "from": 10, "until": 100}
"""

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any

EVENT_TYPES = {
    "land_preparation",
    "sowing",
    "fertilizer",
    "irrigation",
    "weeding",
    "disease_monitoring",
    "pest_monitoring",
    "harvest",
}
MAX_EVENTS_PER_CYCLE = 60


@dataclass(frozen=True, slots=True)
class PlannedEvent:
    event_type: str
    detail_key: str
    scheduled_on: date
    window_days: int


def expand_template(
    template: list[dict[str, Any]], sowing_date: date, *, irrigated: bool
) -> list[PlannedEvent]:
    events: list[PlannedEvent] = []
    for entry in template:
        event_type = entry["type"]
        if event_type not in EVENT_TYPES:
            raise ValueError(f"unknown calendar event type {event_type!r}")
        if event_type == "irrigation" and not irrigated:
            continue  # rainfed farms get rain-based advice from weather alerts instead
        window = int(entry.get("window", 0))
        if "every" in entry:
            step = int(entry["every"])
            if step <= 0:
                raise ValueError("'every' must be positive")
            offsets = range(int(entry.get("from", 0)), int(entry["until"]) + 1, step)
        else:
            offsets = [int(entry["day"])]
        events.extend(
            PlannedEvent(event_type, entry["key"], sowing_date + timedelta(days=offset), window)
            for offset in offsets
        )
    events.sort(key=lambda e: (e.scheduled_on, e.event_type))
    return events[:MAX_EVENTS_PER_CYCLE]
