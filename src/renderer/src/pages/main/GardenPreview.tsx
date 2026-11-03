import { useEffect, useState } from 'react'
import type { GardenPlant } from '../../../../shared/api'
import { plantImage } from '../../../assets/manifest'
import { useApi } from '../../api/useApi'
import styles from './MainPage.module.css'

// The main page's simplified garden: a grass strip with each plant's current stage standing on
// it. The row is centered, so each new plant pushes the earlier ones left and it stays symmetrical.
export function GardenPreview(props: { onOpen: () => void }): React.JSX.Element {
  const api = useApi()
  const [plants, setPlants] = useState<GardenPlant[]>([])

  useEffect(() => {
    let alive = true
    const load = (): void => {
      void api.garden.getState().then((state) => {
        if (alive) setPlants([...state.plants].sort((a, b) => a.position - b.position))
      })
    }
    load()
    const unsubscribe = api.events.onGardenChanged(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [api])

  return (
    <button
      type="button"
      className={styles.preview}
      aria-label="Open garden"
      onClick={props.onOpen}
    >
      <span data-testid="preview-row" className={styles.row}>
        {plants.map((plant) => (
          <img
            key={plant.category}
            className={styles.plant}
            src={plantImage(plant.plant, plant.stage)}
            alt={plant.plant}
          />
        ))}
      </span>
    </button>
  )
}
