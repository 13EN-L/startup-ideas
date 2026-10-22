from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys

import uvicorn


def _bundled_activitywatch() -> Path | None:
    candidates = [
        Path(getattr(sys, "_MEIPASS", "")) / "activitywatch",
        Path(sys.executable).resolve().parent / "activitywatch",
        Path(__file__).resolve().parents[1] / "activitywatch",
    ]
    for directory in candidates:
        for name in ("activitywatch.exe", "aw-qt.exe"):
            executable = directory / name
            if executable.is_file():
                return executable
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the FocusGarden local backend.")
    parser.add_argument("--host", default=os.getenv("FOCUSGARDEN_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("FOCUSGARDEN_PORT", "8765")))
    parser.add_argument("--token", default=os.getenv("FOCUSGARDEN_EXTENSION_TOKEN", ""))
    parser.add_argument("--anthropic-api-key", default=os.getenv("ANTHROPIC_API_KEY", ""))
    args = parser.parse_args()

    if args.token:
        os.environ["FLORA_SHARED_SECRET"] = args.token
        os.environ["FOCUSGARDEN_EXTENSION_TOKEN"] = args.token
    if args.anthropic_api_key:
        os.environ["ANTHROPIC_API_KEY"] = args.anthropic_api_key
    if "ACTIVITYWATCH_EXECUTABLE" not in os.environ:
        executable = _bundled_activitywatch()
        if executable is not None:
            os.environ["ACTIVITYWATCH_EXECUTABLE"] = str(executable)

    from app.server import app

    uvicorn.run(app, host=args.host, port=args.port, log_level="info")


if __name__ == "__main__":
    main()
