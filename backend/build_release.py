"""Build a self-contained Windows release containing ActivityWatch.

Usage:
    uv run --project backend --extra build python build_release.py
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from urllib.request import Request, urlopen
import zipfile


ACTIVITYWATCH_VERSION = "v0.14.1"
RELEASE_API = (
    "https://api.github.com/repos/ActivityWatch/activitywatch/releases/tags/"
    f"{ACTIVITYWATCH_VERSION}"
)
ROOT = Path(__file__).resolve().parent
DIST = Path(
    os.environ.get(
        "FOCUSGARDEN_RELEASE_DIR",
        Path(tempfile.gettempdir()) / "focusgarden-release",
    )
)


def fetch_json(url: str) -> dict:
    request = Request(url, headers={"Accept": "application/vnd.github+json"})
    with urlopen(request) as response:
        return json.load(response)


def download(url: str, destination: Path) -> None:
    request = Request(url, headers={"Accept": "application/octet-stream"})
    with urlopen(request) as response, destination.open("wb") as output:
        shutil.copyfileobj(response, output)


def choose_windows_asset(release: dict) -> tuple[str, str]:
    candidates = [
        asset for asset in release["assets"]
        if "windows" in asset["name"].lower()
        and "tauri" not in asset["name"].lower()
        and asset["name"].lower().endswith(".zip")
    ]
    if len(candidates) != 1:
        names = ", ".join(asset["name"] for asset in candidates)
        raise RuntimeError(
            "Expected exactly one Windows ActivityWatch zip asset; "
            f"found {len(candidates)} ({names})."
        )
    asset = candidates[0]
    digest = asset.get("digest", "")
    if not digest.startswith("sha256:"):
        raise RuntimeError(f"Release asset {asset['name']} has no SHA-256 digest.")
    return asset["browser_download_url"], digest.removeprefix("sha256:")


def verify_sha256(path: Path, expected: str) -> None:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != expected:
        raise RuntimeError(f"SHA-256 mismatch for {path.name}.")


def build() -> None:
    release = fetch_json(RELEASE_API)
    download_url, expected_digest = choose_windows_asset(release)
    with tempfile.TemporaryDirectory(prefix="focusgarden-build-") as temporary:
        temporary_path = Path(temporary)
        archive = temporary_path / "activitywatch.zip"
        download(download_url, archive)
        verify_sha256(archive, expected_digest)
        extracted = temporary_path / "activitywatch"
        extracted.mkdir()
        with zipfile.ZipFile(archive) as source:
            source.extractall(extracted)
        executables = [
            path for path in extracted.rglob("*.exe")
            if path.name.lower() in {"activitywatch.exe", "aw-qt.exe"}
        ]
        executable = executables[0] if executables else None
        if executable is None:
            found = ", ".join(str(path.relative_to(extracted)) for path in extracted.rglob("*.exe"))
            raise RuntimeError(
                "The ActivityWatch archive did not contain activitywatch.exe or "
                f"aw-qt.exe. Executables found: {found or 'none'}"
            )
        activitywatch_root = executable.parent
        pyinstaller_dist = temporary_path / "pyinstaller-dist"
        pyinstaller_work = temporary_path / "pyinstaller-work"
        pyinstaller_spec = temporary_path / "pyinstaller-spec"

        subprocess.run(
            [
                sys.executable,
                "-m",
                "PyInstaller",
                "--noconfirm",
                "--clean",
                "--onedir",
                "--windowed",
                "--name",
                "FocusGardenLocalBackend",
                "--distpath",
                str(pyinstaller_dist),
                "--workpath",
                str(pyinstaller_work),
                "--specpath",
                str(pyinstaller_spec),
                "--paths",
                str(ROOT),
                "--hidden-import",
                "app.server",
                "--hidden-import",
                "app.gemini",
                "--hidden-import",
                "app.contracts",
                "--hidden-import",
                "app.labeling",
                "--hidden-import",
                "app.photo",
                "--hidden-import",
                "app.stats",
                "--hidden-import",
                "pystray",
                str(ROOT / "app" / "launcher.py"),
            ],
            cwd=ROOT,
            check=True,
        )
        packaged = pyinstaller_dist / "FocusGardenLocalBackend"
        destination = packaged / "activitywatch"
        if destination.exists():
            shutil.rmtree(destination)
        shutil.copytree(activitywatch_root, destination)
        if DIST.exists():
            shutil.rmtree(DIST)
        shutil.copytree(packaged, DIST / "FocusGardenLocalBackend")
        (DIST / "README.txt").write_text(
            "Run FocusGardenLocalBackend\\FocusGardenLocalBackend.exe.\n"
            "The app runs in the Windows system tray without a terminal.\n"
            "Optional: pass --token TOKEN for Chrome-extension authentication.\n",
            encoding="utf-8",
        )
        archive = shutil.make_archive(
            str(ROOT / "FocusGardenLocalBackend-windows-x86_64"),
            "zip",
            root_dir=DIST,
        )
    print(f"Release created at {DIST}")
    print(f"Release archive created at {archive}")


if __name__ == "__main__":
    build()
