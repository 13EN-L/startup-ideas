#!/usr/bin/env node
/**
 * aw-idle-time.mjs — standalone idle vs. active time report from ActivityWatch.
 *
 * Totals how much of a time window was ACTIVE, IDLE, or had NO DATA
 * (ActivityWatch not running / computer off or asleep), using only the AFK
 * watcher (aw-watcher-afk). Which app or website was in use is ignored.
 *
 * Data can come from either:
 *   - an exported JSON file (a tester's "Export bucket as JSON" download), or
 *   - a running ActivityWatch server on this computer.
 *
 * Requirements: Node.js 18+. No npm packages, no other files.
 *
 * ---------------------------------------------------------------------------
 * HOW TO RUN
 * ---------------------------------------------------------------------------
 *   node aw-idle-time.mjs <start> <stop> [options]
 *
 * HOW TO LIST THE INPUTS (prints the full option list below)
 *   node aw-idle-time.mjs --help
 *
 * INPUTS
 *   <start>, <stop>     24-hour (military) clock times in US Eastern time,
 *                       both on the same day: 14:14, 15:52, 09:05:30.
 *                       "1414" (no colon) also works. <stop> may be "now".
 *                       Eastern time follows daylight saving automatically
 *                       (EST, UTC-5, in winter; EDT, UTC-4, in summer).
 *
 *   --date <YYYY-MM-DD> The day the times are on (default: today, Eastern).
 *                       Set this when the tester's session was another day.
 *   --file <path>       Read an exported ActivityWatch JSON file instead of a
 *                       running server. Accepts "Export bucket as JSON",
 *                       "Export all buckets as JSON", or a plain events array.
 *   --host <name>       Only use the AFK bucket for this hostname (when a file
 *                       or server has more than one).
 *   --url <url>         ActivityWatch server (default http://localhost:5600).
 *                       Ignored with --file.
 *   --json              Print machine-readable JSON instead of text.
 *   --intervals         Also list each active / idle / no-data stretch.
 *   --list-buckets      Show which AFK buckets the file/server contains (hosts,
 *                       event counts, date range) and exit. <start>/<stop> not
 *                       needed.
 *   -h, --help          Show this help.
 *
 * EXAMPLES
 *   # Tester sent aw-bucket-export_aw-watcher-afk_LAPTOP.json, worked 14:14–15:52 on Nov 8
 *   node aw-idle-time.mjs 14:14 15:52 --date 2026-11-08 --file ./aw-bucket-export_aw-watcher-afk_LAPTOP.json
 *
 *   # Same, but the session was today
 *   node aw-idle-time.mjs 14:14 15:52 --file ./export.json
 *
 *   # See what a file contains (and which dates it covers) before running it
 *   node aw-idle-time.mjs --list-buckets --file ./export.json
 *
 *   # Your own computer's live ActivityWatch, from 09:00 today until now
 *   node aw-idle-time.mjs 09:00 now
 *
 * NOTES
 *   - Where idle and active overlap (multiple buckets), active wins.
 *   - ActivityWatch marks you idle after 3 minutes without keyboard/mouse input
 *     (its default), counting from the last input.
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_URL = 'http://localhost:5600';
const TZ = 'America/New_York'; // US Eastern: EST in winter, EDT in summer

const HELP = `Idle vs. active time from ActivityWatch's AFK watcher.

How to run:
  node aw-idle-time.mjs <start> <stop> [options]
  node aw-idle-time.mjs --list-buckets [--file <path> | --url <url>]

Inputs:
  <start>, <stop>   24-hour times in US Eastern time, same day: 14:14 15:52
                    (also 1414, or 09:05:30). <stop> may be "now".

Options:
  --date <YYYY-MM-DD>  Day of the session (default: today, Eastern)
  --file <path>     Read an exported ActivityWatch JSON file (instead of a server)
  --host <name>     Only use the AFK bucket for this hostname
  --url <url>       ActivityWatch server (default ${DEFAULT_URL}); ignored with --file
  --json            Print JSON instead of text
  --intervals       Also list each active / idle / no-data stretch
  --list-buckets    List the AFK buckets available (hosts, event counts, date range) and exit
  -h, --help        Show this help

Examples:
  node aw-idle-time.mjs 14:14 15:52 --date 2026-11-08 --file export.json
  node aw-idle-time.mjs --list-buckets --file export.json`;

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { url: DEFAULT_URL, host: null, file: null, date: null, json: false, intervals: false, listBuckets: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} requires a value`);
      return argv[++i];
    };
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--intervals') opts.intervals = true;
    else if (a === '--list-buckets') opts.listBuckets = true;
    else if (a === '--url') opts.url = next();
    else if (a === '--host') opts.host = next();
    else if (a === '--file') opts.file = next();
    else if (a === '--date') opts.date = next();
    else if (a.startsWith('--')) throw new Error(`Unknown option: ${a}`);
    else positional.push(a);
  }
  if (!opts.help && !opts.listBuckets && positional.length !== 2) {
    throw new Error('Expected exactly two arguments: <start> <stop>');
  }
  [opts.start, opts.stop] = positional;
  return opts;
}

// ---------------------------------------------------------------------------
// Time parsing: 24-hour clock times on one day, in US Eastern time
// ---------------------------------------------------------------------------

const CLOCK_TIME = /^(\d{1,2}):?(\d{2})(?::?(\d{2}))?$/; // 14:14, 1414, 14:14:30, 141430
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in Eastern time as YYYY-MM-DD. */
function todayEastern() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function parseDate(value) {
  const m = (value ?? todayEastern()).match(DATE);
  if (!m) throw new Error(`Invalid --date "${value}" (expected YYYY-MM-DD, e.g. 2026-11-08)`);
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const check = new Date(Date.UTC(y, mo - 1, d));
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) throw new Error(`Invalid --date "${value}" (no such day)`);
  return { y, mo, d };
}

