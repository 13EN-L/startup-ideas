# FocusGarden Chrome extension

The extension is the browser-facing half of FocusGarden. It owns the popup,
settings page, service worker, browser-local session history, and plant
display. It does not contain a Google API key and does not call Gemini
directly.

## Load it in Chrome

1. Start the packaged `FocusGardenLocalBackend.exe` from the separate
   [`backend/`](../backend/) project.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this `extension` directory.
5. Open the extension's **Settings** page and confirm:
   - Backend address: `http://127.0.0.1:8765`
   - Shared secret: blank unless the backend was started with `--token`
6. Click **Test connection**. The backend must be running and ActivityWatch
   must be reachable.

The Google API key is configured through the local program's system-tray
menu, **Set Google API key**. It remains local to the backend.

## Session flow

- **Computer session:** the service worker requests `/activity`, then sends
  the privacy-filtered blocks to `/label` when the session ends.
- **Paper session:** the service worker sends the resized photo to
  `/photo-check`; the backend decides whether the time is verified.
- **Review:** unclear computer blocks can be resolved in the popup. The
  service worker recomputes statistics locally after the user's decision.
- **Garden:** the extension selects a plant and computes growth from verified
  minutes. Gemini never controls plant growth.

The service worker is the only extension module that talks to the backend.
The popup communicates with it using `chrome.runtime.sendMessage`; UI code
does not make backend requests directly.
