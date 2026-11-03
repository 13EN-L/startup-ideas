import { describe, expect, it } from 'vitest'
import { browserForApp, browserForBucket, domainFromUrl } from './browsers'

describe('browserForApp', () => {
  it.each([
    ['Google Chrome', 'chrome'],
    ['chrome.exe', 'chrome'],
    ['Google Chrome Canary', 'chrome'],
    ['google-chrome', 'chrome'],
    ['Chromium', 'chrome'],
    ['Safari', 'safari'],
    ['Safari Technology Preview', 'safari'],
    ['Firefox', 'firefox'],
    ['firefox.exe', 'firefox'],
    ['Firefox Developer Edition', 'firefox'],
    ['Microsoft Edge', 'edge'],
    ['msedge.exe', 'edge'],
    ['Brave Browser', 'brave'],
    ['brave.exe', 'brave'],
    ['Arc', 'arc'],
    ['Opera', 'opera'],
    ['opera.exe', 'opera'],
    ['Vivaldi', 'vivaldi'],
    ['vivaldi.exe', 'vivaldi']
  ])('recognizes %j as %s', (app, browser) => {
    expect(browserForApp(app)).toBe(browser)
  })

  it.each([
    'Code',
    'Slack',
    'Finder',
    'explorer.exe',
    'Archive Utility',
    'Microsoft Word',
    'Chrome Remote Desktop',
    'My Chrome',
    'Safari Web Content',
    'Mobile Safari',
    'Firefox Profile Manager',
    'Old Firefox',
    'Microsoft Edge Update',
    'Not Microsoft Edge',
    'Brave Updater',
    'Unbrave',
    'Arcade',
    'Monarc',
    'Operator',
    'Hopera',
    'Vivaldi Installer',
    'My Vivaldi',
    'chrome.exe.bak'
  ])('does not treat %j as a browser', (app) => {
    expect(browserForApp(app)).toBeNull()
  })
})

describe('browserForBucket', () => {
  it.each([
    ['aw-watcher-web-chrome', 'chrome'],
    ['aw-watcher-web-chromium', 'chrome'],
    ['aw-watcher-web-firefox_my-laptop', 'firefox'],
    ['aw-watcher-web-safari', 'safari'],
    ['aw-watcher-web-edge', 'edge'],
    ['aw-watcher-web-brave', 'brave'],
    ['aw-watcher-web-arc', 'arc'],
    ['aw-watcher-web-opera', 'opera'],
    ['aw-watcher-web-vivaldi', 'vivaldi'],
    ['AW-WATCHER-WEB-FIREFOX', 'firefox']
  ])('reads %j as %s', (id, browser) => {
    expect(browserForBucket(id)).toBe(browser)
  })

  it.each(['my-custom-web-bucket', 'aw-watcher-web-netscape', 'old-aw-watcher-web-chrome'])(
    'returns null for %j',
    (id) => {
      expect(browserForBucket(id)).toBeNull()
    }
  )
})

describe('domainFromUrl', () => {
  it('returns the bare hostname without path, query or www', () => {
    expect(domainFromUrl('https://www.example.com/account/reset?token=abc#top')).toBe('example.com')
  })

  it('keeps subdomains other than www and lowercases', () => {
    expect(domainFromUrl('https://Docs.Google.com/document/d/1x/edit')).toBe('docs.google.com')
  })

  it('only strips a leading www and a trailing dot', () => {
    expect(domainFromUrl('https://awww.example/')).toBe('awww.example')
    expect(domainFromUrl('https://my.www.example/')).toBe('my.www.example')
    expect(domainFromUrl('https://example.com./')).toBe('example.com')
  })

  it('drops ports and credentials', () => {
    expect(domainFromUrl('http://user:pass@localhost:5173/app')).toBe('localhost')
  })

  it.each(['chrome://newtab/', 'about:blank', 'file:///Users/bl/notes.txt', 'not a url', ''])(
    'returns null for %j',
    (url) => {
      expect(domainFromUrl(url)).toBeNull()
    }
  )
})
