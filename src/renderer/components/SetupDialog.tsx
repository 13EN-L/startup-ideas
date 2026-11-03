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
  /** Turns starting ActivityWatch at sign-in on or off. Omit to hide the option. */
  onSetActivityWatchAutostart?: (enabled: boolean) => Promise<void>;
  /** Erases tasks and the garden (not the API key). Omit to hide the option. */
  onResetData?: () => Promise<void>;
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
  onSetActivityWatchAutostart,
  onResetData,
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

  const [savingAutostart, setSavingAutostart] = useState(false);
  const changeAutostart = async (enabled: boolean) => {
    if (!onSetActivityWatchAutostart) return;
    setSavingAutostart(true);
    setMessage(null);
    try {
      await onSetActivityWatchAutostart(enabled);
    } catch (e) {
      setMessage({ kind: 'error', text: `Could not change the sign-in setting: ${(e as Error).message}` });
    } finally {
      setSavingAutostart(false);
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
              ) : status.activityWatchBundled ? (
                <>
                  <p>
                    ActivityWatch comes with FocusGarden but couldn't be started. FocusGarden needs it to see which apps
                    and sites you use during a task.
                  </p>
                  <div className="setup-step__actions">
                    <button type="button" className="btn" onClick={recheck} disabled={checking}>
                      {checking ? 'Starting…' : 'Try again'}
                    </button>
                  </div>
                </>
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
              {status.activityWatchAutostart !== 'unavailable' && onSetActivityWatchAutostart && (
                <label className="setup-toggle">
                  <input
                    type="checkbox"
                    checked={status.activityWatchAutostart === 'on'}
                    disabled={savingAutostart}
                    onChange={(e) => void changeAutostart(e.target.checked)}
                  />
                  <span>
                    Start ActivityWatch when I sign in
                    <small>
                      Keeps tracking after a restart, even before you open FocusGarden. Only ActivityWatch needs to be
                      running to record a task.
                    </small>
                  </span>
                </label>
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

            <section className="setup-step">
              <h3 className="setup-step__title">
                <span className={`setup-step__mark setup-step__mark--${status.websiteTracking === 'extension' ? 'ok' : 'optional'}`} aria-hidden="true">
                  {status.websiteTracking === 'extension' ? '✓' : '3'}
                </span>
                Website tracking (optional)
              </h3>
              {status.websiteTracking === 'extension' ? (
                <p>The ActivityWatch browser extension is connected. FocusGarden sees the exact websites and searches you use.</p>
              ) : (
                <>
                  <p>
                    FocusGarden reads page titles from your browser window, so it already sees websites and Google searches.
                    For exact websites and searches on every search engine, add the ActivityWatch browser extension, browse
                    for a moment, then click Check for the extension.
                  </p>
                  <div className="setup-step__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => onOpenLink('webWatcherChrome')}>
                      Chrome / Edge extension
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => onOpenLink('webWatcherFirefox')}>
                      Firefox add-on
                    </button>
                    <button type="button" className="link-button setup-step__recheck" onClick={recheck} disabled={checking}>
                      {checking ? 'Checking…' : 'Check for the extension'}
                    </button>
                  </div>
                </>
              )}
            </section>

            {onResetData && <ResetDataStep onReset={onResetData} />}
          </>
        )}

        <button type="button" className="btn" onClick={onClose}>
          {isSetupComplete(status) ? 'Close' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}

/** "Reset all data", behind a confirmation because it can't be undone. */
function ResetDataStep({ onReset }: { onReset: () => Promise<void> }) {
  const [phase, setPhase] = useState<'idle' | 'confirming' | 'resetting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = async () => {
    setPhase('resetting');
    setError(null);
    try {
      await onReset();
      setPhase('done');
    } catch (e) {
      setError(`Could not reset your data: ${(e as Error).message}`);
      setPhase('confirming');
    }
  };

  return (
    <section className="setup-step">
      <h3 className="setup-step__title">Your data</h3>
      {phase === 'idle' || phase === 'done' ? (
        <>
          <p>Reset all data erases every task, plant, prestige and trophy. Your saved API key is kept.</p>
          <div className="setup-step__actions">
            <button type="button" className="btn btn--secondary" onClick={() => setPhase('confirming')}>
              Reset all data
            </button>
          </div>
          {phase === 'done' && (
            <p className="setup-message setup-message--info" role="status">
              All data was reset.
            </p>
          )}
        </>
      ) : (
        <>
          <p>
            <strong>This can't be undone.</strong> Erase all your tasks and your garden?
          </p>
          <div className="setup-step__actions">
            <button type="button" className="btn btn--danger" onClick={reset} disabled={phase === 'resetting'}>
              {phase === 'resetting' ? 'Erasing…' : 'Yes, erase everything'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setPhase('idle')} disabled={phase === 'resetting'}>
              Cancel
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="setup-message setup-message--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
