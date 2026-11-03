import type { DatabaseSync } from 'node:sqlite'
import type { TaskResults, WaitReason } from '../../shared/api'
import type { ActivityReader } from '../../shared/activity'
import {
  ClassificationError,
  type ClassificationErrorKind,
  type Classifier
} from '../../shared/classifier'
import { CATEGORIES, MAX_ACTIVE_TASKS, type Category, type Task } from '../../shared/domain'
import {
  getTask,
  insertActiveTask,
  listActiveTasks,
  listPendingTasks,
  listRecentStoppedTasks,
  stopTask
} from '../db'
import { pickAnimal } from './animals'
import {
  classificationRequest,
  completeTask,
  isSummarized,
  offTaskLabels,
  saveSummary
} from './pipeline'
import { getTaskResults } from './results'
import { MAX_CLASSIFICATION_RETRIES, retryDelayMs } from './retry'

export interface TaskServiceDeps {
  db: DatabaseSync
  activity: Pick<ActivityReader, 'getSummary'>
  getClassifier: () => Classifier
  notify: { taskResults(taskId: number): void; gardenChanged(): void }
  now?: () => number
  random?: () => number
}

export interface TaskService {
  start(input: { name: string; category: Category }): Task
  stop(id: number): void
  listActive(): Task[]
  listRecent(): Task[]
  getResults(id: number): TaskResults
  // Retries every pending task with a fresh count. Runs on app launch and after a key is saved.
  retryPending(): Promise<void>
  // Resolves once no task is being processed (for tests and shutdown).
  settled(): Promise<void>
  dispose(): void
}

type Outcome = 'done' | 'retry-classify' | 'retry-summary' | 'wait'

export function createTaskService(deps: TaskServiceDeps): TaskService {
  const { db, activity, getClassifier, notify } = deps
  const now = deps.now ?? Date.now
  const random = deps.random ?? Math.random

  const inFlight = new Map<number, Promise<void>>()
  const timers = new Map<number, ReturnType<typeof setTimeout>>()
  // Consecutive failures this app session; reset by retryPending.
  const classifyFailures = new Map<number, number>()
  const summaryFailures = new Map<number, number>()
  // Why each pending task is waiting, as last seen this session (shown in the results popup).
  const waiting = new Map<number, WaitReason>()
  let disposed = false

  const WAIT_FOR_ERROR: Record<ClassificationErrorKind, WaitReason> = {
    temporary: 'retrying',
    'no-api-key': 'no-api-key',
    'api-key-rejected': 'api-key-rejected',
    failed: 'claude-error'
  }

  // Records a new reason and tells the UI, so an open results popup can show it.
  function setWaiting(taskId: number, reason: WaitReason): void {
    if (waiting.get(taskId) === reason) return
    waiting.set(taskId, reason)
    notify.taskResults(taskId)
  }

  function finish(taskId: number): void {
    classifyFailures.delete(taskId)
    summaryFailures.delete(taskId)
    waiting.delete(taskId)
    notify.taskResults(taskId)
    notify.gardenChanged()
  }

  async function attempt(taskId: number): Promise<Outcome> {
    const task = getTask(db, taskId)
    if (task?.status !== 'pending') return 'done'

    if (!isSummarized(db, taskId)) {
      try {
        const summary = await activity.getSummary({ start: task.startedAt, end: task.stoppedAt! })
        saveSummary(db, task, summary)
        notify.taskResults(taskId)
      } catch {
        setWaiting(taskId, 'activitywatch')
        return 'retry-summary'
      }
    }

    try {
      waiting.set(taskId, 'labeling')
      const labels = await getClassifier()(classificationRequest(db, task))
      if (completeTask(db, taskId, labels)) finish(taskId)
      return 'done'
    } catch (error) {
      if (!(error instanceof ClassificationError)) throw error
      setWaiting(taskId, WAIT_FOR_ERROR[error.kind])
      return error.retryable ? 'retry-classify' : 'wait'
    }
  }

  function schedule(taskId: number, delayMs: number): void {
    if (disposed) return
    clearTimeout(timers.get(taskId))
    timers.set(
      taskId,
      setTimeout(() => {
        timers.delete(taskId)
        void process(taskId)
      }, delayMs)
    )
  }

  function handle(taskId: number, outcome: Outcome): void {
    if (outcome === 'retry-summary') {
      const failures = (summaryFailures.get(taskId) ?? 0) + 1
      summaryFailures.set(taskId, failures)
      schedule(taskId, retryDelayMs(failures))
    } else if (outcome === 'retry-classify') {
      const failures = (classifyFailures.get(taskId) ?? 0) + 1
      classifyFailures.set(taskId, failures)
      // failures counts the first attempt too, so this allows exactly 5 retries.
      if (failures > MAX_CLASSIFICATION_RETRIES) {
        if (completeTask(db, taskId, offTaskLabels(db, taskId))) finish(taskId)
      } else {
        schedule(taskId, retryDelayMs(failures))
      }
    }
  }

  function process(taskId: number): Promise<void> {
    const running = inFlight.get(taskId)
    if (running) return running
    const run = attempt(taskId)
      .then((outcome) => handle(taskId, outcome))
      .catch((error: unknown) => {
        // Unexpected (e.g. a database error). Messages here never include activity data.
        console.error(`Task ${taskId} could not be processed:`, (error as Error)?.message)
      })
      .finally(() => inFlight.delete(taskId))
    inFlight.set(taskId, run)
    return run
  }

  return {
    start({ name, category }) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Task name is required')
      if (!CATEGORIES.includes(category)) throw new Error('Unknown category')
      const active = listActiveTasks(db)
      if (active.length >= MAX_ACTIVE_TASKS) {
        throw new Error(`At most ${MAX_ACTIVE_TASKS} tasks can be active`)
      }
      return insertActiveTask(db, {
        name: trimmed,
        category,
        animal: pickAnimal(
          active.map((task) => task.animal),
          random
        ),
        startedAt: now()
      })
    },

    stop(id) {
      stopTask(db, id, now())
      // Its results are now pending; the UI shows it in the recent clouds right away, even if
      // ActivityWatch can't be read yet.
      notify.taskResults(id)
      void process(id)
    },

    listActive: () => listActiveTasks(db),
    listRecent: () => listRecentStoppedTasks(db),
    getResults(id) {
      const results = getTaskResults(db, id)
      if (results.task.status !== 'pending') return results
      const fallback = isSummarized(db, id) ? 'labeling' : 'reading-activity'
      return { ...results, waiting: waiting.get(id) ?? fallback }
    },

    async retryPending() {
      const pending = listPendingTasks(db)
      for (const { id } of pending) {
        clearTimeout(timers.get(id))
        timers.delete(id)
        classifyFailures.delete(id)
        summaryFailures.delete(id)
      }
      await Promise.all(pending.map(({ id }) => process(id)))
    },

    async settled() {
      while (inFlight.size > 0) await Promise.all(inFlight.values())
    },

    dispose() {
      disposed = true
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }
}
