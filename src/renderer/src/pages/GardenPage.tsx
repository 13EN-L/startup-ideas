import { useEffect, useState } from 'react'
import type { Category } from '../../../shared/domain'
import type { GardenState } from '../../../shared/api'
import { useApi } from '../api/useApi'
import { HomeSign } from '../components'
import type { PageProps } from '../navigation'
import styles from './garden/GardenPage.module.css'
import { GardenSky } from './garden/GardenSky'
import { PlantPopup } from './garden/PlantPopup'
import { Plots } from './garden/Plots'

// The garden: drifting clouds, logo and trophies in the sky; one dirt plot per plant on the
// grass. Plants never grow in real time, so the state only reloads when main says it changed.
// Clicking a plant opens a popup with its progress.
export function GardenPage(props: PageProps): React.JSX.Element {
  const api = useApi()
  const [garden, setGarden] = useState<GardenState | null>(null)
  const [selected, setSelected] = useState<Category | null>(null)
  const selectedPlant = garden?.plants.find((p) => p.category === selected)

  useEffect(() => {
    let alive = true
    const load = (): void => {
      void api.garden.getState().then((state) => alive && setGarden(state))
    }
    load()
    const unsubscribe = api.events.onGardenChanged(load)
    return () => {
      alive = false
      unsubscribe()
    }
  }, [api])

  return (
    <main aria-label="Garden page" className={styles.page}>
      <GardenSky trophies={garden?.trophies ?? []}>
        <HomeSign
          active
          className={styles.homeSign}
          onClick={() => props.navigate({ page: 'main' })}
        />
      </GardenSky>
      <Plots plants={garden?.plants ?? null} onSelect={(plant) => setSelected(plant.category)} />
      {selectedPlant && <PlantPopup plant={selectedPlant} onClose={() => setSelected(null)} />}
    </main>
  )
}
