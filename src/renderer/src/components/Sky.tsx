import type { ReactNode } from 'react'
import styles from './Sky.module.css'

// The blue sky band at the top of every page. heightFraction is the share of the page it
// covers (3/4 on the main page, 2/3 on the task page, 1/3 on the garden page).
export function Sky(props: {
  heightFraction: number
  children?: ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <section
      data-testid="sky"
      className={[styles.sky, props.className].filter(Boolean).join(' ')}
      style={{ height: `${props.heightFraction * 100}%` }}
    >
      {props.children}
    </section>
  )
}

// The rectangular window in the middle of the sky that holds a page's main controls.
export function SkyWindow(props: { children?: ReactNode; className?: string }): React.JSX.Element {
  return (
    <div
      data-testid="sky-window"
      className={[styles.window, props.className].filter(Boolean).join(' ')}
    >
      {props.children}
    </div>
  )
}
