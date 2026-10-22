// @ts-check
/** Session history lives only in the user's browser (no accounts). */

/**
 * @typedef {{id: string, kind: "computer"|"paper", task: string, start: string, end: string,
 *            result: any, plant: import("./plantRules.js").Plant, blocks?: object[]}} SavedSession
 */

/** @param {SavedSession} session */
export async function saveSession(session) {
  const history = await getHistory();
  history.push(session);
  await chrome.storage.local.set({ history });
}

/** Replaces a saved session with the same id. @param {SavedSession} session */
export async function updateSession(session) {
  const history = (await getHistory()).map((s) => (s.id === session.id ? session : s));
  await chrome.storage.local.set({ history });
}

/** @returns {Promise<SavedSession[]>} */
export async function getHistory() {
  const { history } = await chrome.storage.local.get("history");
  return history || [];
}

/** The running session survives the service worker being shut down. */
export async function getActive() {
  const { active } = await chrome.storage.local.get("active");
  return active || null;
}

/** @param {object|null} active */
export async function setActive(active) {
  if (active) await chrome.storage.local.set({ active });
  else await chrome.storage.local.remove("active");
}
