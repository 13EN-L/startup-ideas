// @ts-check
/**
 * The popup: start/end sessions, show results, review unclear blocks.
 * All work happens in the service worker (docs/contracts.md section 2); this file only renders.
 * Page and app titles are untrusted text, so they are only ever set with textContent.
 */

import { breakdownByApp, distractionSummary, productivitySplit } from "../background/breakdown.js";
import { PlantView } from "./plant.js";

const LABEL_NAMES = { on_task: "On task", off_task: "Off task", break: "Break", unclear: "Unclear" };
const inTab = new URLSearchParams(location.search).has("tab");

/** @param {string} id */
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

/**
 * Builds an element. Children that are strings become text nodes, never HTML.
 * @param {string} tag @param {Record<string, string>} [attrs] @param {(Node|string)[]} children
 */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  el.append(...children);
  return el;
}

/** Sends a message to the service worker and unwraps {ok, data|error}. @param {object} msg */
async function send(msg) {
  const reply = await chrome.runtime.sendMessage(msg);
  if (!reply) throw new Error("The extension's background worker didn't answer. Try reloading it.");
  if (!reply.ok) throw new Error(reply.error);
  return reply.data;
}

function showError(err) {
  const box = $("error");
  box.textContent = err ? friendly(String(err.message || err)) : "";
  box.hidden = !err;
}

/** Turns raw fetch/backend failures into something a student can act on. @param {string} message */
function friendly(message) {
  if (message.includes("Failed to fetch")) {
    return "Can't reach the FocusGarden backend. Make sure it's running, and check the address in Settings.";
  }
  if (message.includes("401")) return "The backend rejected the shared secret. Check it in Settings.";
  return message;
}

/** A warning that isn't an error, e.g. a photo to retake. @param {string} text */
function showNotice(text) {
  const box = $("error");
  box.textContent = text;
  box.hidden = false;
}

const views = ["view-start", "view-running", "view-working", "view-result"];
/** @param {string} name */
function show(name) {
  for (const view of views) $(view).hidden = view !== name;
}

/* ---------- Start ---------- */

let mode = /** @type {"computer"|"paper"} */ ("computer");

function setMode(next) {
  mode = next;
  $("mode-computer").setAttribute("aria-selected", String(mode === "computer"));
  $("mode-paper").setAttribute("aria-selected", String(mode === "paper"));
  $("lists").hidden = mode === "paper";
  $("paper-hint").hidden = mode === "computer";
  $("start-btn").textContent = mode === "computer" ? "Start session" : "Start paper session";
}

/** @param {string} value */
const splitList = (value) => value.split(",").map((s) => s.trim()).filter(Boolean);

async function showStart() {
  show("view-start");
  const history = /** @type {any[]} */ (await send({ type: "getHistory" }));
  const list = $("history");
  list.replaceChildren();
  for (const session of history.slice(-5).reverse()) {
    const minutes = session.kind === "computer"
      ? session.result.stats.on_task_minutes
      : session.result.credited_minutes;
    const button = h("button", { type: "button" },
      h("span", { class: "task" }, session.task),
      h("span", { class: "muted" }, `${plantEmoji(session.plant)} ${formatMinutes(minutes)}`));
    button.addEventListener("click", () => showResult(session));
    list.append(h("li", {}, button));
  }
  $("history-empty").hidden = history.length > 0;
  /** @type {HTMLInputElement} */ ($("task")).focus();
}

$("mode-computer").addEventListener("click", () => setMode("computer"));
$("mode-paper").addEventListener("click", () => setMode("paper"));

$("start-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(null);
  const task = /** @type {HTMLInputElement} */ ($("task")).value.trim();
  if (!task) return;
  try {
    if (mode === "computer") {
      await send({
        type: "startSession",
        task,
        allowlist: splitList(/** @type {HTMLInputElement} */ ($("allowlist")).value),
        blocklist: splitList(/** @type {HTMLInputElement} */ ($("blocklist")).value),
      });
    } else {
      await send({ type: "startPaperSession", task });
    }
    showRunning(await send({ type: "getActive" }));
  } catch (err) {
    showError(err);
  }
});

/* ---------- Running ---------- */

