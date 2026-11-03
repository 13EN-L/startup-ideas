// First-run setup (also reachable from Settings): checks ActivityWatch and
// takes the Anthropic API key, so nobody has to edit environment variables.
import { useId, useState, type FormEvent } from 'react';
import type { ExternalLink, SaveApiKeyResult, SetupStatus } from '../../shared/bridge';
import { useEscape } from './useEscape';

export interface SetupDialogProps {
  /** null while the first check is still running. */
  status: SetupStatus | null;
  onRecheck: () => Promise<void>;
  onSaveApiKey: (key: string) => Promise<SaveApiKeyResult>;
  onClearApiKey: () => Promise<void>;
  onOpenLink: (link: ExternalLink) => void;
  onClose: () => void;
}

export function isSetupComplete(status: SetupStatus | null): boolean {
  return !!status && status.activityWatchRunning && status.apiKey !== 'missing';
}

export function SetupDialog({
  status,
  onRecheck,
  onSaveApiKey,
  onClearApiKey,
  onOpenLink,
  onClose,
}: SetupDialogProps) {
  const titleId = useId();
  const keyInputId = useId();
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);
  useEscape(onClose);

  const saveKey = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const result = await onSaveApiKey(key);
      if (result.ok) {
        setKey('');
        setMessage(result.warning ? { kind: 'info', text: result.warning } : null);
      } else {
        setMessage({ kind: 'error', text: result.error });
      }
    } finally {
      setSaving(false);
    }
  };

  const recheck = async () => {
    setChecking(true);
    try {
      await onRecheck();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="overlay">
      <div className="popup popup--setup" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className="popup__title">
          Set up FocusGarden
        </h2>

        {status === null ? (
          <p>Checking your setup…</p>
        ) : (
          <>
            <section className="setup-step">
              <h3 className="setup-step__title">
                <span className={`setup-step__mark setup-step__mark--${status.activityWatchRunning ? 'ok' : 'todo'}`} aria-hidden="true">
                  {status.activityWatchRunning ? '✓' : '1'}
                </span>
                ActivityWatch
              </h3>
              {status.activityWatchRunning ? (
                <p>ActivityWatch is running. FocusGarden can see which apps and sites you use during a task.</p>
              ) : (
                <>
                  <p>
                    ActivityWatch isn't running. FocusGarden uses this free app to see which apps and sites you use
                    during a task. Install it, start it, then check again.
                  </p>
                  <div className="setup-step__actions">
                    <button type="button" className="btn" onClick={() => onOpenLink('activityWatchDownload')}>
                      Download ActivityWatch
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={recheck} disabled={checking}>
                      {checking ? 'Checking…' : 'Check again'}
                    </button>
                  </div>
                </>
              )}
            </section>

            <section className="setup-step">
              <h3 className="setup-step__title">
                <span className={`setup-step__mark setup-step__mark--${status.apiKey !== 'missing' ? 'ok' : 'todo'}`} aria-hidden="true">
                  {status.apiKey !== 'missing' ? '✓' : '2'}
                </span>
                Claude API key
              </h3>

              {status.apiKey === 'saved' ? (
                <>
                  <p>API key saved on this computer.</p>
                  <div className="setup-step__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => void onClearApiKey()}>
                      Remove saved key
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    {status.apiKey === 'environment'
                      ? 'Using the key from the ANTHROPIC_API_KEY environment variable. You can save a different key here instead.'
                      : 'FocusGarden asks Claude which of your apps and sites were on-task. Paste an Anthropic API key to turn this on.'}
                  </p>
                  <form className="setup-key" onSubmit={saveKey}>
                    <label htmlFor={keyInputId} className="setup-key__label">
                      Anthropic API key
                    </label>
                    <div className="setup-key__row">
                      <input
                        id={keyInputId}
                        className="task-form__input"
                        type="password"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder="sk-ant-…"
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                      />
                      <button type="submit" className="btn" disabled={saving || key.trim() === ''}>
                        {saving ? 'Checking…' : 'Save key'}
                      </button>
                    </div>
                  </form>
                  <button type="button" className="link-button" onClick={() => onOpenLink('anthropicApiKeys')}>
                    Get an API key
                  </button>
                </>
              )}

              {message && (
                <p className={`setup-message setup-message--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>
                  {message.text}
                </p>
              )}
            </section>
          </>
        )}

        <button type="button" className="btn" onClick={onClose}>
          {isSetupComplete(status) ? 'Start' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}
