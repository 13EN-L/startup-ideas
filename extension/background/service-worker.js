// @ts-check
/**
 * Part 2 background service worker. Webpages can't reach it, and the Claude key
 * never reaches the extension (it lives on the backend).
 *
 * Messages from the UI (chrome.runtime.sendMessage), each answered with {ok, data|error}:
 *   {type: "startSession", task, allowlist?, blocklist?}
 *   {type: "endSession"}
 *   {type: "startPaperSession", task}            -> {codeWord}
 *   {type: "endPaperSession", imageBase64, mediaType}
 *   {type: "getActive"} / {type: "getHistory"}
 * Broadcast when a result is saved: {type: "sessionSaved", session}
 */
import { checkPhoto, labelSession } from "./backendClient.js";
import { fetchActivity } from "./localClient.js";
import { plantFor } from "./plantRules.js";
import { getActive, getHistory, saveSession, setActive } from "./storage.js";

const CODE_WORDS = ["maple", "otter", "comet", "pebble", "lantern", "cedar", "harbor",
  "violet", "summit", "willow", "ember", "canyon", "meadow", "falcon", "glacier", "orchid"];

function randomCodeWord() {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return CODE_WORDS[n % CODE_WORDS.length];
}

/** @param {any} msg */
async function handle(msg) {
  switch (msg.type) {
    case "startSession": {
      if (await getActive()) throw new Error("a session is already running");
      await setActive({ kind: "computer", task: msg.task, start: new Date().toISOString(),
                        allowlist: msg.allowlist || [], blocklist: msg.blocklist || [] });
      return null;
    }
    case "endSession": {
      const active = await requireActive("computer");
      const end = new Date().toISOString();
      const window = await fetchActivity(active.start, end);
      const result = await labelSession({ task: active.task, blocks: window.blocks,
                                          allowlist: active.allowlist, blocklist: active.blocklist });
      return finish(active, end, result, plantFor("computer", result.stats.on_task_minutes));
    }
    case "startPaperSession": {
      if (await getActive()) throw new Error("a session is already running");
      const codeWord = randomCodeWord();
      await setActive({ kind: "paper", task: msg.task, start: new Date().toISOString(), codeWord });
      return { codeWord };
    }
    case "endPaperSession": {
      const active = await requireActive("paper");
      const end = new Date().toISOString();
      const minutes = (Date.parse(end) - Date.parse(active.start)) / 60000;
      const result = await checkPhoto({ task: active.task, code_word: active.codeWord, minutes,
                                        image_base64: msg.imageBase64, media_type: msg.mediaType });
      return finish(active, end, result, plantFor("paper", result.credited_minutes));
    }
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

/** Saves the validated result, clears the active session, and tells the UI. */
async function finish(active, end, result, plant) {
  const session = { id: crypto.randomUUID(), kind: active.kind, task: active.task,
                    start: active.start, end, result, plant };
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
