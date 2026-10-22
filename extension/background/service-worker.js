// @ts-check
/**
 * Part 2 background service worker. Webpages can't reach it, and the Google API key
 * never reaches the extension (it lives on the backend).
 *
 * Messages from the UI (chrome.runtime.sendMessage), each answered with {ok, data|error}:
 *   {type: "startSession", task, allowlist?, blocklist?}
 *   {type: "endSession"}
 *   {type: "startPaperSession", task}            -> {codeWord}
 *   {type: "endPaperSession", imageBase64, mediaType}
 *   {type: "reviewBlock", sessionId, blockId, label}  -> the updated session
 *   {type: "getActive"} / {type: "getHistory"}
 * Broadcast when a result is saved: {type: "sessionSaved", session}
 */
import { checkPhoto, labelSession } from "./backendClient.js";
import { getConfig } from "./config.js";
import { effectiveBlocklist } from "./distracting.js";
import { fetchActivity } from "./localClient.js";
import { choosePlant, plantFor } from "./plantRules.js";
import { computeStats } from "./stats.js";
import { getActive, getHistory, saveSession, setActive, updateSession } from "./storage.js";

const CODE_WORDS = ["maple", "otter", "comet", "pebble", "lantern", "cedar", "harbor",
  "violet", "summit", "willow", "ember", "canyon", "meadow", "falcon", "glacier", "orchid"];
const MAX_PAPER_PHOTO_ATTEMPTS = 2;

function randomCodeWord() {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return CODE_WORDS[n % CODE_WORDS.length];
}

/** @param {any} msg */
async function handle(msg) {
  switch (msg.type) {
    case "startSession": {
      if (await getActive()) throw new Error("a session is already running");
      const allowlist = msg.allowlist || [];
      const { distractingSites } = await getConfig();
      await setActive({ kind: "computer", task: msg.task, start: new Date().toISOString(),
                        allowlist,
                        blocklist: effectiveBlocklist(distractingSites, msg.blocklist || [], allowlist),
                        plant: await choosePlant() });
      return null;
    }
    case "endSession": {
      const active = await requireActive("computer");
      const end = new Date().toISOString();
      const window = await fetchActivity(active.start, end);
      const result = await labelSession({ task: active.task, blocks: window.blocks,
                                          allowlist: active.allowlist, blocklist: active.blocklist });
      return finish(active, end, result, plantFor(active.plant, result.stats.on_task_minutes),
                    window.blocks);
    }
    case "startPaperSession": {
      if (await getActive()) throw new Error("a session is already running");
      const codeWord = randomCodeWord();
      await setActive({ kind: "paper", task: msg.task, start: new Date().toISOString(),
                        codeWord, photoAttempts: 0, plant: await choosePlant() });
      return { codeWord };
    }
    case "endPaperSession": {
      const active = await requireActive("paper");
      const end = new Date().toISOString();
      const minutes = (Date.parse(end) - Date.parse(active.start)) / 60000;
      let result;
      try {
        result = await checkPhoto({ task: active.task, code_word: active.codeWord, minutes,
                                    image_base64: msg.imageBase64, media_type: msg.mediaType });
      } catch (error) {
        result = { verified: false, credited_minutes: 0,
                   reason: `photo check unavailable: ${String(error.message || error)}` };
      }
      const attempts = (active.photoAttempts || 0) + 1;
      if (!result.verified && attempts < MAX_PAPER_PHOTO_ATTEMPTS) {
        await setActive({ ...active, photoAttempts: attempts });
        return { completed: false, retryable: true,
                 attemptsRemaining: MAX_PAPER_PHOTO_ATTEMPTS - attempts, result };
      }
      return finish(active, end, result, plantFor(active.plant, result.credited_minutes));
    }
    case "reviewBlock":
      return reviewBlock(msg.sessionId, msg.blockId, msg.label);
    case "getActive":
      return getActive();
    case "getHistory":
      return getHistory();
    default:
      throw new Error(`unknown message type: ${msg.type}`);
  }
}

/** @param {"computer"|"paper"} kind */
async function requireActive(kind) {
  const active = await getActive();
  if (!active || active.kind !== kind) throw new Error(`no ${kind} session is running`);
  return active;
}

/**
 * The user's decision on a block from the review screen. Stats are recomputed by
 * code, and only on_task / off_task / break are accepted.
 */
async function reviewBlock(sessionId, blockId, label) {
  if (!["on_task", "off_task", "break"].includes(label)) throw new Error(`invalid label: ${label}`);
  const session = (await getHistory()).find((s) => s.id === sessionId);
  if (!session || session.kind !== "computer") throw new Error("session not found");
  const result = session.result;
  const item = result.labels.find((l) => l.block_id === blockId);
  if (!item) throw new Error("block not found");
  Object.assign(item, { label, confidence: 1, source: "user", reason: "you reviewed this" });
  result.needs_review = result.needs_review.filter((id) => id !== blockId);
  result.stats = computeStats(result.labels);
  session.plant = plantFor(session.plant, result.stats.on_task_minutes);
  await updateSession(session);
  chrome.runtime.sendMessage({ type: "sessionSaved", session }).catch(() => {});
  return session;
}

/** Saves the validated result, clears the active session, and tells the UI. */
async function finish(active, end, result, plant, blocks) {
  const session = { id: crypto.randomUUID(), kind: active.kind, task: active.task,
                    start: active.start, end, result, plant };
  if (blocks) session.blocks = blocks; // so the review screen can show what each block was
  await saveSession(session);
  await setActive(null);
  chrome.runtime.sendMessage({ type: "sessionSaved", session }).catch(() => {}); // no UI open
  return session;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false; // only our own pages
  handle(msg).then(
    (data) => sendResponse({ ok: true, data }),
    (err) => sendResponse({ ok: false, error: String(err.message || err) }),
  );
  return true; // keep the channel open for the async response
});
