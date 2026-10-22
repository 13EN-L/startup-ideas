"""The request sent to Gemini, checked with a fake client (no API calls or credits)."""
from datetime import datetime, timezone
from types import SimpleNamespace

from app.contracts import ActivityBlock
from app.gemini import LABELS_SCHEMA, PHOTO_SCHEMA, GeminiLabeler, GeminiPhotoReader


class RecordingClient:
    """Stands in for genai.Client and keeps the config of each request."""

    def __init__(self, reply: str):
        self.configs = []
        self.models = SimpleNamespace(generate_content=self._generate)
        self._reply = reply

    def _generate(self, model, contents, config=None):
        self.configs.append(config)
        return SimpleNamespace(text=self._reply)


def block():
    return ActivityBlock(id="b1", start=datetime(2026, 10, 21, 14, tzinfo=timezone.utc),
                         seconds=60, kind="web", app="Google Chrome", site="docs.google.com")


def test_labels_are_requested_with_a_standard_json_schema():
    # Gemini's response_schema rejects JSON Schema keywords like additionalProperties (HTTP 400).
    client = RecordingClient('{"labels": []}')

    GeminiLabeler(client=client, model="test").label_blocks("chem", [block()], [])

    config = client.configs[0]
    assert config.response_json_schema == LABELS_SCHEMA
    assert config.response_schema is None


def test_photo_verdict_is_requested_with_a_standard_json_schema():
    client = RecordingClient('{"code_word_seen": "maple", "notes_present": true, '
                             '"matches_task": true, "confidence": 0.9}')

    GeminiPhotoReader(client=client, model="test").read_photo("chem", "aGk=", "image/jpeg", [])

    config = client.configs[0]
    assert config.response_json_schema == PHOTO_SCHEMA
    assert config.response_schema is None
