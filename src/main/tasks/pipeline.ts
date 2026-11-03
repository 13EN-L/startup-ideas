import type { DatabaseSync } from 'node:sqlite'
import type { ActivitySummary } from '../../shared/activity'
import type { ClassificationRequest, ItemLabel } from '../../shared/classifier'
import type { Task } from '../../shared/domain'
import {
  getCreditedIntervals,
  getPlant,
  getTask,
  getTaskBuckets,
  getTaskItems,
  markTaskDone,
  replaceCreditedIntervals,
  saveLabels,
  saveTaskBuckets,
  saveTaskItems,
  upsertPlantTotal,
  withTransaction
} from '../db'
import { applyGrowth, computeBuckets } from '../rewards'

export function isSummarized(db: DatabaseSync, taskId: number): boolean {
  return getTaskBuckets(db, taskId) !== undefined
}

// Saves the ActivityWatch summary so idle time and the item list can show before labels arrive.
export function saveSummary(db: DatabaseSync, task: Task, summary: ActivitySummary): void {
  withTransaction(db, () => {
    if (getTask(db, task.id)?.status !== 'pending' || isSummarized(db, task.id)) return
    saveTaskItems(db, task.id, summary.items)
    saveTaskBuckets(db, task.id, {
      idleSeconds: summary.idleSeconds,
      productiveSeconds: null,
      unproductiveSeconds: null
    })
  })
}

export function classificationRequest(db: DatabaseSync, task: Task): ClassificationRequest {
  return {
    taskName: task.name,
    category: task.category,
    items: getTaskItems(db, task.id).map(({ id, app, title, domain }) => ({
      id,
      app,
      title,
      domain
    }))
  }
}

// Labels every item off-task: used once all classification retries have failed.
export function offTaskLabels(db: DatabaseSync, taskId: number): ItemLabel[] {
  return getTaskItems(db, taskId).map(({ id }) => ({ id, label: 'off-task' }))
}

// Saves the labels and grows the task's plant, all or nothing. Returns false if the task was
// already completed, since labels are final.
export function completeTask(db: DatabaseSync, taskId: number, labels: ItemLabel[]): boolean {
  return withTransaction(db, () => {
    const task = getTask(db, taskId)
    if (task?.status !== 'pending') return false

    saveLabels(
      db,
      taskId,
      labels.map(({ id, label }) => ({ itemId: id, label }))
    )
    const items = getTaskItems(db, taskId)
    const unlabeled = items.find((item) => item.label === null)
    if (unlabeled) throw new Error(`Item ${unlabeled.id} of task ${taskId} has no label`)

    // Item intervals already exclude idle time, which the summary recorded separately.
    const buckets = computeBuckets({
      items: items.map((item) => ({ label: item.label!, intervals: item.intervals })),
      idleIntervals: []
    })
    const growth = applyGrowth({
      plantTotalSeconds: getPlant(db, task.category)?.totalSeconds ?? null,
      creditedIntervals: getCreditedIntervals(db, task.category),
      productiveIntervals: buckets.productiveIntervals
    })
    upsertPlantTotal(db, task.category, growth.plantTotalSeconds)
    replaceCreditedIntervals(db, task.category, growth.creditedIntervals)
    saveTaskBuckets(db, taskId, {
      idleSeconds: getTaskBuckets(db, taskId)?.idleSeconds ?? 0,
      productiveSeconds: buckets.productiveSeconds,
      unproductiveSeconds: buckets.unproductiveSeconds
    })
    markTaskDone(db, taskId)
    return true
  })
}
