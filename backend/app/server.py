"""Production entry point: `uvicorn app.server:app`. Reads its config from env vars."""
import logging
import os

from app.claude import ClaudeLabeler, ClaudePhotoReader
from app.main import create_app

logging.basicConfig(level=logging.INFO)

secret = os.environ.get("FLORA_SHARED_SECRET")
if not secret:
    raise RuntimeError("Set FLORA_SHARED_SECRET (the extension sends it as X-Flora-Secret).")

app = create_app(labeler=ClaudeLabeler(), photo_reader=ClaudePhotoReader(), shared_secret=secret)
