// @ts-check
/** Talks to Part 1's local backend. Format: docs/contracts.md#activity-window */
import { getConfig } from "./config.js";

/**
 * @typedef {{id: string, start: string, seconds: number, kind: "web"|"app"|"idle",
 *            app?: string, site?: string|null, title?: string|null}} ActivityBlock
 * @typedef {{start: string, end: string, blocks: ActivityBlock[]}} ActivityWindow
 */

/**
 * @param {string} start ISO time
 * @param {string} end ISO time
 * @returns {Promise<ActivityWindow>}
 */
export async function fetchActivity(start, end) {
  const { activityUrl } = await getConfig();
  const url = `${activityUrl}/activity?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`activity backend returned ${res.status}`);
  return res.json();
}
