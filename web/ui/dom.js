// @ts-check
/** Tiny DOM helpers shared by the page's modules. Untrusted text only ever becomes text nodes. */

/** @param {string} id */
export const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * Builds an element. Children that are strings become text nodes, never HTML.
 * @param {string} tag @param {Record<string, string>} [attrs] @param {(Node|string)[]} children
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children);
  return el;
}

/** @param {number} minutes */
export function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  if (minutes > 0 && rounded === 0) return "<1 min";
  if (rounded < 60) return `${rounded} min`;
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

/** @param {number} ms */
export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
