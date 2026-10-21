"""Checks Part 1's activity data against the agreed format (docs/contracts.md)."""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.contracts import ActivityWindow

EXAMPLE = Path(__file__).resolve().parents[2] / "docs" / "examples" / "activity-window.json"


def test_shared_example_matches_the_contract():
    window = ActivityWindow.model_validate(json.loads(EXAMPLE.read_text()))
    assert [b.id for b in window.blocks] == ["b1", "b2", "b3", "b4", "b5"]


def test_blocks_out_of_time_order_are_rejected():
    data = json.loads(EXAMPLE.read_text())
    data["blocks"].reverse()
    with pytest.raises(ValidationError):
        ActivityWindow.model_validate(data)
