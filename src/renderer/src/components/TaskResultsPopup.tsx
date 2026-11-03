import { useEffect, useState } from 'react'
import type { TaskResults } from '../../../shared/api'
import { useApi } from '../api/useApi'
import { formatDuration } from '../format'
import { Popup } from './Popup'
import { TimeBar } from './TimeBar'
import styles from './TaskResultsPopup.module.css'

// A task's results: name, time bar, then what the user did. Updates itself when labels arrive.
export function TaskResultsPopup(props: {
  taskId: number
  onClose: () => void
}): React.JSX.Element | null {
  const api = useApi()
  const { taskId } = props
  const [results, setResults] = useState<TaskResults | null>(null)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      void api.tasks.getResults(taskId).then((r) => alive && setResults(r))
    }
    load()
    const unsubscribe = api.events.onTaskResults((id) => id === taskId && load())
    return () => {
      alive = false
      unsubscribe()
    }
  }, [api, taskId])

  if (!results) return null
  return (
    <Popup label={results.task.name} onClose={props.onClose} className={styles.popup}>
      <h2 className={styles.title}>{results.task.name}</h2>
      <TimeBar results={results} />
      <h3 className={styles.subtitle}>What you did:</h3>
      <div className={styles.scroll}>
        <ul className={styles.list}>
          {results.items.map((item, i) => (
            <li key={i} className={styles.row}>
              <span className={styles.name}>{item.name}</span>
              <span className={styles.time}>{formatDuration(item.seconds)}</span>
              <span className={[styles.label, item.label && styles[item.label]].join(' ')}>
                {item.label ?? ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Popup>
  )
}
