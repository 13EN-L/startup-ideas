"""Turns a task and activity blocks into validated labels and stats."""
import logging
from typing import Dict, List, Optional, Tuple

from pydantic import ValidationError

from app.contracts import (ActivityBlock, FinalLabel, LabelRequest, LabelResponse, LLMLabel,
                           LLMLabels)
from app.stats import compute_stats

MAX_RETRIES = 2
MIN_CONFIDENCE = 0.6
log = logging.getLogger(__name__)


class LLMUnavailableError(RuntimeError):
    """Raised when the configured LLM cannot be called."""


def matches(block: ActivityBlock, entries: List[str]) -> bool:
    """An entry matches an app name, a site, or any subdomain of that site (case-insensitive)."""
    site = (block.site or "").lower()
    app = block.app.lower()
    for entry in (e.strip().lower() for e in entries):
        if entry and (entry == app or entry == site or site.endswith("." + entry)):
            return True
    return False


def rule_label(block: ActivityBlock, request: LabelRequest) -> Optional[FinalLabel]:
    """Labels decided by code, so these blocks never go to the LLM. The blocklist wins ties."""
    if block.kind == "idle":
        label, reason, source = "break", "idle", "rule"
    elif matches(block, request.blocklist):
        label, reason, source = "off_task", "on your blocklist", "override"
    elif matches(block, request.allowlist):
        label, reason, source = "on_task", "on your allowlist", "override"
    else:
        return None
    return FinalLabel(block_id=block.id, seconds=block.seconds, label=label,
                      confidence=1.0, reason=reason, source=source)


def check_labels(raw, expected_ids: List[str]) -> Tuple[Dict[str, LLMLabel], List[str]]:
    """Schema and coverage check: every expected block labeled exactly once, nothing extra."""
    try:
        items = LLMLabels.model_validate(raw).labels
    except ValidationError as err:
        return {}, [f"Output did not match the schema: {e['loc']}: {e['msg']}" for e in err.errors()]

    errors = []
    by_id: Dict[str, LLMLabel] = {}
    for item in items:
        if item.block_id not in expected_ids:
            errors.append(f"Block {item.block_id} does not exist; label only the given block IDs.")
        elif item.block_id in by_id:
            errors.append(f"Block {item.block_id} was labeled more than once; label it exactly once.")
        else:
            by_id[item.block_id] = item
    errors += [f"Block {i} has no label; label every block." for i in expected_ids if i not in by_id]
    return by_id, errors


def ask_llm(task: str, blocks: List[ActivityBlock], labeler) -> Dict[str, LLMLabel]:
    """Calls the LLM, feeding validator errors back up to MAX_RETRIES times.

    Returns the valid labels from the last attempt; blocks missing from it are unlabeled.
    """
    expected = [b.id for b in blocks]
    by_id: Dict[str, LLMLabel] = {}
    feedback: List[str] = []
    for _ in range(1 + MAX_RETRIES):
        try:
            raw = labeler.label_blocks(task, blocks, feedback)
        except Exception as exc:
            log.exception("labeler call failed")
            raise LLMUnavailableError(f"Gemini request failed: {exc}") from exc
        by_id, feedback = check_labels(raw, expected)
        if not feedback:
            break
    return by_id


def final_label(block: ActivityBlock, item: Optional[LLMLabel]) -> FinalLabel:
    if item is None:
        return FinalLabel(block_id=block.id, seconds=block.seconds, label="unclear",
                          confidence=0.0, reason="no valid label from the LLM", source="unlabeled")
    if item.confidence < MIN_CONFIDENCE:
        return FinalLabel(block_id=block.id, seconds=block.seconds, label="unclear",
                          confidence=item.confidence, reason=item.reason, source="low_confidence")
    return FinalLabel(block_id=block.id, seconds=block.seconds, label=item.label,
                      confidence=item.confidence, reason=item.reason, source="llm")


def label_session(request: LabelRequest, labeler) -> LabelResponse:
    by_rule = {b.id: rule_label(b, request) for b in request.blocks}
    to_llm = [b for b in request.blocks if by_rule[b.id] is None]
    by_llm = ask_llm(request.task, to_llm, labeler) if to_llm else {}

    labels = [by_rule[b.id] or final_label(b, by_llm.get(b.id)) for b in request.blocks]
    needs_review = [l.block_id for l in labels if l.label == "unclear"]
    return LabelResponse(labels=labels, stats=compute_stats(labels), needs_review=needs_review)
