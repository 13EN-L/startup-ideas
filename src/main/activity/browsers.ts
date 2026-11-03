export type Browser =
  'chrome' | 'safari' | 'firefox' | 'edge' | 'brave' | 'arc' | 'opera' | 'vivaldi'

// Matched against the lowercased app name with any `.exe` or `.app` suffix removed, which
// covers macOS names ("Google Chrome"), Windows process names ("chrome.exe") and Linux ones.
const BROWSER_APPS: [Browser, RegExp][] = [
  ['chrome', /^(google[ -]chrome|chrome|chromium(-browser)?)( (canary|beta|dev))?$/],
  ['safari', /^safari( technology preview)?$/],
  ['firefox', /^(mozilla )?firefox( (developer edition|nightly)|-esr)?$/],
  ['edge', /^(microsoft edge|msedge)( (beta|dev|canary))?$/],
  ['brave', /^brave( browser)?( (beta|nightly))?$/],
  ['arc', /^arc$/],
  ['opera', /^opera( gx)?$/],
  ['vivaldi', /^vivaldi$/]
]

export function browserForApp(app: string): Browser | null {
  const name = app
    .trim()
    .toLowerCase()
    .replace(/\.(exe|app)$/, '')
  return BROWSER_APPS.find(([, pattern]) => pattern.test(name))?.[0] ?? null
}

const BUCKET_BROWSERS: Record<string, Browser> = {
  chrome: 'chrome',
  chromium: 'chrome',
  safari: 'safari',
  firefox: 'firefox',
  edge: 'edge',
  brave: 'brave',
  arc: 'arc',
  opera: 'opera',
  vivaldi: 'vivaldi'
}

// The web watcher names its bucket after the browser, e.g. `aw-watcher-web-firefox_my-host`.
export function browserForBucket(bucketId: string): Browser | null {
  const name = /^aw-watcher-web-([a-z]+)/i.exec(bucketId)?.[1].toLowerCase()
  return (name && BUCKET_BROWSERS[name]) || null
}

// The bare hostname of a web page, without `www.`. Never the path or query string, which can
// hold tokens or personal data. null for anything that isn't an http(s) URL.
export function domainFromUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  const host = parsed.hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '')
  return host || null
}
