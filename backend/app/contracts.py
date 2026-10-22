"""Shared data formats. docs/contracts.md describes these for Parts 1 and 3."""
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

Label = Literal["on_task", "off_task", "break", "unclear"]
LabelSource = Literal["llm", "rule", "override", "low_confidence", "unlabeled"]


class ActivityBlock(BaseModel):
    """One stretch of activity from Part 1's local backend."""
    id: str
    start: datetime
    seconds: int = Field(ge=0)
    kind: Literal["web", "app", "idle"]
    app: str = ""
    site: Optional[str] = None
    title: Optional[str] = None


def check_blocks(blocks: List[ActivityBlock]) -> List[ActivityBlock]:
    """Block ids are unique and blocks are in time order (streaks depend on it)."""
    ids = [b.id for b in blocks]
    if len(ids) != len(set(ids)):
        raise ValueError("block ids must be unique")
    if any(a.start > b.start for a, b in zip(blocks, blocks[1:])):
        raise ValueError("blocks must be in time order")
    return blocks


class ActivityWindow(BaseModel):
    """What Part 1's local backend returns for GET /activity?start=&end=."""
    start: datetime
    end: datetime
    blocks: List[ActivityBlock]

    _check_blocks = field_validator("blocks")(check_blocks)


class LabelRequest(BaseModel):
    task: str = Field(min_length=1)
    blocks: List[ActivityBlock]
    allowlist: List[str] = []
    blocklist: List[str] = []

    _check_blocks = field_validator("blocks")(check_blocks)


class LLMLabel(BaseModel):
    """One label exactly as the LLM must return it."""
    block_id: str
    label: Label
    confidence: float = Field(ge=0, le=1)
    reason: str


class LLMLabels(BaseModel):
    labels: List[LLMLabel]


class FinalLabel(BaseModel):
    """A block's label after validation, overrides and confidence checks."""
    block_id: str
    seconds: int = Field(ge=0)
    label: Label
    confidence: float = Field(ge=0, le=1)
    reason: str
    source: LabelSource


class Stats(BaseModel):
    total_minutes: float
    on_task_minutes: float
    off_task_minutes: float
    break_minutes: float
    unclear_minutes: float
    on_task_pct: float
    longest_streak_minutes: float


class LabelResponse(BaseModel):
    labels: List[FinalLabel]
    stats: Stats
    needs_review: List[str]


class PhotoCheckRequest(BaseModel):
    task: str = Field(min_length=1)
    code_word: str = Field(min_length=1)
    minutes: float = Field(gt=0)
    image_base64: str = Field(min_length=1)
    media_type: Literal["image/jpeg", "image/png", "image/webp"]


class LLMPhotoVerdict(BaseModel):
    """The photo verdict exactly as the LLM must return it."""
    code_word_seen: Optional[str]
    notes_present: bool
    matches_task: bool
    confidence: float = Field(ge=0, le=1)


class PhotoCheckResponse(BaseModel):
    verified: bool
    credited_minutes: float
    reason: str
