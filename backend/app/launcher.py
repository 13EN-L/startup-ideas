from __future__ import annotations

import argparse
import os
from pathlib import Path
import sys
import threading
import tkinter as tk
import webbrowser
from tkinter import messagebox

import pystray
import uvicorn
from PIL import Image, ImageDraw

from app.config import (
    delete_saved_google_api_key,
    load_saved_google_api_key,
    save_google_api_key,
)

_api_key_window_lock = threading.Lock()


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


def _configure_google_api_key_window(app: object) -> None:
    root = tk.Tk()
    root.title("FocusGarden API key")
    root.resizable(False, False)
    root.geometry("460x165")
    root.protocol("WM_DELETE_WINDOW", root.destroy)

    tk.Label(
        root,
        text="Google AI Studio API key",
        anchor="w",
    ).pack(fill="x", padx=16, pady=(16, 4))
    key_entry = tk.Entry(root, show="*", width=58)
    key_entry.insert(0, os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY", ""))
    key_entry.pack(padx=16, pady=(0, 12))
    key_entry.focus_force()

    buttons = tk.Frame(root)
    buttons.pack(pady=(0, 12))

    def close() -> None:
        root.destroy()

    def save() -> None:
        api_key = key_entry.get().strip()
        if not api_key:
            messagebox.showerror("FocusGarden", "Enter an API key before saving.", parent=root)
            return
        try:
            save_google_api_key(api_key)
            os.environ["GOOGLE_API_KEY"] = api_key
            from app.gemini import GeminiLabeler, GeminiPhotoReader

            app.state.labeler = GeminiLabeler()
            app.state.photo_reader = GeminiPhotoReader()
        except OSError as exc:
            messagebox.showerror("FocusGarden", f"Could not save the API key: {exc}", parent=root)
            return
        close()

    def remove() -> None:
        try:
            delete_saved_google_api_key()
            os.environ.pop("GOOGLE_API_KEY", None)
            os.environ.pop("GEMINI_API_KEY", None)
            app.state.labeler = None
            app.state.photo_reader = None
        except OSError as exc:
            messagebox.showerror("FocusGarden", f"Could not remove the API key: {exc}", parent=root)
            return
        close()

    tk.Button(buttons, text="Save", width=10, command=save).pack(side="left", padx=4)
    tk.Button(buttons, text="Remove", width=10, command=remove).pack(side="left", padx=4)
    tk.Button(buttons, text="Cancel", width=10, command=close).pack(side="left", padx=4)
    root.mainloop()


def _configure_google_api_key(app: object) -> None:
    """Open the Tk window on its own UI thread, not inside the tray callback."""
    if not _api_key_window_lock.acquire(blocking=False):
        return

    def run_window() -> None:
        try:
            _configure_google_api_key_window(app)
        finally:
            _api_key_window_lock.release()

    threading.Thread(target=run_window, name="focusgarden-api-key-window", daemon=True).start()


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
    elif not (os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")):
        saved_api_key = load_saved_google_api_key()
        if saved_api_key:
            os.environ["GOOGLE_API_KEY"] = saved_api_key
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

    def configure_api_key() -> None:
        _configure_google_api_key(app)

    def quit_application(icon: pystray.Icon, _: object) -> None:
        shutdown_server()
        icon.stop()

    icon = pystray.Icon(
        "FocusGarden",
        _tray_image(),
        "FocusGarden local backend",
        menu=pystray.Menu(
            pystray.MenuItem("Set Google API key", lambda _icon, _item: configure_api_key()),
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
