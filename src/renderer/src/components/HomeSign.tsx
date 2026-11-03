import { ui } from '../../assets/manifest'
import styles from './HomeSign.module.css'

// A fence sign labeled "home". Deactivated (greyed, not clickable) while tasks are active.
// The sign art carries the label and both color states.
export function HomeSign(props: {
  active: boolean
  onClick: () => void
  className?: string
}): React.JSX.Element {
  const state = props.active ? 'active' : 'inactive'
  return (
    <button
      type="button"
      aria-label="home"
      data-state={state}
      disabled={!props.active}
      onClick={props.onClick}
      className={[styles.sign, props.className].filter(Boolean).join(' ')}
    >
      <img className={styles.art} src={ui.homeSign[state]} alt="" />
    </button>
  )
}
