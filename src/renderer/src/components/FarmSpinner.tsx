import { ui } from '../../assets/manifest'
import styles from './FarmSpinner.module.css'

export function FarmSpinner(props: { message: string; className?: string }): React.JSX.Element {
  return (
    <div role="status" className={[styles.spinner, props.className].filter(Boolean).join(' ')}>
      <img className={styles.art} src={ui.spinner} alt="" />
      <span>{props.message}</span>
    </div>
  )
}
