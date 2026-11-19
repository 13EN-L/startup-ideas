// Issue #19/#20: sky window with the task form (top 2/3), recent-task clouds,
// animal pen (bottom 1/3) and the Home sign.
import { useState } from 'react';
import { canStartTask, type StartTaskInput } from '../../core/tasks';
import type { ActiveTask, CompletedTask } from '../../shared/types';
import { AnimalPen } from '../components/AnimalPen';
import { Clouds } from '../components/Clouds';
import { HomeButton } from '../components/HomeButton';
import { TaskForm } from '../components/TaskForm';
import { TaskResultPopup } from '../components/TaskResultPopup';

export interface TaskPageProps {
  activeTasks: ActiveTask[];
  recentTasks: CompletedTask[];
  now: number;
  /** Result popup to show on arrival (set when a Main page cloud was clicked). */
  initialResultTaskId?: string;
  onStartTask: (input: StartTaskInput) => void;
  onStopTask: (taskId: string, endedAt: number) => void;
  onNavigateHome: () => void;
}

export function TaskPage({
  activeTasks,
  recentTasks,
  now,
  initialResultTaskId,
  onStartTask,
  onStopTask,
  onNavigateHome,
}: TaskPageProps) {
  const [resultTaskId, setResultTaskId] = useState(initialResultTaskId);
  const resultTask = recentTasks.find((t) => t.id === resultTaskId);

  return (
    <div className="page page--task">
      <section className="sky sky--task">
        <Clouds tasks={recentTasks} onSelect={setResultTaskId} />
        <div className="window">
          <TaskForm disabled={!canStartTask(activeTasks)} onStart={onStartTask} />
        </div>
        <HomeButton activeTasks={activeTasks} onClick={onNavigateHome} />
      </section>

      <AnimalPen activeTasks={activeTasks} now={now} onStopTask={onStopTask} />

      {resultTask && <TaskResultPopup task={resultTask} onClose={() => setResultTaskId(undefined)} />}
    </div>
  );
}
