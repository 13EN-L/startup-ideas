import type { CSSProperties } from 'react'
import type { GardenPlant } from '../../../../shared/api'
import { plantImage } from '../../../assets/manifest'
import styles from './Plots.module.css'

const PLOTS_PER_ROW = 5

// The grass: one dirt plot per plant in position order. Up to 5 sit in one centered row; from
// 6 on, plants 1-5 take the upper half and 6-10 the lower half. plants is null until loaded.
export function Plots(props: {
  plants: GardenPlant[] | null
  onSelect: (plant: GardenPlant) => void
}): React.JSX.Element {
  const plants = [...(props.plants ?? [])].sort((a, b) => a.position - b.position)
  const rows: GardenPlant[][] = []
  for (let i = 0; i < plants.length; i += PLOTS_PER_ROW) {
    rows.push(plants.slice(i, i + PLOTS_PER_ROW))
  }
  // Every plot is as wide as the fullest row allows, so both rows line up.
  const perRow = Math.min(plants.length, PLOTS_PER_ROW)

  return (
    <section
      data-testid="grass"
      data-loaded={props.plants !== null}
      data-rows={rows.length}
      className={[styles.grass, perRow === PLOTS_PER_ROW ? styles.narrow : ''].join(' ')}
    >
      {props.plants?.length === 0 && (
        <p className={styles.hint}>Finish a task to plant your first seed.</p>
      )}
      {rows.map((row, r) => (
        <div key={r} data-testid="plot-row" data-row={r + 1} className={styles.row}>
          {row.map((plant) => (
            <Plot
              key={plant.category}
              plant={plant}
              perRow={perRow}
              onSelect={() => props.onSelect(plant)}
            />
          ))}
        </div>
      ))}
    </section>
  )
}

// A dirt plot with its plant, prestige count and a category sign. Clicking the plant opens its
// progress popup.
function Plot(props: {
  plant: GardenPlant
  perRow: number
  onSelect: () => void
}): React.JSX.Element {
  const { plant } = props
  return (
    <div
      data-testid="plot"
      data-position={plant.position}
      data-category={plant.category}
      className={styles.plot}
      style={{ '--plots': props.perRow } as CSSProperties}
    >
      <button
        type="button"
        className={styles.plantButton}
        aria-label={`${plant.plant}, ${plant.category}, stage ${plant.stage}`}
        onClick={props.onSelect}
      >
        <img
          data-testid="plant"
          className={styles.plant}
          src={plantImage(plant.plant, plant.stage)}
          alt={`${plant.plant}, stage ${plant.stage}`}
          style={{ transform: `scale(${plant.scale})` }}
        />
      </button>
      <span
        data-testid="prestige"
        className={styles.prestige}
        aria-label={`prestige ${plant.prestige}`}
      >
        {plant.prestige}
      </span>
      <span data-testid="plot-sign" className={styles.sign}>
        {plant.category}
      </span>
    </div>
  )
}
