"""Production entry point for the packaged local application."""
import logging
import os

from app.gemini import GeminiLabeler, GeminiPhotoReader
from app.activitywatch import ActivityWatchManager
from app.config import settings
from app.main import create_app

logging.basicConfig(level=logging.INFO)

secret = os.environ.get("FLORA_SHARED_SECRET", settings.extension_token)
if not secret:
    logging.warning(
        "FLORA_SHARED_SECRET is not set; extension endpoints will not require a secret."
    )

labeler = photo_reader = None
if os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
    labeler = GeminiLabeler()
    photo_reader = GeminiPhotoReader()
else:
    logging.warning(
        "GOOGLE_API_KEY is not set; /label and /photo-check will return 503."
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
)
