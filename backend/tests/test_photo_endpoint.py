from fastapi.testclient import TestClient

from app.main import create_app
from tests.fakes import BrokenPhotoReader, FakeLabeler, FakePhotoReader

SECRET = "test-secret"
REQUEST = {"task": "chem ps4", "code_word": "maple", "minutes": 40,
           "image_base64": "aGVsbG8=", "media_type": "image/jpeg"}


def verdict(code_word_seen="maple", notes_present=True, matches_task=True, confidence=0.9):
    return {"code_word_seen": code_word_seen, "notes_present": notes_present,
            "matches_task": matches_task, "confidence": confidence}


def post_photo(reader, body=REQUEST):
    client = TestClient(create_app(labeler=FakeLabeler(), photo_reader=reader, shared_secret=SECRET))
    return client.post("/photo-check", json=body, headers={"X-Flora-Secret": SECRET})


def test_photo_with_matching_code_word_and_notes_gets_full_credit():
    res = post_photo(FakePhotoReader(verdict()))

    assert res.status_code == 200
    assert res.json()["verified"] is True
    assert res.json()["credited_minutes"] == 40


def test_wrong_code_word_falls_back_to_half_credit():
    res = post_photo(FakePhotoReader(verdict(code_word_seen="mapel")))

    body = res.json()
    assert body["verified"] is False
    assert body["credited_minutes"] == 20
    assert "code word" in body["reason"]


def test_notes_unrelated_to_the_task_fall_back_to_half_credit():
    res = post_photo(FakePhotoReader(verdict(matches_task=False)))
    assert (res.json()["verified"], res.json()["credited_minutes"]) == (False, 20)


def test_code_word_match_ignores_case_and_surrounding_spaces():
    res = post_photo(FakePhotoReader(verdict(code_word_seen=" MAPLE ")))
    assert res.json()["verified"] is True


def test_blurry_low_confidence_photo_falls_back_to_half_credit():
    res = post_photo(FakePhotoReader(verdict(confidence=0.3)))
    assert (res.json()["verified"], res.json()["credited_minutes"]) == (False, 20)


def test_malformed_verdict_is_retried_with_the_schema_errors():
    reader = FakePhotoReader({"code_word_seen": "maple"}, verdict())
    res = post_photo(reader)

    assert res.json()["verified"] is True
    assert "notes_present" in " ".join(reader.calls[1]["feedback"])


def test_verdict_still_malformed_after_two_retries_gets_half_credit():
    reader = FakePhotoReader({}, {}, {})
    res = post_photo(reader)

    assert len(reader.calls) == 3
    assert (res.json()["verified"], res.json()["credited_minutes"]) == (False, 20)


def test_unreachable_llm_gives_half_credit_instead_of_an_error():
    res = post_photo(BrokenPhotoReader())
    assert res.status_code == 200
    assert (res.json()["verified"], res.json()["credited_minutes"]) == (False, 20)
