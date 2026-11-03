// Screenshots one page of the built app, using the in-memory mock API.
//
//   npx electron-vite build
//   node scripts/screenshot.mjs <main|task|garden> <out.png> [--active N] [--port P]
//                               [--width W] [--height H] [--wait MS] [--eval JS]
//
// --eval runs JavaScript in the page before the screenshot (e.g. to click something).
// Uses a throwaway data folder, so the real app's data is never touched.
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [page, out, ...rest] = process.argv.slice(2)
if (!['main', 'task', 'garden'].includes(page) || !out) {
  console.error('Usage: node scripts/screenshot.mjs <main|task|garden> <out.png> [options]')
  process.exit(1)
}
const opt = (name, fallback) => {
  const i = rest.indexOf(`--${name}`)
  return i === -1 ? fallback : rest[i + 1]
}
const port = Number(opt('port', 9340))
const width = Number(opt('width', 900))
const height = Number(opt('height', 670))
const wait = Number(opt('wait', 800))
const active = opt('active', '2')
const script = opt('eval', '')

const root = resolve(import.meta.dirname, '..')
const dataDir = mkdtempSync(join(tmpdir(), 'focusgarden-shot-'))
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = spawn(
  join(root, 'node_modules', '.bin', 'electron'),
  ['.', `--remote-debugging-port=${port}`, `--user-data-dir=${dataDir}`],
  { cwd: root, env, stdio: 'ignore' }
)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function pageTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json()
      const target = targets.find((t) => t.type === 'page')
      if (target) return target
    } catch {
      // not listening yet
    }
    await sleep(250)
  }
  throw new Error('The app did not start')
}

try {
  const ws = new WebSocket((await pageTarget()).webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r))
  let id = 0
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id
      ws.addEventListener('message', function onMessage(event) {
        const msg = JSON.parse(event.data)
        if (msg.id !== msgId) return
        ws.removeEventListener('message', onMessage)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      })
      ws.send(JSON.stringify({ id: msgId, method, params }))
    })
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    })
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description)
    return result.value
  }

  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false
  })
  const url = pathToFileURL(join(root, 'out', 'renderer', 'index.html'))
  url.search = `?mock&page=${page}&active=${active}`
  await send('Page.navigate', { url: url.href })
  await sleep(300)
  await evaluate(
    'document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))))'
  )
  if (script) await evaluate(`(async () => { ${script} })()`)
  await sleep(wait)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(out, Buffer.from(data, 'base64'))
  console.log(`Saved ${out}`)
  ws.close()
} finally {
  app.kill()
  await sleep(300)
  rmSync(dataDir, { recursive: true, force: true })
}
