// In-app setup: ActivityWatch check and API key entry
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SetupDialog, type SetupDialogProps } from '../../../src/renderer/components/SetupDialog';

const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz';

function setup(overrides: Partial<SetupDialogProps> = {}) {
  const props: SetupDialogProps = {
    status: { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'missing' },
    onRecheck: vi.fn(async () => {}),
    onSaveApiKey: vi.fn(async () => ({ ok: true as const })),
    onClearApiKey: vi.fn(async () => {}),
    onOpenLink: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<SetupDialog {...props} />);
  return props;
}

describe('SetupDialog: ActivityWatch', () => {
  it('confirms when ActivityWatch is running', () => {
    setup({ status: { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'saved' } });
    expect(screen.getByText(/ActivityWatch is running/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download ActivityWatch' })).not.toBeInTheDocument();
  });

  it('offers a download link and a re-check when it is not running', async () => {
    const props = setup({ status: { activityWatchRunning: false, activityWatchBundled: false, apiKey: 'saved' } });
    expect(screen.getByText(/ActivityWatch isn't running/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download ActivityWatch' }));
    expect(props.onOpenLink).toHaveBeenCalledWith('activityWatchDownload');
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));
    expect(props.onRecheck).toHaveBeenCalled();
  });
});

describe('SetupDialog: bundled ActivityWatch', () => {
  it('offers to start it again instead of a download when it ships with FocusGarden', async () => {
    const props = setup({ status: { activityWatchRunning: false, activityWatchBundled: true, apiKey: 'saved' } });
    expect(screen.getByText(/comes with FocusGarden but couldn't be started/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download ActivityWatch' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(props.onRecheck).toHaveBeenCalled();
  });
});

describe('SetupDialog: API key', () => {
  it('saves a pasted key', async () => {
    const user = userEvent.setup();
    const props = setup();
    await user.type(screen.getByLabelText('Anthropic API key'), KEY);
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(props.onSaveApiKey).toHaveBeenCalledWith(KEY);
  });

  it('hides the key while typing', () => {
    setup();
    expect(screen.getByLabelText('Anthropic API key')).toHaveAttribute('type', 'password');
  });

  it('shows why a key was rejected', async () => {
    const user = userEvent.setup();
    setup({ onSaveApiKey: vi.fn(async () => ({ ok: false as const, error: 'Anthropic rejected this key.' })) });
    await user.type(screen.getByLabelText('Anthropic API key'), KEY);
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(await screen.findByText('Anthropic rejected this key.')).toBeInTheDocument();
  });

  it('shows a warning when the key was saved but not checked', async () => {
    const user = userEvent.setup();
    setup({ onSaveApiKey: vi.fn(async () => ({ ok: true as const, warning: 'Saved, but could not check.' })) });
    await user.type(screen.getByLabelText('Anthropic API key'), KEY);
    await user.click(screen.getByRole('button', { name: 'Save key' }));
    expect(await screen.findByText('Saved, but could not check.')).toBeInTheDocument();
  });

  it('links to the page where keys are created', async () => {
    const props = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Get an API key' }));
    expect(props.onOpenLink).toHaveBeenCalledWith('anthropicApiKeys');
  });

  it('can remove a saved key', async () => {
    const props = setup({ status: { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'saved' } });
    expect(screen.getByText(/API key saved/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Anthropic API key')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove saved key' }));
    await waitFor(() => expect(props.onClearApiKey).toHaveBeenCalled());
  });

  it('explains when the key comes from the environment, and still allows saving one', () => {
    setup({ status: { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'environment' } });
    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
    expect(screen.getByLabelText('Anthropic API key')).toBeInTheDocument();
  });
});

describe('SetupDialog: reset all data', () => {
  const READY = { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'saved' as const };

  it('is hidden unless a reset handler is given', () => {
    setup({ status: READY });
    expect(screen.queryByRole('button', { name: 'Reset all data' })).not.toBeInTheDocument();
  });

  it('asks for confirmation, and Cancel erases nothing', async () => {
    const onResetData = vi.fn(async () => {});
    setup({ status: READY, onResetData });
    await userEvent.click(screen.getByRole('button', { name: 'Reset all data' }));
    expect(screen.getByText(/can't be undone/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onResetData).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Reset all data' })).toBeInTheDocument();
  });

  it('resets once confirmed and says so', async () => {
    const onResetData = vi.fn(async () => {});
    setup({ status: READY, onResetData });
    await userEvent.click(screen.getByRole('button', { name: 'Reset all data' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, erase everything' }));
    expect(onResetData).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('All data was reset.')).toBeInTheDocument();
  });

  it('shows why a reset failed', async () => {
    setup({ status: READY, onResetData: vi.fn(async () => Promise.reject(new Error('disk full'))) });
    await userEvent.click(screen.getByRole('button', { name: 'Reset all data' }));
    await userEvent.click(screen.getByRole('button', { name: 'Yes, erase everything' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not reset your data: disk full');
  });
});

describe('SetupDialog: closing', () => {
  it('says "Start" when everything is ready', async () => {
    const props = setup({ status: { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'saved' } });
    await userEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('says "Skip for now" while something is missing', async () => {
    const props = setup({ status: { activityWatchRunning: false, activityWatchBundled: false, apiKey: 'missing' } });
    await userEvent.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(props.onClose).toHaveBeenCalled();
  });

  it('shows a checking state before the status arrives', () => {
    setup({ status: null });
    expect(screen.getByText(/checking/i)).toBeInTheDocument();
  });
});
