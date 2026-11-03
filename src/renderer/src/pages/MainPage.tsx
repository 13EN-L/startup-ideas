import { PixelButton, RecentClouds, Sky, SkyWindow } from '../components'
import type { PageProps } from '../navigation'
import { GardenPreview } from './main/GardenPreview'
import styles from './main/MainPage.module.css'

export function MainPage(props: PageProps): React.JSX.Element {
  const { navigate } = props
  return (
    <main aria-label="Main page" className={styles.page}>
      <Sky heightFraction={3 / 4}>
        <RecentClouds
          className={styles.clouds}
          onSelect={(taskId) => navigate({ page: 'task', openResultsFor: taskId })}
        />
        <SkyWindow className={styles.window}>
          <h1 className={styles.title}>FocusGarden</h1>
          <PixelButton onClick={() => navigate({ page: 'task' })}>Tasks</PixelButton>
        </SkyWindow>
      </Sky>
      <GardenPreview onOpen={() => navigate({ page: 'garden' })} />
    </main>
  )
}
