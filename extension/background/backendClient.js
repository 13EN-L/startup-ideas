// @ts-check
/** Talks to the FastAPI backend, which holds the Google API key. Format: docs/contracts.md */
import { getConfig } from "./config.js";

/**
 * @typedef {{block_id: string, seconds: number, label: "on_task"|"off_task"|"break"|"unclear",
 *            confidence: number, reason: string,
 *            source: "llm"|"rule"|"override"|"low_confidence"|"unlabeled"|"user"}} FinalLabel
 * @typedef {{total_minutes: number, on_task_minutes: number, off_task_minutes: number,
 *            break_minutes: number, unclear_minutes: number, on_task_pct: number,
 *            longest_streak_minutes: number}} Stats
 * @typedef {{labels: FinalLabel[], stats: Stats, needs_review: string[]}} LabelResponse
 * @typedef {{verified: boolean, credited_minutes: number, reason: string}} PhotoCheckResponse
 */

/** The backend's error detail, e.g. "ActivityWatch is not reachable". @param {Response} res */
export async function errorDetail(res) {
  const text = await res.text();
  try {
    const { detail } = JSON.parse(text);
    if (typeof detail === "string") return detail;
  } catch {}
  return text || res.statusText;
}

/** @param {string} path @param {object} body */
async function post(path, body) {
  const { backendUrl, sharedSecret } = await getConfig();
  const res = await fetch(`${backendUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Flora-Secret": sharedSecret },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`backend ${path} returned ${res.status}: ${await errorDetail(res)}`);
  return res.json();
}

/**
 * @param {{task: string, blocks: import("./localClient.js").ActivityBlock[],
 *          allowlist: string[], blocklist: string[]}} request
 * @returns {Promise<LabelResponse>}
 */
export const labelSession = (request) => post("/label", request);

/**
 * @param {{task: string, code_word: string, minutes: number,
 *          image_base64: string, media_type: string}} request
 * @returns {Promise<PhotoCheckResponse>}
 */
export const checkPhoto = (request) => post("/photo-check", request);
