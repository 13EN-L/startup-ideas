// Deterministic stand-in for ActivityWatch + Claude, used by the e2e suite
// (FOCUSGARDEN_FAKE_SERVICES=1) so it runs without either service.
import type { ActiveTask, CompletedTask } from '../shared/types';

export function fakeProcessCompletedTask(task: ActiveTask, endedAt: number): CompletedTask {
  const total = Math.max(0, Math.round((endedAt - task.startedAt) / 1000));
  const code = Math.round(total * 0.5);
  const search = Math.round(total * 0.2);
  const unproductive = Math.round(total * 0.2);
  return {
    id: task.id,
    name: task.name,
    category: task.category,
    startedAt: task.startedAt,
    endedAt,
    metrics: {
      productiveSeconds: code + search,
      unproductiveSeconds: unproductive,
      idleSeconds: total - code - search - unproductive,
    },
    activities: [
      { id: 'app:Code', name: 'Code', source: 'app', seconds: code, status: 'on-task' },
      {
        id: `search:Google search: ${task.name}`,
        name: `Google search: ${task.name}`,
        source: 'search',
        seconds: search,
        status: 'on-task',
      },
      { id: 'web:youtube.com', name: 'youtube.com', source: 'web', seconds: unproductive, status: 'off-task' },
    ],
  };
}
