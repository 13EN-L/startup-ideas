import type { TaskResults, WaitReason } from '../../../shared/api'
import { percentages } from '../format'
import { FarmSpinner } from './FarmSpinner'
import styles from './TimeBar.module.css'

function Segment(props: {
  kind: 'on-task' | 'off-task' | 'idle'
  percent: number
}): React.JSX.Element | null {
  if (props.percent <= 0) return null
  return (
    <div
      data-testid={`segment-${props.kind}`}
      className={[styles.segment, styles[props.kind]].join(' ')}
      style={{ width: `${props.percent}%` }}
      title={`${props.kind} ${props.percent}%`}
    >
      <span className={styles.label}>{props.percent}%</span>
    </div>
  )
}

// What the on/off-task part of the bar says while labels are pending. Blocked reasons need the
// user to act (see TaskResultsPopup), so they show no spinner.
const WAITING: Record<WaitReason, { message: string; blocked: boolean }> = {
  'reading-activity': { message: 'Reading what you did…', blocked: false },
  activitywatch: { message: 'Waiting for ActivityWatch…', blocked: false },
  labeling: { message: 'Sorting the harvest…', blocked: false },
  retrying: { message: 'Claude is busy. Trying again soon…', blocked: false },
  'no-api-key': { message: 'Needs a Claude API key', blocked: true },
  'api-key-rejected': { message: 'API key rejected', blocked: true },
  'claude-error': { message: 'Claude couldn’t sort this', blocked: true }
}

// A task's time split into on-task, off-task, and idle. While Claude's labels are pending, the
// reason stands in for the on/off-task part; idle comes from ActivityWatch and shows right away.
export function TimeBar(props: { results: TaskResults }): React.JSX.Element {
  const p = percentages(props.results)
  const wait = WAITING[props.results.waiting ?? 'labeling']
  return (
    <div data-testid="time-bar" className={styles.bar}>
      {p.pending ? (
        <div
          data-testid="segment-pending"
          data-blocked={wait.blocked}
          className={[styles.segment, styles.pending, wait.blocked && styles.blocked].join(' ')}
          style={{ width: `${100 - p.idle}%` }}
        >
          {wait.blocked ? (
            <span className={styles.label}>{wait.message}</span>
          ) : (
            <FarmSpinner message={wait.message} />
          )}
        </div>
      ) : (
        <>
          <Segment kind="on-task" percent={p.onTask!} />
          <Segment kind="off-task" percent={p.offTask!} />
        </>
      )}
      <Segment kind="idle" percent={p.idle} />
    </div>
  )
}
