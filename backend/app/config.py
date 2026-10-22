from dataclasses import dataclass
import os
from pathlib import Path


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
    allow_origins: tuple[str, ...] = (
        "chrome-extension://*",
        "http://localhost",
        "http://127.0.0.1",
    )
    state_directory: Path = Path(
        os.getenv(
            "FOCUSGARDEN_STATE_DIRECTORY",
            str(Path.home() / ".focusgarden"),
        )
    )


settings = Settings()


def _api_key_path() -> Path:
    return settings.state_directory / "google_api_key"


def load_saved_google_api_key() -> str:
    path = _api_key_path()
    try:
        return path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return ""


def save_google_api_key(api_key: str) -> None:
    settings.state_directory.mkdir(parents=True, exist_ok=True)
    _api_key_path().write_text(api_key.strip(), encoding="utf-8")


def delete_saved_google_api_key() -> None:
    try:
        _api_key_path().unlink()
    except FileNotFoundError:
        pass
