import { useEffect, useState } from 'react'
import type { Task } from '../../../shared/domain'
import { ui } from '../../assets/manifest'
import { useApi } from '../api/useApi'
import styles from './Cloud.module.css'

// A cloud, optionally showing a task name. Clickable only when given onClick; otherwise it's
// decoration (the garden page's drifting clouds).
export function Cloud(props: {
  label?: string
  onClick?: () => void
  className?: string
}): React.JSX.Element {
  const className = [styles.cloud, props.className].filter(Boolean).join(' ')
  const content = (
    <>
      <img className={styles.art} src={ui.cloud} alt="" />
      {props.label && <span className={styles.label}>{props.label}</span>}
    </>
  )
  if (props.onClick) {
    return (
      <button type="button" data-testid="cloud" className={className} onClick={props.onClick}>
        {content}
      </button>
    )
  }
  return (
    <div data-testid="cloud" className={className} aria-hidden="true">
      {content}
    </div>
  )
}

// The 5 recent-task clouds on the main and task pages. Refreshes whenever a task gets results.
export function RecentClouds(props: {
  onSelect: (taskId: number) => void
  className?: string
}): React.JSX.Element {
  const api = useApi()
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    let alive = true
    const load = (): void => {
      void api.tasks.listRecent().then((recent) => alive && setTasks(recent))
    }
    load()
    const unsubscribe = api.events.onTaskResults(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [api])

  return (
    <div data-testid="recent-clouds" className={[styles.row, props.className].join(' ')}>
      {tasks.map((task) => (
        <Cloud key={task.id} label={task.name} onClick={() => props.onSelect(task.id)} />
      ))}
    </div>
  )
}
