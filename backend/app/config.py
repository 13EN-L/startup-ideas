from dataclasses import dataclass
import os
from pathlib import Path
import sys


@dataclass(frozen=True)
class Settings:
    activitywatch_url: str = os.getenv("ACTIVITYWATCH_URL", "http://127.0.0.1:5600")
    activitywatch_executable: str | None = os.getenv("ACTIVITYWATCH_EXECUTABLE") or None
    activitywatch_start_command: str | None = os.getenv("ACTIVITYWATCH_START_COMMAND") or None
    extension_token: str = os.getenv("FOCUSGARDEN_EXTENSION_TOKEN", "")
    host: str = os.getenv("FOCUSGARDEN_HOST", "127.0.0.1")
    port: int = int(os.getenv("FOCUSGARDEN_PORT", "8765"))
    max_window_seconds: int = int(os.getenv("FOCUSGARDEN_MAX_WINDOW_SECONDS", "604800"))
    request_timeout_seconds: float = float(os.getenv("ACTIVITYWATCH_TIMEOUT_SECONDS", "5"))
    state_directory: Path = Path(
        os.getenv(
            "FOCUSGARDEN_STATE_DIRECTORY",
            str(Path.home() / ".focusgarden"),
        )
    )


settings = Settings()


def default_web_root() -> Path:
    """The FocusGarden page's files: web/ in the repo, bundled as web/ in the packaged exe."""
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).parent)) / "web"
    return Path(__file__).resolve().parents[2] / "web"


def _api_key_path(directory: Path | None) -> Path:
    return (directory or settings.state_directory) / "anthropic_api_key"


def load_saved_claude_api_key(directory: Path | None = None) -> str:
    try:
        return _api_key_path(directory).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def save_claude_api_key(api_key: str, directory: Path | None = None) -> None:
    path = _api_key_path(directory)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(api_key.strip(), encoding="utf-8")


def delete_saved_claude_api_key(directory: Path | None = None) -> None:
    try:
        _api_key_path(directory).unlink()
    except FileNotFoundError:
        pass
