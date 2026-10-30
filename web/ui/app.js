// @ts-check
/**
 * The FocusGarden page: start/end sessions, show results, review unclear blocks. Tasks are
 * named only here; the Tasks & groups section below (tracker.js) groups them.
 * All work happens in the local program (docs/contracts.md section 2); this file only renders.
 * Page and app titles are untrusted text, so they are only ever set with textContent.
 */

import { api, sessionEvents } from "./api.js";
import { breakdownByApp, distractionSummary, productivitySplit } from "./breakdown.js";
import { LABEL_NAMES, appRows, distractionText, splitView } from "./breakdownView.js";
import { $, formatElapsed, formatMinutes, h } from "./dom.js";
import { PlantView } from "./plant.js";
import { refreshTracker, showTracker } from "./tracker.js";

function showError(err) {
  const box = $("error");
  box.textContent = err ? String(err.message || err) : "";
  box.hidden = !err;
}

/** A warning that isn't an error, e.g. a photo to retake. @param {string} text */
function showNotice(text) {
  const box = $("error");
  box.textContent = text;
  box.hidden = false;
}

const views = ["view-start", "view-result"];
/** Running sessions have their own list above these, so they stay visible. @param {string} name */
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
  const history = /** @type {any[]} */ (await api.getHistory());
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
      await api.startSession({
        task,
        allowlist: splitList(/** @type {HTMLInputElement} */ ($("allowlist")).value),
        blocklist: splitList(/** @type {HTMLInputElement} */ ($("blocklist")).value),
      });
    } else {
      await api.startPaperSession(task);
    }
    /** @type {HTMLInputElement} */ ($("task")).value = "";
    await renderRunning();
    refreshTracker(); // the session's task is now running
    sessionEvents.postMessage({ type: "sessionStarted" });
  } catch (err) {
    showError(err);
  }
});

/* ---------- Running ---------- */

/** Ids of sessions whose Done is being checked by the LLM, so a re-render keeps saying so. */
const ending = new Set();
/** Each card's once-a-second update (timer and growing plant). @type {(() => void)[]} */
let cardTicks = [];
/** @type {PlantView[]} */
let runningPlants = [];
setInterval(() => { for (const tick of cardTicks) tick(); }, 1000);

/** Shows every running session as a card, oldest first. */
async function renderRunning() {
  const running = /** @type {any[]} */ (await api.getActive());
  for (const plant of runningPlants) plant.stop();
  runningPlants = [];
  cardTicks = [];
  $("running-box").hidden = running.length === 0;
  $("running-list").replaceChildren(...running.map(runningCard));
  for (const tick of cardTicks) tick();
}

/** @param {any} active */
function runningCard(active) {
  const paper = active.kind === "paper";
  const timer = h("div", { class: "stat" }, "0:00");
  const canvas = /** @type {HTMLCanvasElement} */ (h("canvas", { class: "plant-canvas" }));
  const plantLabel = h("span", { class: "stat-label" });
  const plantBox = h("div", { class: "plant-stage" }, canvas, plantLabel);
  plantBox.hidden = true;

  const card = h("li", { class: "card stack" },
    h("span", { class: "stat-label" }, paper ? "Paper session" : "Computer session"),
    h("h1", {}, active.task),
    plantBox,
    h("div", {}, timer, h("span", { class: "stat-label" }, "elapsed")),
    ...(paper ? [h("div", { class: "code-box" },
      h("span", { class: "stat-label" }, "Write this at the top of your page"),
      h("div", { class: "code-word" }, active.codeWord || ""))] : []),
    ...(ending.has(active.id) ? checking(paper) : [
      h("p", { class: "muted small" }, paper
        ? "Study on paper. When you're done, press Done and take a photo of the page with the code word."
        : "Work as you normally would. You can close this tab."),
      paper ? photoDone(active) : computerDone(active)]));

  const started = Date.parse(active.start);
  const plant = active.plant;
  const plantView = plant?.gif ? new PlantView(canvas) : null;
  let plantReady = false;
  if (plantView) {
    runningPlants.push(plantView);
    plantView.load(plant.gif).then((ok) => { plantReady = ok; plantBox.hidden = !ok; tick(); });
  }
  const tick = () => {
    const elapsed = Date.now() - started;
    timer.textContent = formatElapsed(elapsed);
    if (!plantReady || !plantView) return;
    // While studying, the plant grows with time. Its final size comes from verified minutes.
    const progress = elapsed / 60000 / plant.minutesToFullGrowth;
    plantView.setProgress(progress);
    plantLabel.textContent = progress >= 1
      ? `Your ${plant.name.toLowerCase()} is fully grown`
      : `Your ${plant.name.toLowerCase()} is growing · ${Math.floor(progress * 100)}%`;
  };
  cardTicks.push(tick);
  return card;
}

