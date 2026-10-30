"""The requests sent to Claude, checked with a fake SDK client (no API calls or credits)."""
from datetime import datetime, timezone
from types import SimpleNamespace

import pytest

from app.claude import LABELS_SCHEMA, PHOTO_SCHEMA, ClaudeLabeler, ClaudePhotoReader
from app.contracts import ActivityBlock


class RecordingClient:
    """Stands in for anthropic.Anthropic and keeps the arguments of each request."""

    def __init__(self, reply: str, stop_reason: str = "end_turn"):
        self.requests = []
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))
        self._reply = reply
        self._stop_reason = stop_reason

    def _create(self, **request):
        self.requests.append(request)
        return SimpleNamespace(stop_reason=self._stop_reason, content=[
            SimpleNamespace(type="thinking", thinking=""),
            SimpleNamespace(type="text", text=self._reply),
        ])


def block():
    return ActivityBlock(id="b1", start=datetime(2026, 10, 21, 14, tzinfo=timezone.utc),
                         seconds=60, kind="web", app="Google Chrome", site="docs.google.com",
                         title="Chem PS4")


def test_labels_are_requested_as_structured_json_and_parsed():
    client = RecordingClient('{"labels": [{"block_id": "b1", "label": "on_task", '
                             '"confidence": 0.9, "reason": "chem doc"}]}')

    labels = ClaudeLabeler(client=client, model="claude-test").label_blocks("chem", [block()], [])

    assert labels["labels"][0]["label"] == "on_task"
    request = client.requests[0]
    assert request["model"] == "claude-test"
    assert request["output_config"]["format"] == {"type": "json_schema", "schema": LABELS_SCHEMA}
    assert "b1 | 1.0m | docs.google.com | Chem PS4" in request["messages"][0]["content"]


def test_photo_is_sent_as_an_image_block_and_an_unreadable_code_word_becomes_none():
    client = RecordingClient('{"code_word_seen": "", "notes_present": true, '
                             '"matches_task": true, "confidence": 0.4}')

    verdict = ClaudePhotoReader(client=client, model="claude-test").read_photo(
        "chem notes", "aGk=", "image/png", [])

    assert verdict["code_word_seen"] is None
    request = client.requests[0]
    assert request["output_config"]["format"] == {"type": "json_schema", "schema": PHOTO_SCHEMA}
    image, text = request["messages"][0]["content"]
    assert image == {"type": "image",
                     "source": {"type": "base64", "media_type": "image/png", "data": "aGk="}}
    assert text == {"type": "text", "text": "Task: chem notes"}


@pytest.mark.parametrize("stop_reason", ["refusal", "max_tokens"])
def test_a_refused_or_cut_off_answer_is_an_error_not_a_label(stop_reason):
    client = RecordingClient('{"labels": [', stop_reason=stop_reason)

    with pytest.raises(RuntimeError, match=stop_reason):
        ClaudeLabeler(client=client, model="claude-test").label_blocks("chem", [block()], [])


def test_requests_opt_into_server_side_refusal_fallbacks():
    client = RecordingClient('{"labels": []}')

    ClaudeLabeler(client=client, model="claude-test").label_blocks("chem", [block()], [])

    assert client.requests[0]["fallbacks"] == "default"
    assert client.requests[0]["betas"] == ["server-side-fallback-2026-07-01"]


def test_connection_check_sends_one_small_request_and_fails_on_a_refusal():
    client = RecordingClient("OK")
    ClaudeLabeler(client=client, model="claude-test").test_connection()
    assert client.requests[0]["model"] == "claude-test"

    with pytest.raises(RuntimeError):
        ClaudeLabeler(client=RecordingClient("", stop_reason="refusal"),
                      model="claude-test").test_connection()
