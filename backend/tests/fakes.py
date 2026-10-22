"""Stand-ins for Gemini, the only external system the backend talks to."""


class FakeLabeler:
    """Returns scripted raw LLM outputs in order and records what it was sent."""

    def __init__(self, *outputs):
        self.outputs = list(outputs)
        self.calls = []

    def label_blocks(self, task, blocks, feedback):
        self.calls.append({"task": task, "blocks": blocks, "feedback": feedback})
        return self.outputs.pop(0)


class BrokenLabeler:
    """Behaves like Gemini being unreachable."""

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
    """Behaves like Gemini being unreachable."""

    def read_photo(self, task, image_base64, media_type, feedback):
        raise ConnectionError("LLM unavailable")
