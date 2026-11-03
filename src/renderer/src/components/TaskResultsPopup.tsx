import { useEffect, useState } from 'react'
import type { TaskResults, WaitReason } from '../../../shared/api'
import { useApi } from '../api/useApi'
import { formatDuration } from '../format'
import { ApiKeyPopup } from './ApiKeyPopup'
import { PixelButton } from './controls'
import { Popup } from './Popup'
import { TimeBar } from './TimeBar'
import styles from './TaskResultsPopup.module.css'

// When labels are stuck on the API key, say so and let the user fix it right here.
const KEY_PROBLEMS: Partial<Record<WaitReason, { note: string; button: string }>> = {
  'no-api-key': {
    note: 'Add your Claude API key so Claude can sort this task.',
    button: 'add key'
  },
  'api-key-rejected': {
    note: 'Claude didn’t accept your API key. Check it and enter it again.',
    button: 'change key'
  },
  'claude-error': {
    note: 'Claude refused the request. Check your API key and account, then enter the key again.',
    button: 'change key'
  }
}

// A task's results: name, time bar, then what the user did. Updates itself when labels arrive.
export function TaskResultsPopup(props: {
  taskId: number
  onClose: () => void
}): React.JSX.Element | null {
  const api = useApi()
  const { taskId } = props
  const [results, setResults] = useState<TaskResults | null>(null)
  const [enteringKey, setEnteringKey] = useState(false)

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
  const keyProblem = results.waiting && KEY_PROBLEMS[results.waiting]
  return (
    <>
      <Popup label={results.task.name} onClose={props.onClose} className={styles.popup}>
        <h2 className={styles.title}>{results.task.name}</h2>
        <TimeBar results={results} />
        {keyProblem && (
          <div className={styles.keyProblem}>
            <p>{keyProblem.note}</p>
            <PixelButton onClick={() => setEnteringKey(true)}>{keyProblem.button}</PixelButton>
          </div>
        )}
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
      {/* Saving a key retries the task; the new reason or labels arrive through onTaskResults. */}
      {enteringKey && <ApiKeyPopup onClose={() => setEnteringKey(false)} />}
    </>
  )
}
