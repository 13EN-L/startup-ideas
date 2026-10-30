// @ts-check
/** Settings page: distracting sites, saved by the local program. */
import { api } from "./api.js";

const distracting = /** @type {HTMLTextAreaElement} */ (document.getElementById("distractingSites"));
const status = /** @type {HTMLElement} */ (document.getElementById("status"));

try {
  distracting.value = (await api.getSettings()).distractingSites.join("\n");
} catch (err) {
  status.textContent = String(err.message || err);
}

document.getElementById("settings")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const distractingSites = distracting.value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  try {
    await api.saveSettings({ distractingSites });
    status.textContent = "Saved.";
  } catch (err) {
    status.textContent = String(err.message || err);
  }
});

document.getElementById("test")?.addEventListener("click", async () => {
  status.textContent = "Checking…";
  try {
    const health = await api.health();
    status.textContent = health.reachable
      ? "FocusGarden and ActivityWatch are both running."
      : `ActivityWatch isn't running: ${health.detail}`;
  } catch (err) {
    status.textContent = String(err.message || err);
  }
});
