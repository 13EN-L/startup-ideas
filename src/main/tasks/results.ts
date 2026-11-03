import type { DatabaseSync } from 'node:sqlite'
import type { TaskResults } from '../../shared/api'
import { getTask, getTaskBuckets, getTaskItems } from '../db'

// What the results popup shows. Before the summary is saved there are no items and no idle time.
export function getTaskResults(db: DatabaseSync, taskId: number): TaskResults {
  const task = getTask(db, taskId)
  if (!task) throw new Error(`Task ${taskId} not found`)
  return {
    task,
    buckets: getTaskBuckets(db, taskId) ?? {
      productiveSeconds: null,
      unproductiveSeconds: null,
      idleSeconds: 0
    },
    items: getTaskItems(db, taskId).map(({ name, seconds, label }) => ({ name, seconds, label }))
  }
}
