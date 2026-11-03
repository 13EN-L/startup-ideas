import { useEffect, useState } from 'react'
import type { Task } from '../../../../shared/domain'
import { PixelButton, Popup } from '../../components'
import { formatElapsed } from './penLayout'
import styles from './TaskPage.module.css'

// Time since the animal spawned, ticking every second, with a "stop" button below.
export function StopPopup(props: {
  task: Task
  onStop: () => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now())
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  async function stop(): Promise<void> {
    setStopping(true)
    setError(null)
    try {
      await props.onStop()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStopping(false)
    }
  }

  return (
    <Popup label={props.task.name} onClose={props.onClose} className={styles.stopPopup}>
      <h2 className={styles.stopTitle}>{props.task.name}</h2>
      <p data-testid="elapsed" className={styles.elapsed}>
        {formatElapsed((now - props.task.startedAt) / 1000)}
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <PixelButton onClick={() => void stop()} disabled={stopping}>
        stop
      </PixelButton>
    </Popup>
  )
}
