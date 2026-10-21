"""Claude adapters: the only code that talks to the LLM. Tests replace these with fakes."""
import json
import os
from typing import List, Optional

import anthropic

from app.contracts import ActivityBlock

DEFAULT_MODEL = "claude-haiku-5-5"

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
    """One compact line per block keeps the prompt small. URLs never reach this point."""
    where = block.site or f"app:{block.app}"
    return f"{block.id} | {round(block.seconds / 60, 1)}m | {where} | {block.title or ''}"


def feedback_text(feedback: List[str]) -> str:
    if not feedback:
        return ""
    return "\n\nYour previous answer was rejected. Fix these problems:\n" + "\n".join(
        f"- {f}" for f in feedback)


class ClaudeClient:
    def __init__(self, client: Optional[anthropic.Anthropic] = None, model: Optional[str] = None,
                 effort: Optional[str] = None):
        self.client = client or anthropic.Anthropic()
        self.model = model or os.environ.get("FLORA_MODEL", DEFAULT_MODEL)
        self.effort = effort or os.environ.get("FLORA_EFFORT", "medium")

    def _json(self, system: str, content, schema: dict) -> dict:
        response = self.client.messages.create(
            model=self.model,
            max_tokens=16000,
            system=system,
            messages=[{"role": "user", "content": content}],
            output_config={"effort": self.effort,
                           "format": {"type": "json_schema", "schema": schema}},
        )
        if response.stop_reason == "refusal":
            raise RuntimeError(f"Claude declined the request: {response.stop_details}")
        text = next((b.text for b in response.content if b.type == "text"), None)
        if text is None:
            raise RuntimeError(f"no text in response (stop_reason={response.stop_reason})")
        # Invalid JSON surfaces as a schema error in the caller's retry loop.
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return {"invalid_json": text}


class ClaudeLabeler(ClaudeClient):
    def label_blocks(self, task: str, blocks: List[ActivityBlock], feedback: List[str]) -> dict:
        prompt = (f"Task: {task}\n\nBlocks:\n" + "\n".join(block_line(b) for b in blocks)
                  + feedback_text(feedback))
        return self._json(LABEL_SYSTEM, prompt, LABELS_SCHEMA)


class ClaudePhotoReader(ClaudeClient):
    def read_photo(self, task: str, image_base64: str, media_type: str,
                   feedback: List[str]) -> dict:
        content = [
            {"type": "image",
             "source": {"type": "base64", "media_type": media_type, "data": image_base64}},
            {"type": "text", "text": f"Task: {task}" + feedback_text(feedback)},
        ]
        raw = self._json(PHOTO_SYSTEM, content, PHOTO_SCHEMA)
        if raw.get("code_word_seen") == "":
            raw["code_word_seen"] = None
        return raw
