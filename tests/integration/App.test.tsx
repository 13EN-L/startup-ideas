// Issue #20 (with #19): app-level state persistence and restore through the bridge
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import type { FocusGardenBridge, SetupStatus } from '../../src/shared/bridge';
import type { AppState, CompletedTask } from '../../src/shared/types';
import { makeActiveTask, makeCompletedTask, makeState, T0 } from '../fixtures';

const NOW = T0 + 20 * 60_000;
const READY: SetupStatus = { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'saved', websiteTracking: 'page-titles' };

function fakeBridge(initial: AppState, finished?: CompletedTask, setup: SetupStatus = READY) {
  return {
    loadState: vi.fn(async () => initial),
    saveState: vi.fn(async (_state: AppState) => {}),
    finishTask: vi.fn(async () => finished ?? makeCompletedTask()),
    getSetupStatus: vi.fn(async (): Promise<SetupStatus> => setup),
    saveApiKey: vi.fn(async (_key: string) => ({ ok: true as const })),
    clearApiKey: vi.fn(async () => {}),
    openExternal: vi.fn(async () => {}),
    getPlantAbout: vi.fn(async (): Promise<string | null> => 'Pines are evergreen conifers.'),
  } satisfies FocusGardenBridge;
}

function renderApp(bridge: FocusGardenBridge) {
  let n = 0;
  return render(
    <App bridge={bridge} clock={() => NOW} random={() => 0.35} createId={() => `new-${++n}`} />,
  );
}

const lastSaved = (bridge: ReturnType<typeof fakeBridge>) =>
  bridge.saveState.mock.calls.at(-1)?.[0] as AppState | undefined;

describe('#20 launch restore', () => {
  it('restores the Task page with Home greyed out when tasks were active', async () => {
    const bridge = fakeBridge(
      makeState({ route: 'main', activeTasks: [makeActiveTask({ name: 'Essay', animal: 'cow' })] }),
    );
    renderApp(bridge);
    expect(await screen.findByRole('button', { name: 'Essay (cow)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Home' })).toBeDisabled();
  });

  it('reopens the saved page when nothing was active', async () => {
    renderApp(fakeBridge(makeState({ route: 'garden', plants: { work: { category: 'work', totalMinutes: 5 } } })));
    expect(await screen.findByTestId('plot-work')).toBeInTheDocument();
  });

  it('opens on the Main page on first launch', async () => {
    renderApp(fakeBridge(makeState()));
    expect(await screen.findByRole('button', { name: 'Tasks' })).toBeInTheDocument();
  });

  it('keeps showing recent task clouds after a restart', async () => {
    const completed = [makeCompletedTask({ name: 'Old essay', endedAt: T0 })];
    renderApp(fakeBridge(makeState({ completedTasks: completed })));
    expect(await screen.findByRole('button', { name: 'Old essay' })).toBeInTheDocument();
  });
});

