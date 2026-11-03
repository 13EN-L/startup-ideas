import type { CSSProperties, ReactNode } from 'react'
import type { Trophy } from '../../../../shared/domain'
import { trophyImage, ui } from '../../../assets/manifest'
import { Cloud, Sky } from '../../components'
import styles from './GardenSky.module.css'

// Height of each cloud's lane, as a share of the sky.
const CLOUD_LANES = ['8%', '50%', '20%', '62%', '34%']
const TROPHY_ORDER: Trophy[] = ['bronze', 'silver', 'gold']

// The garden's top third: decorative clouds on a conveyor belt, with the logo and earned
// trophies in the upper left. children go on top (the home sign).
export function GardenSky(props: { trophies: Trophy[]; children?: ReactNode }): React.JSX.Element {
  const earned = TROPHY_ORDER.filter((t) => props.trophies.includes(t))
  return (
    <Sky heightFraction={1 / 3}>
      {CLOUD_LANES.map((top, i) => (
        // Each cloud starts a fifth of a lap after the last, so the loop has no seam.
        <div key={i} className={styles.lane} style={{ '--lane': i, '--top': top } as CSSProperties}>
          <Cloud className={styles.cloud} />
        </div>
      ))}
      <div className={styles.corner}>
        <img className={styles.logo} src={ui.logo} alt="FocusGarden" />
        <div data-testid="trophies" className={styles.trophies}>
          {earned.map((trophy) => (
            <img
              key={trophy}
              className={styles.trophy}
              src={trophyImage(trophy)}
              alt={`${trophy} trophy`}
            />
          ))}
        </div>
      </div>
      {props.children}
    </Sky>
  )
}
