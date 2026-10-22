from __future__ import annotations

import json
import os
from pathlib import Path
import shlex
import subprocess
import time
from threading import Lock
from typing import Any

import httpx
import psutil


class ActivityWatchError(RuntimeError):
    """Raised when ActivityWatch cannot be reached or returns invalid data."""


class ActivityWatchManager:
    def __init__(
        self,
        base_url: str,
        executable: str | None = None,
        start_command: str | None = None,
        timeout: float = 5,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.executable = executable
        self.start_command = start_command
        self.timeout = timeout
        self._process: subprocess.Popen[bytes] | None = None
        self._managed_processes: dict[int, psutil.Process] = {}
        self._lock = Lock()
        self.startup_error: str | None = None
        self.started_by_manager = False

    @property
    def process_running(self) -> bool:
        return self._process is not None and self._process.poll() is None

    def _request(self, path: str) -> Any:
        try:
            response = httpx.get(f"{self.base_url}{path}", timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ActivityWatchError(f"ActivityWatch request failed: {exc}") from exc

    def is_reachable(self) -> bool:
        try:
            self._request("/api/0/info")
        except ActivityWatchError:
            return False
        return True

    def startup(self) -> bool:
        """Start the configured/bundled ActivityWatch process and report readiness."""
        try:
            self.ensure_running()
        except ActivityWatchError as exc:
            self.startup_error = str(exc)
            return False
        self.startup_error = None
        return True

    def ensure_running(self) -> None:
        if self.is_reachable():
            return
        with self._lock:
            if self.is_reachable():
                return
            if self.process_running:
                raise ActivityWatchError(
                    "ActivityWatch was started but its API is not ready"
                )
            command = self._command()
            if command is None:
                raise ActivityWatchError(
                    "ActivityWatch is unavailable. Set ACTIVITYWATCH_EXECUTABLE "
                    "or ACTIVITYWATCH_START_COMMAND."
                )
            try:
                self._process = subprocess.Popen(
                    command,
                    cwd=str(Path(command[0]).resolve().parent),
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    env={**os.environ, "AW_HIDE": "1"},
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            except OSError as exc:
                raise ActivityWatchError(
                    f"Could not launch ActivityWatch: {exc}"
                ) from exc
            self._remember_process_tree()
            deadline = time.monotonic() + 10
            while time.monotonic() < deadline:
                if self.is_reachable():
                    self._remember_process_tree()
                    self.started_by_manager = True
                    return
                time.sleep(0.25)
            if self._process.poll() is not None:
                exit_code = self._process.returncode
                self._process = None
                raise ActivityWatchError(
                    f"ActivityWatch exited before becoming ready (exit code {exit_code})"
                )
            raise ActivityWatchError("ActivityWatch launched but did not become reachable")

    def _command(self) -> list[str] | None:
        if self.start_command:
            return shlex.split(self.start_command, posix=os.name != "nt")
        if self.executable:
            return [self.executable]
        for root in (
            Path(__file__).resolve().parents[2],
            Path(getattr(__import__("sys"), "_MEIPASS", "")),
            Path(__import__("sys").executable).resolve().parent,
        ):
            directory = root / "activitywatch"
            for name in ("activitywatch.exe", "aw-qt.exe"):
                bundled = directory / name
                if bundled.is_file():
                    return [str(bundled)]
        return None

    def buckets(self) -> list[dict[str, Any]]:
        result = self._request("/api/0/buckets/")
        if not isinstance(result, dict):
            raise ActivityWatchError("ActivityWatch returned invalid bucket data")
        buckets: list[dict[str, Any]] = []
        for bucket_id, bucket in result.items():
            if isinstance(bucket, dict):
                normalized = dict(bucket)
                normalized.setdefault("id", bucket_id)
                buckets.append(normalized)
        return buckets

    def events(self, bucket_id: str, start: str, end: str) -> list[dict[str, Any]]:
        try:
            response = httpx.get(
                f"{self.base_url}/api/0/buckets/{bucket_id}/events",
                params={"starttime": start, "endtime": end},
                timeout=self.timeout,
            )
            response.raise_for_status()
            result = response.json()
        except (httpx.HTTPError, ValueError) as exc:
            raise ActivityWatchError(f"ActivityWatch event request failed: {exc}") from exc
        if not isinstance(result, list):
            raise ActivityWatchError("ActivityWatch returned invalid event data")
        return [event for event in result if isinstance(event, dict)]

    def close(self) -> None:
        self._remember_process_tree()
        processes = list(self._managed_processes.values())
        if self._process is not None:
            try:
                root = psutil.Process(self._process.pid)
                processes.append(root)
            except psutil.Error:
                pass
        unique_processes = {process.pid: process for process in processes}
        descendants = []
        for process in unique_processes.values():
            try:
                descendants.extend(process.children(recursive=True))
            except psutil.Error:
                continue
        unique_processes.update({process.pid: process for process in descendants})
        for process in unique_processes.values():
            try:
                process.terminate()
            except psutil.Error:
                pass
        _, alive = psutil.wait_procs(list(unique_processes.values()), timeout=5)
        for process in alive:
            try:
                process.kill()
            except psutil.Error:
                pass
        if alive:
            psutil.wait_procs(alive, timeout=5)
        self._managed_processes.clear()
        self._process = None
        self.started_by_manager = False

    def _remember_process_tree(self) -> None:
        if self._process is None:
            return
        try:
            root = psutil.Process(self._process.pid)
            self._managed_processes[root.pid] = root
            for child in root.children(recursive=True):
                self._managed_processes[child.pid] = child
        except psutil.Error:
            return


def dump_json(value: Any) -> str:
    """Stable JSON helper for logs and diagnostics."""
    return json.dumps(value, separators=(",", ":"), sort_keys=True)
