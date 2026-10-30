"""Errors the page's API turns into HTTP responses (see the handler in main.py)."""


class SessionError(Exception):
    """A request that can't be done right now, e.g. ending when nothing is running."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
