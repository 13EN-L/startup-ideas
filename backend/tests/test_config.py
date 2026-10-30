"""The Claude API key the tray saves stays on this computer, under the state directory."""
from app.config import delete_saved_claude_api_key, load_saved_claude_api_key, save_claude_api_key


def test_saved_key_is_loaded_trimmed_and_can_be_removed(tmp_path):
    assert load_saved_claude_api_key(tmp_path) == ""

    save_claude_api_key("  sk-ant-test  ", tmp_path)
    assert load_saved_claude_api_key(tmp_path) == "sk-ant-test"

    delete_saved_claude_api_key(tmp_path)
    delete_saved_claude_api_key(tmp_path)  # removing twice is fine
    assert load_saved_claude_api_key(tmp_path) == ""
