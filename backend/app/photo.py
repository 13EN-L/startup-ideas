"""Verifies a paper session from a photo of the user's notes."""
import logging
from typing import List, Optional

from pydantic import ValidationError

from app.contracts import LLMPhotoVerdict, PhotoCheckRequest, PhotoCheckResponse
from app.labeling import MAX_RETRIES

PARTIAL_CREDIT = 0.5
MIN_CONFIDENCE = 0.6
log = logging.getLogger(__name__)


def same_word(seen: Optional[str], issued: str) -> bool:
    """Exact match apart from case and surrounding spaces, which handwriting makes ambiguous."""
    return seen is not None and seen.strip().casefold() == issued.strip().casefold()


def failure_reason(verdict: LLMPhotoVerdict, request: PhotoCheckRequest) -> Optional[str]:
    if not same_word(verdict.code_word_seen, request.code_word):
        return "the session's code word was not found on the page"
    if not verdict.notes_present:
        return "no notes were found on the page"
    if not verdict.matches_task:
        return "the notes don't look related to the task"
    if verdict.confidence < MIN_CONFIDENCE:
        return "the photo was too unclear to verify"
    return None


def credit_for_failed_check(
    verdict: Optional[LLMPhotoVerdict], request: PhotoCheckRequest
) -> float:
    """Give partial credit only when the image plausibly belongs to this session."""
    if (
        verdict is not None
        and same_word(verdict.code_word_seen, request.code_word)
        and verdict.notes_present
        and verdict.matches_task
        and verdict.confidence < MIN_CONFIDENCE
    ):
        return request.minutes * PARTIAL_CREDIT
    return 0.0


def ask_llm(request: PhotoCheckRequest, reader) -> Optional[LLMPhotoVerdict]:
    """Calls the LLM, feeding schema errors back up to MAX_RETRIES times. None if it never passes."""
    feedback: List[str] = []
    for _ in range(1 + MAX_RETRIES):
        try:
            raw = reader.read_photo(request.task, request.image_base64, request.media_type, feedback)
        except Exception:
            # The caller must not receive credit when the model cannot check the image.
            log.exception("photo reader call failed")
            return None
        try:
            return LLMPhotoVerdict.model_validate(raw)
        except ValidationError as err:
            feedback = [f"Output did not match the schema: {e['loc']}: {e['msg']}" for e in err.errors()]
    return None


def check_photo(request: PhotoCheckRequest, reader) -> PhotoCheckResponse:
    verdict = ask_llm(request, reader)
    reason = "the photo could not be checked" if verdict is None else failure_reason(verdict, request)
    if reason is None:
        return PhotoCheckResponse(verified=True, credited_minutes=request.minutes,
                                  reason="code word and task notes found")
    return PhotoCheckResponse(
        verified=False,
        credited_minutes=credit_for_failed_check(verdict, request),
        reason=reason,
    )
