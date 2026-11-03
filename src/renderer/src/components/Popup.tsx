import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Popup.module.css'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// A beige pixel-art modal. Esc or the close button closes it; Tab stays inside.
export function Popup(props: {
  label: string
  onClose: () => void
  children: ReactNode
  className?: string
}): React.JSX.Element {
  const dialog = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const first = body.current?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? dialog.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus()
  }, [])

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.stopPropagation()
      props.onClose()
      return
    }
    if (event.key !== 'Tab' || !dialog.current) return
    const items = [...dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute('disabled')
    )
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className={styles.overlay}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={props.label}
        className={[styles.popup, props.className].filter(Boolean).join(' ')}
        onKeyDown={onKeyDown}
      >
        <div ref={body} className={styles.body}>
          {props.children}
        </div>
        <button type="button" aria-label="close" className={styles.close} onClick={props.onClose}>
          x
        </button>
      </div>
    </div>
  )
}
