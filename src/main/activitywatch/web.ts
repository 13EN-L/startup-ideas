// Turns browser data into named activities: a web page ("github.com — org/repo",
// or just the page title without the extension) or a search ("Google search:
// cats"). Page titles and search words are kept because they say a lot about
// whether the page was on task.
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

/**
 * From the aw-watcher-web extension: a search, or one page as
 * "<hostname> — <page title>" (just the hostname when the tab has no title).
 */
export function activityFromUrl(url: string, title = ''): NamedActivity {
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
  const site = host.replace(/^www\./, '') || shorten(url);
  const page = title.trim();
  return { name: page ? `${site} — ${shorten(page)}` : site, source: 'web' };
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

// A browser's own new-tab page: chrome://newtab/, edge://newtab/, about:newtab,
// opera://startpage, Chrome's Google-hosted new tab page, and so on.
const NEW_TAB_URL =
  /^(?:(?:chrome|edge|brave|vivaldi|opera):\/\/(?:newtab|new-tab-page|startpage)\b|about:(?:newtab|home)\b|https:\/\/www\.google\.[a-z.]+\/_\/chrome\/newtab\b)/i;
// "New Tab" (Chrome, Firefox, Brave), "New tab" (Edge), "New Private Tab", "New Incognito Tab".
const NEW_TAB_TITLE = /^New (?:Private |Incognito |InPrivate )?Tab$/i;

/**
 * True for an empty new tab reported by the aw-watcher-web extension. Time on
 * one counts as idle: nothing has been opened yet, so there is nothing to classify.
 */
export function isNewTabPage(url: string, title = ''): boolean {
  return NEW_TAB_URL.test(url.trim()) || (url.trim() === '' && NEW_TAB_TITLE.test(title.trim()));
}

/** True for a browser window showing a new tab, judged by its window title. */
export function isNewTabWindowTitle(title: string): boolean {
  const page = title.trim().replace(BROWSER_SUFFIX, '').replace(MORE_TABS, '').trim();
  return NEW_TAB_TITLE.test(page);
}

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
