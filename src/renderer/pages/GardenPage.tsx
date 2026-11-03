// Issue #18: decorative conveyor-belt clouds (top 1/3), grass with category
// plots (bottom 2/3), trophies and global prestige under the logo. Clicking a
// plot lists that category's completed tasks; clicking one shows its results.
import { useEffect, useState } from 'react';
import {
  earnedTrophies,
  getPlantGrowth,
  globalPrestige,
  plantScale,
  plotRows,
  visiblePlots,
  type Plants,
} from '../../core/growth';
import { tasksInCategory } from '../../core/persistence';
import { CATEGORIES } from '../../shared/constants';
import type { CategoryId, CompletedTask, Trophy } from '../../shared/types';
import { plantImage, trophyImage } from '../assets';
import { DecorativeClouds } from '../components/Clouds';
import { HomeButton } from '../components/HomeButton';
import { PlantTasksPopup } from '../components/PlantTasksPopup';
import { TaskResultPopup } from '../components/TaskResultPopup';

export interface GardenPageProps {
  plants: Plants;
  /** Every completed task, in any order. */
  completedTasks: CompletedTask[];
  /** Reads assets/plants/<plant>/about.txt; resolves null when there is none. */
  loadPlantAbout: (category: CategoryId) => Promise<string | null>;
  onNavigateHome: () => void;
}

const TROPHY_LABELS: Record<Trophy, string> = {
  bronze: 'Bronze trophy',
  silver: 'Silver trophy',
  gold: 'Gold trophy',
};

export function GardenPage({ plants, completedTasks, loadPlantAbout, onNavigateHome }: GardenPageProps) {
  const [openCategory, setOpenCategory] = useState<CategoryId>();
  const [resultTaskId, setResultTaskId] = useState<string>();
  const [about, setAbout] = useState<{ category: CategoryId; text: string | null }>();

  useEffect(() => {
    if (!openCategory) return;
    let cancelled = false;
    loadPlantAbout(openCategory)
      // A missing description just leaves the popup without one.
      .catch(() => null)
      .then((text) => {
        if (!cancelled) setAbout({ category: openCategory, text });
      });
    return () => {
      cancelled = true;
    };
  }, [openCategory, loadPlantAbout]);

  const prestige = globalPrestige(plants);
  const rows = plotRows(visiblePlots(plants));
  const categoryTasks = openCategory ? tasksInCategory(completedTasks, openCategory) : [];
  const resultTask = categoryTasks.find((t) => t.id === resultTaskId);

  return (
    <div className="page page--garden">
      <section className="sky sky--garden">
        <div className="garden-logo">
          <h1 className="logo">FocusGarden</h1>
          <div className="trophies">
            {earnedTrophies(prestige).map((trophy) => (
              <img key={trophy} className={`trophy trophy--${trophy}`} src={trophyImage(trophy)} alt={TROPHY_LABELS[trophy]} />
            ))}
          </div>
          <p className="garden-logo__prestige">Total prestige: {prestige}</p>
        </div>
        <DecorativeClouds />
        <HomeButton activeTasks={[]} onClick={onNavigateHome} />
      </section>

      <section className="grass" aria-label="Garden">
        {rows.length === 0 && <p className="grass__empty">Complete a task to plant your first seed.</p>}
        {rows.map((row, index) => (
          <div key={index} className={`plot-row plot-row--of-${rows.length}`} data-testid={`plot-row-${index}`}>
            {row.map((category) => (
              <Plot
                key={category}
                category={category}
                totalMinutes={plants[category]!.totalMinutes}
                onOpen={() => setOpenCategory(category)}
              />
            ))}
          </div>
        ))}
      </section>

      {openCategory && (
        <PlantTasksPopup
          category={openCategory}
          totalMinutes={plants[openCategory]?.totalMinutes ?? 0}
          about={about?.category === openCategory ? about.text : undefined}
          tasks={categoryTasks}
          onSelectTask={setResultTaskId}
          onClose={() => {
            setOpenCategory(undefined);
            setResultTaskId(undefined);
          }}
          active={!resultTask}
        />
      )}
      {resultTask && <TaskResultPopup task={resultTask} onClose={() => setResultTaskId(undefined)} />}
    </div>
  );
}

function Plot({ category, totalMinutes, onOpen }: { category: CategoryId; totalMinutes: number; onOpen: () => void }) {
  const growth = getPlantGrowth(totalMinutes);
  const plant = CATEGORIES.find((c) => c.id === category)!;
  return (
    <div className="plot" data-testid={`plot-${category}`}>
      <img
        className="plot__plant"
        src={plantImage(category, growth.stage)}
        alt={`${plant.plantLabel}, stage ${growth.stage}`}
        style={{ transform: `scale(${plantScale(growth)})` }}
      />
      <span className="plot__label">{plant.label}</span>
      {growth.prestige > 0 && <span className="plot__prestige">Prestige {growth.prestige}</span>}
      {/* Covers the whole plot so the plant, label and dirt are all clickable. */}
      <button type="button" className="plot__open" aria-label={`${plant.plantLabel}: ${plant.label} tasks`} onClick={onOpen} />
    </div>
  );
}