/** What a card shows while its Done is being checked. @param {boolean} paper */
const checking = (paper) => [h("p", { class: "center" },
  h("span", { class: "sprout", "aria-hidden": "true" }, "🌱"), " ",
  paper ? "Checking your notes for the code word…" : "Checking your session against your task…")];

/**
 * Runs a session's Done: the card says it's checking (other sessions keep running), then
 * the result is shown, or the error and the card come back so the user can try again.
 * @param {string} id @param {() => Promise<any>} end
 */
async function finishSession(id, end) {
  showError(null);
  ending.add(id);
  await renderRunning();
  try {
    const reply = await end();
    if (reply.completed === false) {
      // The photo failed but the session is still running: let the user try another photo.
      const tries = reply.attemptsRemaining === 1 ? "1 more try" : `${reply.attemptsRemaining} more tries`;
      showNotice(`That photo didn't pass: ${reply.result.reason}. Make sure the code word is clear, `
        + `then press Done and upload another photo (${tries}).`);
    } else {
      saved(reply);
    }
  } catch (err) {
    showError(err); // the session is still running; try again
  } finally {
    ending.delete(id);
    await renderRunning();
  }
}

/** @param {any} active */
function computerDone(active) {
  const button = h("button", { class: "btn", type: "button" }, "Done");
  button.addEventListener("click", () => finishSession(active.id, () => api.endSession(active.id)));
  return button;
}

/** A paper session's Done asks for the photo of the page. @param {any} active */
function photoDone(active) {
  const input = /** @type {HTMLInputElement} */ (h("input", { type: "file",
    accept: "image/jpeg,image/png,image/webp", hidden: "" }));
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    finishSession(active.id, async () =>
      api.endPaperSession(active.id, await toJpegBase64(file), "image/jpeg"));
  });
  return h("label", { class: "btn" }, "Done", input);
}

const resultPlant = new PlantView(/** @type {HTMLCanvasElement} */ ($("result-plant-canvas")));

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

/** Shows a just-saved session and tells other open FocusGarden tabs. @param {any} session */
function saved(session) {
  showResult(session);
  refreshTracker();
  sessionEvents.postMessage({ type: "sessionSaved", session });
}

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
  $("result-split").replaceChildren(...splitView(split));
}

/** @param {{top: {name: string, minutes: number}|null, switches: number}} summary */
function renderDistraction(summary) {
  const line = $("distraction-line");
  line.textContent = distractionText(summary);
  line.hidden = !line.textContent;
}

/** @param {import("./breakdown.js").AppTime[]} apps */
function renderApps(apps) {
  $("apps-box").hidden = apps.length === 0;
  $("app-list").replaceChildren(...appRows(apps));
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
          saved(await api.reviewBlock(sessionId, label.block_id, choice));
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

$("close-btn").addEventListener("click", () => {
  shownSessionId = "";
  showStart();
});

/* ---------- Formatting ---------- */

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

// Another FocusGarden tab started or saved a session: refresh the running list and task stats,
// and the result if it's the one on screen.
sessionEvents.addEventListener("message", ({ data: msg }) => {
  if (msg.type !== "sessionSaved" && msg.type !== "sessionStarted") return;
  renderRunning().catch(showError);
  refreshTracker();
  if (msg.type === "sessionSaved" && msg.session.id === shownSessionId) showResult(msg.session);
});

setMode("computer");
showTracker(showError);
(async () => {
  try {
    await renderRunning();
    await showStart();
  } catch (err) {
    showError(err);
    show("view-start");
  }
})();
