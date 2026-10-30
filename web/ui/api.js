// @ts-check
/**
 * The page's only connection to the FocusGarden program, which serves this page and does
 * all session work (backend/app/sessions.py). Formats: docs/contracts.md section 2.
 */

/**
 * @typedef {{block_id: string, seconds: number, label: "on_task"|"off_task"|"break"|"unclear",
 *            confidence: number, reason: string,
 *            source: "llm"|"rule"|"override"|"low_confidence"|"unlabeled"|"user"}} FinalLabel
 * @typedef {{total_minutes: number, on_task_minutes: number, off_task_minutes: number,
 *            break_minutes: number, unclear_minutes: number, on_task_pct: number,
 *            longest_streak_minutes: number}} Stats
 */

/** The program's error detail, e.g. "ActivityWatch is not reachable". @param {Response} res */
async function errorDetail(res) {
  const text = await res.text();
  try {
    const { detail } = JSON.parse(text);
    if (typeof detail === "string") return detail;
  } catch {}
  return text || res.statusText;
}

/** @param {string} method @param {string} path @param {object} [body] */
async function request(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error("Can't reach FocusGarden. Make sure it's running in the system tray.");
  }
  if (!res.ok) throw new Error(await errorDetail(res));
  return res.json();
}

export const api = {
  /** The running sessions, oldest first; several tasks can run at once. */
  getActive: () => request("GET", "/api/active"),
  getHistory: () => request("GET", "/api/history"),
  /** @param {{task: string, allowlist: string[], blocklist: string[]}} body */
  startSession: (body) => request("POST", "/api/sessions", body),
  /** @param {string} id the running session's id */
  endSession: (id) => request("POST", `/api/sessions/${encodeURIComponent(id)}/end`),
  /** @param {string} task @returns {Promise<{codeWord: string}>} */
  startPaperSession: (task) => request("POST", "/api/paper-sessions", { task }),
  /** @param {string} id @param {string} imageBase64 @param {string} mediaType */
  endPaperSession: (id, imageBase64, mediaType) =>
    request("POST", `/api/paper-sessions/${encodeURIComponent(id)}/end`, { imageBase64, mediaType }),
  /** @param {string} sessionId @param {string} blockId @param {string} label */
  reviewBlock: (sessionId, blockId, label) => request("POST",
    `/api/sessions/${encodeURIComponent(sessionId)}/blocks/${encodeURIComponent(blockId)}/review`,
    { label }),
  getSettings: () => request("GET", "/api/settings"),
  /** @param {{distractingSites: string[]}} settings */
  saveSettings: (settings) => request("PUT", "/api/settings", settings),
  health: () => request("GET", "/health"),

  /**
   * Tasks & groups totals and stats; `since` is the start of the local day. Tasks are created
   * by starting a session, never directly. @param {string} since
   */
  getTracker: (since) => request("GET", `/api/tracker?since=${encodeURIComponent(since)}`),
  /** @param {string} id @param {{name?: string, tags?: string[]}} changes */
  editTask: (id, changes) => request("PATCH", `/api/tracker/tasks/${encodeURIComponent(id)}`, changes),
  /** @param {string} id */
  deleteTask: (id) => request("DELETE", `/api/tracker/tasks/${encodeURIComponent(id)}`),
};

/** Lets other open FocusGarden tabs refresh when a session is saved. */
export const sessionEvents = new BroadcastChannel("focusgarden");
