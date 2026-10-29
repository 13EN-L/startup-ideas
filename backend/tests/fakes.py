"""Stand-ins for Claude and ActivityWatch, the external systems the backend talks to."""


class FakeLabeler:
    """Returns scripted raw LLM outputs in order and records what it was sent."""

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = []

    def label_blocks(self, task, blocks, feedback):
        self.calls.append({"task": task, "blocks": blocks, "feedback": feedback})
        return self.outputs.pop(0)


class BrokenLabeler:
    """Behaves like Claude being unreachable."""

    def label_blocks(self, task, blocks, feedback):
        raise ConnectionError("LLM unavailable")


class FakePhotoReader:
    """Returns scripted raw LLM photo verdicts in order and records what it was sent."""

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = []

    def read_photo(self, task, image_base64, media_type, feedback):
        self.calls.append({"task": task, "feedback": feedback})
        return self.outputs.pop(0)


class BrokenPhotoReader:
    """Behaves like Claude being unreachable."""

    def read_photo(self, task, image_base64, media_type, feedback):
        raise ConnectionError("LLM unavailable")


class FakeActivityWatch:
    """A running ActivityWatch with a browser bucket and an AFK bucket of scripted events."""

    base_url = "http://127.0.0.1:5600"
    startup_error = None
    process_running = True

    def __init__(self, *events, afk=()):
        self.recorded = {"aw-watcher-web-chrome": list(events), "aw-watcher-afk_test": list(afk)}

    def startup(self):
        return True

    def close(self):
        return None

    def is_reachable(self):
        return True

    def ensure_running(self):
        return None

    def buckets(self):
        return [{"id": bucket_id} for bucket_id in self.recorded]

    def events(self, bucket_id, start, end):
        return self.recorded[bucket_id]


class FakeClock:
    """A clock tests move forward by hand."""

    def __init__(self, now):
        self.current = now

    def __call__(self):
        return self.current

    def advance(self, **delta):
        from datetime import timedelta
        self.current += timedelta(**delta)
