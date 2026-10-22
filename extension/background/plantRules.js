// @ts-check
/**
 * Picks a plant for each session and turns verified minutes into growth.
 * Plants are configured in extension/plants/plants.json (see the README there).
 * Code decides growth from validated stats, never the LLM.
 */

const DEFAULT_MINUTES = 60;

/**
 * @typedef {{name: string, gif: string|null, minutesToFullGrowth: number}} PlantChoice
 * @typedef {PlantChoice & {minutes: number, progress: number, percent: number, minutesLeft: number}} Plant
 *   progress runs from 0 (seed, first frame) to 1 (fully grown, last frame); percent is
 *   progress rounded down, so 100 only means fully grown; minutesLeft is on-task minutes to go
 */

/** @returns {Promise<PlantChoice|null>} a random plant from plants.json, or null if none */
export async function choosePlant() {
  let config;
  try {
    const res = await fetch(chrome.runtime.getURL("plants/plants.json"));
    config = await res.json();
  } catch {
    return null; // missing or invalid plants.json: the UI falls back to an emoji
  }
  const plants = Array.isArray(config.plants) ? config.plants.filter((p) => p && p.file) : [];
  if (!plants.length) return null;
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  const plant = plants[n % plants.length];
  return {
    name: plant.name || plant.file.replace(/\.gif$/i, ""),
    gif: `plants/${plant.file}`,
    minutesToFullGrowth: Number(plant.minutesToFullGrowth || config.minutesToFullGrowth)
      || DEFAULT_MINUTES,
  };
}

/**
 * @param {PlantChoice|null|undefined} choice the plant picked when the session started
 * @param {number} minutes verified on-task (or credited paper) minutes
 * @returns {Plant}
 */
export function plantFor(choice, minutes) {
  const name = choice?.name || "Plant";
  const gif = choice?.gif || null;
  const full = choice?.minutesToFullGrowth || DEFAULT_MINUTES;
  const progress = Math.min(1, Math.max(0, minutes / full));
  return { name, gif, minutesToFullGrowth: full, minutes, progress,
           percent: Math.floor(progress * 100), minutesLeft: Math.max(0, full - minutes) };
}