describe('first-run setup', () => {
  it('opens the setup window on launch when something is missing', async () => {
    renderApp(fakeBridge(makeState(), undefined, { activityWatchRunning: false, activityWatchBundled: false, apiKey: 'missing', websiteTracking: 'page-titles' }));
    expect(await screen.findByRole('dialog', { name: 'Set up FocusGarden' })).toBeInTheDocument();
  });

  it('stays out of the way when everything is ready', async () => {
    renderApp(fakeBridge(makeState()));
    await screen.findByRole('button', { name: 'Tasks' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('re-checks after a key is saved and can be closed to use the app', async () => {
    const user = userEvent.setup();
    const bridge = fakeBridge(makeState(), undefined, { activityWatchRunning: true, activityWatchBundled: false, apiKey: 'missing', websiteTracking: 'page-titles' });
    renderApp(bridge);

    await user.type(await screen.findByLabelText('Anthropic API key'), 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    bridge.getSetupStatus.mockResolvedValue(READY);
    await user.click(screen.getByRole('button', { name: 'Save key' }));

    expect(bridge.saveApiKey).toHaveBeenCalledWith('sk-ant-api03-abcdefghijklmnopqrstuvwxyz');
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('reopens from Settings on the Main page', async () => {
    renderApp(fakeBridge(makeState()));
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Set up FocusGarden' })).toBeInTheDocument();
  });
});

describe('reset all data', () => {
  it('erases tasks and the garden from Settings, saves that, and keeps the API key', async () => {
    const user = userEvent.setup();
    const bridge = fakeBridge(
      makeState({
        completedTasks: [makeCompletedTask({ name: 'Old essay', category: 'work' })],
        plants: { work: { category: 'work', totalMinutes: 40 } },
      }),
    );
    renderApp(bridge);
    expect(await screen.findByRole('button', { name: 'Old essay' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Reset all data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, erase everything' }));

    expect(await screen.findByText('All data was reset.')).toBeInTheDocument();
    expect(lastSaved(bridge)).toEqual(makeState());
    expect(bridge.clearApiKey).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Old essay' })).not.toBeInTheDocument();
  });

  it('drops a task whose analysis finishes after the reset', async () => {
    const user = userEvent.setup();
    let finish!: (task: CompletedTask) => void;
    const bridge = fakeBridge(makeState({ route: 'task', activeTasks: [makeActiveTask({ id: 'a1', name: 'Essay', animal: 'cow' })] }));
    bridge.finishTask.mockImplementation(() => new Promise<CompletedTask>((resolve) => (finish = resolve)));
    renderApp(bridge);

    await user.click(await screen.findByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.animationEnd(screen.getByRole('button', { name: 'Essay (cow)' }));
    await user.click(await screen.findByRole('button', { name: 'Home' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(screen.getByRole('button', { name: 'Reset all data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, erase everything' }));
    await screen.findByText('All data was reset.');

    finish(makeCompletedTask({ name: 'Essay' }));
    await waitFor(() => expect(lastSaved(bridge)).toEqual(makeState()));
    expect(screen.queryByRole('button', { name: 'Essay' })).not.toBeInTheDocument();
  });
});

describe('#20 saving state', () => {
  it('saves the page when navigating', async () => {
    const bridge = fakeBridge(makeState());
    renderApp(bridge);
    await userEvent.click(await screen.findByRole('button', { name: 'Tasks' }));
    await waitFor(() => expect(lastSaved(bridge)?.route).toBe('task'));
  });

  it('saves a newly started task so it survives a restart', async () => {
    const user = userEvent.setup();
    const bridge = fakeBridge(makeState({ route: 'task' }));
    renderApp(bridge);

    await user.type(await screen.findByPlaceholderText('enter task'), 'Read chapter 4');
    await user.selectOptions(screen.getByRole('combobox', { name: 'category' }), 'School / Study');
    await user.click(screen.getByRole('button', { name: 'start task' }));

    expect(await screen.findByRole('button', { name: 'Read chapter 4 (sheep)' })).toBeInTheDocument();
    await waitFor(() =>
      expect(lastSaved(bridge)?.activeTasks).toEqual([
        { id: 'new-1', name: 'Read chapter 4', category: 'school', animal: 'sheep', slot: 0, startedAt: NOW },
      ]),
    );
  });
});

describe('#20 Main page cloud -> Task page result popup', () => {
  it('navigates to the Task page and opens that task popup', async () => {
    const completed = makeCompletedTask({ id: 'c1', name: 'Gym session', category: 'health' });
    renderApp(fakeBridge(makeState({ completedTasks: [completed] })));
    await userEvent.click(await screen.findByRole('button', { name: 'Gym session' }));
    expect(screen.getByPlaceholderText('enter task')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Gym session' })).toBeInTheDocument();
  });
});

describe('#19/#17 stopping a task end to end', () => {
  it('runs the pipeline, adds a cloud, grows the plant and re-enables Home', async () => {
    const user = userEvent.setup();
    const active = makeActiveTask({ id: 'a1', name: 'Essay', animal: 'cow', category: 'school' });
    const finished = makeCompletedTask({
      id: 'a1',
      name: 'Essay',
      category: 'school',
      endedAt: NOW,
      metrics: { productiveSeconds: 12 * 60, unproductiveSeconds: 0, idleSeconds: 0 },
    });
    const bridge = fakeBridge(makeState({ route: 'task', activeTasks: [active] }), finished);
    renderApp(bridge);

    await user.click(await screen.findByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.animationEnd(screen.getByRole('button', { name: 'Essay (cow)' }));

    expect(bridge.finishTask).toHaveBeenCalledWith(active, NOW);
    expect(await screen.findByRole('button', { name: 'Essay' })).toBeInTheDocument(); // new cloud
    expect(screen.getByRole('button', { name: 'Home' })).toBeEnabled();
    await waitFor(() => {
      const saved = lastSaved(bridge);
      expect(saved?.activeTasks).toEqual([]);
      expect(saved?.completedTasks).toEqual([finished]);
      expect(saved?.plants.school).toEqual({ category: 'school', totalMinutes: 12 });
    });
  });

  it('shows an alert if the task could not be analyzed', async () => {
    const user = userEvent.setup();
    const active = makeActiveTask({ name: 'Essay', animal: 'cow' });
    const bridge = fakeBridge(makeState({ route: 'task', activeTasks: [active] }));
    bridge.finishTask.mockRejectedValueOnce(new Error('ActivityWatch is not running'));
    renderApp(bridge);

    await user.click(await screen.findByRole('button', { name: 'Essay (cow)' }));
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    fireEvent.animationEnd(screen.getByRole('button', { name: 'Essay (cow)' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ActivityWatch is not running/);
  });
});
