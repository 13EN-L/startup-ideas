import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MAX_ACTIVE_TASKS, type Category, type Task } from '../../../shared/domain'
import { useApi } from '../api/useApi'
import {
  CategorySelect,
  PixelButton,
  PixelTextInput,
  RecentClouds,
  Sky,
  SkyWindow,
  TaskResultsPopup
} from '../components'
import type { PageProps } from '../navigation'
import { Pen } from './task/Pen'
import { StopPopup } from './task/StopPopup'
import { assignSections, EXIT_MS, type Sections } from './task/penLayout'
import styles from './task/TaskPage.module.css'

interface PenState {
  sections: Sections
  tasks: Record<number, Task>
  exiting: number[]
}

const EMPTY_PEN: PenState = { sections: [null, null, null], tasks: {}, exiting: [] }

function withActive(pen: PenState, active: Task[]): PenState {
  const sections = assignSections(
    pen.sections,
    active.map((t) => t.id),
    new Set(pen.exiting)
  )
  const tasks: Record<number, Task> = {}
  for (const id of sections) {
    if (id !== null) tasks[id] = active.find((t) => t.id === id) ?? pen.tasks[id]
  }
  return { ...pen, sections, tasks }
}

// docs/ui-spec.md "Task page": the start-task form in the sky, active tasks as animals in the pen.
export function TaskPage(props: PageProps): React.JSX.Element {
  const api = useApi()
  const { navigate } = props
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category | ''>('')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [pen, setPen] = useState<PenState>(EMPTY_PEN)
  const [loaded, setLoaded] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [resultsFor, setResultsFor] = useState<number | null>(props.openResultsFor ?? null)
  const alive = useRef(true)
  // Stopped tasks never come back, even if a reload that started before the stop lands late.
  const stopped = useRef(new Set<number>())
  const exitTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  const reload = useCallback((): void => {
    void api.tasks.listActive().then((active) => {
      if (!alive.current) return
      setPen((p) =>
        withActive(
          p,
          active.filter((t) => !stopped.current.has(t.id))
        )
      )
      setLoaded(true)
    })
  }, [api])

  useEffect(() => {
    alive.current = true
    const timers = exitTimers.current
    reload()
    const unsubscribe = api.events.onTaskResults(reload)
    return () => {
      alive.current = false
      unsubscribe()
      timers.forEach(clearTimeout)
    }
  }, [api, reload])

  const animalCount = pen.sections.filter((id) => id !== null).length
  const canStart =
    name.trim() !== '' && category !== '' && animalCount < MAX_ACTIVE_TASKS && !starting

  async function start(event: FormEvent): Promise<void> {
    event.preventDefault()
    if (!canStart) return
    setStarting(true)
    setStartError(null)
    try {
      await api.tasks.start({ name: name.trim(), category })
      setName('')
      setCategory('')
      reload()
    } catch (err) {
      setStartError(err instanceof Error ? err.message : String(err))
    } finally {
      setStarting(false)
    }
  }

  async function stop(task: Task): Promise<void> {
    await api.tasks.stop(task.id)
    stopped.current.add(task.id)
    setSelectedId(null)
    setPen((p) => ({ ...p, exiting: [...p.exiting, task.id] }))
    const timer = setTimeout(() => {
      setPen((p) => ({
        ...p,
        sections: p.sections.map((id) => (id === task.id ? null : id)),
        exiting: p.exiting.filter((id) => id !== task.id)
      }))
      reload()
    }, EXIT_MS)
    exitTimers.current.push(timer)
  }

  const selected = selectedId !== null ? pen.tasks[selectedId] : undefined

  return (
    <main aria-label="Task page" className={styles.page}>
      <Sky heightFraction={2 / 3}>
        <RecentClouds onSelect={setResultsFor} className={styles.clouds} />
        <SkyWindow className={styles.window}>
          <form className={styles.form} onSubmit={(event) => void start(event)}>
            <PixelTextInput
              label="task name"
              placeholder="enter task"
              value={name}
              maxLength={80}
              onChange={setName}
            />
            <CategorySelect value={category} onChange={setCategory} />
            {startError && (
              <p role="alert" className={styles.error}>
                {startError}
              </p>
            )}
            <PixelButton type="submit" disabled={!canStart} className={styles.start}>
              start task
            </PixelButton>
          </form>
        </SkyWindow>
      </Sky>
      <Pen
        sections={pen.sections.map((id) => (id === null ? null : pen.tasks[id]))}
        exiting={new Set(pen.exiting)}
        homeActive={loaded && animalCount === 0}
        onHome={() => navigate({ page: 'main' })}
        onSelect={(task) => setSelectedId(task.id)}
      />
      {selected && (
        <StopPopup
          task={selected}
          onStop={() => stop(selected)}
          onClose={() => setSelectedId(null)}
        />
      )}
      {resultsFor !== null && (
        <TaskResultsPopup taskId={resultsFor} onClose={() => setResultsFor(null)} />
      )}
    </main>
  )
}