let timer = 0;

/** @param {any} active */
function showRunning(active) {
  show("view-running");
  const paper = active.kind === "paper";
  $("running-kind").textContent = paper ? "Paper session" : "Computer session";
  $("running-task").textContent = active.task;
  $("code-word-box").hidden = !paper;
  $("code-word").textContent = active.codeWord || "";
  $("running-hint").textContent = paper
    ? "Study on paper. When you're done, take a photo of the page with the code word."
    : "Work as you normally would. You can close this popup.";
  $("end-btn").hidden = paper;
  // A file picker can close the popup, so photo upload happens in a full tab.
  $("photo-label").hidden = !paper || !inTab;
  $("open-tab-btn").hidden = !paper || inTab;

  const started = Date.parse(active.start);
  const plant = active.plant;
  $("running-plant-box").hidden = true;
  let plantReady = false;
  if (plant?.gif) {
    runningPlant.load(plant.gif).then((ok) => {
      plantReady = ok;
      $("running-plant-box").hidden = !ok;
      tick();
    });
  }
  const tick = () => {
    const elapsed = Date.now() - started;
    $("timer").textContent = formatElapsed(elapsed);
    if (!plantReady) return;
    // While studying, the plant grows with time. Its final size comes from verified minutes.
    const progress = elapsed / 60000 / plant.minutesToFullGrowth;
    runningPlant.setProgress(progress);
    $("running-plant-label").textContent = progress >= 1
      ? `Your ${plant.name.toLowerCase()} is fully grown`
      : `Your ${plant.name.toLowerCase()} is growing · ${Math.floor(progress * 100)}%`;
  };
  clearInterval(timer);
  tick();
  timer = setInterval(tick, 1000);
}

const runningPlant = new PlantView(/** @type {HTMLCanvasElement} */ ($("running-plant")));
const resultPlant = new PlantView(/** @type {HTMLCanvasElement} */ ($("result-plant-canvas")));

$("end-btn").addEventListener("click", async () => {
  showError(null);
  clearInterval(timer);
  show("view-working");
  $("working-text").textContent = "Checking your session against your task…";
  try {
    showResult(await send({ type: "endSession" }));
  } catch (err) {
    showError(err);
    showRunning(await send({ type: "getActive" })); // the session is still running; try again
  }
});

$("open-tab-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("ui/popup.html?tab=1") });
  window.close();
});

$("photo").addEventListener("change", async (event) => {
  const input = /** @type {HTMLInputElement} */ (event.target);
  const file = input.files && input.files[0];
  input.value = "";
  if (!file) return;
  showError(null);
  clearInterval(timer);
  show("view-working");
  $("working-text").textContent = "Checking your notes for the code word…";
  try {
    const imageBase64 = await toJpegBase64(file);
    const reply = await send({ type: "endPaperSession", imageBase64, mediaType: "image/jpeg" });
    if (reply.completed === false) {
      // The photo failed but the session is still running: let the user try another photo.
      showRunning(await send({ type: "getActive" }));
      const tries = reply.attemptsRemaining === 1 ? "1 more try" : `${reply.attemptsRemaining} more tries`;
      showNotice(`That photo didn't pass: ${reply.result.reason}. Make sure the code word is clear, `
        + `then upload another photo (${tries}).`);
      return;
    }
    showResult(reply);
  } catch (err) {
    showError(err);
    showRunning(await send({ type: "getActive" }));
  }
});

/**
 * Phone photos are large; shrink to 1600px on the long side so the upload stays well
 * under the LLM's image limit. @param {File} file
 */
async function toJpegBase64(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't open that image. Use a JPEG, PNG or WebP photo.");
  }
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"))
    .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/* ---------- Results ---------- */

let shownSessionId = "";

