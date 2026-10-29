"""Picks a plant for each session and turns verified minutes into growth.

Plants are configured in plants/plants.json under the web root (see the README there).
Code decides growth from validated stats, never the LLM.
"""
from __future__ import annotations

import json
from pathlib import Path
import secrets
from typing import Optional

DEFAULT_MINUTES = 60


def choose_plant(web_root: Path) -> Optional[dict]:
    """A random plant from plants.json, or None if there is none (the UI shows an emoji)."""
    try:
        config = json.loads((web_root / "plants" / "plants.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    plants = [p for p in config.get("plants") or [] if isinstance(p, dict) and p.get("file")]
    if not plants:
        return None
    plant = secrets.choice(plants)
    return {
        "name": plant.get("name") or plant["file"].removesuffix(".gif"),
        "gif": f"plants/{plant['file']}",
        "minutesToFullGrowth": float(
            plant.get("minutesToFullGrowth") or config.get("minutesToFullGrowth") or DEFAULT_MINUTES
        ),
    }


def plant_for(choice: Optional[dict], minutes: float) -> dict:
    """progress runs 0 (seed) to 1 (fully grown); percent is rounded down, so 100 means grown."""
    choice = choice or {}
    full = choice.get("minutesToFullGrowth") or DEFAULT_MINUTES
    progress = min(1.0, max(0.0, minutes / full))
    return {"name": choice.get("name") or "Plant", "gif": choice.get("gif"),
            "minutesToFullGrowth": full, "minutes": minutes, "progress": progress,
            "percent": int(progress * 100), "minutesLeft": max(0, full - minutes)}
