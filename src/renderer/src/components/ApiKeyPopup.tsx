import { useState } from 'react'
import { useApi } from '../api/useApi'
import { PixelButton, PixelTextInput } from './controls'
import { Popup } from './Popup'
import styles from './ApiKeyPopup.module.css'

// Asks for the user's Claude API key. The main process encrypts and stores it; the renderer
// forgets it as soon as it's sent. onClose(true) after saving, onClose(false) if skipped.
export function ApiKeyPopup(props: { onClose: (saved: boolean) => void }): React.JSX.Element {
  const api = useApi()
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save(): Promise<void> {
    setSaving(true)
    setFailed(false)
    try {
      await api.settings.setApiKey(key.trim())
      setKey('')
      props.onClose(true)
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popup label="Connect Claude" onClose={() => props.onClose(false)} className={styles.popup}>
      <h2 className={styles.title}>Connect Claude</h2>
      <p>
        FocusGarden uses your Claude API key to sort each task’s apps and sites into on-task and
        off-task. It’s stored encrypted on this computer.
      </p>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault()
          if (key.trim() && !saving) void save()
        }}
      >
        <PixelTextInput
          label="Claude API key"
          type="password"
          placeholder="sk-ant-…"
          value={key}
          maxLength={1000}
          onChange={setKey}
        />
        {failed && (
          <p role="alert" className={styles.error}>
            Couldn’t save the key. Try again.
          </p>
        )}
        <div className={styles.buttons}>
          <PixelButton onClick={() => props.onClose(false)}>cancel</PixelButton>
          <PixelButton type="submit" disabled={!key.trim() || saving}>
            save
          </PixelButton>
        </div>
      </form>
    </Popup>
  )
}
