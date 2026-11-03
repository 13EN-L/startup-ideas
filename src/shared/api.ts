import type { Category, Label, Plant, Task, Trophy } from './domain'

// Why a stopped task has no labels yet, shown under the spinner in the results popup.
export type WaitReason =
  | 'reading-activity' // reading what you did from ActivityWatch
  | 'activitywatch' // ActivityWatch can't be reached; retrying
  | 'labeling' // Claude is labeling the items
  | 'retrying' // Claude failed for now; retrying
  | 'no-api-key' // waiting for a Claude API key
  | 'api-key-rejected' // Claude rejected the saved key
  | 'claude-error' // Claude refused the request for another reason; waiting for a new key

// What the results popup shows. While a task is pending, productive/unproductive seconds and
// item labels are null, but idle time and the item list (from ActivityWatch) are already known.
export interface TaskResults {
  waiting: WaitReason | null // null once the task is done
  task: Task
  buckets: {
    productiveSeconds: number | null
    unproductiveSeconds: number | null
    idleSeconds: number
  }
  items: { name: string; seconds: number; label: Label | null }[]
}

export interface GardenPlant {
  category: Category
  plant: Plant
  position: number // 1 = first plant to appear
  stage: number // 1 to 6
  scale: number // 1 to 1.1
  prestige: number
  // For the plant's progress popup.
  totalSeconds: number // all productive seconds ever added
  progress: number // 0 to 1 within the current stage
  secondsIntoStage: number
  secondsPerStage: number
  stagesPerCycle: number
}

export interface GardenState {
  plants: GardenPlant[] // in position order
  globalPrestige: number
  trophies: Trophy[]
}

// The renderer's only way to reach the main process, exposed by the preload script as
// window.api. The renderer never sees the API key or calls ActivityWatch or Claude.
export interface FocusGardenApi {
  tasks: {
    // Rejects when 3 tasks are already active. Main picks the animal.
    start(input: { name: string; category: Category }): Promise<Task>
    stop(id: number): Promise<void>
    listActive(): Promise<Task[]>
    // The 5 most recently stopped tasks, newest first (the recent-task clouds).
    listRecent(): Promise<Task[]>
    getResults(id: number): Promise<TaskResults>
  }
  garden: {
    getState(): Promise<GardenState>
  }
  settings: {
    setApiKey(key: string): Promise<void>
    hasApiKey(): Promise<boolean>
  }
  events: {
    // Each returns a function that unsubscribes.
    onTaskResults(callback: (taskId: number) => void): () => void
    onGardenChanged(callback: () => void): () => void
  }
}
