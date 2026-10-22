"""Measures real Gemini label accuracy on label_set.json. Costs API credits.

Run from backend/:  GOOGLE_API_KEY=... PYTHONPATH=. .venv/bin/python ../eval/run_eval.py
"""
import json
from pathlib import Path

from app.gemini import GeminiLabeler
from app.contracts import LabelRequest
from app.labeling import label_session

cases = json.loads((Path(__file__).parent / "label_set.json").read_text())
labeler = GeminiLabeler()
right = total = review = 0
for case in cases:
    result = label_session(LabelRequest(task=case["task"], blocks=case["blocks"]), labeler)
    for label in result.labels:
        expected = case["expected"][label.block_id]
        total += 1
        if label.label == "unclear":
            review += 1
        elif label.label == expected:
            right += 1
        else:
            print(f"MISS [{case['task']}] {label.block_id}: got {label.label}, "
                  f"expected {expected} ({label.reason})")

decided = total - review
print(f"accuracy on decided blocks: {right}/{decided}, sent to review: {review}/{total}")
