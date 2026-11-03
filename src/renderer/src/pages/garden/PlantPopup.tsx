import type { GardenPlant } from '../../../../shared/api'
import { Popup } from '../../components'
import { formatClock, formatDuration } from '../../format'
import styles from './PlantPopup.module.css'

// How far a plant has grown: its stage, a bar toward the next stage, its total and prestige.
// Every number comes from main (src/main/rewards); this only formats them.
export function PlantPopup(props: { plant: GardenPlant; onClose: () => void }): React.JSX.Element {
  const { plant } = props
  const lastStage = plant.stage === plant.stagesPerCycle
  const percent = Math.floor(plant.progress * 100)
  return (
    <Popup label={plant.plant} onClose={props.onClose} className={styles.popup}>
      <h2 className={styles.title}>{plant.plant}</h2>
      <p className={styles.category}>{plant.category}</p>
      <p className={styles.stage}>
        Stage {plant.stage} of {plant.stagesPerCycle}
      </p>
      <div
        role="progressbar"
        aria-label="progress to the next stage"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className={styles.bar}
      >
        <div data-testid="stage-fill" className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
      <p className={styles.clock}>
        {formatClock(plant.secondsIntoStage)} / {formatClock(plant.secondsPerStage)}
        {lastStage ? ' to a new cycle' : ' to the next stage'}
      </p>
      <p>Total grown: {formatDuration(Math.floor(plant.totalSeconds))}</p>
      <p>Prestige: {plant.prestige}</p>
    </Popup>
  )
}
