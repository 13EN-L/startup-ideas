import type { TaskResults } from '../../../shared/api'
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

// A task's time split into on-task, off-task, and idle. While Claude's labels are pending, a
// spinner stands in for the on/off-task part; idle comes from ActivityWatch and shows right away.
export function TimeBar(props: { results: TaskResults }): React.JSX.Element {
  const p = percentages(props.results)
  return (
    <div data-testid="time-bar" className={styles.bar}>
      {p.pending ? (
        <div
          data-testid="segment-pending"
          className={[styles.segment, styles.pending].join(' ')}
          style={{ width: `${100 - p.idle}%` }}
        >
          <FarmSpinner message="Sorting the harvest…" />
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
