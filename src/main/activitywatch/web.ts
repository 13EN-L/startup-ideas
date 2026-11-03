// Turns browser data into named activities: a website (hostname or page
// title) or a search ("Google search: cats"). Search words are kept because
// they say a lot about whether a search was on task.
import type { ActivitySource } from '../../shared/types';

export interface NamedActivity {
  name: string;
  source: ActivitySource;
}

/** Long page titles and queries are cut to this many characters. */
const MAX_NAME_LENGTH = 120;

// Lowercased app names with everything but letters removed, as reported by
// aw-watcher-window on Windows (chrome.exe), macOS (Google Chrome) and Linux (Google-chrome).
const BROWSERS = new Set([
  'chrome',
  'googlechrome',
  'chromium',
  'chromiumbrowser',
  'msedge',
  'microsoftedge',
  'firefox',
  'firefoxesr',
  'brave',
  'bravebrowser',
  'opera',
  'operagx',
  'vivaldi',
  'arc',
  'safari',
]);

export function isBrowserApp(app: string): boolean {
  return BROWSERS.has(app.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z]/g, ''));
}

function shorten(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > MAX_NAME_LENGTH ? `${clean.slice(0, MAX_NAME_LENGTH - 1)}…` : clean;
}

const search = (engine: string, query: string): NamedActivity => ({
  name: `${engine} search: ${shorten(query)}`,
  source: 'search',
});

/** Search engines whose results page URL carries the query. */
const SEARCH_URLS: { engine: string; host: RegExp; path: RegExp; param: string }[] = [
  { engine: 'Google', host: /^(www\.)?google\.[a-z.]+$/, path: /^\/search/, param: 'q' },
  { engine: 'Bing', host: /^(www\.)?bing\.com$/, path: /^\/search/, param: 'q' },
  { engine: 'DuckDuckGo', host: /^(html\.)?duckduckgo\.com$/, path: /^\/(html\/?)?$/, param: 'q' },
  { engine: 'Brave', host: /^search\.brave\.com$/, path: /^\/search/, param: 'q' },
  { engine: 'Ecosia', host: /^(www\.)?ecosia\.org$/, path: /^\/search/, param: 'q' },
  { engine: 'Yahoo', host: /^search\.yahoo\.com$/, path: /^\/search/, param: 'p' },
  { engine: 'YouTube', host: /^(www\.|m\.)?youtube\.com$/, path: /^\/results/, param: 'search_query' },
];

/** From the aw-watcher-web extension: a search, or the site's hostname. */
export function activityFromUrl(url: string): NamedActivity {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { name: shorten(url) || 'Unknown website', source: 'web' };
  }
  const host = parsed.hostname.toLowerCase();
  for (const engine of SEARCH_URLS) {
    const query = parsed.searchParams.get(engine.param)?.trim();
    if (query && engine.host.test(host) && engine.path.test(parsed.pathname)) {
      return search(engine.engine, query);
    }
  }
  return { name: host.replace(/^www\./, '') || shorten(url), source: 'web' };
}

// "<page> - Google Chrome", "<page> — Mozilla Firefox", "<page> - Microsoft​ Edge" (with a zero-width space).
const BROWSER_SUFFIX =
  /(?:^|\s+)[-—–]\s+(?:Google Chrome|Chromium|Mozilla Firefox|Firefox|Microsoft​?\s?Edge|Brave|Opera|Vivaldi|Arc|Safari)$/;
// Edge: "<page> and 3 more pages".
const MORE_TABS = /\s+and \d+ more (?:pages?|tabs?)$/;

/** Results pages whose title carries the query. Bing's (" - Search") is too generic to trust. */
const SEARCH_TITLES: { engine: string; pattern: RegExp }[] = [
  { engine: 'Google', pattern: /^(.+) - Google Search$/ },
  { engine: 'DuckDuckGo', pattern: /^(.+) at DuckDuckGo$/ },
  { engine: 'Brave', pattern: /^(.+) - Brave Search$/ },
];

/**
 * Fallback when the extension isn't installed: the browser window's title,
 * minus the browser name, is the page title; results pages become searches.
 */
export function activityFromPageTitle(title: string): NamedActivity {
  const page = title.trim().replace(BROWSER_SUFFIX, '').replace(MORE_TABS, '').trim();
  if (!page) return { name: 'Untitled page', source: 'web' };

  for (const { engine, pattern } of SEARCH_TITLES) {
    const match = page.match(pattern);
    if (match) return search(engine, match[1]);
  }
  return { name: shorten(page), source: 'web' };
}
