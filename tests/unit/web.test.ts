// Websites and searches from browser URLs (extension) and window titles (fallback)
import { describe, expect, it } from 'vitest';
import { activityFromPageTitle, activityFromUrl, isBrowserApp } from '../../src/main/activitywatch/web';

describe('isBrowserApp', () => {
  it.each(['chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'Google Chrome', 'Safari', 'Microsoft Edge', 'Google-chrome', 'Arc'])(
    'recognises %s',
    (app) => expect(isBrowserApp(app)).toBe(true),
  );

  it.each(['Code.exe', 'Slack', 'explorer.exe', 'Spotify', 'WINWORD.EXE'])('does not treat %s as a browser', (app) =>
    expect(isBrowserApp(app)).toBe(false),
  );
});

describe('activityFromUrl', () => {
  it.each([
    ['https://www.google.com/search?q=react+hooks&oq=react', 'Google search: react hooks'],
    ['https://www.google.co.uk/search?q=tea', 'Google search: tea'],
    ['https://www.bing.com/search?q=css+grid', 'Bing search: css grid'],
    ['https://duckduckgo.com/?q=rust+traits', 'DuckDuckGo search: rust traits'],
    ['https://search.brave.com/search?q=vite', 'Brave search: vite'],
    ['https://www.ecosia.org/search?q=trees', 'Ecosia search: trees'],
    ['https://search.yahoo.com/search?p=weather', 'Yahoo search: weather'],
    ['https://www.youtube.com/results?search_query=lofi+beats', 'YouTube search: lofi beats'],
  ])('turns %s into a search', (url, name) => {
    expect(activityFromUrl(url)).toEqual({ name, source: 'search' });
  });

  it('names other pages by hostname (without www) and page title', () => {
    expect(activityFromUrl('https://github.com/13EN-L/startup-ideas', 'GitHub - 13EN-L/startup-ideas')).toEqual({
      name: 'github.com — GitHub - 13EN-L/startup-ideas',
      source: 'web',
    });
    expect(activityFromUrl('https://www.youtube.com/watch?v=x', '  Lofi beats - YouTube ')).toEqual({
      name: 'youtube.com — Lofi beats - YouTube',
      source: 'web',
    });
  });

  it('uses just the hostname when the tab has no title', () => {
    expect(activityFromUrl('https://www.github.com/org/repo?q=ignored')).toEqual({ name: 'github.com', source: 'web' });
    expect(activityFromUrl('https://www.github.com/org/repo', '   ')).toEqual({ name: 'github.com', source: 'web' });
  });

  it('shortens very long page titles', () => {
    const { name } = activityFromUrl('https://example.com/', 'x'.repeat(300));
    expect(name).toBe(`example.com — ${'x'.repeat(119)}…`);
  });

  it('names searches by query, not by the results page title', () => {
    expect(activityFromUrl('https://www.google.com/search?q=cats', 'cats - Google Search')).toEqual({
      name: 'Google search: cats',
      source: 'search',
    });
  });

  it('treats an engine page without a query as the website', () => {
    expect(activityFromUrl('https://www.google.com/')).toEqual({ name: 'google.com', source: 'web' });
    expect(activityFromUrl('https://www.google.com/search?q=+')).toEqual({ name: 'google.com', source: 'web' });
  });

  it('does not mistake look-alike hosts for search engines', () => {
    expect(activityFromUrl('https://notgoogle.com/search?q=x')).toEqual({ name: 'notgoogle.com', source: 'web' });
  });

  it('keeps unparseable URLs as they are', () => {
    expect(activityFromUrl('about:blank')).toEqual({ name: 'about:blank', source: 'web' });
    expect(activityFromUrl('not a url')).toEqual({ name: 'not a url', source: 'web' });
  });

  it('shortens very long queries', () => {
    const { name } = activityFromUrl(`https://www.google.com/search?q=${'a'.repeat(300)}`);
    expect(name).toBe(`Google search: ${'a'.repeat(119)}…`);
  });
});

describe('activityFromPageTitle', () => {
  it.each([
    ['Pull request #2 · org/repo - Google Chrome', 'Pull request #2 · org/repo'],
    ['MDN Web Docs — Mozilla Firefox', 'MDN Web Docs'],
    ['Inbox - Outlook - Microsoft​ Edge', 'Inbox - Outlook'],
    ['Docs and 3 more pages - Microsoft​ Edge', 'Docs'],
    ['Stack Overflow - Brave', 'Stack Overflow'],
    ['A page with no browser name', 'A page with no browser name'],
  ])('strips the browser name from %s', (title, name) => {
    expect(activityFromPageTitle(title)).toEqual({ name, source: 'web' });
  });

  it.each([
    ['react hooks - Google Search - Google Chrome', 'Google search: react hooks'],
    ['rust traits at DuckDuckGo — Mozilla Firefox', 'DuckDuckGo search: rust traits'],
    ['vite - Brave Search - Brave', 'Brave search: vite'],
  ])('recognises the results page %s as a search', (title, name) => {
    expect(activityFromPageTitle(title)).toEqual({ name, source: 'search' });
  });

  it('names a window with no title', () => {
    expect(activityFromPageTitle('')).toEqual({ name: 'Untitled page', source: 'web' });
    expect(activityFromPageTitle(' - Google Chrome')).toEqual({ name: 'Untitled page', source: 'web' });
  });
});
