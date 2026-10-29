"""Claude adapters: the only code that talks to the LLM."""
import json
import os
from typing import Any, List, Optional

import anthropic

from app.contracts import ActivityBlock

DEFAULT_MODEL = "claude-opus-5-5"
FALLBACK_BETA = "server-side-fallback-2026-07-01"

LABEL_SYSTEM = """You judge whether a student's computer activity fits the task they set for themselves.

Each line is one block of activity: id | minutes | site or app | page or window title.
Label every block exactly once:
- on_task: directly helps with the task (task documents, course sites, related searches, related lecture videos)
- off_task: unrelated to the task (social media, entertainment, other coursework)
- break: a deliberate pause such as music or a short walk away, not counted against the student
- unclear: you cannot tell from the title alone

Give a confidence from 0 to 1 and a reason of at most 12 words. Prefer unclear over guessing."""

PHOTO_SYSTEM = """You check a photo of a student's handwritten study notes.

The student was asked to write a short code word at the top of the page.
Report the code word exactly as written (empty string if there is none or it is unreadable),
whether the page has study notes, whether the notes relate to the student's task,
and your confidence from 0 to 1. Do not guess a code word you cannot read."""

LABELS_SCHEMA = {
    "type": "object",
    "properties": {
        "labels": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "block_id": {"type": "string"},
                    "label": {"type": "string", "enum": ["on_task", "off_task", "break", "unclear"]},
                    "confidence": {"type": "number"},
                    "reason": {"type": "string"},
                },
                "required": ["block_id", "label", "confidence", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["labels"],
    "additionalProperties": False,
}

PHOTO_SCHEMA = {
    "type": "object",
    "properties": {
        "code_word_seen": {"type": "string"},
        "notes_present": {"type": "boolean"},
        "matches_task": {"type": "boolean"},
        "confidence": {"type": "number"},
    },
    "required": ["code_word_seen", "notes_present", "matches_task", "confidence"],
    "additionalProperties": False,
}


def block_line(block: ActivityBlock) -> str:
    where = block.site or f"app:{block.app}"
    return f"{block.id} | {round(block.seconds / 60, 1)}m | {where} | {block.title or ''}"


def feedback_text(feedback: List[str]) -> str:
    if not feedback:
        return ""
    return "\n\nYour previous answer was rejected. Fix these problems:\n" + "\n".join(
        f"- {f}" for f in feedback
    )


class ClaudeClient:
    def __init__(self, client: Optional[anthropic.Anthropic] = None, model: Optional[str] = None):
        self.client = client or anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))
        self.model = model or os.environ.get("CLAUDE_MODEL", DEFAULT_MODEL)

    def _text(self, content: Any, max_tokens: int, output_config: dict, **request: Any) -> str:
        response = self.client.beta.messages.create(
            model=self.model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": content}],
            output_config=output_config,
            # If a safety classifier declines, the API retries on its recommended model.
            betas=[FALLBACK_BETA],
            fallbacks="default",
            **request,
        )
        if response.stop_reason in ("refusal", "max_tokens"):
            # A refusal has no usable output and a cut-off answer is partial JSON.
            raise RuntimeError(f"Claude stopped without an answer ({response.stop_reason})")
        return next((b.text for b in response.content if b.type == "text"), "")

    def test_connection(self) -> None:
        self._text("Reply with the single word OK.", 1024, {"effort": "low"})

    def _json(self, system: str, content: Any, schema: dict) -> dict:
        text = self._text(content, 16000,
                          {"format": {"type": "json_schema", "schema": schema}}, system=system)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"invalid_json": text}


class ClaudeLabeler(ClaudeClient):
    def label_blocks(self, task: str, blocks: List[ActivityBlock], feedback: List[str]) -> dict:
        prompt = (
            f"Task: {task}\n\nBlocks:\n"
            + "\n".join(block_line(b) for b in blocks)
            + feedback_text(feedback)
        )
        return self._json(LABEL_SYSTEM, prompt, LABELS_SCHEMA)


class ClaudePhotoReader(ClaudeClient):
    def read_photo(
        self, task: str, image_base64: str, media_type: str, feedback: List[str]
    ) -> dict:
        content = [
            {"type": "image",
             "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
            {"type": "text", "text": f"Task: {task}" + feedback_text(feedback)},
        ]
        raw = self._json(PHOTO_SYSTEM, content, PHOTO_SCHEMA)
        if raw.get("code_word_seen") == "":
            raw["code_word_seen"] = None
        return raw