/** @param {any} session */
function showResult(session) {
  show("view-result");
  shownSessionId = session.id;
  $("result-task").textContent = session.task;
  $("result-date").textContent = new Date(session.start).toLocaleString([], {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  $("result-plant").textContent = plantLine(session.plant);
  $("result-plant-box").hidden = true;
  const plant = session.plant;
  if (plant?.gif) {
    resultPlant.load(plant.gif).then((ok) => {
      if (!ok || shownSessionId !== session.id) return;
      $("result-plant-box").hidden = false;
      resultPlant.setProgress(plant.progress);
    });
  }
  renderGrowth(plant);
  if (session.kind === "paper") renderPaper(session);
  else renderComputer(session);
}

/** @param {any} session */
function renderComputer(session) {
  const { labels, stats, needs_review: needsReview } = session.result;
  $("result-stats").replaceChildren(
    statTile(formatMinutes(stats.on_task_minutes), "on task"),
    statTile(`${Math.round(stats.on_task_pct)}%`, "of your time"),
    statTile(formatMinutes(stats.longest_streak_minutes), "longest focus"),
  );
  renderSplit(productivitySplit(labels));
  renderDistraction(distractionSummary(labels, session.blocks || []));
  renderApps(breakdownByApp(labels, session.blocks || []));
  $("paper-reason").hidden = true;

  const blocks = new Map((session.blocks || []).map((b) => [b.id, b]));
  const reviewIds = new Set(needsReview);
  $("review-box").hidden = reviewIds.size === 0;
  $("review-list").replaceChildren(...labels
    .filter((l) => reviewIds.has(l.block_id))
    .map((l) => blockItem(l, blocks.get(l.block_id), session.id)));
  $("blocks-title").hidden = false;
  $("block-list").replaceChildren(...labels
    .filter((l) => !reviewIds.has(l.block_id))
    .map((l) => blockItem(l, blocks.get(l.block_id), null)));
}

/** @param {any} session */
function renderPaper(session) {
  const { verified, credited_minutes: credited, reason } = session.result;
  $("result-stats").replaceChildren(
    statTile(formatMinutes(credited), "credited"),
    statTile(verified ? "Yes" : "No", "verified"),
    statTile(formatMinutes((Date.parse(session.end) - Date.parse(session.start)) / 60000), "studied"),
  );
  $("result-split").hidden = true;
  $("distraction-line").hidden = true;
  $("apps-box").hidden = true;
  $("review-box").hidden = true;
  $("blocks-title").hidden = true;
  $("block-list").replaceChildren();
  $("paper-reason").hidden = false;
  $("paper-reason").textContent = verified
    ? "Code word and notes found, so you get full credit."
    : credited > 0
      ? `Partial credit: ${reason}.`
      : `No credit this time: ${reason}.`;
}

/** @param {{productive: number, distracting: number, other: number}} split */
function renderSplit(split) {
  $("result-split").hidden = false;
  const parts = /** @type {const} */ ([
    ["productive", "productive"], ["distracting", "distracting"], ["other", "break or unclear"],
  ]);
  for (const [key] of parts) $(`seg-${key}`).style.width = `${split[key]}%`;
  $("split-legend").replaceChildren(...parts.map(([key, caption]) =>
    h("li", {}, h("span", { class: `dot dot-${key}` }), h("strong", {}, `${Math.round(split[key])}%`),
      caption)));
}

/** @param {{top: {name: string, minutes: number}|null, switches: number}} summary */
function renderDistraction({ top, switches }) {
  const line = $("distraction-line");
  const parts = [];
  if (top) parts.push(`Biggest distraction: ${top.name} (${formatMinutes(top.minutes)})`);
  if (switches) parts.push(`switched off-task ${switches === 1 ? "once" : `${switches} times`}`);
  line.textContent = parts.join(" · ");
  line.hidden = parts.length === 0;
}

/** @param {import("../background/breakdown.js").AppTime[]} apps */
function renderApps(apps) {
  $("apps-box").hidden = apps.length === 0;
  $("app-list").replaceChildren(...apps.map((app) => {
    const bar = h("span", { class: `app-bar-${app.label}` });
    bar.style.width = `${app.pct}%`;
    return h("li", { class: "app" },
      h("span", { class: "app-name", title: app.name }, app.name),
      h("span", { class: "app-time" },
        `${formatMinutes(app.minutes)} · ${Math.round(app.pct)}% · ${LABEL_NAMES[app.label] || app.label}`),
      h("div", { class: "app-track" }, bar));
  }));
}

/** Growth as a percent, plus the on-task minutes left to full growth. @param {any} plant */
function renderGrowth(plant) {
  const percent = plant?.percent ?? Math.floor(plantProgress(plant) * 100);
  const left = plant?.minutesLeft
    ?? (plant?.minutesToFullGrowth ? Math.max(0, plant.minutesToFullGrowth - (plant.minutes || 0)) : null);
  $("growth-box").hidden = !plant;
  $("growth-bar").style.width = `${percent}%`;
  $("growth-label").textContent = percent >= 100 ? "Plant growth: 100%, fully grown"
    : left == null ? `Plant growth: ${percent}%`
    : `Plant growth: ${percent}% · ${formatMinutes(left)} more on-task to full growth`;
}

/**
 * One labeled block. With a sessionId it gets review buttons.
 * @param {any} label @param {any} block @param {string|null} sessionId
 */
function blockItem(label, block, sessionId) {
  const what = !block ? label.block_id
    : block.kind === "idle" ? "Away from the computer"
    : block.title || block.site || block.app || "Untitled";
  const where = !block || block.kind === "idle" ? "" : block.site || block.app || "";
  const item = h("li", { class: "block" },
    h("div", { class: "block-head" },
      h("span", { class: "block-title" }, what),
      h("span", { class: `chip chip-${label.label}` }, LABEL_NAMES[label.label] || label.label)),
    h("span", { class: "block-meta" },
      [where, formatMinutes(label.seconds / 60), label.reason].filter(Boolean).join(" · ")));

  if (sessionId) {
    const actions = h("div", { class: "review-actions" });
    for (const choice of ["on_task", "off_task", "break"]) {
      const button = h("button", { type: "button", class: "btn btn-secondary" }, LABEL_NAMES[choice]);
      button.addEventListener("click", async () => {
        showError(null);
        try {
          showResult(await send({ type: "reviewBlock", sessionId, blockId: label.block_id, label: choice }));
        } catch (err) {
          showError(err);
        }
      });
      actions.append(button);
    }
    item.append(actions);
  }
  return item;
}

/** @param {string} value @param {string} caption */
function statTile(value, caption) {
  return h("div", {}, h("div", { class: "stat" }, value), h("span", { class: "stat-label" }, caption));
}

$("done-btn").addEventListener("click", () => {
  shownSessionId = "";
  if (inTab) window.close();
  else showStart();
});

/* ---------- Formatting ---------- */

/** @param {number} minutes */
function formatMinutes(minutes) {
  const rounded = Math.round(minutes);
  if (minutes > 0 && rounded === 0) return "<1 min";
  if (rounded < 60) return `${rounded} min`;
  return `${Math.floor(rounded / 60)}h ${rounded % 60}m`;
}

/** @param {number} ms */
function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** Growth as 0..1. Sessions saved before plant GIFs used {growth} steps of 15 minutes. @param {any} plant */
const plantProgress = (plant) => plant?.progress ?? Math.min(1, (plant?.growth || 0) / 4);

/** @param {any} plant */
const plantEmoji = (plant) => {
  const progress = plantProgress(plant);
  return progress >= 1 ? "🌻" : progress >= 0.5 ? "🪴" : progress > 0 ? "🌿" : "🌱";
};

/** @param {any} plant */
function plantLine(plant) {
  const progress = plantProgress(plant);
  const name = (plant?.name || plant?.species || "plant").toLowerCase();
  if (progress <= 0) return "Not enough on-task time to grow your plant this time.";
  if (progress >= 1) return `Your ${name} is fully grown!`;
  return `Your ${name} grew to ${Math.round(progress * 100)}% from on-task time.`;
}

/* ---------- Start up ---------- */

$("open-settings").addEventListener("click", () => chrome.runtime.openOptionsPage());

// Another view (or the tab) saved a session: refresh if it's the one on screen.
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "sessionSaved" && msg.session.id === shownSessionId) showResult(msg.session);
});

if (inTab) document.body.classList.add("in-tab");
setMode("computer");
(async () => {
  try {
    const active = await send({ type: "getActive" });
    if (active) showRunning(active);
    else await showStart();
  } catch (err) {
    showError(err);
    show("view-start");
  }
})();
