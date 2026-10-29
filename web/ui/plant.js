// @ts-check
/**
 * Shows a plant GIF at a chosen growth stage instead of letting it loop.
 * Frame 0 is the seed and the last frame is fully grown; progress 0..1 picks the frame.
 * When progress goes up, it plays the frames in between so the plant visibly grows.
 * Uses Chrome's ImageDecoder, which hands back fully drawn GIF frames.
 */

const FRAME_MS = 70;
const MAX_SIZE = 480; // px; big GIFs are shrunk so a tab doesn't hold hundreds of MB of frames
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export class PlantView {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
    this.url = "";
    /** @type {ImageBitmap[]} */
    this.frames = [];
    this.shown = -1;
    this.target = 0;
    this.timer = 0;
  }

  /** Loads a GIF. Returns false if it can't be shown (the caller should fall back). @param {string} url */
  async load(url) {
    if (url === this.url) return this.frames.length > 0;
    this.stop();
    this.url = url;
    this.frames = [];
    this.shown = -1;
    try {
      if (typeof ImageDecoder === "undefined") throw new Error("ImageDecoder unavailable");
      // Plant paths in plants.json are relative to the site root, not ui/.
      const res = await fetch(`/${url}`);
      if (!res.ok) throw new Error(`${url} returned ${res.status}`);
      const decoder = new ImageDecoder({ data: await res.arrayBuffer(), type: "image/gif" });
      await decoder.tracks.ready;
      await decoder.completed;
      const count = decoder.tracks.selectedTrack?.frameCount || 1;
      const frames = [];
      for (let i = 0; i < count; i++) {
        const { image } = await decoder.decode({ frameIndex: i });
        const scale = Math.min(1, MAX_SIZE / Math.max(image.displayWidth, image.displayHeight));
        frames.push(await createImageBitmap(image, {
          resizeWidth: Math.round(image.displayWidth * scale),
          resizeHeight: Math.round(image.displayHeight * scale),
          resizeQuality: "high",
        }));
        image.close();
      }
      decoder.close();
      if (url !== this.url) return false; // another load started meanwhile
      this.frames = frames;
      this.canvas.width = frames[0].width;
      this.canvas.height = frames[0].height;
      return true;
    } catch (err) {
      console.warn("plant GIF could not be loaded", url, err);
      return false;
    }
  }

  /**
   * @param {number} progress 0 (seed) to 1 (fully grown)
   * @param {{animate?: boolean}} [options] animate from the current frame (default true)
   */
  setProgress(progress, { animate = true } = {}) {
    if (!this.frames.length) return;
    const last = this.frames.length - 1;
    this.target = Math.round(Math.min(1, Math.max(0, progress)) * last);
    if (!animate || reducedMotion.matches || this.shown < 0 && this.target === 0) {
      this.stop();
      this.draw(this.target);
      return;
    }
    if (this.timer || this.target === this.shown) return; // already heading there
    if (this.shown < 0) this.draw(0);
    this.timer = setInterval(() => {
      if (this.shown === this.target) return this.stop();
      this.draw(this.shown + (this.target > this.shown ? 1 : -1));
    }, FRAME_MS);
  }

  stop() {
    clearInterval(this.timer);
    this.timer = 0;
  }

  /** @param {number} index */
  draw(index) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this.frames[index], 0, 0);
    this.shown = index;
  }
}
