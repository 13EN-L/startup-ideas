// @ts-check
/**
 * PLACEHOLDER for Part 3: turns verified minutes into garden growth.
 * Code decides growth from validated stats, never the LLM. Replace freely.
 */

/**
 * @param {"computer"|"paper"} kind
 * @param {number} onTaskMinutes verified on-task (or credited paper) minutes
 * @returns {{species: string, growth: number}}
 */
export function plantFor(kind, onTaskMinutes) {
  return {
    species: kind === "paper" ? "fern" : "sunflower",
    growth: Math.floor(onTaskMinutes / 15), // one growth step per 15 verified minutes
  };
}
