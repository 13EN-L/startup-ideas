from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
import threading
import webbrowser

import pystray
import uvicorn
from PIL import Image, ImageDraw


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


def _tray_image() -> Image.Image:
    image = Image.new("RGBA", (64, 64), (39, 64, 54, 255))
    draw = ImageDraw.Draw(image)
    draw.ellipse((10, 10, 54, 54), fill=(117, 190, 107, 255))
    draw.ellipse((20, 20, 44, 44), fill=(39, 64, 54, 255))
    return image


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the FocusGarden local backend.")
    parser.add_argument("--host", default=os.getenv("FOCUSGARDEN_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("FOCUSGARDEN_PORT", "8765")))
    parser.add_argument("--token", default=os.getenv("FOCUSGARDEN_EXTENSION_TOKEN", ""))
    parser.add_argument(
        "--google-api-key",
        default=os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY", ""),
    )
    parser.add_argument(
        "--console",
        action="store_true",
        help="run without the system tray (useful for development)",
    )
    args = parser.parse_args()

    if args.token:
        os.environ["FLORA_SHARED_SECRET"] = args.token
        os.environ["FOCUSGARDEN_EXTENSION_TOKEN"] = args.token
    if args.google_api_key:
        os.environ["GOOGLE_API_KEY"] = args.google_api_key
    if "ACTIVITYWATCH_EXECUTABLE" not in os.environ:
        executable = _bundled_activitywatch()
        if executable is not None:
            os.environ["ACTIVITYWATCH_EXECUTABLE"] = str(executable)

    from app.server import app

    if args.console:
        uvicorn.run(app, host=args.host, port=args.port, log_level="info")
        return

    # A windowless PyInstaller process has no stderr stream. Uvicorn's default
    # logging config assumes one exists and calls isatty() during startup.
    config = uvicorn.Config(
        app,
        host=args.host,
        port=args.port,
        log_level="warning",
        log_config=None,
        access_log=False,
    )
    server = uvicorn.Server(config)
    server_thread = threading.Thread(target=server.run, name="focusgarden-api", daemon=True)
    server_thread.start()

    def shutdown_server() -> None:
        server.should_exit = True
        server_thread.join(timeout=10)
        if server_thread.is_alive():
            app.state.activitywatch.close()

    def open_health() -> None:
        webbrowser.open(f"http://{args.host}:{args.port}/health")

    def quit_application(icon: pystray.Icon, _: object) -> None:
        shutdown_server()
        icon.stop()

    icon = pystray.Icon(
        "FocusGarden",
        _tray_image(),
        "FocusGarden local backend",
        menu=pystray.Menu(
            pystray.MenuItem("Open health status", lambda _icon, _item: open_health()),
            pystray.MenuItem("Quit FocusGarden", quit_application),
        ),
    )
    try:
        icon.run()
    finally:
        shutdown_server()


if __name__ == "__main__":
    main()