/** Offset (ms) of `tz` from UTC at the instant `utcMs`. */
function tzOffsetMs(utcMs, tz) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(utcMs))
      .map((p) => [p.type, p.value]),
  );
  const wallAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return wallAsUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Parses a 24-hour clock time on `date` (Eastern) into a UTC timestamp. */
function parseTime(value, label, date) {
  if (label === 'stop' && value.toLowerCase() === 'now') return Date.now();

  const m = value.match(CLOCK_TIME);
  const [h, mi, s] = m ? [+m[1], +m[2], +(m[3] ?? 0)] : [];
  if (!m || h > 23 || mi > 59 || s > 59) {
    throw new Error(`Invalid ${label} time: "${value}" (use 24-hour time like 14:14 or 09:05)`);
  }
  const wall = Date.UTC(date.y, date.mo - 1, date.d, h, mi, s);
  // Two passes so times near a daylight-saving change resolve correctly.
  let utc = wall - tzOffsetMs(wall, TZ);
  utc = wall - tzOffsetMs(utc, TZ);
  return utc;
}

// ---------------------------------------------------------------------------
// Interval math (intervals are [startMs, endMs) pairs)
// ---------------------------------------------------------------------------

/** Sort and merge overlapping/touching intervals. */
function union(intervals) {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/** a minus b, both already merged and sorted. */
function subtract(a, b) {
  const out = [];
  let j = 0;
  for (let [s, e] of a) {
    while (j < b.length && b[j][1] <= s) j++;
    let k = j;
    while (k < b.length && b[k][0] < e) {
      if (b[k][0] > s) out.push([s, b[k][0]]);
      s = Math.max(s, b[k][1]);
      if (s >= e) break;
      k++;
    }
    if (s < e) out.push([s, e]);
  }
  return out;
}

const total = (intervals) => intervals.reduce((sum, [s, e]) => sum + (e - s), 0);

// ---------------------------------------------------------------------------
// Data sources: exported file or live server
// ---------------------------------------------------------------------------

const hostOf = (b) => b.hostname ?? b.id.replace(/^aw-watcher-afk_?/, '');

function isAfkBucket(b) {
  if (b.type === 'afkstatus' || String(b.id).startsWith('aw-watcher-afk')) return true;
  return Array.isArray(b.events) && b.events.some((e) => e?.data?.status === 'afk' || e?.data?.status === 'not-afk');
}

function pickBuckets(afk, host, preferLocal) {
  if (afk.length === 0) throw new Error('No AFK bucket found (aw-watcher-afk). Was the right bucket exported / is the watcher running?');
  if (host) {
    const matched = afk.filter((b) => hostOf(b).toLowerCase() === host.toLowerCase());
    if (matched.length === 0) throw new Error(`No AFK bucket for host "${host}". Available: ${afk.map(hostOf).join(', ')}`);
    return matched;
  }
  if (preferLocal) {
    const local = afk.filter((b) => hostOf(b).toLowerCase() === os.hostname().toLowerCase());
    if (local.length > 0) return local;
  }
  if (afk.length > 1) {
    console.error(`Warning: ${afk.length} AFK buckets found (${afk.map(hostOf).join(', ')}); combining them. Use --host to pick one.`);
  }
  return afk;
}

/** Normalizes the shapes ActivityWatch exports into [{ id, type, hostname, events }]. */
function normalizeExport(json, label) {
  if (Array.isArray(json)) return [{ id: '(events array)', hostname: '(unknown)', events: json }];
  if (json && typeof json === 'object') {
    if (json.buckets && typeof json.buckets === 'object') {
      return Object.entries(json.buckets).map(([id, b]) => ({ ...b, id: b.id ?? id, events: b.events ?? [] }));
    }
    if (Array.isArray(json.events)) return [{ ...json, id: json.id ?? '(bucket)', events: json.events }];
  }
  throw new Error(`${label} doesn't look like an ActivityWatch export (expected {"buckets": {...}})`);
}

async function fileSource(filePath) {
  let text;
  try {
    text = await fs.readFile(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Could not read ${filePath}: ${err.message}`);
  }
  let json;
  try {
    json = JSON.parse(text.replace(/^﻿/, ''));
  } catch (err) {
    throw new Error(`${filePath} is not valid JSON: ${err.message}`);
  }
  const buckets = normalizeExport(json, filePath).filter(isAfkBucket);
  return {
    label: path.basename(filePath),
    buckets,
    preferLocal: false, // the file is from someone else's computer
    events: async (bucket) => bucket.events,
  };
}

async function getJson(url) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  } catch (err) {
    throw new Error(`Could not reach ActivityWatch at ${url} — is it running? (${err.cause?.code ?? err.message})`);
  }
  if (!res.ok) throw new Error(`ActivityWatch returned HTTP ${res.status} for ${url}: ${await res.text()}`);
  return res.json();
}

async function serverSource(url, startMs, stopMs) {
  const baseUrl = url.replace(/\/+$/, '');
  const buckets = Object.values(await getJson(`${baseUrl}/api/0/buckets/`)).filter(isAfkBucket);
  return {
    label: baseUrl,
    buckets,
    preferLocal: true,
    events: async (bucket) => {
      const params = new URLSearchParams();
      if (startMs != null) params.set('start', new Date(startMs).toISOString());
      if (stopMs != null) params.set('end', new Date(stopMs).toISOString());
      return getJson(`${baseUrl}/api/0/buckets/${encodeURIComponent(bucket.id)}/events?${params}`);
    },
  };
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Returns active / idle / no-data totals (ms) and merged intervals for the window.
 * options: { file, url, host }
 */
export async function getIdleStats(startMs, stopMs, { file = null, url = DEFAULT_URL, host = null } = {}) {
  if (stopMs <= startMs) throw new Error('Stop time must be after start time');
  const source = file ? await fileSource(file) : await serverSource(url, startMs, stopMs);
  const buckets = pickBuckets(source.buckets, host, source.preferLocal);

  const activeRaw = [];
  const idleRaw = [];
  for (const bucket of buckets) {
    for (const ev of await source.events(bucket)) {
      const s = Date.parse(ev.timestamp);
      if (Number.isNaN(s)) continue;
      const e = s + (Number(ev.duration) || 0) * 1000;
      const clipped = [Math.max(s, startMs), Math.min(e, stopMs)];
      if (clipped[1] <= clipped[0]) continue;
      if (ev.data?.status === 'not-afk') activeRaw.push(clipped);
      else if (ev.data?.status === 'afk') idleRaw.push(clipped);
    }
  }

  const active = union(activeRaw);
  const idle = subtract(union(idleRaw), active);
  const noData = subtract(subtract([[startMs, stopMs]], active), idle);

  return {
    source: source.label,
    start: startMs,
    stop: stopMs,
    buckets: buckets.map((b) => b.id),
    activeMs: total(active),
    idleMs: total(idle),
    noDataMs: total(noData),
    intervals: { active, idle, noData },
  };
}

async function listBuckets({ file, url }) {
  const source = file ? await fileSource(file) : await serverSource(url);
  if (source.buckets.length === 0) {
    console.log(`No AFK buckets in ${source.label}.`);
    return;
  }
  console.log(`AFK buckets in ${source.label}:\n`);
  for (const b of source.buckets) {
    const events = await source.events(b);
    const starts = events.map((e) => Date.parse(e.timestamp)).filter((t) => !Number.isNaN(t));
    const ends = events.map((e) => Date.parse(e.timestamp) + (Number(e.duration) || 0) * 1000).filter((t) => !Number.isNaN(t));
    const range = starts.length
      ? `${new Date(Math.min(...starts)).toISOString()} -> ${new Date(Math.max(...ends)).toISOString()}`
      : '(no events)';
    console.log(`  ${b.id}`);
    console.log(`    host: ${hostOf(b)}   events: ${events.length}   range: ${range}`);
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function fmtDuration(ms) {
  const sec = Math.round(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function makeTimeFormatter() {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  return (ms) => fmt.format(new Date(ms));
}

function printText(r, showIntervals) {
  const windowMs = r.stop - r.start;
  const pct = (ms) => `${((ms / windowMs) * 100).toFixed(1)}%`.padStart(6);
  const t = makeTimeFormatter();

  console.log(`Source:    ${r.source}`);
  console.log(`Bucket(s): ${r.buckets.join(', ')}`);
  console.log(`Window:    ${t(r.start)} -> ${t(r.stop)} Eastern  (${fmtDuration(windowMs)})`);
  console.log('');
  console.log(`Active:    ${fmtDuration(r.activeMs).padStart(12)}  ${pct(r.activeMs)}`);
  console.log(`Idle:      ${fmtDuration(r.idleMs).padStart(12)}  ${pct(r.idleMs)}`);
  console.log(`No data:   ${fmtDuration(r.noDataMs).padStart(12)}  ${pct(r.noDataMs)}   (ActivityWatch off / computer asleep)`);

  if (showIntervals) {
    const rows = [
      ...r.intervals.active.map((iv) => ['active', iv]),
      ...r.intervals.idle.map((iv) => ['idle', iv]),
      ...r.intervals.noData.map((iv) => ['no-data', iv]),
    ].sort((a, b) => a[1][0] - b[1][0]);
    console.log('\nIntervals:');
    for (const [kind, [s, e]] of rows) {
      console.log(`  ${kind.padEnd(8)} ${t(s)} -> ${t(e)}  ${fmtDuration(e - s)}`);
    }
  }
}

function toJson(r, showIntervals) {
  const out = {
    source: r.source,
    buckets: r.buckets,
    start: new Date(r.start).toISOString(),
    stop: new Date(r.stop).toISOString(),
    windowSeconds: (r.stop - r.start) / 1000,
    activeSeconds: r.activeMs / 1000,
    idleSeconds: r.idleMs / 1000,
    noDataSeconds: r.noDataMs / 1000,
  };
  if (showIntervals) {
    const conv = (list) => list.map(([s, e]) => ({ start: new Date(s).toISOString(), stop: new Date(e).toISOString() }));
    out.intervals = { active: conv(r.intervals.active), idle: conv(r.intervals.idle), noData: conv(r.intervals.noData) };
  }
  return JSON.stringify(out, null, 2);
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error: ${err.message}\nRun with --help to list the inputs.`);
    process.exit(2);
  }
  if (opts.help) {
    console.log(HELP);
    return;
  }
  if (opts.listBuckets) {
    await listBuckets(opts);
    return;
  }

  const date = parseDate(opts.date);
  const startMs = parseTime(opts.start, 'start', date);
  const stopMs = parseTime(opts.stop, 'stop', date);
  if (stopMs <= startMs) throw new Error(`Stop time (${opts.stop}) must be later than start time (${opts.start}) on the same day`);
  const result = await getIdleStats(startMs, stopMs, { file: opts.file, url: opts.url, host: opts.host });

  if (result.noDataMs === result.stop - result.start) {
    console.error('Warning: no ActivityWatch data at all in this window. Check --date (default is today) and the times.');
  }

  if (opts.json) console.log(toJson(result, opts.intervals));
  else printText(result, opts.intervals);
}

// Run only when executed directly (so the file can also be imported).
const invokedUrl = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url.toLowerCase() === invokedUrl.toLowerCase()) {
  main().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  });
}
