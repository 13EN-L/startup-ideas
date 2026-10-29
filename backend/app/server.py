"""Production entry point for the packaged local application."""
import logging
import os

from app.claude import ClaudeLabeler, ClaudePhotoReader
from app.activitywatch import ActivityWatchManager
from app.config import settings
from app.main import create_app
from app.store import SessionStore

logging.basicConfig(level=logging.INFO)

secret = os.environ.get("FLORA_SHARED_SECRET", settings.extension_token)
if not secret:
    logging.warning(
        "FLORA_SHARED_SECRET is not set; /activity, /usage, /label and /photo-check will not"
        " require a secret. The FocusGarden page never needs one."
    )

labeler = photo_reader = None
if os.environ.get("ANTHROPIC_API_KEY"):
    labeler = ClaudeLabeler()
    photo_reader = ClaudePhotoReader()
else:
    logging.warning(
        "ANTHROPIC_API_KEY is not set; /label and /photo-check will return 503."
    )

app = create_app(
    labeler=labeler,
    photo_reader=photo_reader,
    shared_secret=secret,
    activitywatch_manager=ActivityWatchManager(
        settings.activitywatch_url,
        settings.activitywatch_executable,
        settings.activitywatch_start_command,
        settings.request_timeout_seconds,
    ),
    start_activitywatch=True,
    store=SessionStore(settings.state_directory / "sessions.json"),
)
