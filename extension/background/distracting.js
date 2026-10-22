// @ts-check
/**
 * Sites that always count as off-task, whatever the AI thinks. Users can edit the list in
 * Settings; it's sent to /label as part of the blocklist, so the backend applies it.
 * Matching is by site, so YouTube and Reddit are left to the AI (they're often study tools).
 */

export const DEFAULT_DISTRACTING_SITES = [
  "instagram.com", "tiktok.com", "facebook.com", "x.com", "twitter.com", "snapchat.com",
];

/**
 * The blocklist sent for a session: the distracting sites plus the session's own blocklist,
 * minus anything on the session's allowlist. Lowercased, sorted, no duplicates.
 * @param {string[]} distracting @param {string[]} blocklist @param {string[]} allowlist
 * @returns {string[]}
 */
export function effectiveBlocklist(distracting, blocklist, allowlist) {
  const clean = (/** @type {string[]} */ list) => list.map((s) => s.trim().toLowerCase()).filter(Boolean);
  const allowed = new Set(clean(allowlist));
  return [...new Set(clean([...distracting, ...blocklist]))].filter((s) => !allowed.has(s)).sort();
}
