import type { Interval } from './domain'

// Limits that keep each classification request small. The activity reader never produces
// more items than this (it folds the rest into per-app/per-domain items) and truncates titles;
// the classifier rejects anything larger.
export const MAX_SUMMARY_ITEMS = 50
export const MAX_TITLE_LENGTH = 200

// One app, or one website/search, used during a task. Built from ActivityWatch data with
// secrets already redacted from the title. domain is the bare host (no path or query) and is
// null for non-browser apps. intervals are non-idle and don't overlap other items'.
export interface ActivityItem {
  name: string
  app: string
  title: string
  domain: string | null
  seconds: number
  intervals: Interval[]
}

export interface ActivitySummary {
  range: Interval // the task's start to stop
  items: ActivityItem[]
  idleIntervals: Interval[]
  idleSeconds: number
}

// Implemented by src/main/activity/, the only code that talks to ActivityWatch.
export interface ActivityReader {
  isServerRunning(): Promise<boolean>
  getSummary(range: Interval): Promise<ActivitySummary>
}
