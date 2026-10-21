// @ts-check
/** Where Part 2 sends data. Settings saved by the options page (Part 3) override these. */

export const DEFAULTS = {
  backendUrl: "http://127.0.0.1:8000", // FastAPI backend (Render URL once deployed)
  activityUrl: "http://127.0.0.1:5601", // Part 1's local activity backend
  sharedSecret: "", // must match FLORA_SHARED_SECRET on the backend
};

/** @returns {Promise<typeof DEFAULTS>} */
export async function getConfig() {
  const { settings } = await chrome.storage.local.get("settings");
  return { ...DEFAULTS, ...(settings || {}) };
}
