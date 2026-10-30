"""The program serves the FocusGarden page itself, so no browser extension is needed."""
from fastapi.testclient import TestClient

from app.main import create_app


def test_home_page_is_the_focusgarden_ui():
    client = TestClient(create_app())

    page = client.get("/")

    assert page.status_code == 200
    assert page.url.path == "/ui/"
    assert 'id="view-start"' in page.text


def test_page_scripts_settings_and_plant_art_are_served():
    client = TestClient(create_app())

    for path in ["/ui/app.js", "/ui/settings.html", "/ui/breakdown.js",
                 "/plants/plants.json", "/plants/strawberry_stages.gif"]:
        assert client.get(path).status_code == 200, path
