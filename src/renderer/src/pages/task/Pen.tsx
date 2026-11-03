import type { Task } from '../../../../shared/domain'
import { animalImage, ui } from '../../../assets/manifest'
import { HomeSign } from '../../components'
import styles from './Pen.module.css'

// Straw tufts scattered over the dirt, as [left %, top %] of the field.
const STRAW: [number, number][] = [
  [8, 18],
  [21, 62],
  [30, 30],
  [44, 78],
  [52, 22],
  [63, 55],
  [72, 84],
  [80, 34],
  [91, 66],
  [14, 88],
  [38, 52],
  [86, 12]
]

// The fenced pen: one section per active task, each holding that task's animal.
export function Pen(props: {
  sections: (Task | null)[]
  exiting: ReadonlySet<number>
  homeActive: boolean
  onHome: () => void
  onSelect: (task: Task) => void
}): React.JSX.Element {
  const fence = { backgroundImage: `url(${ui.fence})` }
  return (
    <section aria-label="pen" className={styles.pen}>
      <div aria-hidden="true" className={styles.straw}>
        {STRAW.map(([left, top]) => (
          <span key={`${left}-${top}`} style={{ left: `${left}%`, top: `${top}%` }} />
        ))}
      </div>
      <div data-testid="fence" aria-hidden="true">
        <div className={`${styles.fence} ${styles.topLeft}`} style={fence} />
        <div className={`${styles.fence} ${styles.topRight}`} style={fence} />
        <div className={`${styles.fence} ${styles.side} ${styles.left}`} style={fence} />
        <div className={`${styles.fence} ${styles.side} ${styles.right}`} style={fence} />
      </div>
      <img
        data-testid="gate"
        data-open={String(props.exiting.size > 0)}
        className={styles.gate}
        src={ui.gate}
        alt=""
      />
      <div className={styles.sections}>
        {props.sections.map((task, i) => (
          <div key={i} data-testid="pen-section" data-section={i} className={styles.section}>
            {task && (
              <button
                type="button"
                data-testid="animal"
                data-exiting={String(props.exiting.has(task.id))}
                aria-label={`${task.name} (${task.animal})`}
                className={styles.animal}
                disabled={props.exiting.has(task.id)}
                onClick={() => props.onSelect(task)}
              >
                <span data-testid="nametag" className={styles.nametag}>
                  {task.name}
                </span>
                <img className={styles.sprite} src={animalImage(task.animal)} alt="" />
              </button>
            )}
          </div>
        ))}
      </div>
      <HomeSign active={props.homeActive} onClick={props.onHome} className={styles.home} />
    </section>
  )
}
