import type { ReactNode } from 'react'
import { CATEGORIES, type Category } from '../../../shared/domain'
import styles from './controls.module.css'

const cx = (...names: (string | undefined | false)[]): string => names.filter(Boolean).join(' ')

export function PixelButton(props: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}): React.JSX.Element {
  return (
    <button
      type={props.type ?? 'button'}
      className={cx(styles.button, props.className)}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  )
}

export function PixelTextInput(props: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: 'text' | 'password'
  maxLength?: number
  className?: string
}): React.JSX.Element {
  return (
    <input
      className={cx(styles.input, props.className)}
      aria-label={props.label}
      type={props.type ?? 'text'}
      value={props.value}
      placeholder={props.placeholder}
      maxLength={props.maxLength}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => props.onChange(event.target.value)}
    />
  )
}

// The "category" dropdown. value is '' until the user picks one.
export function CategorySelect(props: {
  value: Category | ''
  onChange: (category: Category) => void
  className?: string
}): React.JSX.Element {
  return (
    <select
      className={cx(styles.input, styles.select, props.className)}
      aria-label="category"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value as Category)}
    >
      <option value="" disabled>
        category
      </option>
      {CATEGORIES.map((category) => (
        <option key={category} value={category}>
          {category}
        </option>
      ))}
    </select>
  )
}
