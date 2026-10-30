"""The tray's "Open FocusGarden" item opens the page the program serves."""
from app.launcher import page_url


def test_page_url_points_at_the_running_program():
    assert page_url("127.0.0.1", 8765) == "http://127.0.0.1:8765/"


def test_page_url_uses_loopback_when_listening_on_every_interface():
    assert page_url("0.0.0.0", 9000) == "http://127.0.0.1:9000/"
