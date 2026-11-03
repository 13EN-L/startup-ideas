// In-memory FocusGardenApi with sample data, for building and testing pages without the
// main process. It follows the same rules as the real API: at most 3 active tasks, active
// tasks get different animals, results are pending for a while after stop, labels are final.
import type { FocusGardenApi, GardenState, TaskResults } from '../../../shared/api'
import {
  ANIMALS,
  MAX_ACTIVE_TASKS,
  PLANT_FOR_CATEGORY,
  type Category,
  type Label,
  type Task
} from '../../../shared/domain'

export interface MockApiOptions {
  activeTasks?: number // sample tasks already in the pen (0 to 3)
  resultDelayMs?: number // how long results stay pending after stop
  random?: () => number
}

const SAMPLE_ITEMS: { name: string; seconds: number; label: Label }[] = [
  { name: 'docs.google.com', seconds: 1260, label: 'on-task' },
  { name: 'YouTube: Lecture 4 - Photosynthesis', seconds: 540, label: 'on-task' },
  { name: 'Slack', seconds: 180, label: 'off-task' },
  { name: 'reddit.com', seconds: 95, label: 'off-task' }
]
const SAMPLE_IDLE_SECONDS = 120

const SAMPLE_RECENT: { name: string; category: Category }[] = [
  { name: 'Biology homework', category: 'School / Study' },
  { name: 'Quarterly report', category: 'Work' },
  { name: 'Morning run', category: 'Health & Fitness' },
  { name: 'Budget for March', category: 'Finance' },
  { name: 'Sketch practice', category: 'Creative' }
]

const SAMPLE_ACTIVE: { name: string; category: Category }[] = [
  { name: 'Write essay', category: 'School / Study' },
  { name: 'Clean garage', category: 'Home' },
  { name: 'Learn guitar chords', category: 'Creative' }
]

function labeledResults(task: Task): TaskResults {
  const sum = (label: Label): number =>
    SAMPLE_ITEMS.filter((i) => i.label === label).reduce((s, i) => s + i.seconds, 0)
  return {
    task,
    buckets: {
      productiveSeconds: sum('on-task'),
      unproductiveSeconds: sum('off-task'),
      idleSeconds: SAMPLE_IDLE_SECONDS
    },
    items: SAMPLE_ITEMS.map((item) => ({ ...item }))
  }
}

function pendingResults(task: Task): TaskResults {
  return {
    task,
    buckets: {
      productiveSeconds: null,
      unproductiveSeconds: null,
      idleSeconds: SAMPLE_IDLE_SECONDS
    },
    items: SAMPLE_ITEMS.map(({ name, seconds }) => ({ name, seconds, label: null }))
  }
}

export function createMockApi(options: MockApiOptions = {}): FocusGardenApi {
  const { activeTasks = 2, resultDelayMs = 1500, random = Math.random } = options
  const now = Date.now()
  const tasks: Task[] = []
  const results = new Map<number, TaskResults>()
  const resultListeners = new Set<(taskId: number) => void>()
  const gardenListeners = new Set<() => void>()
  let nextId = 1
  let hasKey = false

  const garden: GardenState = {
    plants: [
      {
        category: 'School / Study',
        plant: 'Tomato',
        position: 1,
        stage: 4,
        scale: 1.033,
        prestige: 1
      },
      { category: 'Work', plant: 'Pine', position: 2, stage: 2, scale: 1.05, prestige: 0 },
      { category: 'Creative', plant: 'Basil', position: 3, stage: 1, scale: 1, prestige: 0 }
    ],
    globalPrestige: 1,
    trophies: ['bronze']
  }

  const active = (): Task[] => tasks.filter((t) => t.status === 'active')

  const addTask = (name: string, category: Category, startedAt: number): Task => {
    const taken = new Set(active().map((t) => t.animal))
    const free = ANIMALS.filter((a) => !taken.has(a))
    const task: Task = {
      id: nextId++,
      name,
      category,
      animal: free[Math.floor(random() * free.length)],
      startedAt,
      stoppedAt: null,
      status: 'active'
    }
    tasks.push(task)
    return task
  }

  SAMPLE_RECENT.forEach(({ name, category }, i) => {
    const startedAt = now - (i + 2) * 3_600_000
    const task = addTask(name, category, startedAt)
    Object.assign(task, { stoppedAt: startedAt + 40 * 60_000, status: 'done' })
    results.set(task.id, labeledResults(task))
  })
  SAMPLE_ACTIVE.slice(0, Math.min(activeTasks, MAX_ACTIVE_TASKS)).forEach(({ name, category }, i) =>
    addTask(name, category, now - (i + 1) * 15 * 60_000)
  )

  const find = (id: number): Task => {
    const task = tasks.find((t) => t.id === id)
    if (!task) throw new Error(`Task ${id} not found`)
    return task
  }

  const finish = (task: Task): void => {
    task.status = 'done'
    results.set(task.id, labeledResults(task))
    if (!garden.plants.some((p) => p.category === task.category)) {
      garden.plants.push({
        category: task.category,
        plant: PLANT_FOR_CATEGORY[task.category],
        position: garden.plants.length + 1,
        stage: 1,
        scale: 1,
        prestige: 0
      })
    }
    resultListeners.forEach((listener) => listener(task.id))
    gardenListeners.forEach((listener) => listener())
  }

  const copy = <T>(value: T): T => structuredClone(value)

  return {
    tasks: {
      async start({ name, category }) {
        if (active().length >= MAX_ACTIVE_TASKS) throw new Error('At most 3 tasks can be active')
        if (!name.trim()) throw new Error('Task name is required')
        return copy(addTask(name.trim(), category, Date.now()))
      },
      async stop(id) {
        const task = tasks.find((t) => t.id === id && t.status === 'active')
        if (!task) throw new Error(`Task ${id} is not active`)
        task.stoppedAt = Date.now()
        task.status = 'pending'
        results.set(task.id, pendingResults(task))
        setTimeout(() => finish(task), resultDelayMs)
      },
      async listActive() {
        return copy(active())
      },
      async listRecent() {
        return copy(
          tasks
            .filter((t) => t.stoppedAt !== null)
            .sort((a, b) => b.stoppedAt! - a.stoppedAt! || b.id - a.id)
            .slice(0, 5)
        )
      },
      async getResults(id) {
        const task = find(id)
        return copy({ ...results.get(id)!, task })
      }
    },
    garden: {
      async getState() {
        return copy(garden)
      }
    },
    settings: {
      async setApiKey(key) {
        hasKey = key.length > 0
      },
      async hasApiKey() {
        return hasKey
      }
    },
    events: {
      onTaskResults(callback) {
        resultListeners.add(callback)
        return () => resultListeners.delete(callback)
      },
      onGardenChanged(callback) {
        gardenListeners.add(callback)
        return () => gardenListeners.delete(callback)
      }
    }
  }
}
