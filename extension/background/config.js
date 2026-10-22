// @ts-check
/** Where Part 2 sends data. Settings saved by the options page (Part 3) override these. */
import { DEFAULT_DISTRACTING_SITES } from "./distracting.js";

export const DEFAULTS = {
  backendUrl: "http://127.0.0.1:8765", // unified local backend
  activityUrl: "http://127.0.0.1:8765", // retained as a settings migration alias
  sharedSecret: "", // must match FLORA_SHARED_SECRET on the backend
  distractingSites: DEFAULT_DISTRACTING_SITES, // always off-task unless allowlisted
};

/** @returns {Promise<typeof DEFAULTS>} */
export async function getConfig() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}
