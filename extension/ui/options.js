// @ts-check
/** Settings page: where the backend is and its shared secret. Read by background/config.js. */
import { DEFAULTS, getConfig } from "../background/config.js";

const url = /** @type {HTMLInputElement} */ (document.getElementById("backendUrl"));
const secret = /** @type {HTMLInputElement} */ (document.getElementById("sharedSecret"));
const status = /** @type {HTMLElement} */ (document.getElementById("status"));

const config = await getConfig();
url.value = config.backendUrl;
secret.value = config.sharedSecret;

function current() {
  const backendUrl = (url.value.trim() || DEFAULTS.backendUrl).replace(/\/+$/, "");
  // One local backend serves both activity and labeling.
  return { backendUrl, activityUrl: backendUrl, sharedSecret: secret.value };
}

document.getElementById("settings")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  await chrome.storage.local.set({ settings: current() });
  status.textContent = "Saved.";
});

document.getElementById("test")?.addEventListener("click", async () => {
  status.textContent = "Testing…";
  const { backendUrl } = current();
  try {
    const res = await fetch(`${backendUrl}/health`);
    const health = await res.json();
    status.textContent = health.reachable
      ? "Connected. The backend and ActivityWatch are both running."
      : `Connected to the backend, but ActivityWatch isn't running: ${health.detail}`;
  } catch {
    status.textContent = `Can't reach ${backendUrl}. Is the backend running?`;
  }
});
